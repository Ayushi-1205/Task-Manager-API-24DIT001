# Practical 13: AI API Integration into a Web Application

## Overview
- **Practical**: Practical 13
- **Course**: Advanced Web Development Frameworks (AWDF)
- **Title**: AI API Integration into a Web Application
- **Backend Repository**: https://github.com/Ayushi-1205/Task-Manager-API-24DIT001
- **Frontend Repository**: https://github.com/Ayushi-1205/Portfolio-24DIT001
- **Technology Stack**: Node.js, Express, OpenAI SDK (`gpt-4o-mini`), React, Vite, Tailwind CSS, Jest, Supertest

---

## 1. Objectives
1. Integrate an external AI API (OpenAI) into the full-stack Task Management application.
2. Securely proxy AI requests through the Node.js/Express backend so API keys are never exposed to the client browser.
3. Design effective system and user prompts to generate concise, actionable task descriptions from task titles.
4. Implement resilient, non-blocking error handling and graceful fallbacks for missing keys, network timeouts, and rate limits.
5. Provide an intuitive frontend UX with loading indicators, error handling, and responsible AI disclosures.
6. Verify implementation with automated unit/integration tests running in the existing CI/CD pipeline.

---

## 2. Architecture & Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│                                                             │
│   TaskForm.jsx ──▶ api.js (generateTaskDescription)         │
│         ▲                    │                              │
│         │                    │ POST /api/ai/generate-description
│         │                    │ Authorization: Bearer <token>│
│         │                    ▼                              │
└─────────┼───────────────────────────────────────────────────┘
          │
          │ (HTTP Response)
          │
