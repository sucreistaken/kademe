/**
 * Proves that the pg-boss maintenance pass the transcription drain now runs
 * (`superviseQueue()` in src/lib/queue.ts) works against the real database:
 * connects, runs `boss.supervise("transcription")`, and prints the queue's
 * policy and expiry so the settings the drain relies on are visible.
 *
 * Read only from the application's point of view: it touches pg-boss's own
 * schema and nothing else. Exit 1 if the pass throws.
 *
 * Run with: npx tsx scripts/verify-queue-supervise.ts
 */

import "dotenv/config";

async function main() {
  const { queue, superviseQueue, TRANSCRIPTION_QUEUE } = await import("../src/lib/queue");

  const started = Date.now();
  const ok = await superviseQueue();
  const ms = Date.now() - started;
  if (!ok) {
    console.log(`FAIL superviseQueue() returned false after ${ms} ms (see the error above)`);
    process.exit(1);
  }
  console.log(`ok   boss.supervise("${TRANSCRIPTION_QUEUE}") completed in ${ms} ms`);

  const boss = await queue();
  const q = await boss.getQueue(TRANSCRIPTION_QUEUE);
  console.log(
    `ok   queue "${TRANSCRIPTION_QUEUE}": policy=${q?.policy} expireInSeconds=${q?.expireInSeconds} retryLimit=${q?.retryLimit}`,
  );
  await boss.stop({ graceful: false, close: true });
}

main().catch((error) => {
  console.error("FAIL", error);
  process.exit(1);
});
