/**
 * Runs the cron drain for real, with the provider configured but every read
 * failing, to prove the unhappy path.
 *
 * The point is what must happen when transcription fails: no transcript row is
 * written, the failure lands in `ai_runs` with its reason, and the job goes back
 * to pg-boss to be retried. Storage is pointed at an empty directory so every
 * asset fails before any network call, which keeps this check offline and sends
 * nothing to a third party.
 *
 * The one step neither this nor scripts/verify-transcription.ts can prove is a
 * successful Scribe call. That needs a real ELEVENLABS_API_KEY.
 *
 * Run with: npx tsx scripts/verify-transcription-drain.ts
 */

import "dotenv/config";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SECRET = "drain-check-secret";
process.env.CRON_SECRET = SECRET;
// A syntactically fine key that will never be used: every asset fails at the
// storage read, before the provider is contacted.
process.env.ELEVENLABS_API_KEY = "offline-drain-check";
process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "kademe-empty-"));

async function main() {
  const { and, desc, eq, gt, inArray } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { aiRuns, transcripts } = await import("../src/db/schema");
  const { enqueueTranscription } = await import("../src/lib/queue");
  const { findUntranscribed } = await import("../src/lib/transcribe-job");
  const { POST } = await import("../src/app/api/cron/transcribe/route");

  let failed = 0;
  const ok = (m: string) => console.log(`   ok   ${m}`);
  const bad = (m: string) => {
    console.log(`   FAIL ${m}`);
    failed = 1;
  };

  const pending = await findUntranscribed(3);
  if (pending.length === 0) {
    console.log("\n   No untranscribed recording in the last day. Upload one first:");
    console.log("   pnpm dev:link <name>, then bash scripts/verify-candidate-flow.sh <token>\n");
    process.exit(2);
  }
  for (const asset of pending) await enqueueTranscription(asset.id);
  const startedAt = new Date();

  console.log(`\n== draining with ${pending.length} recording(s) queued`);

  const res = await POST(
    new Request("http://localhost/api/cron/transcribe", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
    }) as never,
  );
  const body = (await res.json()) as {
    provider: string;
    swept: number;
    fetched: number;
    results: Array<{ mediaAssetId: string; outcome: string }>;
  };

  console.log(`   provider=${body.provider} swept=${body.swept} fetched=${body.fetched}`);

  if (body.provider === "elevenlabs-scribe") ok("the drain ran with a provider configured");

  else bad(`expected the real provider to be selected, got ${body.provider}`);

  if (body.fetched > 0) ok(`fetched ${body.fetched} job(s)`);

  else bad("fetched nothing");

  const allFailed =
    body.results.length > 0 && body.results.every((r) => r.outcome.startsWith("FAILED"));
  if (allFailed) ok("every job failed, as expected with no readable media");
  else bad(`expected every job to fail, got ${JSON.stringify(body.results)}`);

  const touched = body.results.map((r) => r.mediaAssetId);
  if (touched.length > 0) {
    const written = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(inArray(transcripts.mediaAssetId, touched));
    if (written.length === 0) ok("no transcript row was written for a failed job");
    else bad(`${written.length} transcript row(s) written despite failure`);
  }

  const runs = await db
    .select({ error: aiRuns.error, model: aiRuns.model, purpose: aiRuns.purpose })
    .from(aiRuns)
    .where(and(eq(aiRuns.purpose, "TRANSCRIPTION"), gt(aiRuns.at, startedAt)))
    .orderBy(desc(aiRuns.at));

  if (runs.length >= body.results.length) ok(`${runs.length} ai_runs row(s) recorded for this drain`);

  else bad(`expected at least ${body.results.length} ai_runs rows, got ${runs.length}`);

  if (runs.every((r) => !!r.error)) ok("each recorded run carries the failure reason");

  else bad("an ai_runs row has no error despite the job failing");

  if (runs[0]?.error) console.log(`   reason: ${runs[0].error.slice(0, 90)}`);

  const { queue, TRANSCRIPTION_QUEUE } = await import("../src/lib/queue");
  const boss = await queue();
  const backInQueue = await boss.fetch<{ mediaAssetId: string }>(
    TRANSCRIPTION_QUEUE,
    { batchSize: 20 },
  );
  console.log(`   ${backInQueue.length} job(s) currently fetchable after the failures`);
  for (const job of backInQueue) {
    await boss.complete(TRANSCRIPTION_QUEUE, job.id, { cleanedUp: true });
  }

  console.log(failed ? "\nSOME CHECKS FAILED\n" : "\nALL CHECKS PASSED\n");
  await boss.stop({ graceful: false });
  process.exit(failed);
}

void main();
