/**
 * Stage clock. Pure functions only, so the rules can be tested without a
 * database or a browser.
 *
 * The server is the only authority. The client renders a countdown from a
 * server-issued deadline and re-syncs on every heartbeat; it never decides when
 * time is up. Refreshing the page must neither reset nor extend the clock, so
 * the deadline is derived once at stage start and then simply read back.
 *
 * The clock is wall time, not active time: a candidate who closes the tab to
 * think or look something up does not get free time. Interruptions are logged
 * for the manager, who can grant a retake if that seems unfair.
 */

export type TimeoutBehaviour =
  | "AUTO_SUBMIT"
  | "AUTO_CLOSE"
  | "ALLOW_GRACE"
  | "ALLOW_LATE";

/** Small allowance for request latency, so a submit sent just in time survives. */
export const SUBMIT_SLACK_MS = 5_000;

export function computeDeadline(
  startedAt: Date,
  durationSeconds: number,
  graceSeconds = 0,
): Date {
  return new Date(startedAt.getTime() + (durationSeconds + graceSeconds) * 1000);
}

export function remainingMs(deadlineAt: Date, now: Date = new Date()): number {
  return Math.max(0, deadlineAt.getTime() - now.getTime());
}

export function isExpired(deadlineAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= deadlineAt.getTime();
}

/**
 * Whether the server should still accept a write for this stage run.
 * ALLOW_LATE keeps accepting and the run is flagged late instead of rejected.
 */
export function acceptsWrite(
  deadlineAt: Date,
  behaviour: TimeoutBehaviour,
  now: Date = new Date(),
): boolean {
  if (behaviour === "ALLOW_LATE") return true;
  return now.getTime() <= deadlineAt.getTime() + SUBMIT_SLACK_MS;
}

export function isLate(deadlineAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > deadlineAt.getTime() + SUBMIT_SLACK_MS;
}

/**
 * Video activities run think time first, then answer time. Recording starts when
 * think time ends, or earlier if the candidate says they are ready.
 */
export type VideoPhase = "THINKING" | "RECORDING" | "DONE";

export function videoPhase(
  startedAt: Date,
  thinkSeconds: number,
  answerSeconds: number,
  now: Date = new Date(),
  startedEarlyAt?: Date | null,
): VideoPhase {
  const recordingStart = startedEarlyAt
    ? startedEarlyAt
    : new Date(startedAt.getTime() + thinkSeconds * 1000);
  if (now < recordingStart) return "THINKING";
  if (now.getTime() < recordingStart.getTime() + answerSeconds * 1000) {
    return "RECORDING";
  }
  return "DONE";
}

/**
 * A recording longer than the allowed answer time is rejected server side. The
 * 10 percent margin absorbs encoder overshoot on the final chunk; it is not a
 * bonus the candidate can use.
 */
export function isMediaOverlong(durationMs: number, answerSeconds: number) {
  return durationMs > answerSeconds * 1000 * 1.1;
}

/** mm:ss for the countdown. Always two digits so the layout does not shift. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
