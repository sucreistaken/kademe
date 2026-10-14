import { createHmac } from "node:crypto";
import { TAXONOMY, type ProctorEventType, type Severity } from "@/lib/proctor/taxonomy";

/**
 * The integrity tab and the printable report as data. Pure, no database: the
 * page loads the rows, this folds hundreds of raw events into a short list a
 * teacher can read ("3 serious, 2 medium"), one group per event type.
 *
 * A group's severity is the highest severity among the events the teacher has
 * not dismissed; a group whose events are all dismissed is "settled" and no
 * longer counts as a flag. Technical groups (connection and system records)
 * are kept apart so a few hundred heartbeat gaps cannot bury a phone sighting.
 */

/** Connection and system records. Not something the candidate did. */
export const NOISE_TYPES: readonly ProctorEventType[] = ["HEARTBEAT_GAP", "SNAPSHOT_GAP", "RESUMED"];
const NOISE: ReadonlySet<string> = new Set(NOISE_TYPES);

export type TeacherStatus = "OPEN" | "CONFIRMED" | "DISMISSED";
export type AiVerdict = "CONFIRMED" | "NOT_CONFIRMED" | "UNCLEAR";

export type FlagEvent = {
  id: string;
  type: ProctorEventType;
  severity: Severity;
  startedAt: number;
  durationMs: number | null;
  teacherStatus: TeacherStatus;
  /** The AI second look, if there is one. */
  review?: { status: string; verdict: AiVerdict | null } | null;
  /** Warnings shown to the student, when the client reported it. Never required. */
  warningCount?: number | null;
};

export type FlagGroup = {
  type: ProctorEventType;
  /** Highest severity among events not dismissed; the highest overall when all are dismissed. */
  severity: Severity;
  count: number;
  first: number;
  last: number;
  /** Event id of the earliest event, the target of "watch in the recording". */
  firstEventId: string;
  totalMs: number;
  open: number;
  confirmed: number;
  dismissed: number;
  ai: Record<AiVerdict, number> & { pending: number };
  /** Largest warning count reported on any event of the group, or null. */
  maxWarning: number | null;
  /** All events dismissed: no longer a flag. */
  settled: boolean;
  technical: boolean;
  eventIds: string[];
};

const RANK: Record<Severity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const maxSeverity = (a: Severity, b: Severity): Severity => (RANK[a] >= RANK[b] ? a : b);

export const isNoiseType = (type: string): boolean => NOISE.has(type);

export function groupFlags(events: readonly FlagEvent[]): FlagGroup[] {
  const byType = new Map<ProctorEventType, FlagEvent[]>();
  for (const e of [...events].sort((a, b) => a.startedAt - b.startedAt)) {
    const list = byType.get(e.type);
    if (list) list.push(e);
    else byType.set(e.type, [e]);
  }
  const groups: FlagGroup[] = [];
  for (const [type, list] of byType) {
    const live = list.filter((e) => e.teacherStatus !== "DISMISSED");
    const sevOf = (xs: FlagEvent[]) => xs.reduce<Severity>((m, e) => maxSeverity(m, e.severity), "INFO");
    const ai = { CONFIRMED: 0, NOT_CONFIRMED: 0, UNCLEAR: 0, pending: 0 };
    for (const e of list) {
      if (!e.review) continue;
      if (e.review.verdict) ai[e.review.verdict] += 1;
      else ai.pending += 1;
    }
    const warnings = list.map((e) => e.warningCount).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const severity = live.length > 0 ? sevOf(live) : sevOf(list);
    groups.push({
      type,
      severity,
      count: list.length,
      first: list[0].startedAt,
      last: list[list.length - 1].startedAt,
      firstEventId: list[0].id,
      totalMs: list.reduce((s, e) => s + (e.durationMs ?? 0), 0),
      open: list.filter((e) => e.teacherStatus === "OPEN").length,
      confirmed: list.filter((e) => e.teacherStatus === "CONFIRMED").length,
      dismissed: list.length - live.length,
      ai,
      maxWarning: warnings.length ? Math.max(...warnings) : null,
      settled: live.length === 0,
      technical: isNoiseType(type) || sevOf(list) === "INFO" || TAXONOMY[type].coverage,
      eventIds: list.map((e) => e.id),
    });
  }
  // Most serious first, then the most frequent, then the earliest.
  return groups.sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.count - a.count || a.first - b.first);
}

export type FlagSummary = {
  serious: number;
  medium: number;
  low: number;
  /** Non-technical groups whose events were all dismissed. */
  settled: number;
  /** Non-technical groups, settled ones last. */
  flags: FlagGroup[];
  technical: FlagGroup[];
  technicalEvents: number;
};

export function summarizeFlags(events: readonly FlagEvent[]): FlagSummary {
  const all = groupFlags(events);
  const technical = all.filter((g) => g.technical);
  const flags = all.filter((g) => !g.technical);
  // Settled groups drop to the bottom of the list but keep their order among themselves.
  const ordered = [...flags.filter((g) => !g.settled), ...flags.filter((g) => g.settled)];
  const live = flags.filter((g) => !g.settled);
  return {
    serious: live.filter((g) => g.severity === "HIGH").length,
    medium: live.filter((g) => g.severity === "MEDIUM").length,
    low: live.filter((g) => g.severity === "LOW").length,
    settled: flags.length - live.length,
    flags: ordered,
    technical,
    technicalEvents: technical.reduce((s, g) => s + g.count, 0),
  };
}

/** Clock time in the school's zone, for the group rows and the report. */
export const clockTime = (ms: number): string =>
  new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(ms));

/** 8 uppercase hex characters of an HMAC over the attempt id, distinct from the level report's code. */
export function integrityVerificationCode(attemptId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kademe-integrity:${attemptId}`).digest("hex").slice(0, 8).toUpperCase();
}

/** Reads meta.warningCount when the client reported it; anything else is ignored. */
export function warningCountOf(meta: unknown): number | null {
  const n = (meta as { warningCount?: unknown } | null | undefined)?.warningCount;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}
