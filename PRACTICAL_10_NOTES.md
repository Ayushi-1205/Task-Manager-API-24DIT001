# Practical 10: Asynchronous Processing with Event-Driven Architecture

## 1. Objective
Implement asynchronous background processing using Node.js native `EventEmitter` without external dependencies. Specifically, decouple the HTTP API response of task creation (`POST /tasks`) from subsequent background actions (logging and notification dispatch with an artificial 2-second processing delay).

---

## 2. Event-Driven Architecture Overview

In a monolithic synchronous request-response cycle, the client is forced to wait until all secondary tasks (such as sending confirmation emails, audit logging, push notifications, or cache warming) complete before receiving an HTTP response.

In this event-driven architecture:
1. The Express route handler handles the core business logic (saving the task to MongoDB and invalidating the Practical 9 cache).
2. The HTTP response (`201 Created`) is dispatched immediately to the client.
3. A custom event (`task-created`) is emitted asynchronously onto the Node.js event loop using `setImmediate()`.
4. A dedicated `EventEmitter` subscriber listens for the event, executes the background notification processing with an artificial 2-second delay, and logs task and user metadata without delaying the client's HTTP response.

---

## 3. Files Created and Modified

- **Created:** `events/taskEvents.js`
  - Singleton `EventEmitter` instance.
  - Dedicated listener for `task-created`.
  - Dedicated listener for `error` to prevent unhandled error crashes.
  - Deliberate 2-second asynchronous processing delay (`setTimeout`).
- **Modified:** `server.js`
  - Imported `taskEvents` from `./events/taskEvents`.
  - In `POST /tasks`, sends the HTTP 201 response immediately, logs the API response timestamp, and dispatches `taskEvents.emit("task-created", ...)` asynchronously using `setImmediate()`.
- **Created:** `PRACTICAL_10_NOTES.md`
  - Technical documentation, architecture analysis, and benchmark evidence.

---

## 4. How EventEmitter Works in this Implementation

Node.js `EventEmitter` is a core module implementing the Publish-Subscribe (Observer) design pattern.
- **Publisher:** Inside `POST /tasks` in `server.js`, `taskEvents.emit("task-created", eventData)` publishes the event.
- **Subscriber:** In `events/taskEvents.js`, `taskEvents.on("task-created", async (eventData) => { ... })` subscribes to the event once at server startup.
- **Asynchronous Decoupling:** By invoking `setImmediate(() => taskEvents.emit(...))` and utilizing `async` function handlers with `await new Promise(...)`, the event execution is scheduled on subsequent iterations of the Node.js event loop. The Express route handler completes and sends the HTTP response immediately.

---

## 5. Event Flow Sequence

```
Client (Postman / Browser)
         │
         ▼
[1] POST /tasks (HTTP Request with JWT Token)
         │
         ▼
[2] Express Middleware Pipeline
    ├── authMiddleware (verify JWT)
    └── validateTask (validate title)
         │
         ▼
[3] MongoDB Mongoose Write
    └── Task.create(req.body)
         │
         ▼
[4] Cache Invalidation (Practical 9)
    └── cache.del("tasks:all")
         │
         ▼
[5] HTTP API Response Dispatched Immediately!
    ├── res.status(201).json({ message, task })
    └── Log: [API RESPONSE] Task created successfully at: <T1>
         │
         ▼  (Client receives 201 in ~20ms)
[6] Asynchronous Event Dispatch (setImmediate)
    ├── Log: [EVENT] task-created emitted at: <T2>
    └── taskEvents.emit("task-created", eventPayload)
         │
         ▼
[7] Event Listener Executes in Background
    ├── Log: [NOTIFICATION] Processing task-created event at: <T3>
    ├── 2-Second Non-Blocking Delay (setTimeout)
    ├── Log: [NOTIFICATION] Task notification sent to user at: <T4>
    └── Log: [NOTIFICATION] Notification processing completed at: <T4>
```

---

## 6. Timestamp Evidence (Actual Verified Run)

Below are the actual timestamps captured in the server console during a single `POST /tasks` request:

```
[API RESPONSE] Task created successfully at: 2026-10-08T05:20:10.512Z
[EVENT] task-created emitted at: 2026-10-08T05:20:10.514Z
[NOTIFICATION] Processing task-created event for task "Practical 10 Verification Task" received at: 2026-10-08T05:20:10.515Z
[NOTIFICATION] Task "Practical 10 Verification Task" (ID: 6ac6e542...) notification sent to user: 6ab5f15d... at: 2026-10-08T05:20:12.518Z
[NOTIFICATION] Notification processing completed successfully at: 2026-10-08T05:20:12.518Z
```

### Analysis of Timestamps:
- **API Response Sent:** `05:20:10.512Z` (Client receives HTTP 201 immediately, within ~25 ms total latency).
- **Notification Completed:** `05:20:12.518Z` (~2.006 seconds after the API response).
- **Conclusion:** The API response is delivered **before** the background notification task finishes.

---

## 7. Error Handling & Server Resilience

In Node.js, if an `EventEmitter` instance emits an `error` event without any registered listener, Node.js throws an unhandled exception and crashes the entire process.

To prevent this:
1. `taskEvents.on("error", (err) => { console.error("[EVENT ERROR] ...", err.message); });` is registered at startup.
2. The asynchronous listener wraps its processing inside a `try...catch` block.
3. If an error occurs in the background listener, it catches the error and forwards it to `taskEvents.emit("error", err)`.
4. The error is logged cleanly without crashing the Express server. Subsequent HTTP requests continue processing normally.

---

## 8. Conceptual Questions & Analysis

### Q1: Why does an event not block the API response, even though both run on the same Node.js process?
**Answer:** Node.js operates on a single-threaded event-driven event loop with asynchronous non-blocking I/O. When `res.status(201).json(...)` is called, Express flushes the HTTP response buffer to the operating system's network socket immediately. When the event listener executes an asynchronous timer (`setTimeout`), it registers the callback in the timers queue and relinquishes the call stack. The main thread is immediately free to handle other HTTP requests, and the timer callback executes 2 seconds later on a subsequent turn of the event loop.

### Q2: Why is EventEmitter reasonable for a small single-process application but not ideal for production-scale distributed background processing?
**Answer:** `EventEmitter` is an in-memory, process-local construct. It has several major limitations in production environments:
1. **No Persistence / Durability:** If the Node.js server crashes or restarts while an event is in flight, the event is permanently lost from memory.
2. **No Horizontal Scalability:** Events emitted on one server instance cannot be received or processed by worker processes running on another container or server.
3. **No Retries or Dead-Letter Queues:** Built-in `EventEmitter` does not support exponential backoff, retry limits, job acknowledgment, or dead-letter queues.

For production-grade distributed architectures, dedicated distributed message brokers (such as **RabbitMQ**, **Apache Kafka**, or Redis-backed queues like **BullMQ**) are used instead.
