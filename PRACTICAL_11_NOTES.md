# Practical 11: Containerization with Docker and Docker Compose

## 1. Objective
Containerize the full-stack Task Manager application using Docker and orchestrate all constituent services (`frontend`, `backend`, and `mongodb`) using Docker Compose. Ensure reliable container-to-container service discovery, data persistence across container restarts using a named volume, and maintain seamless compatibility with all features from Practicals 1 through 10.

- **Course**: Advanced Web Development Frameworks (AWDF)
- **CO / PO Mapping**: CO5 / PO3, PO5

---

## 2. Multi-Container System Architecture

The application comprises three distinct micro-services running in isolated Linux containers on a shared bridge network:

```
                        Host Machine / Web Browser
                         (http://localhost:5173)
                                  │
                                  │ (HTTP API Requests)
                                  ▼
               ┌──────────────────────────────────────┐
               │         Docker Bridge Network         │
               │            (task-network)            │
               │                                      │
               │   ┌──────────────────────────────┐   │
               │   │      frontend Container      │   │
               │   │   (React 19 + Vite Preview)  │   │
               │   │      Exposed Port: 5173      │   │
               │   └──────────────┬───────────────┘   │
               │                  │                   │
               │                  │                   │
               │                  ▼                   │
               │   ┌──────────────────────────────┐   │
               │   │      backend Container       │   │
               │   │   (Node 20 + Express API)    │   │
               │   │      Exposed Port: 5000      │   │
               │   └──────────────┬───────────────┘   │
               │                  │                   │
               │                  │ Internal DNS      │
               │                  │ mongodb:27017     │
               │                  ▼                   │
               │   ┌──────────────────────────────┐   │
               │   │      mongodb Container       │   │
               │   │      (Official MongoDB)      │   │
               │   │      Internal Port: 27017    │   │
               │   └──────────────┬───────────────┘   │
               └──────────────────┼───────────────────┘
                                  │
                                  ▼
                     Docker Named Volume: mongodb_data
                     Mount Path: /data/db
```

---

## 3. Dockerfiles Implementation

### 3.1 Backend Dockerfile (`task-manager-api/Dockerfile`)
The backend leverages an optimized `node:20-alpine` image to support Mongoose 9.x and ES features with minimal image footprint.
- **Layer Caching**: `package*.json` is copied first and `npm install` is executed before copying source code, ensuring dependency caching unless dependencies change.
- **Runtime Execution**: Directly executes `CMD ["node", "server.js"]`.
- **Security**: `.env` and `node_modules` are strictly excluded via `.dockerignore`.

```dockerfile
# Practical 11: Backend Dockerfile for Task Manager API
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production and application dependencies
RUN npm install

# Copy remaining backend source code
COPY . .

# Expose API port
EXPOSE 5000

# Start Express application
CMD ["node", "server.js"]
```

### 3.2 Frontend Multi-Stage Dockerfile (`student-portfolio/Dockerfile`)
A production-ready multi-stage build separates the build environment from the lean runtime container:
- **Stage 1 (Builder)**: Installs build dependencies (Vite, Rollup, PostCSS), compiles JSX, bundles JS/CSS assets, and executes `npm run build`.
- **Stage 2 (Runtime)**: Copies only the compiled `/dist` directory and Vite configuration into a fresh `node:20-alpine` image, serving the bundle via `vite preview` on port `5173`.
- **Benefits**: Reduces attack surface, isolates build tools, and minimizes image overhead.

```dockerfile
# Practical 11: Multi-stage Frontend Dockerfile
# Stage 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies needed for build
RUN npm install

# Copy frontend source code
COPY . .

# Build the React production bundle
RUN npm run build

# Stage 2: Production Preview Runtime Stage
FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies needed to serve preview
COPY package*.json ./
RUN npm install

# Copy built production assets and configuration from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/vite.config.js ./vite.config.js

# Expose frontend port
EXPOSE 5173

# Serve production build using Vite preview bound to all interfaces
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
```

### 3.3 `.dockerignore` Files
Both projects include `.dockerignore` to prevent copying local development artifacts, secret configuration files, and operating-system-specific binaries into the Docker build context:
- `node_modules` (prevents binary incompatibility and excessive image layer size)
- `.env` (prevents secret leakage inside immutable image layers)
- `.git` / `.gitignore` (excludes repository history)
- `dist` (ensures clean rebuild in frontend)
- `*.log` (excludes local debug logs)

---

## 4. Docker Compose Orchestration (`docker-compose.yml`)

The root `docker-compose.yml` configures all three services, network discovery, health monitoring, and data volumes:

