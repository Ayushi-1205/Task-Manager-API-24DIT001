# Practical 9: In-Memory Caching and Query Optimization

## 1. Overview & Architecture

Practical 9 implements server-side in-memory caching for the Node.js / Express / MongoDB Task Manager API using `node-cache` and optimizes database reads using Mongoose `.lean()`.

### Cache Key Structure
- **All Tasks List:** `tasks:all`
- **Single Task Lookup:** `task:<id>` (e.g. `task:65f1e8a9...`)

### Key Components
- `config/cache.js`: Singleton `NodeCache` instance (`stdTTL: 60`, `checkperiod: 120`), stats tracking (`allTasks`, `singleTask`), and cache helper functions.
- `server.js`: Standard CRUD routes with cache HIT/MISS handling, Mongoose `.lean()` query optimizations, write invalidations, and `/debug/cache` endpoints.

---

## 2. API Endpoints & Caching Behavior

### Read Operations
1. `GET /tasks`:
   - **Cache Key:** `tasks:all`
   - **Flow:**
     - Check `cache.get("tasks:all")`.
     - **CACHE HIT:** Increments `hits` counter, returns cached JSON response immediately without querying MongoDB. (`cache -> response`)
     - **CACHE MISS:** Increments `misses` counter, executes optimized `Task.find().lean()`, stores result in cache (`stdTTL: 60s`), returns JSON response. (`MongoDB -> cache -> response`)

2. `GET /tasks/:id`:
   - **Cache Key:** `task:<id>`
   - **Flow:**
     - Check `cache.get("task:<id>")`.
     - **CACHE HIT:** Increments `hits` counter, returns cached task immediately.
     - **CACHE MISS:** Increments `misses` counter, executes `Task.findById(id).lean()`. If found, stores in cache and returns.

### Write Operations & Cache Invalidation
1. `POST /tasks`:
   - After successful MongoDB creation: calls `cache.del("tasks:all")`.
   - Ensures the next `GET /tasks` request fetches fresh data from MongoDB.

2. `PUT /tasks/:id`:
   - After successful MongoDB update: calls `cache.del("tasks:all")` AND `cache.del("task:<id>")`.
   - Prevents stale data in both list view and individual item detail lookup.

3. `DELETE /tasks/:id`:
   - After successful MongoDB deletion: calls `cache.del("tasks:all")` AND `cache.del("task:<id>")`.

### Debug & Monitoring Endpoints
- `GET /debug/cache`: Returns current hit/miss statistics, active key counts, and TTL configuration.
- `DELETE /debug/cache`: Flushes all cached keys and resets hit/miss statistics (useful during testing/experiments).

---

## 3. Query Optimization (.lean())

By default, Mongoose queries (`Task.find()`) construct heavy Mongoose Document instances complete with change tracking, internal getters/setters, and schema validation methods.

For read-only API responses, chaining `.lean()` (`Task.find().lean()` and `Task.findById(id).lean()`) instructs Mongoose to skip document hydration and return plain JavaScript objects directly. This significantly reduces CPU overhead, memory footprint, and garbage collection pressure.

---

## 4. Supplementary Conceptual Answers

### Q1: Why must the cache be invalidated after every write operation?
**Answer:** A write operation (`POST`, `PUT`, `DELETE`) alters the underlying source of truth in the database. If the cache is not invalidated immediately after a write, subsequent `GET` requests will continue serving outdated data from memory until the cache TTL expires. Invalidating the cache guarantees data consistency between the API and database.

### Q2: What happens if we forget to invalidate it?
**Answer:** Forgetting cache invalidation leads to **stale data bugs**. For instance, if a user deletes or updates a task, but the cache is not cleared, `GET /tasks` will return the deleted or old task until TTL expiration. The user interface will reflect incorrect state even though the database write succeeded.

### Q3: What is a reasonable TTL for task data and why?
**Answer:** A TTL of **30 to 60 seconds** is reasonable for interactive task management data. It balances performance gain with data freshness. A very long TTL (e.g., 24 hours) risks serving stale data if external updates occur, while a very short TTL (e.g., 2 seconds) reduces cache hit ratio. 60 seconds provides significant load reduction for high-traffic read operations while remaining responsive.

