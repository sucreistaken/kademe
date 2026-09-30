/**
 * Attempt integrity summary. Pure, no database.
 *
 * The output orders the teacher's review queue; it never fails a candidate on
 * its own. That shapes every rule below:
 *  1. Many small events must not outweigh one serious one, so repeats of the
 *     same type have diminishing returns.
 *  2. More evidence can never make an attempt look cleaner. Adding an event
 *     never lowers the score (the tests check this).
 *  3. The teacher overrides the machine: a dismissal weighs zero, a
 *     confirmation weighs more and always lands the attempt in review.
 *  4. Missing coverage is surfaced, and may lift CLEAR to REVIEW, but never to
 *     ATTENTION. Not being able to see is not evidence of cheating.
 */

import { TAXONOMY, type ProctorEventType, type Severity } from "./taxonomy";

export type TeacherStatus = "OPEN" | "CONFIRMED" | "DISMISSED";
export type AiVerdict = "CONFIRMED" | "NOT_CONFIRMED" | "UNCLEAR";
export type IntegrityLevel = "CLEAR" | "REVIEW" | "ATTENTION";

export type IntegrityEvent = {
  id: string;
  type: ProctorEventType;
  /** The stored, duration-adjusted severity (see effectiveSeverity). */
  severity: Severity;
  startedAt: number;
  endedAt: number | null;
  teacherStatus: TeacherStatus;
};

export type CoverageInput = {
  modelUnavailable: boolean;
  shareUnverified: boolean;
  secondScreenUnverifiable: boolean;
  /** Share of the attempt with a working camera feed, 0..1. */
  cameraCoverage: number;
};

export type CoverageGap =
  | "MODEL_UNAVAILABLE"
  | "SHARE_UNVERIFIED"
  | "SECOND_SCREEN_UNVERIFIABLE"
  | "LOW_CAMERA_COVERAGE";

export type IntegrityReason = { type: ProctorEventType; count: number; totalMs: number };

export type IntegrityResult = {
  level: IntegrityLevel;
  score: number;
  reasons: IntegrityReason[];
  /** HIGH events nobody has ruled on yet. */
  openHigh: number;
  coverageGaps: CoverageGap[];
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 3,
  HIGH: 8,
};

export const REVIEW_THRESHOLD = 4;
export const ATTENTION_THRESHOLD = 12;
export const MIN_CAMERA_COVERAGE = 0.8;

const AI_MULTIPLIER: Record<AiVerdict, number> = {
  CONFIRMED: 1.5,
  NOT_CONFIRMED: 0.3,
  UNCLEAR: 1,
};
const TEACHER_CONFIRMED_MULTIPLIER = 1.5;
/** Duration only counts past the first minute, and at most three minutes of it. */
const DURATION_FREE_MS = 60_000;
const DURATION_CAP_MINUTES = 3;

const LEVEL_RANK: Record<IntegrityLevel, number> = { CLEAR: 0, REVIEW: 1, ATTENTION: 2 };
const atLeast = (a: IntegrityLevel, b: IntegrityLevel) =>
  LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;

function durationMs(e: IntegrityEvent, now: number | undefined): number {
  const end = e.endedAt ?? now;
  if (end === undefined) return 0;
  return Math.max(0, end - e.startedAt);
}

function aiVerdict(
  reviews: Map<string, AiVerdict> | Record<string, AiVerdict>,
  id: string,
): AiVerdict | undefined {
  if (reviews instanceof Map) return reviews.get(id);
  return Object.prototype.hasOwnProperty.call(reviews, id) ? reviews[id] : undefined;
}

