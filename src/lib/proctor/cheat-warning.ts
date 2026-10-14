/**
 * The big warning the student sees when something serious is recorded. Pure,
 * no DOM: the engine feeds events in, the overlay draws what comes out.
 *
 * The student must see that the system noticed, so a serious event opens a
 * modal overlay with a running count ("your 3rd warning"). It never ends the
 * exam; a teacher decides. To keep the count honest and the screen usable:
 *  - the same kind of warning shows at most once per 20 seconds (the event is
 *    still recorded, only the overlay is held back and not counted);
 *  - related events share one kind (leaving the tab fires TAB_HIDDEN and
 *    FOCUS_LOST together, but it is one act and one warning);
 *  - while an overlay is open, the next warning waits its turn.
 */

import type { ProctorEventType } from "./taxonomy";

export type WarningKind =
  | "PHONE"
  | "MULTIPLE_FACES"
  | "LEFT_EXAM"
  | "SECOND_SCREEN"
  | "CLIPBOARD"
  | "DUPLICATE_TAB"
  | "WRONG_SURFACE"
  | "GAZE"
  | "NO_FACE";

/** The same kind shows at most once per this long. */
export const WARNING_RATE_LIMIT_MS = 20_000;
/** Gaze away must hold this long, from its onset, before it becomes a warning. */
export const GAZE_WARNING_AFTER_MS = 6_000;
/** A missing face must last this long, from its onset, before the banner becomes a warning. */
export const NO_FACE_WARNING_AFTER_MS = 10_000;
/** screen.isExtended is also read on this interval (some setups never fire "change"). */
export const EXTENDED_POLL_MS = 5_000;

/** Kinds the student cannot dismiss until the cause is gone. */
export const PERSISTENT_KINDS: ReadonlySet<WarningKind> = new Set<WarningKind>(["SECOND_SCREEN"]);

/** Which warning an event raises; null for events that are recorded silently. */
export function warningKindFor(type: ProctorEventType, detail?: { shortcutKey?: string }): WarningKind | null {
  switch (type) {
    case "PHONE_DETECTED":
      return "PHONE";
    case "MULTIPLE_FACES":
      return "MULTIPLE_FACES";
    case "TAB_HIDDEN":
    case "FOCUS_LOST":
      return "LEFT_EXAM";
    case "SECOND_SCREEN_DETECTED":
      return "SECOND_SCREEN";
    case "COPY_ATTEMPT":
    case "PASTE_ATTEMPT":
      return "CLIPBOARD";
    case "BLOCKED_SHORTCUT":
      // Only the clipboard shortcuts are a warning; F12 and friends stay a quiet record.
      return detail?.shortcutKey && ["c", "v", "x"].includes(detail.shortcutKey) ? "CLIPBOARD" : null;
    case "DUPLICATE_TAB":
    case "DUPLICATE_SESSION":
      return "DUPLICATE_TAB";
    case "SCREEN_SHARE_WRONG_SURFACE":
      return "WRONG_SURFACE";
    case "GAZE_AWAY":
      return "GAZE";
    case "NO_FACE":
      return "NO_FACE";
    default:
      return null;
  }
}

export type ActiveWarning = {
  kind: WarningKind;
  /** This warning's number in the attempt (1-based). */
  count: number;
  at: number;
  /** Cannot be dismissed while `resolved` is false. */
  persistent: boolean;
  resolved: boolean;
};

export type WarningState = {
  /** Warnings counted so far in this attempt. */
  count: number;
  lastShown: Partial<Record<WarningKind, number>>;
  open: ActiveWarning | null;
  queue: ActiveWarning[];
};

export const INITIAL_WARNING_STATE: WarningState = { count: 0, lastShown: {}, open: null, queue: [] };

export type RaiseResult = {
  state: WarningState;
  /** A warning was accepted (it is open or queued). False when held back by the rate limit. */
  accepted: boolean;
  /** The attempt's warning count after this call; what goes in the event's meta. */
  count: number;
};

