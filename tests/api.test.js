const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OpenAI } = require("openai");
const app = require("../server");

describe("Task Manager API - Automated CI Tests (Practical 12)", () => {
  let authToken;

  beforeAll(() => {
    // Generate valid JWT token for authenticated route testing (Practical 7)
    const secret = process.env.JWT_SECRET || "taskmanager_jwt_secret_fallback";
    authToken = jwt.sign(
      { id: "65f000000000000000000001", email: "ci_test@example.com" },
      secret,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    // Cleanly close Mongoose connection to prevent Jest open handle warnings
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe("1. Health & System Endpoints", () => {
    test("GET / returns 200 and running message", async () => {
      const response = await request(app).get("/");
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain("Task Manager API is Running...");
    });

    test("GET /debug/cache returns 200 and cache statistics structure", async () => {
      const response = await request(app).get("/debug/cache");
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("hits");
      expect(response.body).toHaveProperty("misses");
      expect(response.body).toHaveProperty("keys");
      expect(response.body).toHaveProperty("ttlSeconds");
    });
  });

  describe("2. Authentication Middleware Protection (Practical 7)", () => {
    test("GET /tasks without authorization header returns 401 Unauthorized", async () => {
      const response = await request(app).get("/tasks");
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty("message", "Missing or malformed Authorization header");
    });

    test("POST /tasks without authorization header returns 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/tasks")
        .set("Content-Type", "application/json")
        .send({ title: "Unauthorized Task" });
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty("message", "Missing or malformed Authorization header");
    });
  });

  describe("3. Validation Middleware (Practical 6/7)", () => {
    test("POST /tasks with missing title returns 400 Bad Request", async () => {
      const response = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({ description: "Task with no title" });
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty(
        "message",
        "Title is required and must be a non-empty string"
      );
    });
  });

  describe("4. Task Endpoints (Practical 4, 7, 9, 10, 12)", () => {
    test("GET /tasks returns 200 with valid JWT authorization", async () => {
      const response = await request(app)
        .get("/tasks")
        .set("Authorization", `Bearer ${authToken}`);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test("POST /tasks creates task, invalidates cache, and returns 201 Created", async () => {
      const newTask = {
        title: "CI Pipeline Automated Test Task",
        priority: "High",
        description: "Created during CI test execution",
      };

      const response = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send(newTask);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty("message", "Task Added Successfully");
      expect(response.body.task).toHaveProperty("title", newTask.title);
      expect(response.body.task).toHaveProperty("_id");

      // Await completion of Practical 10 asynchronous background notification processing (2s timer)
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }, 10000);
  });

  describe("5. AI Description Generation (Practical 13)", () => {
    test("POST /api/ai/generate-description without auth header returns 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Content-Type", "application/json")
        .send({ title: "Design Landing Page" });
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty("message", "Missing or malformed Authorization header");
    });

    test("POST /api/ai/generate-description with missing title returns 400 Bad Request", async () => {
      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({});
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty(
        "message",
        "Title is required and must be a non-empty string"
      );
    });

    test("POST /api/ai/generate-description with empty title returns 400 Bad Request", async () => {
      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({ title: "   " });
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty(
        "message",
        "Title is required and must be a non-empty string"
      );
    });

    test("POST /api/ai/generate-description with unconfigured/missing API key returns handled fallback with fallback: true", async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({ title: "Refactor Database Schema" });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("fallback", true);
      expect(response.body).toHaveProperty("description");
      expect(response.body.description).toContain("manually");

      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    test("POST /api/ai/generate-description with valid title and mocked AI response returns 200 with fallback: false", async () => {
      process.env.OPENAI_API_KEY = "sk-test-mock-valid-key";

      const mockDescription =
        "Refactor MongoDB schemas to optimize query performance and reduce memory usage.";
      const createSpy = jest
        .spyOn(OpenAI.Chat.Completions.prototype, "create")
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: mockDescription,
              },
            },
          ],
        });

      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({ title: "Refactor Database Schema" });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        description: mockDescription,
        fallback: false,
      });

      createSpy.mockRestore();
    });

    test("POST /api/ai/generate-description handles AI provider errors/timeouts gracefully with fallback: true", async () => {
      process.env.OPENAI_API_KEY = "sk-test-mock-valid-key";

      const createSpy = jest
        .spyOn(OpenAI.Chat.Completions.prototype, "create")
        .mockRejectedValueOnce(new Error("Rate limit exceeded / Timeout"));

      const response = await request(app)
        .post("/api/ai/generate-description")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send({ title: "Build CI Pipeline" });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("fallback", true);
      expect(response.body).toHaveProperty("description");
      expect(response.body.description).toContain("manually");

      createSpy.mockRestore();
    });
  });
});
