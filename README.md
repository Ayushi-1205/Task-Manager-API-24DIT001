# Task Manager API & Full-Stack Application

A robust full-stack task management application developed for Advanced Web Development Frameworks (AWDF).

---

## Practical 11: Containerization with Docker and Docker Compose

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v20+ with Docker Compose v2+)
- WSL 2 backend (on Windows)
- Verify installation:
  ```bash
  docker --version
  docker compose version
  ```

---

### 2. Multi-Container Architecture
The application is composed of three interconnected services defined in `docker-compose.yml`:

```
                 Host Browser
                /            \
       :5173   /              \   :5000
              ▼                ▼
     ┌────────────────┐   ┌────────────────┐
     │    frontend    │   │    backend     │
     │  (Vite Preview)│──▶│(Express + JWT) │
     └────────────────┘   └───────┬────────┘
                                  │
                       :27017     │ Service Discovery
                    (Docker Net)  ▼
                         ┌────────────────┐
                         │    mongodb     │
                         │ (Official Mongo│
                         └───────┬────────┘
                                 │
                            Named Volume
                       (awdf_mongodb_data)
```

- **`frontend`**: React single-page application built via multi-stage Dockerfile and served using Vite preview on port `5173`.
- **`backend`**: Node.js/Express REST API containerized with Dockerfile on port `5000`, supporting JWT auth, caching, and event-driven architecture.
- **`mongodb`**: Official MongoDB image (`mongo:latest`) running with database persistence on named volume `mongodb_data`.
- **Network**: All containers communicate seamlessly over an isolated bridge network (`task-network`).

---

### 3. Container-to-Container Communication
Inside the Docker Compose bridge network, Docker automatically provisions an internal DNS service.
- The backend container connects to MongoDB using the service name:
  ```
  MONGO_URI=mongodb://mongodb:27017/taskmanager
  ```
- **Important**: The backend container must **NOT** connect to `localhost` or `127.0.0.1` for MongoDB, as `localhost` inside a container resolves to that container itself, not the MongoDB container.
- The frontend (running in the client browser on the host machine) interacts with the backend through the published host port: `http://localhost:5000`.

---

### 4. Database Persistence with Named Volumes
A Docker named volume `mongodb_data` is mounted to MongoDB's data directory (`/data/db`):
- All database documents, collections, and indexes persist across container lifecycles.
- Executing `docker compose down` stops and destroys containers while preserving the volume.
- Restarting via `docker compose up -d` mounts the same volume, restoring all existing data.
- *(Note: Running `docker compose down -v` deletes named volumes and will wipe all database data).*

---

### 5. Quick Start Commands

#### Start the Full Stack (Build and Run)
```bash
docker compose up -d --build
```

#### Access Points
- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API Root**: [http://localhost:5000](http://localhost:5000)
- **Cache Debug Stats**: [http://localhost:5000/debug/cache](http://localhost:5000/debug/cache)

#### Inspect Container Status
```bash
docker compose ps
```

#### View Live Service Logs
```bash
# View backend logs (including MongoDB connection and Practical 10 events)
docker compose logs -f backend

# View frontend logs
docker compose logs -f frontend

# View MongoDB logs
docker compose logs -f mongodb
```

#### Stop Containers (Preserving Data Volume)
```bash
docker compose down
```

---

## Previous Practicals Implemented in this Codebase

- **Practical 4 & 5**: Express REST API and MongoDB/Mongoose CRUD operations.
- **Practical 6**: Middleware pipeline (JSON parsing, CORS, logging, validation).
- **Practical 7**: JWT authentication, bcrypt password hashing, protected `/tasks` routes, and `/auth/me`.
- **Practical 8**: Frontend route-based lazy loading, Suspense, and chunk optimization.
- **Practical 9**: In-memory caching with `node-cache`, cache invalidation on write, `/debug/cache`, and `.lean()` query optimization.
- **Practical 10**: Asynchronous event-driven architecture using Node.js `EventEmitter` for background notification processing with zero HTTP latency overhead.
- **Practical 11**: Containerization with multi-stage Dockerfiles and Docker Compose orchestration.