```yaml
services:
  mongodb:
    image: mongo:latest
    container_name: task-manager-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - task-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  backend:
    build:
      context: ./task-manager-api
      dockerfile: Dockerfile
    container_name: task-manager-backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - MONGO_URI=mongodb://mongodb:27017/taskmanager
      - JWT_SECRET=taskmanager_super_secret_jwt_key_2026
      - CACHE_TTL=60
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - task-network

  frontend:
    build:
      context: "./STUDENT PORTFOLIO/student-portfolio"
      dockerfile: Dockerfile
    container_name: task-manager-frontend
    restart: always
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:5000
    depends_on:
      - backend
    networks:
      - task-network

volumes:
  mongodb_data:
    driver: local

networks:
  task-network:
    driver: bridge
```

---

## 5. Network Configuration and Service Discovery

1. **Docker Bridge Network (`task-network`)**: An isolated private software bridge where containers receive internal dynamic IP addresses (e.g., `172.20.0.x`).
2. **Internal DNS Service Discovery**: Docker registers the service names as hostnames within the network.
   - When `backend` performs DNS resolution for `mongodb`, Docker's embedded DNS server returns the internal IP of `task-manager-mongodb`.
   - The connection string passed via environment variables is:
     ```
     MONGO_URI=mongodb://mongodb:27017/taskmanager
     ```
3. **Healthcheck Synchronization**: The backend waits for MongoDB's ping command to return healthy before initializing, eliminating startup connection race conditions.

---

## 6. MongoDB Named Volume Persistence

- **Volume Name**: `mongodb_data` (mapped by Docker Compose to `awdf_mongodb_data`).
- **Target Directory**: Mounted to `/data/db` within the MongoDB container.
- **Persistence Verification**:
  - Tasks and users created inside the container were stored in `/data/db`.
  - Executing `docker compose down` stopped and destroyed all three containers (`task-manager-backend`, `task-manager-frontend`, and `task-manager-mongodb`).
  - Executing `docker compose up -d` re-created the containers and attached the existing `awdf_mongodb_data` volume.
  - A query to `GET /tasks` immediately returned the existing task with complete data intact.

---

## 7. Verification and Testing Results

| Test Category | Command / Endpoint | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **Docker Engine** | `docker version` | Docker Engine v29.6.2 running | Client 29.6.2, Engine 29.6.2 active | PASSED |
| **Compose Engine** | `docker compose version` | Docker Compose v2+ / v5+ | Docker Compose v5.3.1 active | PASSED |
| **Stack Build** | `docker compose up -d --build` | 3 images built, 3 containers started | All 3 built and started | PASSED |
| **Container Status** | `docker compose ps` | mongodb (healthy), backend (Up), frontend (Up) | All 3 running with port mappings | PASSED |
| **Frontend UI** | `GET http://localhost:5173` | React SPA index.html (200 OK) | 200 OK, JS bundle 235 kB loaded | PASSED |
| **Backend API** | `GET http://localhost:5000` | "Task Manager API is Running..." | 200 OK, message returned | PASSED |
| **JWT Register** | `POST /auth/register` | 201 Registration successful | 201 Created | PASSED |
| **JWT Login** | `POST /auth/login` | 200 OK, returns signed JWT token | 200 OK, JWT returned | PASSED |
| **Auth /me** | `GET /auth/me` | 200 OK, returns user profile | 200 OK, authenticated user | PASSED |
| **Task Creation** | `POST /tasks` | 201 Task Added Successfully | 201 Created, Task ID generated | PASSED |
| **Practical 10 Event** | `docker compose logs backend` | `[EVENT]` emitted & 2s delay async log | API response at 06:12:50Z, notification at 06:12:52Z | PASSED |
| **Practical 9 Cache** | `GET /tasks` & `/debug/cache` | 1st call MISS, 2nd call HIT | Hits: 3, Misses: 3, Keys: 2 | PASSED |
| **Cache Invalidation** | `PUT /tasks/:id` | 200 OK, all cache keys invalidated | Keys invalidated to 0 | PASSED |
| **Persistence Test** | `docker compose down` then `up` | Data survives container recreation | Task ID `6ac73462f0a1d61ba5b4d26d` preserved | PASSED |

---

## 8. Key Questions and Answers

### Q1: Why does the backend container need to reference MongoDB by service name (`mongodb`) rather than `localhost`?
**Answer**:
In Docker containerization, each container runs inside its own isolated network namespace with its own dedicated loopback interface (`localhost` / `127.0.0.1`). If the backend container attempts to connect to `mongodb://localhost:27017`, it is attempting to connect to port 27017 inside the backend container itself, where no database process exists. When containers join a user-defined Docker bridge network, Docker provides automatic embedded DNS service discovery. Referencing the service name `mongodb` instructs Docker to resolve the hostname to the internal virtual IP address of the MongoDB container.

