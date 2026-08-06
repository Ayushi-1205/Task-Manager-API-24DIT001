const express = require("express");

const app = express();
const PORT = 5000;

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
app.get("/tasks", (req, res) => {
  res.status(200).json(tasks);
});

// POST New Task
app.post("/tasks", (req, res) => {
  const { title, completed } = req.body;

  const newTask = {
    id: Date.now(),
    title,
    completed,
  };

  tasks.push(newTask);

  res.status(201).json({
    message: "Task added successfully",
    task: newTask,
  });
});

// PUT Update Task
app.put("/tasks/:id", validateTaskId, (req, res) => {
  const { title, completed } = req.body;

  req.task.title = title;
  req.task.completed = completed;

  res.status(200).json({
    message: "Task updated successfully",
    task: req.task,
  });
});

// DELETE Task
app.delete("/tasks/:id", validateTaskId, (req, res) => {
  tasks = tasks.filter((t) => t.id !== req.task.id);

  res.status(200).json({
    message: "Task deleted successfully",
  });
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