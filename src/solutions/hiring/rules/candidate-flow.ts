import type { HiringActivityConfig, HiringResponsePayload } from "@/db/schema";
import { hasText } from "@/lib/library/anchors";
import { decideClose } from "@/lib/stage-timeout";
import { acceptsWrite, computeDeadline, SUBMIT_SLACK_MS } from "@/lib/timer";
import { isChoice, isRecorded, type ActivityType, type ContentActivity, type StageTimeout } from "./content";

/**
 * The hiring candidate flow's rules (hiring solution design 2.4, HIRING-UX 6).
 * Pure: the server applies them under locks, the screens use the same ones to
 * explain themselves, the tests pin them.
 */

/** HIRING-UX 6.1: the candidate picks extra time without giving a reason. */
export const EXTRA_TIME_OPTIONS = [0, 25, 50] as const;
export type ExtraTimePct = (typeof EXTRA_TIME_OPTIONS)[number];
export const isExtraTimePct = (value: unknown): value is ExtraTimePct => value === 0 || value === 25 || value === 50;

/** Seconds on this candidate's stage clock: duration × (100 + pct) / 100, rounded up. */
export function effectiveSeconds(durationSeconds: number, pct: ExtraTimePct): number {
  // A percentage the database would refuse (extra_time_pct IN (0, 25, 50)) grants nothing.
  const safe = isExtraTimePct(pct) ? pct : 0;
  return Math.ceil((durationSeconds * (100 + safe)) / 100);
}

/**
 * Written once, when the stage starts; a reload reads it back and nothing moves
 * it. ALLOW_GRACE bakes its grace into the deadline (lib/stage-timeout).
 */
export function stageDeadline(
  startedAt: Date,
  stage: { durationSeconds: number; graceSeconds: number; onTimeout: StageTimeout },
  pct: ExtraTimePct,
): Date {
  return computeDeadline(startedAt, effectiveSeconds(stage.durationSeconds, pct), stage.onTimeout === "ALLOW_GRACE" ? stage.graceSeconds : 0);
}

/** The clock ran out and the server closes the run. ALLOW_LATE never closes by itself. */
export function isOverdue(
  run: { startedAt: Date | null; deadlineAt: Date | null; submittedAt: Date | null },
  onTimeout: StageTimeout,
  now: Date,
): boolean {
  if (!run.startedAt || !run.deadlineAt || run.submittedAt) return false;
  if (onTimeout === "ALLOW_LATE") return false;
  return now.getTime() > run.deadlineAt.getTime() + SUBMIT_SLACK_MS;
}

/**
 * The most characters the server ever keeps of one answer, whatever the stored
 * limit says. Equals the builder's ceiling for `maxChars` (activityConfigSchema).
 */
export const MAX_TEXT_CHARS = 20_000;
/**
 * The file size limit of a FILE_UPLOAD question that sets none. The upload
 * routes read it from here, so the candidate hint and the server agree.
 */
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

type Shape = { type: ActivityType; config: HiringActivityConfig };

/** A stored limit counts only when it is a usable number; anything else falls back to the default. */
const wholeOr = (value: unknown, fallback: number, min: number): number =>
  typeof value === "number" && Number.isFinite(value) && Math.floor(value) >= min ? Math.floor(value) : fallback;

/**
 * The longest text the server keeps for this question (the builder's defaults:
 * 3000 long, 300 short; 3000 for a recording's written alternative; 0 where no
 * text is kept). Never above MAX_TEXT_CHARS. Later tasks import this.
 */
export function maxCharsOf(a: Shape): number {
  const own =
    a.type === "LONG_TEXT"
      ? wholeOr(a.config.maxChars, 3000, 1)
      : a.type === "SHORT_TEXT"
        ? wholeOr(a.config.maxChars, 300, 1)
        : isRecorded(a.type)
          ? 3000
          : 0;
  return Math.min(own, MAX_TEXT_CHARS);
}