┌─────────┼───────────────────────────────────────────────────┐
│         │               Express Backend                     │
│         ▼                                                   │
│   server.js ──▶ authMiddleware ──▶ routes/ai.js             │
│                                         │                   │
│                        ┌────────────────┴──────────────┐    │
│                        │                               │    │
│            [Valid Key & Online]             [No Key / Error]│
│                        │                               │    │
│                        ▼                               ▼    │
│                 OpenAI API SDK                  Static Fallback
│              (gpt-4o-mini, 10s)                        │    │
│                        │                               │    │
│                        ▼                               ▼    │
│           { description, fallback: false }     { description, fallback: true }
└─────────────────────────────────────────────────────────────┘
```

### Component Roles:
1. **Frontend (`TaskForm.jsx`)**:
   - Triggers description generation when the user clicks "Generate Description".
   - Displays loading spinner and `Generating description...` during the API call.
   - Disables the button when title is blank or request is in-flight.
   - Populates description field with generated suggestion.
   - Highlights responsible AI disclaimer reminding users to review before saving.
2. **Backend Proxy (`routes/ai.js`)**:
   - Protects endpoint with JWT authentication (`authMiddleware`).
   - Validates task title presence, type, and max length (≤ 200 characters).
   - Manages OpenAI client initialization and 10-second timeout.
   - Returns structured JSON `{ description, fallback }`.

---

## 3. Files Created and Modified

### Backend (`E:\AWDF\task-manager-api`)
- `routes/ai.js` *(Created)*:
  - Express router for `/api/ai/generate-description`.
  - Input validation, prompt engineering, timeout handling, and fallback logic.
- `server.js` *(Modified)*:
  - Mounted `/api/ai` routes behind `authMiddleware`.
  - Conditioned server listener for automated Jest tests without port conflicts.
- `package.json` & `package-lock.json` *(Modified)*:
  - Added `openai` dependency (`^7.33.0`).
- `.env.example` *(Modified)*:
  - Added `OPENAI_API_KEY=your_api_key_here`.
- `tests/api.test.js` *(Modified)*:
  - Added 6 new integration tests covering auth, validation, mock success, timeout, and fallback behaviors (13 total tests).
- `README.md` *(Modified)*:
  - Added Practical 13 documentation, architecture overview, and endpoint specifications.

### Frontend (`E:\AWDF\STUDENT PORTFOLIO\student-portfolio`)
- `src/lib/api.js` *(Modified)*:
  - Added `generateTaskDescription(title)` calling backend `/api/ai/generate-description` with auth header.
- `src/components/TaskForm.jsx` *(Modified)*:
  - Added "Generate Description" action button beside task title / description fields.
  - Added loading indicator, error alert, and responsible AI suggestion disclaimer.

---

## 4. Prompt Engineering & Configuration

### Model & Hyperparameters
- **Model**: `gpt-4o-mini` (or configured via `OPENAI_MODEL` environment variable)
- **Temperature**: `0.7`
- **Max Tokens**: `150`
- **Timeout**: `10000ms` (10 seconds)

### System Prompt
```text
You are a helpful project assistant that generates concise, actionable task descriptions from task titles. The description should be 1-2 sentences explaining what needs to be done. Do not include markdown headers or bullet points.
```

### User Prompt
```text
Task Title: ${title.trim()}
```

---

## 5. Graceful Fallback & Error Handling Strategy

The endpoint ensures high availability and resilience by handling failure modes cleanly:

| Failure Mode | Trigger Condition | Status Code | Response Body |
|---|---|---|---|
| **Missing Auth** | Request without Bearer token | `401 Unauthorized` | `{ error: "Missing or malformed Authorization header" }` |
| **Invalid Title** | Title empty or non-string | `400 Bad Request` | `{ error: "Task title is required to generate a description" }` |
| **Title Too Long** | Title exceeds 200 characters | `400 Bad Request` | `{ error: "Task title must be 200 characters or fewer" }` |
| **Unconfigured Key** | `OPENAI_API_KEY` missing or placeholder | `200 OK` | `{ description: "AI description is temporarily unavailable...", fallback: true }` |
| **API Rate Limit / Quota** | OpenAI API returns 429 / Insufficient Quota | `200 OK` | `{ description: "AI description is temporarily unavailable...", fallback: true }` |
| **Request Timeout** | OpenAI API request exceeds 10,000ms | `200 OK` | `{ description: "AI description is temporarily unavailable...", fallback: true }` |

> **Key Design Decision**: Handled upstream AI errors return HTTP 200 with `fallback: true` rather than HTTP 500. This informs the client application smoothly, prevents crash reports on the frontend, and allows the user to continue manual entry uninterrupted.

---

## 6. Automated Test Suite Results

All 13 tests passed cleanly (`tests/api.test.js`):

```text
PASS tests/api.test.js
  Task Manager API - Automated CI Tests (Practical 12)
    1. Health & System Endpoints
      √ GET / returns 200 and running message (49 ms)
      √ GET /debug/cache returns 200 and cache statistics structure (33 ms)
    2. Authentication Middleware Protection (Practical 7)
      √ GET /tasks without authorization header returns 401 Unauthorized (14 ms)
      √ POST /tasks without authorization header returns 401 Unauthorized (24 ms)
    3. Validation Middleware (Practical 6/7)
      √ POST /tasks with missing title returns 400 Bad Request (12 ms)
    4. Task Endpoints (Practical 4, 7, 9, 10, 12)
      √ GET /tasks returns 200 with valid JWT authorization (20 ms)
      √ POST /tasks creates task, invalidates cache, and returns 201 Created (2248 ms)
    5. AI Description Generation (Practical 13)
      √ POST /api/ai/generate-description without auth header returns 401 Unauthorized (11 ms)
      √ POST /api/ai/generate-description with missing title returns 400 Bad Request (14 ms)
      √ POST /api/ai/generate-description with empty title returns 400 Bad Request (12 ms)
      √ POST /api/ai/generate-description with unconfigured/missing API key returns handled fallback with fallback: true (33 ms)
      √ POST /api/ai/generate-description with valid title and mocked AI response returns 200 with fallback: false (25 ms)
      √ POST /api/ai/generate-description handles AI provider errors/timeouts gracefully with fallback: true (15 ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

---

## 7. Responsible AI & Human-in-the-Loop Disclosures

To adhere to responsible AI guidelines:
1. **Advisory Role**: The AI description is presented purely as a suggestion.
2. **Human Oversight**: The generated text is placed into the editable `<textarea>` so the user can modify, refine, or delete it before saving.
3. **UI Notice**: A notice is displayed directly below the description field:
   > *"AI-generated suggestion: Please review and edit the description before saving."*

---

## 8. Practical Submission Screenshot Checklist

- [ ] **Screenshot 1**: Backend route implementation (`routes/ai.js`) showing prompt engineering and error handling.
- [ ] **Screenshot 2**: Frontend `TaskForm.jsx` showing the "Generate Description" button and responsible AI notice.
- [ ] **Screenshot 3**: Running task form with generated description suggestion displayed in the textarea.
- [ ] **Screenshot 4**: Fallback alert displayed gracefully when API key is unconfigured or offline.
- [ ] **Screenshot 5**: Terminal showing `npm test` passing all 13 tests with 100% success rate.
- [ ] **Screenshot 6**: GitHub Actions CI workflow execution showing a green passing run on the `main` branch.
