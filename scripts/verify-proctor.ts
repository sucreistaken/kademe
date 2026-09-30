/**
 * Runs the AI second look for real on one proctoring flag of the seeded demo
 * attempt. The seed's frames are plain grey images, so an honest model must
 * NOT confirm "more than one person": the expected verdict is NOT_CONFIRMED
 * or UNCLEAR. It also proves the images actually reach the model.
 *
 * Exits 2 when no Gemini key is configured. Run after pnpm db:seed.
 * Run with: pnpm verify:proctor
 */
import "dotenv/config";

async function main() {
  const { and, eq, gt } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { getAiProvider } = await import("../src/lib/ai");
  const { runProctorReview } = await import("../src/server/proctor-review-job");

  const provider = getAiProvider();
  if (!provider.available || provider.name !== "gemini") {
    console.log("NOT VERIFIED: no Gemini provider configured.");
    process.exit(2);
  }
  const [source] = await db
    .select()
    .from(s.proctorEvents)
    .where(eq(s.proctorEvents.type, "MULTIPLE_FACES"))
    .limit(1);
  if (!source) {
    console.log("NOT VERIFIED: no seeded MULTIPLE_FACES event. Run pnpm db:seed.");
    process.exit(2);
  }
  const frames = await db.select().from(s.proctorEvidence).where(eq(s.proctorEvidence.eventId, source.id));
  const [event] = await db
    .insert(s.proctorEvents)
    .values({
      attemptId: source.attemptId,
      clientEventId: `verify-${randomUUID()}`,
      type: "MULTIPLE_FACES",
      severity: "HIGH",
      source: "MODEL",
      startedAt: source.startedAt,
      endedAt: source.endedAt,
      durationMs: source.durationMs,
    })
    .returning();
  for (const f of frames) {
    await db.insert(s.proctorEvidence).values({ ...f, id: randomUUID(), eventId: event.id });
  }
  await db.insert(s.proctorAiReviews).values({ eventId: event.id, status: "QUEUED" });
  const before = new Date();
  const t0 = Date.now();
  const outcome = await runProctorReview(event.id);
  const [review] = await db.select().from(s.proctorAiReviews).where(eq(s.proctorAiReviews.eventId, event.id));
  const runs = await db
    .select()
    .from(s.aiRuns)
    .where(and(eq(s.aiRuns.purpose, "PROCTOR_REVIEW"), gt(s.aiRuns.at, before)));
  console.log(`${frames.length} frames sent, ${((Date.now() - t0) / 1000).toFixed(1)} s, outcome ${outcome.status}: ${outcome.detail}`);
  console.log(`verdict ${review.verdict}, model ${review.model}, ai_runs ${runs.length}`);
  console.log(`summary: ${review.summary}`);
  console.log(`observations: ${JSON.stringify(review.observations).slice(0, 400)}`);
  const ok = review.status === "DONE" && review.verdict !== "CONFIRMED" && runs.length >= 1;
  console.log(ok ? "\nProctor review check passed." : "\nProctor review check FAILED.");
  // Leave no trace of the check in the demo data.
  await db.delete(s.proctorEvents).where(eq(s.proctorEvents.id, event.id));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