export function minCharsOf(a: Shape): number {
  return a.type === "LONG_TEXT" || a.type === "SHORT_TEXT" ? wholeOr(a.config.minChars, 0, 0) : 0;
}

/**
 * Text as the jsonb column can hold it: no NUL and no lone surrogate (Postgres
 * refuses both), cut to `max` UTF-16 units without leaving half a character.
 */
function storableText(value: string, max: number): string {
  const clean = value.replace(/\u0000/g, "").replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "");
  const cut = clean.slice(0, max);
  return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/** Choice ids the candidate was shown: labelled ones only, like the candidate view. */
function visibleChoiceIds(a: Shape): Set<string> {
  return new Set((a.config.choices ?? []).filter((c) => hasText(c.label)).map((c) => c.id));
}

/**
 * What the server stores from a candidate's save. Only the fields of the
 * question's type are read, trimmed to their limits; the parts the server
 * attaches itself (a file, an upload in progress) are kept from `previous`
 * whatever the client sends.
 */
export function sanitizeResponse(a: Shape, raw: unknown, previous: HiringResponsePayload): HiringResponsePayload {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: HiringResponsePayload = {};
  if (previous.file) out.file = previous.file;
  if (previous.pendingFile) out.pendingFile = previous.pendingFile;
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      if (typeof input.text === "string") out.text = storableText(input.text, maxCharsOf(a));
      else if (previous.text !== undefined) out.text = previous.text;
      break;
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE": {
      if (Array.isArray(input.choiceIds)) {
        const valid = visibleChoiceIds(a);
        const ids = [...new Set(input.choiceIds.filter((x): x is string => typeof x === "string" && valid.has(x)))];
        out.choiceIds = a.type === "SINGLE_CHOICE" ? ids.slice(0, 1) : ids;
      } else if (previous.choiceIds) out.choiceIds = previous.choiceIds;
      break;
    }
    case "VIDEO":
    case "AUDIO":
      // The written alternative exists only where the team switched it on (HIRING-UX A7).
      if (a.config.textAlternativeEnabled && input.usedTextAlternative === true) {
        out.usedTextAlternative = true;
        out.text = typeof input.text === "string" ? storableText(input.text, maxCharsOf(a)) : (previous.text ?? "");
      }
      break;
    case "FILE_UPLOAD":
      break;
  }
  return out;
}

/** Trimmed length of the stored text; a stored payload of the wrong shape counts as empty. */
const textLength = (payload: HiringResponsePayload): number => (typeof payload.text === "string" ? payload.text.trim().length : 0);

/** True when the question carries an answer: text long enough, a choice, a usable take, a written alternative, an attached file. */
export function responseAnswered(a: Shape, payload: HiringResponsePayload, hasTake: boolean): boolean {
  switch (a.type) {
    case "LONG_TEXT":
    case "SHORT_TEXT":
      return textLength(payload) >= Math.max(1, minCharsOf(a));
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return Array.isArray(payload.choiceIds) && payload.choiceIds.length > 0;
    case "VIDEO":
    case "AUDIO":
      return hasTake || (payload.usedTextAlternative === true && textLength(payload) > 0);
    case "FILE_UPLOAD":
      return !!payload.file;
  }
}

/**
 * Decision 10: 1 when the chosen set equals the right set, else 0; null for a
 * question that is not a choice, has no right answer, or has a right answer the
 * candidate could not see (unlabelled, dropped by sanitizeResponse). Never shown to the candidate.
 */
export function autoScore(a: Pick<ContentActivity, "type" | "config">, payload: HiringResponsePayload): number | null {
  if (!isChoice(a.type)) return null;
  const correct = (a.config.choices ?? []).filter((c) => c.correct);
  // A right answer the candidate could not see (no label) cannot be judged fairly: no score, the reviewer decides.
  if (correct.length === 0 || correct.some((c) => !hasText(c.label))) return null;
  const right = correct.map((c) => c.id).sort();
  const chosen = [...new Set(Array.isArray(payload.choiceIds) ? payload.choiceIds : [])].sort();
  return chosen.length === right.length && chosen.every((id, i) => id === right[i]) ? 1 : 0;
}

