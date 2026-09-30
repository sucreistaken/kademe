import { and, asc, between, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attempts, assessments, proctorAiReviews, proctorEvents, proctorEvidence } from "@/db/schema";
import { callJson } from "@/lib/ai-runs";
import { getAiProvider } from "@/lib/ai";
import {
  buildProctorReviewMessages,
  parseProctorReview,
  PROCTOR_REVIEW_JSON_SCHEMA,
  reconcileVerdict,
  type FrameKind,
} from "@/lib/exam/proctor-review";
import { getStorage } from "@/lib/storage";
import { recomputeIntegrity } from "@/server/proctoring";

/**
 * The AI second look at one proctoring flag.
 *
 * It sends the frames around the moment to a vision model and asks for facts
 * only (how many people, a device, non-exam content on screen). The verdict is
 * checked against those facts; when the two disagree it becomes UNCLEAR. The
 * result changes how much the flag weighs in the integrity summary. It never
 * decides anything: the teacher confirms or dismisses every flag.
 */

const MAX_FRAMES = 4;
const WAIT_FOR_FRAMES_MS = 2 * 60_000;

export type ReviewOutcome = { status: "DONE" | "SKIPPED" | "WAITING"; detail: string };

async function readAll(key: string): Promise<Buffer> {
  const { stream } = await getStorage().openStream(key);
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function runProctorReview(eventId: string): Promise<ReviewOutcome> {
  const [row] = await db
    .select({ event: proctorEvents, review: proctorAiReviews, locale: assessments.locale })
    .from(proctorEvents)
    .innerJoin(proctorAiReviews, eq(proctorAiReviews.eventId, proctorEvents.id))
    .innerJoin(attempts, eq(attempts.id, proctorEvents.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(proctorEvents.id, eventId));
  if (!row) return { status: "SKIPPED", detail: "event or review row is gone" };
  if (row.review.status !== "QUEUED") return { status: "SKIPPED", detail: `review is ${row.review.status}` };

  const provider = getAiProvider();
  if (!provider.available || provider.name !== "gemini") {
    await db
      .update(proctorAiReviews)
      .set({ status: "SKIPPED", error: "no vision model configured (Gemini)", reviewedAt: new Date() })
      .where(eq(proctorAiReviews.id, row.review.id));
    return { status: "SKIPPED", detail: "no vision provider" };
  }

  // Frames tied to the event first, then any taken within ten seconds of it.
  const at = row.event.startedAt.getTime();
  let frames = await db
    .select()
    .from(proctorEvidence)
    .where(and(eq(proctorEvidence.eventId, eventId), inArray(proctorEvidence.kind, ["WEBCAM_FRAME", "SCREEN_FRAME"])))
    .orderBy(asc(proctorEvidence.capturedAt));
  if (frames.length === 0) {
    frames = await db
      .select()
      .from(proctorEvidence)
      .where(
        and(
          eq(proctorEvidence.attemptId, row.event.attemptId),
          inArray(proctorEvidence.kind, ["WEBCAM_FRAME", "SCREEN_FRAME"]),
          between(proctorEvidence.capturedAt, new Date(at - 10_000), new Date(at + 10_000)),
        ),
      )
      .orderBy(asc(proctorEvidence.capturedAt));
  }
  if (frames.length === 0) {
    if (Date.now() - at < WAIT_FOR_FRAMES_MS) return { status: "WAITING", detail: "frames not uploaded yet" };
    await db
      .update(proctorAiReviews)
      .set({ status: "SKIPPED", error: "no frames for this moment", reviewedAt: new Date() })
      .where(eq(proctorAiReviews.id, row.review.id));
    return { status: "SKIPPED", detail: "no frames" };
  }
  frames = frames.slice(0, MAX_FRAMES);
  const kinds: FrameKind[] = frames.map((f) => (f.kind === "SCREEN_FRAME" ? "SCREEN" : "WEBCAM"));
  const images = await Promise.all(
    frames.map(async (f) => ({ mime: f.mime, base64: (await readAll(f.storageKey)).toString("base64") })),
  );

  const messages = buildProctorReviewMessages({ eventType: row.event.type, frameKinds: kinds, locale: row.locale });
  const orgId = frames[0].orgId;
  try {
    const { response, runId } = await callJson(
      "proctor_review",
      PROCTOR_REVIEW_JSON_SCHEMA,
      messages,
      { orgId, purpose: "PROCTOR_REVIEW", inputRef: `proctor_event:${eventId}` },
      { images, maxTokens: 2000 },
    );
    const parsed = parseProctorReview(response.text, frames.length);
    if (!parsed.ok) {
      await db
        .update(proctorAiReviews)
        .set({ status: "FAILED", error: parsed.error.slice(0, 1000), aiRunId: runId, model: response.model, reviewedAt: new Date() })
        .where(eq(proctorAiReviews.id, row.review.id));
      return { status: "DONE", detail: `unparseable: ${parsed.error}` };
    }
    const { verdict, downgraded } = reconcileVerdict(parsed.review, row.event.type, kinds);
    await db
      .update(proctorAiReviews)
      .set({
        status: "DONE",
        verdict,
        observations: { frames: parsed.review.frames, frameIds: frames.map((f) => f.id), downgraded },
        summary: parsed.review.summary,
        model: response.model,
        aiRunId: runId,
        reviewedAt: new Date(),
      })
      .where(eq(proctorAiReviews.id, row.review.id));
    await recomputeIntegrity(row.event.attemptId);
    return { status: "DONE", detail: verdict };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db
      .update(proctorAiReviews)
      .set({ error: reason.slice(0, 1000) })
      .where(eq(proctorAiReviews.id, row.review.id));
    throw error;
  }
}

/** Reviews still queued after a minute, for the cron's safety net. */
export async function findQueuedReviews(limit = 10) {
  return db
    .select({ eventId: proctorAiReviews.eventId })
    .from(proctorAiReviews)
    .where(eq(proctorAiReviews.status, "QUEUED"))
    .orderBy(asc(proctorAiReviews.createdAt))
    .limit(limit);
}
