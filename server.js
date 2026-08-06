const express = require("express");
const connectDB = require("./config/db");
const Task = require("./models/Task");
const app = express();
const PORT = 5000;
connectDB();

// Middleware to parse JSON
app.use(express.json());

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

// Home Route
app.get("/", (req, res) => {
  res.send("Task Manager API is Running...");
});

// GET All Tasks
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find();

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

app.get("/tasks/:id", async (req, res) => {

  try {

    const task = await Task.findById(req.params.id);

    if (!task) {

      return res.status(404).json({
        message: "Task not found",
      });

    }

    res.status(200).json(task);

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });

  }

});

// POST New Task
app.post("/tasks", async (req, res) => {
  try {
    const task = await Task.create(req.body);

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

// PUT Update Task
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

// DELETE Task
app.delete("/tasks/:id", async (req, res) => {

  try {

    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {

      return res.status(404).json({
        message: "Task not found",
      });

    }

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