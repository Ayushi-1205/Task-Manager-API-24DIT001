require('dotenv').config();
const express = require("express");
const connectDB = require("./config/db");
const Task = require("./models/Task");
const app = express();
const PORT = 5000;
connectDB();

const cors = require("cors");

// Middleware to parse JSON
app.use(express.json());

// Enable CORS
app.use(cors());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Content-Type Validation Middleware
function checkContentType(req, res, next) {
  if (req.method === "POST" && !req.is("application/json")) {
    return res.status(400).json({
      message: "Content-Type must be application/json",
    });
  }

  next();
}

app.use(checkContentType);

// In-memory Database
let tasks = [
  {
    id: 1,
    title: "Learn Express",
    completed: false,
  },
  {
    id: 2,
    title: "Build REST API",
    completed: false,
  },
];

// Task ID Validation Middleware
function validateTaskId(req, res, next) {
  const id = parseInt(req.params.id);

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  req.task = task;

  next();
}

const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");
const validateTask = require("./middleware/validateTask");
const { cache, stats, getCacheStats, clearCacheAndStats } = require("./config/cache");

// Home Route
app.get("/", (req, res) => {
  res.send("Task Manager API is Running...");
});

// Cache Debug Endpoints (Public stats for Practical 9 analysis and screenshots)
app.get("/debug/cache", (req, res) => {
  res.status(200).json(getCacheStats());
});

app.delete("/debug/cache", (req, res) => {
  clearCacheAndStats();
  res.status(200).json({
    message: "Cache and statistics cleared successfully",
    stats: getCacheStats(),
  });
});

// Auth Routes
app.use("/auth", authRoutes);

// Apply Auth & Validation Middleware to all /tasks routes
app.use("/tasks", authMiddleware, validateTask);

// GET All Tasks (Cached)
app.get("/tasks", async (req, res) => {
  try {
    const cacheKey = "tasks:all";
    const cachedTasks = cache.get(cacheKey);

    if (cachedTasks) {
      /* CACHE HIT: cache -> response */
      stats.allTasks.hits++;
      return res.status(200).json(cachedTasks);
    }

    /* CACHE MISS: MongoDB -> cache -> response */
    stats.allTasks.misses++;
    // Query Optimization: .lean() avoids heavy Mongoose document overhead for read-only query
    const tasks = await Task.find().lean();

    cache.set(cacheKey, tasks);
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// GET Single Task by ID (Cached)
app.get("/tasks/:id", async (req, res) => {
  try {
    const cacheKey = `task:${req.params.id}`;
    const cachedTask = cache.get(cacheKey);

    if (cachedTask) {
      /* CACHE HIT: cache -> response */
      stats.singleTask.hits++;
      return res.status(200).json(cachedTask);
    }

    /* CACHE MISS: MongoDB -> cache -> response */
    stats.singleTask.misses++;
    // Query Optimization: .lean() for read-only lookup
    const task = await Task.findById(req.params.id).lean();

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    cache.set(cacheKey, task);
    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// POST New Task (Cache Invalidation)
app.post("/tasks", async (req, res) => {
  try {
    const task = await Task.create(req.body);

    // Invalidate All Tasks cache upon new creation
    cache.del("tasks:all");

    res.status(201).json({
      message: "Task Added Successfully",
      task,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// PUT Update Task (Cache Invalidation)
app.put("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Invalidate both all-tasks cache and specific single-task cache
    cache.del("tasks:all");
    cache.del(`task:${req.params.id}`);

    res.status(200).json({
      message: "Task Updated Successfully",
      task,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// DELETE Task (Cache Invalidation)
app.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Invalidate both all-tasks cache and specific single-task cache
    cache.del("tasks:all");
    cache.del(`task:${req.params.id}`);

    res.status(200).json({
      message: "Task Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route Not Found",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: "Internal Server Error",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});