export function missingRequired(activities: Array<{ id: string; required: boolean }>, answered: (id: string) => boolean): string[] {
  return activities.filter((a) => a.required && !answered(a.id)).map((a) => a.id);
}

/**
 * How a stage run ends. A submit is COMPLETE or PARTIAL by the required
 * answers. The clock keeps whatever was written (lib/stage-timeout
 * decideClose): COMPLETE or PARTIAL when there is something, EXPIRED when
 * there is nothing or the team chose AUTO_CLOSE; always late.
 */
export function runCompletion(input: {
  reason: "SUBMIT" | "CLOCK";
  late: boolean;
  behaviour: StageTimeout;
  requiredCount: number;
  answeredRequired: number;
  answeredAny: number;
}): { completion: "COMPLETE" | "PARTIAL" | "EXPIRED"; late: boolean } {
  const byCounts = input.answeredRequired >= input.requiredCount ? "COMPLETE" : "PARTIAL";
  if (input.reason === "SUBMIT") return { completion: byCounts, late: input.late };
  const decided = decideClose({ behaviour: input.behaviour, requiredCount: input.requiredCount, answeredRequired: input.answeredRequired, answeredAny: input.answeredAny });
  if (decided.action === "LEAVE_OPEN") return { completion: byCounts, late: true };
  // decideClose calls a stage with nothing required PARTIAL; a submit would call it COMPLETE, so the clock does too.
  // AUTO_CLOSE (EXPIRED) and a stage with nothing answered (EXPIRED) stay as decided.
  if (decided.completion === "PARTIAL" && input.requiredCount === 0) return { completion: "COMPLETE", late: true };
  return { completion: decided.completion, late: true };
}

export type WriteRefusal =
  | "NO_STAGE"
  | "STAGE_MISMATCH"
  | "STAGE_NOT_STARTED"
  | "STAGE_EXPIRED"
  | "ACTIVITY_NOT_FOUND"
  | "ACTIVITY_CLOSED"
  | "ACTIVITY_ORDER";

/**
 * Decision 7: every write names the stage and the question it believes it is
 * on; the server refuses rather than guess. `activities` are the running
 * stage's questions in order, `closed` when the candidate already closed one.
 */
export function writeRefusal(input: {
  current: { position: number; startedAt: Date | null; deadlineAt: Date | null; onTimeout: StageTimeout; backNavigation: boolean } | null;
  position: unknown;
  activityId: unknown;
  activities: Array<{ id: string; closed: boolean }>;
  now: Date;
}): WriteRefusal | null {
  const { current } = input;
  if (!current) return "NO_STAGE";
  if (input.position !== current.position) return "STAGE_MISMATCH";
  if (!current.startedAt || !current.deadlineAt) return "STAGE_NOT_STARTED";
  if (!acceptsWrite(current.deadlineAt, current.onTimeout, input.now)) return "STAGE_EXPIRED";
  const target = input.activities.find((a) => a.id === input.activityId);
  if (!target) return "ACTIVITY_NOT_FOUND";
  if (current.backNavigation) return null;
  if (target.closed) return "ACTIVITY_CLOSED";
  const firstOpen = input.activities.find((a) => !a.closed);
  if (firstOpen && firstOpen.id !== target.id) return "ACTIVITY_ORDER";
  return null;
}

export type StageRule =
  | { kind: "think"; seconds: number | null }
  | { kind: "thinkStrict"; seconds: number | null }
  | { kind: "takes"; count: number | null }
  | { kind: "noRetake" }
  | { kind: "noBack" }
  | { kind: "back" }
  | { kind: "lateAllowed" };

/** One value when every item agrees, else null (the copy then says "her soruda yazar"). */
const common = (values: number[]): number | null => (values.length && values.every((v) => v === values[0]) ? values[0] : null);

/**
 * HIRING-UX 6.5: only the rules that apply to this stage, in a fixed order:
 * think time (and whether recording starts by itself), retakes, going back,
 * finishing late.
 */
