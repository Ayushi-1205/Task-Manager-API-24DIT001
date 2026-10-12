# Practical 12: CI/CD Pipeline with GitHub Actions

## 1. Objective
Establish a continuous integration (CI) pipeline using GitHub Actions for the Task Manager API. The pipeline automatically installs dependencies, provisions an isolated MongoDB service container, executes automated integration tests using Jest and Supertest on every push to the `main` branch, and reports clear pass/fail status directly in the repository's GitHub Actions tab.

- **Course**: Advanced Web Development Frameworks (AWDF)
- **CO / PO Mapping**: CO5 / PO3, PO5

---

## 2. CI/CD Architecture & Workflow Pipeline

The continuous integration pipeline is defined in `.github/workflows/ci.yml`:

```
                 git push origin main
                          │
                          ▼
             GitHub Actions Event Trigger
           (push to main / workflow_dispatch)
                          │
                          ▼
           Ubuntu Runner (ubuntu-latest)
       ┌──────────────────────────────────────┐
       │      Services: MongoDB 7+            │
       │      Port: 27017 (Health-Checked)    │
       │                                      │
       │  Step 1: Checkout Repository         │
       │          actions/checkout@v4         │
       │                                      │
       │  Step 2: Set up Node.js 20           │
       │          actions/setup-node@v4       │
       │          (with npm caching)          │
       │                                      │
       │  Step 3: Install Dependencies        │
       │          npm ci                      │
       │                                      │
       │  Step 4: Run Automated Tests         │
       │          npm test                    │
       │          (Jest --runInBand)          │
       └──────────────────┬───────────────────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      All Tests Pass             Any Test Fails
     (Exit Code: 0)            (Exit Code: non-zero)
             │                         │
             ▼                         ▼
     Status: SUCCESS            Status: FAILURE
    (Green Checkmark)             (Red Cross)
```

---

## 3. Automated Test Suite Implementation

The test suite is implemented in `tests/api.test.js` using **Jest** and **Supertest**. It verifies that newly added code maintains backwards compatibility with all previously implemented practicals:

### 3.1 Test Cases Implemented

1. **Health Check (`GET /`)**:
   - Asserts that the root endpoint returns HTTP 200 with message `"Task Manager API is Running..."`.
2. **In-Memory Cache Debug (`GET /debug/cache`)** *(Practical 9)*:
   - Asserts HTTP 200 and validates the response schema containing `hits`, `misses`, `keys`, and `ttlSeconds`.
3. **Authentication Middleware Security (`GET /tasks` & `POST /tasks`)** *(Practical 7)*:
   - Asserts HTTP 401 Unauthorized when no Authorization header is provided.
   - Validates error message: `"Missing or malformed Authorization header"`.
4. **Validation Middleware (`POST /tasks`)** *(Practical 6 & 7)*:
   - Asserts HTTP 400 Bad Request when task title is missing or empty.
   - Validates error message: `"Title is required and must be a non-empty string"`.
5. **Authenticated Task Fetch (`GET /tasks`)** *(Practical 4, 7, 9, 12)*:
   - Generates a valid signed JWT using `jsonwebtoken`.
   - Sends `Authorization: Bearer <token>`.
   - Asserts HTTP 200 OK and returns an array of tasks.
6. **Task Creation & Cache Invalidation (`POST /tasks`)** *(Practical 4, 9, 10)*:
   - Sends valid task payload with JWT authentication.
   - Asserts HTTP 201 Created and validates returned task properties (`title`, `_id`).
   - Awaits Practical 10 background asynchronous notification dispatch (2-second simulated delay) to guarantee clean test completion without open handles.

---

## 4. GitHub Actions Workflow Configuration

File: `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    env:
      NODE_ENV: test
      PORT: 5000
      MONGO_URI: mongodb://127.0.0.1:27017/taskmanager_ci
      JWT_SECRET: ci_test_jwt_secret_key_2026
      CACHE_TTL: 60

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run automated tests
        run: npm test
```

### Key Workflow Features:
- **Service Container**: Automatically starts an isolated MongoDB container on the runner, health-checked with `mongosh`, preventing dependency on external database servers.
- **Strict Dependency Locking**: Uses `npm ci` rather than `npm install` for deterministic, reliable builds matching `package-lock.json`.
- **Environment Isolation**: Injects test-specific environment variables (`NODE_ENV: test`, `PORT: 5000`, `CACHE_TTL: 60`).

---

## 5. Deliberate Failure Verification

Per the practical requirement, the test pipeline was tested with both passing and failing assertions to confirm failure detection:

1. **Deliberate Failure Test**:
   - Temporarily modified `expect(response.statusCode).toBe(200)` to `expect(response.statusCode).toBe(500)`.
   - Result: Jest halted with exit code `1`:
     ```
     FAIL tests/api.test.js
       ● Task Manager API › GET / returns 200 and running message
         Expected: 500
         Received: 200
     Tests: 1 failed, 6 passed, 7 total
     ```
   - Confirmed that test failures produce non-zero exit codes that fail the CI pipeline.
2. **Restored Passing Test**:
   - Restored assertion back to `expect(response.statusCode).toBe(200)`.
   - Result: All 7 test cases passed with exit code `0`:
     ```
     PASS tests/api.test.js
     Test Suites: 1 passed, 1 total
     Tests:       7 passed, 7 total
     Time:        4.721 s
     ```

---

## 6. Preservation of Previous Practicals

| Practical | Feature | Status in Practical 12 |
|---|---|---|
| **Practical 4 & 5** | Express REST API & MongoDB CRUD | Fully preserved; verified in automated tests |
| **Practical 6** | Validation & Error Handling Middleware | Fully preserved; 400 validation tested |
| **Practical 7** | JWT Auth, bcrypt, protected routes, `/auth/me` | Fully preserved; 401 unauthorized tested |
| **Practical 8** | React lazy loading, Suspense, code splitting | Fully preserved in frontend |
| **Practical 9** | `node-cache`, cache invalidation, `/debug/cache` | Fully preserved; cache debug endpoint tested |
| **Practical 10** | `EventEmitter`, async notifications, error handling | Fully preserved; background event lifecycle tested |
| **Practical 11** | Dockerfiles, Docker Compose, named volume | Fully preserved; server works both in Docker and CI |

---

## 7. Submission Screenshots Guide

Capture the following evidence for your submission:

1. **Local Test Execution (All Passing)**:
   - Command: `npm test`
   - Shows: `PASS tests/api.test.js`, 7 passed, exit code 0.
2. **Local Test Execution (Deliberate Failure)**:
   - Shows: `FAIL tests/api.test.js`, 1 failed, exit code 1.
3. **Workflow File (`.github/workflows/ci.yml`)**:
   - Visual of the YAML file structure in VS Code.
4. **GitHub Actions Tab**:
   - In your browser at `https://github.com/Ayushi-1205/Task-Manager-API-24DIT001/actions`
   - Shows: `CI Pipeline` workflow run with green checkmark (Pass).
5. **GitHub Actions Job Details**:
   - Clicking into the `Build and Test` job showing successful execution of:
     - Set up job
     - Checkout repository
     - Set up Node.js
     - Install dependencies (`npm ci`)
     - Run automated tests (`npm test`)
