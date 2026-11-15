import { dispatchDueScheduledPosts } from "../lib/queue/publishing-queue";

const INTERVAL_MS = 30000; // Check every 30 seconds
let isRunning = true;
let isProcessing = false;

console.log("==========================================================");
console.log("  🚀 PostPulse Background Publishing Worker Started        ");
console.log(`  🕒 Polling interval: ${INTERVAL_MS / 1000}s             `);
console.log("==========================================================");

async function runWorkerLoop() {
  while (isRunning) {
    if (!isProcessing) {
      try {
        isProcessing = true;
        const result = await dispatchDueScheduledPosts();
        if (result.processedCount > 0) {
          console.log(`[Worker Loop] Processed ${result.processedCount} targets.`);
        }
      } catch (err) {
        console.error("[Worker Loop] Unhandled error:", err);
      } finally {
        isProcessing = false;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n[Worker] Received SIGTERM, shutting down cleanly...");
  isRunning = false;
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n[Worker] Received SIGINT, stopping worker...");
  isRunning = false;
  process.exit(0);
});

runWorkerLoop();
