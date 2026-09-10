/**
 * Exercises everything in the transcription pipeline that can be exercised
 * without an ElevenLabs API key: the queue round trip, the skip rules, and the
 * refusal to run with no provider configured.
 *
 * What it deliberately does NOT do is fake a transcript. A pipeline that writes
 * invented text would look green here and put words in a candidate's mouth on
 * the review screen, so the one step this cannot prove is the Scribe call
 * itself. The response mapping for that call is covered by
 * src/lib/transcription.test.ts.
 *
 * Run with: npx tsx scripts/verify-transcription.ts
 */

import "dotenv/config";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { mediaAssets, transcripts } from "../src/db/schema";
import {
  TRANSCRIPTION_QUEUE,
  enqueueTranscription,
  queue,
} from "../src/lib/queue";
import { findUntranscribed, runTranscription } from "../src/lib/transcribe-job";
import { TranscriberUnavailable, getTranscriber } from "../src/lib/transcription";

let failed = 0;
const ok = (m: string) => console.log(`   ok   ${m}`);
const bad = (m: string) => {
  console.log(`   FAIL ${m}`);
  failed = 1;
};
const say = (m: string) => console.log(`\n== ${m}`);

async function main() {
  say("provider");
  const transcriber = getTranscriber();
  console.log(`   provider=${transcriber.name} available=${transcriber.available}`);

  say("queue round trip");
  const marker = `verify-${Date.now()}`;
  const sent = await enqueueTranscription(marker);
  if (sent) ok("job enqueued");
  else bad("could not enqueue");

  const boss = await queue();
  const jobs = await boss.fetch<{ mediaAssetId: string }>(TRANSCRIPTION_QUEUE, {
    batchSize: 20,
  });
  const mine = jobs.find((j) => j.data?.mediaAssetId === marker);
  if (mine) ok(`job fetched back (${mine.id})`);
  else bad("job did not come back");

  // Put anything else this fetch pulled back so a real drain still sees it.
  for (const job of jobs) {
    if (job === mine) continue;
    await boss.fail(TRANSCRIPTION_QUEUE, job.id, { reason: "requeued by verify" });
  }
  if (mine) {
    await boss.complete(TRANSCRIPTION_QUEUE, mine.id, { verified: true });
    ok("job completed");
  }

  say("duplicate enqueue does not create a second job");
  const dupKey = `verify-dup-${Date.now()}`;
  await enqueueTranscription(dupKey);
  await enqueueTranscription(dupKey);
  const dupJobs = await boss.fetch<{ mediaAssetId: string }>(TRANSCRIPTION_QUEUE, {
    batchSize: 20,
  });
  const dupes = dupJobs.filter((j) => j.data?.mediaAssetId === dupKey);
  if (dupes.length === 1) ok("one job per media asset (stately policy plus singletonKey)");
  else bad(`expected 1 job for the key, got ${dupes.length}`);
  for (const job of dupJobs) {
    await boss.complete(TRANSCRIPTION_QUEUE, job.id, { verified: true });
  }

  say("skip rules");
  const [withTranscript] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .innerJoin(transcripts, eq(transcripts.mediaAssetId, mediaAssets.id))
    .limit(1);
  if (withTranscript) {
    const outcome = await runTranscription(withTranscript.id);
    if (outcome.status === "SKIPPED" && outcome.reason === "already transcribed") ok("an asset that already has a transcript is skipped");
    else bad(`expected SKIPPED/already transcribed, got ${JSON.stringify(outcome)}`);
  } else {
    console.log("   (no seeded transcript to test against, skipping)");
  }

  const missing = await runTranscription(
    "00000000-0000-0000-0000-000000000000",
  );
  if (missing.status === "SKIPPED") ok("an unknown media asset is skipped, not retried forever");
  else bad(`expected SKIPPED, got ${JSON.stringify(missing)}`);

  say("no provider means no transcript, and it says so");
  const [fresh] = await db
    .select({ id: mediaAssets.id, mime: mediaAssets.mime })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.status, "READY"), isNotNull(mediaAssets.storageKey)))
    .limit(1);
  if (!fresh) {
    console.log("   (no READY media asset in the database, skipping)");
  } else if (transcriber.available) {
    console.log("   (a provider is configured, so this check does not apply)");
  } else {
    try {
      await runTranscription(fresh.id);
      bad("it ran without a provider");
    } catch (error) {
      if (error instanceof TranscriberUnavailable) ok("refuses to run with no provider configured");
      else bad(`unexpected error: ${String(error)}`);
    }
    const [written] = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(eq(transcripts.mediaAssetId, fresh.id))
      .limit(1);
    if (written) bad("a transcript row was written anyway");
    else ok("no transcript row was written");
  }

  say("sweep");
  const untranscribed = await findUntranscribed();
  ok(`${untranscribed.length} recordings from the last day are missing a transcript`);

  console.log(failed ? "\nSOME CHECKS FAILED\n" : "\nALL CHECKS PASSED\n");
  await boss.stop({ graceful: false });
  process.exit(failed);
}

void main();
