import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  proctorAiReviews,
  proctorEvents,
  proctorEvidence,
  proctorSessions,
} from "@/db/schema";
import type { CandidateContext } from "@/lib/candidate-context";
import { normalizeBatch, type NormalizedEvent } from "@/lib/proctor/events";
import { computeIntegrity, type IntegrityEvent } from "@/lib/proctor/integrity";
import { TAXONOMY, effectiveSeverity, type ProctorEventType } from "@/lib/proctor/taxonomy";
import { shouldTerminate } from "@/lib/proctor/termination";
import { enqueueProctorReview } from "@/lib/queue";
import { getStorage, proctorEvidenceKey } from "@/lib/storage";
import type { SegmentRef, SolutionModule } from "@/solutions/types";

/**
 * The server half of proctoring.
 *
 * The browser reports what it saw; this file stores it, adds the few things
 * only the server can know (a heartbeat that stopped, two tabs at once), sends
 * the worst moments to the AI second look within a budget, and keeps the
 * attempt's integrity summary current. It never fails a student. The only
 * automatic consequence is termination, and only when the school switched it on.
 */

const HEARTBEAT_GAP_MS = 45_000;
const DUPLICATE_WINDOW_MS = 30_000;

export async function registerSession(
  ctx: CandidateContext,
  attemptId: string,
  clientSessionId: string,
  env: Record<string, unknown>,
  ip: string | null,
) {
  const [session] = await db
    .insert(proctorSessions)
    .values({ attemptId, clientSessionId: clientSessionId.slice(0, 64), env, ip })
    .onConflictDoUpdate({
      target: [proctorSessions.attemptId, proctorSessions.clientSessionId],
      set: { env, lastSeenAt: new Date(), ip },
    })
    .returning();
  await checkDuplicate(attemptId, session.id);
  return session;
}

async function ownedSession(attemptId: string, sessionId: unknown) {
  if (typeof sessionId !== "string" || sessionId.length !== 36) return null;
  const [s] = await db
    .select()
    .from(proctorSessions)
    .where(and(eq(proctorSessions.id, sessionId), eq(proctorSessions.attemptId, attemptId)));
  return s ?? null;
}

/** Writes a server-derived event. */
async function serverEvent(
  attemptId: string,
  type: ProctorEventType,
  meta: Record<string, unknown> | null,
  startedAt = new Date(),
  endedAt: Date | null = null,
) {
  const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : null;
  const [row] = await db
    .insert(proctorEvents)
    .values({
      attemptId,
      clientEventId: `server-${randomUUID()}`,
      type,
      severity: effectiveSeverity(type, durationMs),
      source: "SERVER",
      startedAt,
      endedAt,
      durationMs,
      meta,
    })
    .returning();
  return row;
}

async function checkDuplicate(attemptId: string, sessionId: string) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const others = await db
    .select({ id: proctorSessions.id })
    .from(proctorSessions)
    .where(
      and(
        eq(proctorSessions.attemptId, attemptId),
        ne(proctorSessions.id, sessionId),
        gt(proctorSessions.lastSeenAt, since),
      ),
    );
  if (others.length > 0) await serverEvent(attemptId, "DUPLICATE_SESSION", { sessions: others.length + 1 });
}

export async function heartbeat(
  solution: SolutionModule,
  attemptId: string,
  sessionId: unknown,
  state: Record<string, unknown>,
) {
  const session = await ownedSession(attemptId, sessionId);
  if (!session) return null;
  const now = new Date();
  const gap = now.getTime() - session.lastSeenAt.getTime();
  // Only a gap inside a running segment means anything: between sections and
  // on the check screen the candidate may simply be reading.
  if (gap > HEARTBEAT_GAP_MS && (await solution.attempts.openSegment(attemptId))) {
    await serverEvent(attemptId, "HEARTBEAT_GAP", { gapMs: gap }, session.lastSeenAt, now);
  }
  await db
    .update(proctorSessions)
    .set({ lastSeenAt: now, lastState: state })
    .where(eq(proctorSessions.id, session.id));
  return { serverNow: now.getTime() };
}

/**
 * Stores a batch from the browser. Intervals arrive twice (start, then end) and
 * are merged by their client id. Returns whether the attempt was terminated.
 */
