const https = require("https");

const clusters = process.argv.slice(2);
if (clusters.length === 0) {
  console.log("Usage: node ping-pusher-clusters.js <cluster1> <cluster2> ...");
  console.log("Example: node ping-pusher-clusters.js ap1 eu us2");
  process.exit(0);
}

const ping = (cluster) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(`https://api-${cluster}.pusher.com/`, (res) => {
      const duration = Date.now() - start;
      resolve({ cluster, statusCode: res.statusCode, duration });
    });

    req.on("error", (err) => {
      const duration = Date.now() - start;
      resolve({ cluster, error: err.message, duration });
    });

    req.setTimeout(5000, () => {
      req.abort();
      const duration = Date.now() - start;
      resolve({ cluster, error: "timeout", duration });
    });
  });
};

(async () => {
  console.log("Pinging clusters:", clusters.join(", "));
  const results = [];
  for (const c of clusters) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ping(c);
    results.push(r);
    console.log(
      `- ${c}: ${r.error ? "ERROR: " + r.error : r.statusCode} (${
        r.duration
      }ms)`
    );
  }
  console.log("\nSummary:");
  results.forEach((r) => {
    console.log(
      `${r.cluster} -> ${r.error ? r.error : r.statusCode} (${r.duration}ms)`
    );
  });
})();
