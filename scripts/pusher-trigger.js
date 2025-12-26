const pusher = require("../config/pusher");

(async () => {
  try {
    console.log('Triggering test event to channel "comments"...');
    const start = Date.now();
    await pusher.trigger("comments", "comment:created", {
      message: "cli test",
      ts: new Date().toISOString(),
    });
    console.log(`Event triggered successfully (${Date.now() - start}ms)`);
  } catch (err) {
    console.error("Error triggering event:", err.message || err);
    process.exit(1);
  }
})();
