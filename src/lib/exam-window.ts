import { ORG_TIMEZONE, zonedDayStart } from "@/lib/org-timezone";

/**
 * The window a student's exam link is open in: `notBefore` (null: open now)
 * to `expiresAt` (the last day to start). Pure, so the invite wizard, the
 * server action, the link check and the tests all apply the same rules.
 * Times are typed and shown in the school's zone (ORG_TIMEZONE), never the
 * browser's.
 */

export const DEFAULT_WINDOW_DAYS = 14;
/** The last entry is at least this long after the exam opens. */
export const MIN_WINDOW_MS = 60 * 60_000;
/** A far-off date is a typo (the wrong year), not a plan. */
export const MAX_WINDOW_DAYS = 365;
/** A start typed "now" a moment ago is still now. */
const START_GRACE_MS = 60_000;

const DAY_MS = 86_400_000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type WindowMoment = { date: string; time: string };
/** `start` null: "Hemen". `end` null: the default (14 days after the start). */
export type WindowInput = { start: WindowMoment | null; end: WindowMoment | null };
export type WindowFault = "START_INVALID" | "START_PAST" | "END_INVALID" | "END_TOO_EARLY" | "END_TOO_FAR";
export type WindowResult = { ok: true; notBefore: Date | null; expiresAt: Date } | { ok: false; fault: WindowFault };

/** "2026-10-14" + "09:30" in the zone as an instant, or null if either is not real. */
export function zonedMoment(moment: WindowMoment, timeZone: string = ORG_TIMEZONE): Date | null {
  const time = TIME_RE.exec(moment.time);
  const day = zonedDayStart(moment.date, timeZone);
  if (!time || !day) return null;
  return new Date(day.getTime() + (Number(time[1]) * 60 + Number(time[2])) * 60_000);
}

/** The wall-clock time (HH:mm) of an instant in the zone, for a time field. */
export function orgTime(at: Date, timeZone: string = ORG_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

/**
 * The window the manager chose. The start must not be in the past; the end
 * is at least an hour after the start (or after now, on "Hemen") and within
 * a year of it. No end: 14 days after the start.
 */
export function resolveWindow(input: WindowInput, opts: { now: Date; timeZone?: string }): WindowResult {
  const tz = opts.timeZone ?? ORG_TIMEZONE;
  let notBefore: Date | null = null;
  if (input.start) {
    notBefore = zonedMoment(input.start, tz);
    if (!notBefore) return { ok: false, fault: "START_INVALID" };
    if (notBefore.getTime() < opts.now.getTime() - START_GRACE_MS) return { ok: false, fault: "START_PAST" };
  }
  const base = notBefore ?? opts.now;
  if (!input.end) return { ok: true, notBefore, expiresAt: new Date(base.getTime() + DEFAULT_WINDOW_DAYS * DAY_MS) };
  const expiresAt = zonedMoment(input.end, tz);
  if (!expiresAt) return { ok: false, fault: "END_INVALID" };
  if (expiresAt.getTime() < base.getTime() + MIN_WINDOW_MS) return { ok: false, fault: "END_TOO_EARLY" };
  if (expiresAt.getTime() > base.getTime() + MAX_WINDOW_DAYS * DAY_MS) return { ok: false, fault: "END_TOO_FAR" };
  return { ok: true, notBefore, expiresAt };
}

/** Where a link stands against its window. */
export type WindowPhase = "BEFORE" | "INSIDE" | "AFTER";

export function windowPhase(link: { notBefore: Date | null; expiresAt: Date }, now: Date): WindowPhase {
  if (link.notBefore && link.notBefore.getTime() > now.getTime()) return "BEFORE";
  return link.expiresAt.getTime() < now.getTime() ? "AFTER" : "INSIDE";
}

/**
 * The link problem the window (and the link's status) puts on a token, or
 * null when it opens. The one rule behind the student pages and every
 * student endpoint: nothing can be started before `notBefore`. A student
 * already inside keeps going past the end date; only a link not yet started
 * lapses.
 */
export function windowProblem(
  link: { status: string; notBefore: Date | null; expiresAt: Date },
  now: Date,
): "COMPLETED" | "EXPIRED" | "NOT_YET" | null {
  if (link.status === "COMPLETED") return "COMPLETED";
  if (link.status === "EXPIRED") return "EXPIRED";
  const phase = windowPhase(link, now);
  if (phase === "BEFORE") return "NOT_YET";
  if (phase === "AFTER" && link.status === "NOT_STARTED") return "EXPIRED";
  return null;
}
