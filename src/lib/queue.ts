import { PgBoss } from "pg-boss";

/**
 * Background work, stored in the same Postgres the rest of the product uses.
 *
 * The queue is durable storage plus a retry policy, not a running worker. The
 * application is deployed to Cloud Run, which scales to zero: nothing keeps a
 * process alive between requests, so a long-lived `boss.work()` subscription
 * has no lifetime to rely on and jobs would sit until some unrelated request
 * happened to wake an instance. Instead jobs are drained by a scheduled call to
 * `/api/cron/transcribe`, which fetches a batch, does the work, and completes or
 * fails each job. pg-boss still owns what is genuinely hard: exactly-once
 * fetching, retries with backoff, and archiving.
 */

export const TRANSCRIPTION_QUEUE = "transcription";

export type TranscriptionJob = { mediaAssetId: string };

/** Hot reload in development would otherwise open a new pool on every edit. */
const globalForBoss = globalThis as unknown as {
  kademeBoss?: Promise<PgBoss> | undefined;
};

async function connect(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const boss = new PgBoss({
    connectionString,
    // Nothing subscribes, so the maintenance and monitoring timers would only
    // ever run inside whichever request happened to touch the queue.
    max: 2,
  });
  boss.on("error", (error: unknown) => {
    console.error("[queue] pg-boss error", error);
  });
  await boss.start();
  await boss.createQueue(TRANSCRIPTION_QUEUE, {
    // One job per media asset, queued or active: a sweep that re-enqueues an
    // asset already waiting must not create a second copy of the same work.
    policy: "stately",
    retryLimit: 4,
    retryDelay: 60,
    retryBackoff: true,
    // Transcribing a three minute answer is minutes, not seconds; a stuck job
    // should be reclaimed rather than left active forever.
    expireInSeconds: 900,
  });
  return boss;
}

export function queue(): Promise<PgBoss> {
  globalForBoss.kademeBoss ??= connect();
  return globalForBoss.kademeBoss;
}

/**
 * Enqueues a recording for transcription. Deliberately swallows its own
 * failures: a candidate finishing an answer must never see an error because a
 * background job could not be written. The cron sweep picks up anything missed.
 */
export async function enqueueTranscription(mediaAssetId: string) {
  try {
    const boss = await queue();
    await boss.send(
      TRANSCRIPTION_QUEUE,
      { mediaAssetId } satisfies TranscriptionJob,
      { singletonKey: mediaAssetId },
    );
    return true;
  } catch (error) {
    console.error("[queue] could not enqueue transcription", error);
    return false;
  }
}
