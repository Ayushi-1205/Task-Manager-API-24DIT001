const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
    minlength: [3, "Title must be at least 3 characters"],
  },

  description: {
    type: String,
    default: "",
  },

  completed: {
    type: Boolean,
    default: false,
  },

  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

taskSchema.pre("save", function () {
  if (this.title) {
    this.title = this.title.trim();
  }
  console.log("Saving Task:", this.title);
});

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;