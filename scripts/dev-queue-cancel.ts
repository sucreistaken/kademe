/**
 * Cancels queued transcription jobs, optionally keeping one.
 *
 * Development only. The point is to stop a drain from spending real API calls
 * on test recordings that were never speech (random bytes from the candidate
 * flow checks), so a run against the live provider exercises the one recording
 * you actually care about.
 *
 * Run with: npx tsx scripts/dev-queue-cancel.ts [mediaAssetId to keep]
 */

import "dotenv/config";
import { TRANSCRIPTION_QUEUE, queue } from "../src/lib/queue";

async function main() {
  const keep = process.argv[2];
  const boss = await queue();
  // `queued: true` covers both created and retry, which is exactly the set a
  // drain would pick up next.
  const jobs = await boss.findJobs<{ mediaAssetId: string }>(TRANSCRIPTION_QUEUE, {
    queued: true,
  });
  const drop = jobs.filter((job) => job.data?.mediaAssetId !== keep);
  for (const job of drop) await boss.cancel(TRANSCRIPTION_QUEUE, job.id);
  console.log(`kept ${jobs.length - drop.length}, cancelled ${drop.length}`);
  await boss.stop({ graceful: false });
  process.exit(0);
}

void main();
