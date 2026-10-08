const EventEmitter = require("events");

// Create dedicated singleton EventEmitter instance
const taskEvents = new EventEmitter();

// Error listener to catch and log errors, preventing server crashes
taskEvents.on("error", (err) => {
  console.error(`[EVENT ERROR] ${new Date().toISOString()} - ${err.message}`);
});

// Listener for the "task-created" event
taskEvents.on("task-created", async (eventData) => {
  try {
    const receiveTime = new Date().toISOString();
    console.log(`[NOTIFICATION] Processing task-created event for task "${eventData.title}" received at: ${receiveTime}`);

    // Controlled simulation of event error if triggerError is set (for error-handling verification)
    if (eventData.triggerError) {
      throw new Error("Simulated background notification service failure");
    }

    // 2-second deliberate asynchronous delay to simulate background task/notification
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const completionTime = new Date().toISOString();
    console.log(`[NOTIFICATION] Task "${eventData.title}" (ID: ${eventData.id}) notification sent to user: ${eventData.user} at: ${completionTime}`);
    console.log(`[NOTIFICATION] Notification processing completed successfully at: ${completionTime}`);
  } catch (err) {
    // Forward error to the EventEmitter error handler so the server does not crash
    taskEvents.emit("error", err);
  }
});

module.exports = taskEvents;