export function stageRules(
  stage: { activities: Array<{ type: ActivityType; thinkSeconds: number; flexibleThink: boolean; maxTakes: number }> },
  options: { backNavigation: boolean; onTimeout: StageTimeout },
): StageRule[] {
  const rules: StageRule[] = [];
  const recorded = stage.activities.filter((a) => isRecorded(a.type));
  const thinking = recorded.filter((a) => a.thinkSeconds > 0);
  if (thinking.length) {
    const seconds = common(thinking.map((a) => a.thinkSeconds));
    rules.push(thinking.some((a) => !a.flexibleThink) ? { kind: "thinkStrict", seconds } : { kind: "think", seconds });
  }
  if (recorded.length) {
    const retakes = recorded.map((a) => Math.max(0, a.maxTakes - 1));
    if (retakes.every((r) => r === 0)) rules.push({ kind: "noRetake" });
    else rules.push({ kind: "takes", count: common(retakes) });
  }
  rules.push(options.backNavigation ? { kind: "back" } : { kind: "noBack" });
  if (options.onTimeout === "ALLOW_LATE") rules.push({ kind: "lateAllowed" });
  return rules;
}

/**
 * HIRING-UX 6: the thin bar and "Aşama 2 / 3". One definition for the candidate
 * pages and the preview: finished stages plus the share of the current stage.
 */
export function progressOf(input: { stagePosition: number; stageCount: number; activityIndex: number; activityCount: number }): { n: number; total: number; ratio: number } {
  const whole = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const position = whole(input.stagePosition);
  const total = whole(input.stageCount);
  if (total === 0) return { n: position, total: 0, ratio: 0 };
  const count = whole(input.activityCount);
  const within = count > 0 ? Math.min(1, whole(input.activityIndex) / count) : 0;
  const ratio = Math.min(1, Math.max(0, (position - 1 + within) / total));
  return { n: position, total, ratio };
}

export type HiringStep = "CONSENT" | "INFO" | "CHECK" | "STAGE" | "DONE" | "CLOSED";

/**
 * The page each step lives on, relative to /a/[token]: the state carries it
 * without the token (the core forms do not know the solution, the server does
 * not keep the raw token). A closed opening is told on the landing.
 */
export function hiringStepSuffix(step: HiringStep, position: number | null): string {
  switch (step) {
    case "CONSENT":
    case "CLOSED":
      return "";
    case "INFO":
      return "/info";
    case "CHECK":
      return "/check";
    case "STAGE":
      return `/stage/${typeof position === "number" && Number.isInteger(position) && position >= 1 ? position : 1}`;
    case "DONE":
      return "/done";
  }
}

export function hiringStepPath(token: string, step: HiringStep, position: number | null): string {
  return `/a/${encodeURIComponent(token)}${hiringStepSuffix(step, position)}`;
}

/** Where a resumed stage opens: the first question the candidate has not closed (the last when all are). */
export function firstOpenIndex(closed: boolean[]): number {
  const open = closed.findIndex((c) => !c);
  return open === -1 ? Math.max(0, closed.length - 1) : open;
}

/** Decision 5: extra time changes only while no stage is running. */
export function extraTimeRefusal(runs: Array<{ startedAt: Date | null; submittedAt: Date | null }>): "EXTRA_TIME_LOCKED" | null {
  return runs.some((r) => r.startedAt && !r.submittedAt) ? "EXTRA_TIME_LOCKED" : null;
}

/** A file's own name without any path, control character or direction override, at most 200 characters. */
export function cleanFileName(raw: unknown): string {
  if (typeof raw !== "string") return "dosya";
  const base = raw.split(/[\\/]/).pop() ?? "";
  // Controls, direction overrides (a name that reads backwards), lone surrogates.
  const clean = base
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "")
    .trim();
  if (clean === "" || clean === "." || clean === "..") return "dosya";
  const cut = clean.slice(0, 200);
  return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut;
}