export function raiseWarning(state: WarningState, kind: WarningKind, now: number): RaiseResult {
  const persistent = PERSISTENT_KINDS.has(kind);
  const last = state.lastShown[kind];
  const limited = last !== undefined && now - last < WARNING_RATE_LIMIT_MS;
  const alreadyUp = state.open?.kind === kind || state.queue.some((w) => w.kind === kind);
  if (alreadyUp) return { state, accepted: false, count: state.count };
  if (limited && !persistent) return { state, accepted: false, count: state.count };

  // A persistent kind that is still true must be on screen again (a reload, a dismissed
  // overlay with the cause back), but one cause is not counted twice inside the window.
  const count = limited ? state.count : state.count + 1;
  const warning: ActiveWarning = { kind, count, at: now, persistent, resolved: !persistent };
  const lastShown = { ...state.lastShown, [kind]: limited ? last : now };
  const next: WarningState = state.open
    ? { count, lastShown, open: state.open, queue: [...state.queue, warning] }
    : { count, lastShown, open: warning, queue: state.queue };
  return { state: next, accepted: true, count };
}

/** The student pressed the button. A persistent warning whose cause remains does not close. */
export function dismissWarning(state: WarningState): WarningState {
  if (!state.open) return state;
  if (state.open.persistent && !state.open.resolved) return state;
  const [nextOpen, ...rest] = state.queue;
  return { ...state, open: nextOpen ?? null, queue: rest };
}

/** The cause is gone (the second screen was unplugged): the button works now. */
export function resolveWarning(state: WarningState, kind: WarningKind): WarningState {
  const mark = (w: ActiveWarning) => (w.kind === kind && !w.resolved ? { ...w, resolved: true } : w);
  if (!state.open && state.queue.length === 0) return state;
  return { ...state, open: state.open ? mark(state.open) : null, queue: state.queue.map(mark) };
}

/** Milliseconds still to wait until a condition that began at `onsetAt` has lasted `afterMs`. */
export function delayUntilLasted(onsetAt: number, now: number, afterMs: number): number {
  return Math.max(0, afterMs - (now - onsetAt));
}

export type ExtendedDecision = "RAISE" | "CLEAR" | "NONE";

/**
 * What a second-screen reading means. `extended` is screen.isExtended;
 * `screenCount` is screens.length from the Window Management API (null when
 * that is not available). Either one saying "more than one screen" counts.
 */
export function secondScreenPresent(extended: boolean | null, screenCount: number | null): boolean | null {
  const byCount = screenCount === null ? null : screenCount > 1;
  if (extended === true || byCount === true) return true;
  if (extended === null && byCount === null) return null;
  return false;
}

/** Called on every reading (the change events and the 5 second poll alike). */
export function extendedDecision(present: boolean | null, raised: boolean): ExtendedDecision {
  if (present === true && !raised) return "RAISE";
  if (present !== true && raised) return "CLEAR";
  return "NONE";
}

// ---- persistence (sessionStorage): a reload keeps the number --------------------------

export function serializeWarnings(state: WarningState): string {
  return JSON.stringify({ count: state.count, lastShown: state.lastShown });
}

const KINDS: ReadonlySet<string> = new Set<WarningKind>([
  "PHONE",
  "MULTIPLE_FACES",
  "LEFT_EXAM",
  "SECOND_SCREEN",
  "CLIPBOARD",
  "DUPLICATE_TAB",
  "WRONG_SURFACE",
  "GAZE",
  "NO_FACE",
]);

/** Reads what serializeWarnings wrote; anything else starts from zero. */
export function parseWarnings(raw: string | null): WarningState {
  if (!raw) return INITIAL_WARNING_STATE;
  try {
    const j = JSON.parse(raw) as { count?: unknown; lastShown?: unknown };
    const count = typeof j.count === "number" && Number.isInteger(j.count) && j.count >= 0 ? j.count : 0;
    const lastShown: Partial<Record<WarningKind, number>> = {};
    if (j.lastShown && typeof j.lastShown === "object") {
      for (const [k, v] of Object.entries(j.lastShown)) {
        if (KINDS.has(k) && typeof v === "number" && Number.isFinite(v)) lastShown[k as WarningKind] = v;
      }
    }
    return { count, lastShown, open: null, queue: [] };
  } catch {
    return INITIAL_WARNING_STATE;
  }
}