### Q4: Why is node-cache / process-local in-memory caching unsuitable by itself for a multi-server deployment?
**Answer:** `node-cache` stores cached data inside the heap memory of a single Node.js process. In a multi-server or clustered deployment (e.g., PM2 cluster or load-balanced container instances), each instance maintains its own isolated memory cache. If Instance A processes a `PUT /tasks/:id` and invalidates its local cache, Instance B's cache remains untouched and will continue serving stale data. Distributed caching solutions like **Redis** or **Memcached** are required for multi-server synchronization.

### Q5: What happens when the server restarts?
**Answer:** Process-local memory is completely cleared when the Node.js process terminates or restarts. The cache starts completely empty (0 keys, reset counters). The first subsequent `GET` request to each endpoint will be a **CACHE MISS** and will re-populate the cache from MongoDB.

### Q6: Why can caching improve response time?
**Answer:** Fetching data from RAM (in-memory `node-cache`) requires near-zero I/O overhead (microsecond-level latency). In contrast, querying MongoDB requires network I/O, query parsing, index lookup, disk/RAM reads, and BSON-to-JSON serialization. Skipping the database round-trip drastically cuts latency.

### Q7: Why might response time barely change if MongoDB is already very fast?
**Answer:** When testing locally (`127.0.0.1`) with a tiny dataset (e.g., 5 documents), MongoDB queries complete in a few milliseconds. Network latency is negligible, so the absolute time difference between 2ms (MongoDB) and 0.5ms (`node-cache`) may seem small. However, under high concurrency or remote database connections across the internet, the performance improvement becomes dramatic.

### Q8: Why are at least 3 repeated measurements better than one measurement?
**Answer:** A single measurement can be biased by transient OS background activity, CPU throttling, garbage collection pauses, or initial TCP handshake delays. Averaging at least 3 consecutive measurements provides a reliable, statistically sound benchmark of API performance.

### Q9: Definitions of key caching terms:
- **Cache Hit:** The requested data key is found in memory, returning the cached payload directly without accessing the database.
- **Cache Miss:** The requested key is not in memory (either never cached or expired), requiring a database query and subsequent cache population.
- **Cache Invalidation:** Explicitly removing specified keys from the cache immediately following a database mutation (`POST`, `PUT`, `DELETE`).
- **Cache Expiration:** Automatic eviction of cached keys after their Time-To-Live (TTL) duration has elapsed.

---

## 5. TTL Experimentation Analysis

| Configured TTL | Database Load | Data Freshness | Observed Behavior |
|---|---|---|---|
| **10 Seconds** | Higher | Very High | Cache entries expire quickly. Frequently results in cache misses, keeping data fresh but querying MongoDB more often. |
| **30 Seconds** | Moderate | High | Good balance for active multi-user applications with frequent updates. |
| **60 Seconds** (Default) | Lowest | High (with invalidation) | Maximum cache hits for read-heavy workloads. Write invalidation keeps data 100% fresh upon user edits. |

---

## 6. Response Time Experiment Template (For Postman / Thunder Client)

Use the table below when performing response time measurements in Postman:

| Endpoint | Attempt 1 | Attempt 2 | Attempt 3 | Average Response Time | Cache Status |
|---|---:|---:|---:|---:|---|
| `GET /tasks` (First call after clear) | *[actual ms]* | — | — | *[actual ms]* | **CACHE MISS** |
| `GET /tasks` (Second call) | *[actual ms]* | *[actual ms]* | *[actual ms]* | *[actual ms]* | **CACHE HIT** |
| `GET /tasks/:id` (First call) | *[actual ms]* | — | — | *[actual ms]* | **CACHE MISS** |
| `GET /tasks/:id` (Second call) | *[actual ms]* | *[actual ms]* | *[actual ms]* | *[actual ms]* | **CACHE HIT** |
