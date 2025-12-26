const express = require("express");
const router = express.Router();
const pusher = require("../config/pusher");

// Trigger a test Pusher event and return timing information
router.get("/pusher/test", async (req, res) => {
  const payload = { message: "hello world", ts: new Date().toISOString() };
  const start = Date.now();
  try {
    await pusher.trigger("comments", "comment:created", payload);
    const duration = Date.now() - start;
    return res
      .status(200)
      .json({ success: true, durationMs: duration, payload });
  } catch (err) {
    const duration = Date.now() - start;
    console.error("Pusher trigger error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message, durationMs: duration });
  }
});

module.exports = router;