### Q2: What is the difference between exposing a port in a Dockerfile and publishing/mapping a port in `docker-compose.yml`?
**Answer**:
- `EXPOSE` in a `Dockerfile` is informational metadata. It documents which ports the containerized service listens on and allows communication between containers on the same Docker network, but does **not** make the port accessible to the host machine or outside network.
- `ports` in `docker-compose.yml` (e.g., `"5000:5000"`) actively publishes and binds the port to the host operating system's network interfaces (NAT / port forwarding). This allows external clients (such as host web browsers, Thunder Client, and Postman) to communicate with the containerized application.

### Q3: Why is copying `node_modules` into a Docker image considered bad practice?
**Answer**:
Copying host `node_modules` into a Docker image is considered an anti-pattern for three primary reasons:
1. **Operating System and Architecture Incompatibility**: Dependencies with native C/C++ addons (e.g., `bcrypt`, native bindings) compiled on the host machine (e.g., Windows x64) will fail or crash inside the container's Linux environment (e.g., Alpine Linux musl libc).
2. **Bloated Build Context and Image Size**: Host `node_modules` directories often contain hundreds of megabytes of redundant dev tools and test files, dramatically slowing down `docker build` context transfer times.
3. **Cache Invalidation**: Any change to a local node module invalidates Docker's build layer cache, preventing Docker from reusing cached installation layers.

---

## 9. Troubleshooting and Technical Challenges Overcome

1. **Linux Filesystem Case Sensitivity**:
   - *Problem*: Windows NTFS is case-insensitive, so imports like `./pages/Home` resolved to `src/Pages/Home.jsx`. However, inside Linux Docker containers, ext4 is strictly case-sensitive, resulting in `UNRESOLVED_IMPORT` errors during `npm run build`.
   - *Solution*: Corrected imports in `src/App.jsx` and `src/Pages/Home.jsx` to accurately match directory and component casing (`./Pages/` and `Navbar.jsx`).
2. **MongoDB Connection String Flexibility**:
   - *Problem*: Hardcoded `mongodb://127.0.0.1:27017/taskmanager` in `config/db.js` caused container crashes when connecting across the Docker network.
   - *Solution*: Configured `const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskmanager";`, enabling seamless switching between Docker service discovery and local development.
3. **Database Readiness Race Condition**:
   - *Problem*: Backend starting immediately alongside MongoDB could attempt to connect before the `mongod` daemon initialized its network socket.
   - *Solution*: Configured Docker Compose `healthcheck` on MongoDB running `mongosh --eval "db.adminCommand('ping')"` and configured backend with `depends_on: mongodb: condition: service_healthy`.

---

## 10. Required Screenshots Guide for Submission

The student should capture the following screenshots from the terminal and browser:

1. **Docker and Docker Compose Version Check**:
   - Command: `docker --version` and `docker compose version`
   - Shows: Active Docker Engine 29.x and Compose v5.x.
2. **Docker Compose Up Build Output**:
   - Command: `docker compose up -d --build`
   - Shows: Multi-stage build completing and network/volume creation.
3. **Docker Compose Running Containers (`docker compose ps`)**:
   - Command: `docker compose ps`
   - Shows: `task-manager-frontend`, `task-manager-backend`, and `task-manager-mongodb` (healthy) with port mappings `5173`, `5000`, `27017`.
4. **Backend Container Logs with Service Discovery and MongoDB Connection**:
   - Command: `docker compose logs backend`
   - Shows: `Server is running on http://localhost:5000` and `MongoDB Connected Successfully`.
5. **Practical 10 Asynchronous Notification Logs**:
   - Command: `docker compose logs --tail 25 backend`
   - Shows: `[API RESPONSE]` immediate dispatch and `[NOTIFICATION]` executed 2 seconds later in the background.
6. **Frontend Running in Browser**:
   - URL: `http://localhost:5173`
   - Shows: React student portfolio and task manager interface.
7. **MongoDB Named Volume Inspection**:
   - Command: `docker volume ls` and `docker volume inspect awdf_mongodb_data`
   - Shows: Named volume mounted at `/data/db`.
8. **Data Persistence Evidence**:
   - Terminal showing `docker compose down`, followed by `docker compose up -d`, and `GET /tasks` returning existing persisted data.
9. **Docker Configuration Files**:
   - Visual of `docker-compose.yml`, `task-manager-api/Dockerfile`, and `student-portfolio/Dockerfile`.