export async function ingestEvents(
  ctx: CandidateContext,
  solution: SolutionModule,
  attempt: typeof attempts.$inferSelect,
  sessionId: unknown,
  raw: unknown,
  clientOffsetMs: number,
) {
  const session = await ownedSession(attempt.id, sessionId);
  const now = Date.now();
  const { accepted } = normalizeBatch(raw, {
    now,
    attemptStartedAt: (attempt.startedAt ?? attempt.createdAt).getTime(),
    clientOffsetMs: Number.isFinite(clientOffsetMs) ? clientOffsetMs : 0,
  });
  const segment = await solution.attempts.openSegment(attempt.id);
  const policy = await solution.proctorPolicy(ctx.assessment.id);
  for (const e of accepted) {
    const stored = await upsertEvent(attempt.id, session?.id ?? null, segment, e);
    if (stored.fresh && policy?.aiSecondLook && TAXONOMY[e.type].aiReview) {
      await maybeQueueReview(attempt.id, stored.id, policy.maxAiReviewsPerAttempt);
    }
  }
  await recomputeIntegrity(attempt.id);
  return checkTermination(solution, policy, attempt.id);
}

async function upsertEvent(
  attemptId: string,
  sessionId: string | null,
  segment: SegmentRef | null,
  e: NormalizedEvent,
): Promise<{ id: string; fresh: boolean }> {
  const [existing] = await db
    .select()
    .from(proctorEvents)
    .where(and(eq(proctorEvents.attemptId, attemptId), eq(proctorEvents.clientEventId, e.clientEventId)));
  if (existing) {
    if (existing.type !== e.type) return { id: existing.id, fresh: false };
    const start = Math.min(existing.startedAt.getTime(), e.startedAt);
    const endCandidates = [existing.endedAt?.getTime() ?? null, e.endedAt].filter((x): x is number => x !== null);
    const end = endCandidates.length ? Math.max(...endCandidates) : null;
    const durationMs = end !== null ? end - start : null;
    await db
      .update(proctorEvents)
      .set({
        startedAt: new Date(start),
        endedAt: end !== null ? new Date(end) : null,
        durationMs,
        severity: effectiveSeverity(e.type, durationMs),
        meta: { ...(existing.meta ?? {}), ...(e.meta ?? {}) },
      })
      .where(eq(proctorEvents.id, existing.id));
    return { id: existing.id, fresh: false };
  }
  const durationMs = e.endedAt !== null ? e.endedAt - e.startedAt : null;
  const [row] = await db
    .insert(proctorEvents)
    .values({
      attemptId,
      // Dual write until migration 0003 (Task 8).
      sectionRunId: segment?.kind === "section_run" ? segment.runId : null,
      segmentKind: segment?.kind ?? null,
      segmentRunId: segment?.runId ?? null,
      sessionId,
      clientEventId: e.clientEventId,
      type: e.type,
      severity: e.severity,
      source: e.source,
      startedAt: new Date(e.startedAt),
      endedAt: e.endedAt !== null ? new Date(e.endedAt) : null,
      durationMs,
      meta: e.meta,
    })
    .onConflictDoNothing()
    .returning();
  return row ? { id: row.id, fresh: true } : { id: "", fresh: false };
}

async function maybeQueueReview(attemptId: string, eventId: string, budget: number) {
  if (!eventId) return;
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proctorAiReviews)
    .innerJoin(proctorEvents, eq(proctorEvents.id, proctorAiReviews.eventId))
    .where(eq(proctorEvents.attemptId, attemptId));
  if ((used?.n ?? 0) >= budget) return;
  const [review] = await db
    .insert(proctorAiReviews)
    .values({ eventId, status: "QUEUED" })
    .onConflictDoNothing()
    .returning();
  // The frames for this moment arrive a second or two after the event; the
  // job waits for them (see the cron), so enqueueing now is safe.
  if (review) await enqueueProctorReview(eventId);
}

export const EVIDENCE_MIME = ["image/jpeg", "image/webp", "video/webm", "video/mp4", "audio/webm", "audio/mp4"];
export const MAX_FRAME_BYTES = 512 * 1024;
export const MAX_CLIP_BYTES = 3 * 1024 * 1024;