/** One event's weight before the per-type diminishing returns are applied. */
function rawWeight(
  e: IntegrityEvent,
  verdict: AiVerdict | undefined,
  now: number | undefined,
): number {
  if (e.teacherStatus === "DISMISSED") return 0;
  const base = SEVERITY_WEIGHT[e.severity];
  let weight = base;
  if (TAXONOMY[e.type].interval) {
    const extraMinutes = Math.max(0, durationMs(e, now) - DURATION_FREE_MS) / 60_000;
    weight += base * Math.min(DURATION_CAP_MINUTES, extraMinutes);
  }
  const multiplier =
    e.teacherStatus === "CONFIRMED"
      ? TEACHER_CONFIRMED_MULTIPLIER
      : verdict
        ? AI_MULTIPLIER[verdict]
        : 1;
  return weight * multiplier;
}

/**
 * `now` is optional: without it an open interval counts as zero length, which
 * is the conservative reading for a report generated after the fact.
 */
export function computeIntegrity(input: {
  events: IntegrityEvent[];
  reviews: Map<string, AiVerdict> | Record<string, AiVerdict>;
  coverage: CoverageInput;
  now?: number;
}): IntegrityResult {
  const { events, reviews, coverage, now } = input;

  const byType = new Map<ProctorEventType, { weights: number[]; count: number; totalMs: number }>();
  let openHigh = 0;
  let floor: IntegrityLevel = "CLEAR";

  for (const e of events) {
    const verdict = aiVerdict(reviews, e.id);
    if (e.severity === "HIGH" && e.teacherStatus === "OPEN") openHigh++;
    if (e.teacherStatus === "CONFIRMED") floor = "REVIEW";
    if (e.severity === "HIGH" && e.teacherStatus === "OPEN" && verdict === "CONFIRMED") {
      floor = "REVIEW";
    }

    let group = byType.get(e.type);
    if (!group) {
      group = { weights: [], count: 0, totalMs: 0 };
      byType.set(e.type, group);
    }
    group.weights.push(rawWeight(e, verdict, now));
    if (e.teacherStatus !== "DISMISSED") {
      group.count++;
      group.totalMs += TAXONOMY[e.type].interval ? durationMs(e, now) : 0;
    }
  }

  // Diminishing returns: the k-th event of a type counts 1/sqrt(k). The k is
  // assigned by weight, heaviest first, not by time. Chronological order would
  // let an early trivial event push a later serious one down the curve, and
  // the total could drop when evidence is added. Heaviest-first keeps the sum
  // monotone: an inserted event of weight y changes it by at least y/sqrt(n+1).
  const contributions: Array<{ reason: IntegrityReason; contribution: number }> = [];
  let score = 0;
  for (const [type, group] of byType) {
    const sorted = [...group.weights].sort((a, b) => b - a);
    let contribution = 0;
    sorted.forEach((w, i) => {
      contribution += w / Math.sqrt(i + 1);
    });
    score += contribution;
    if (contribution > 0) {
      contributions.push({
        reason: { type, count: group.count, totalMs: group.totalMs },
        contribution,
      });
    }
  }

  const reasons = contributions
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((c) => c.reason);

  const coverageGaps: CoverageGap[] = [];
  if (coverage.modelUnavailable) coverageGaps.push("MODEL_UNAVAILABLE");
  if (coverage.shareUnverified) coverageGaps.push("SHARE_UNVERIFIED");
  if (coverage.secondScreenUnverifiable) coverageGaps.push("SECOND_SCREEN_UNVERIFIABLE");
  if (coverage.cameraCoverage < MIN_CAMERA_COVERAGE) coverageGaps.push("LOW_CAMERA_COVERAGE");

  let level: IntegrityLevel =
    score < REVIEW_THRESHOLD ? "CLEAR" : score < ATTENTION_THRESHOLD ? "REVIEW" : "ATTENTION";
  level = atLeast(level, floor);

  // An unverifiable second screen is common and cannot be fixed by the
  // candidate, so it is reported but does not move the level.
  const coverageLifts =
    coverage.modelUnavailable ||
    coverage.shareUnverified ||
    coverage.cameraCoverage < MIN_CAMERA_COVERAGE;
  if (coverageLifts) level = atLeast(level, "REVIEW");

  return { level, score: Math.round(score * 100) / 100, reasons, openHigh, coverageGaps };
}