export async function storeEvidence(
  ctx: CandidateContext,
  attemptId: string,
  input: {
    kind: "WEBCAM_FRAME" | "SCREEN_FRAME" | "CLIP_VIDEO" | "CLIP_AUDIO";
    trigger: "REFERENCE" | "PERIODIC" | "VIOLATION";
    capturedAt: Date;
    mime: string;
    body: Uint8Array;
    clientEventId: string | null;
    width: number | null;
    height: number | null;
    browserSignals: Record<string, unknown> | null;
  },
) {
  const id = randomUUID();
  const key = proctorEvidenceKey({ orgId: ctx.assessment.orgId, assessmentId: ctx.assessment.id, evidenceId: id, mime: input.mime });
  await getStorage().putObject(key, input.mime, input.body);
  let eventId: string | null = null;
  if (input.clientEventId) {
    const [e] = await db
      .select({ id: proctorEvents.id })
      .from(proctorEvents)
      .where(and(eq(proctorEvents.attemptId, attemptId), eq(proctorEvents.clientEventId, input.clientEventId)));
    eventId = e?.id ?? null;
  }
  const purgeAfter = new Date(input.capturedAt.getTime() + ctx.evidenceRetentionDays * 86_400_000);
  await db.insert(proctorEvidence).values({
    id,
    orgId: ctx.assessment.orgId,
    attemptId,
    eventId,
    kind: input.kind,
    trigger: input.trigger,
    capturedAt: input.capturedAt,
    storageKey: key,
    mime: input.mime,
    bytes: input.body.byteLength,
    width: input.width,
    height: input.height,
    browserSignals: input.browserSignals,
    purgeAfter,
  });
  return { id };
}

async function checkTermination(
  solution: SolutionModule,
  policy: Awaited<ReturnType<SolutionModule["proctorPolicy"]>>,
  attemptId: string,
): Promise<boolean> {
  if (!policy?.termination.enabled) return false;
  const events = await db
    .select({ type: proctorEvents.type, startedAt: proctorEvents.startedAt, endedAt: proctorEvents.endedAt })
    .from(proctorEvents)
    .where(eq(proctorEvents.attemptId, attemptId));
  const decision = shouldTerminate(
    events.map((e) => ({ type: e.type, startedAt: e.startedAt.getTime(), endedAt: e.endedAt?.getTime() ?? null })),
    policy,
    Date.now(),
  );
  if (!decision.terminate) return false;
  await terminateAttempt(solution, attemptId, decision.reason ?? "POLICY");
  return true;
}

export async function terminateAttempt(solution: SolutionModule, attemptId: string, reason: string) {
  const updated = await db
    .update(attempts)
    .set({ terminatedAt: new Date(), terminationReason: reason })
    .where(and(eq(attempts.id, attemptId), sql`${attempts.terminatedAt} is null`))
    .returning();
  if (updated.length === 0) return;
  await serverEvent(attemptId, "TERMINATED", { reason });
  await solution.attempts.terminate(attemptId);
}

/** Recomputes the attempt's integrity summary from everything stored. */
export async function recomputeIntegrity(attemptId: string) {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) return;
  const rows = await db
    .select({ event: proctorEvents, verdict: proctorAiReviews.verdict })
    .from(proctorEvents)
    .leftJoin(proctorAiReviews, eq(proctorAiReviews.eventId, proctorEvents.id))
    .where(eq(proctorEvents.attemptId, attemptId))
    .orderBy(asc(proctorEvents.startedAt));
  const sessions = await db.select().from(proctorSessions).where(eq(proctorSessions.attemptId, attemptId));
  const events: IntegrityEvent[] = rows.map(({ event }) => ({
    id: event.id,
    type: event.type,
    severity: event.severity,
    startedAt: event.startedAt.getTime(),
    endedAt: event.endedAt?.getTime() ?? null,
    teacherStatus: event.teacherStatus,
  }));
  const reviews: Record<string, "CONFIRMED" | "NOT_CONFIRMED" | "UNCLEAR"> = {};
  for (const r of rows) if (r.verdict) reviews[r.event.id] = r.verdict;

  const start = (attempt.startedAt ?? attempt.createdAt).getTime();
  const end = (attempt.completedAt ?? new Date()).getTime();
  const span = Math.max(1, end - start);
  const cameraLostMs = rows
    .filter((r) => r.event.type === "CAMERA_LOST")
    .reduce((a, r) => a + ((r.event.endedAt?.getTime() ?? end) - r.event.startedAt.getTime()), 0);
  const env = sessions.map((s) => s.env as Record<string, unknown>);
  const summary = computeIntegrity({
    events,
    reviews,
    coverage: {
      modelUnavailable: rows.some((r) => r.event.type === "PROCTOR_MODEL_UNAVAILABLE"),
      shareUnverified: env.some((e) => e.displaySurface === "UNVERIFIED"),
      secondScreenUnverifiable: env.some((e) => e.isExtendedSupported === false),
      cameraCoverage: Math.max(0, Math.min(1, 1 - cameraLostMs / span)),
    },
    now: Date.now(),
  });
  await db
    .update(attempts)
    .set({ integritySummary: summary, integrityComputedAt: new Date() })
    .where(eq(attempts.id, attemptId));
  return summary;
}
