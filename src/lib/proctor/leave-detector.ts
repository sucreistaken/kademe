/**
 * Decides when "the student left the exam" is recorded and when it is worth
 * the big warning. Pure, no DOM: the engine feeds browser facts in (blur,
 * focus, visibility, input, a 500 ms tick with document.hasFocus()) and acts
 * on what comes out.
 *
 * Why it is not just "blur for 2 seconds":
 *  - Our own prompts take the focus: the screen-share picker when a lost share
 *    is restored, the fullscreen transition, a camera prompt. A student fixing
 *    the exam is not leaving it. A blur that starts while such a prompt is open
 *    (or just after it closes) only counts if the focus is still away once the
 *    prompt is over.
 *  - Something can take the focus by itself (a display going to sleep, a call
 *    or reminder window, an update dialog). Leaving on purpose needs an action
 *    inside the page first: the pointer crosses the fullscreen page or a key
 *    (Cmd, Alt, Win) is pressed. A loss of focus with no input before it is
 *    still recorded, with the gap, but raises no warning.
 *  - The focus event can be missed (the old code also lost a pending timer on
 *    a second blur), so the tick reads document.hasFocus() and closes what the
 *    events did not.
 */

/** Focus must stay away this long before it is recorded (the address bar, a permission bubble). */
export const FOCUS_LOSS_AFTER_MS = 2_000;
/** After one of our own prompts closes, the focus has this long to come back by itself. */
export const OWN_PROMPT_GRACE_MS = 2_500;
/** No input in the page for this long before the loss: it was not the student's doing. */
export const IDLE_BEFORE_LEAVE_MS = 10_000;

export type LeaveKind = "FOCUS_LOST" | "TAB_HIDDEN";

export type LeaveInput =
  | { type: "blur"; t: number }
  | { type: "focus"; t: number }
  | { type: "hidden"; t: number }
  | { type: "visible"; t: number; hasFocus: boolean }
  | { type: "tick"; t: number; hasFocus: boolean; hidden: boolean }
  | { type: "input"; t: number }
  | { type: "promptStart"; t: number; reason: string }
  | { type: "promptEnd"; t: number };

/** What the episode looked like when it began; goes into the event's meta. */
export type LeaveMeta = {
  /** Milliseconds since the last input inside the page; null when there was none yet. */
  inputGapMs: number | null;
  /** Set when the loss began during or right after one of our own prompts. */
  afterPrompt?: string;
};

export type LeaveAction =
  | { do: "BEGIN"; kind: LeaveKind; meta: LeaveMeta }
  /** `warn`: the student caused it, so the big warning is raised now that they are back. */
  | { do: "END"; kind: LeaveKind; warn: boolean };

type Episode = { onset: number; meta: LeaveMeta; warn: boolean };

export type LeaveState = {
  lastInputAt: number | null;
  /** Our own prompt that is open now, if any. */
  prompt: string | null;
  /** The last prompt that closed, and until when its grace runs. */
  lastPrompt: string | null;
  graceUntil: number;
  /** The window lost focus at this time and has not had it back. */
  blurAt: number | null;
  /** The blur began under a prompt; its counting starts when the grace ends. */
  blurUnderPrompt: string | null;
  focusLost: Episode | null;
  hidden: Episode | null;
};

export const INITIAL_LEAVE_STATE: LeaveState = {
  lastInputAt: null,
  prompt: null,
  lastPrompt: null,
  graceUntil: 0,
  blurAt: null,
  blurUnderPrompt: null,
  focusLost: null,
  hidden: null,
};

function underPrompt(s: LeaveState, t: number): string | null {
  if (s.prompt) return s.prompt;
  return t < s.graceUntil ? s.lastPrompt : null;
}

function episode(s: LeaveState, onset: number, afterPrompt: string | null): Episode {
  const inputGapMs = s.lastInputAt === null ? null : Math.max(0, onset - s.lastInputAt);
  const meta: LeaveMeta = { inputGapMs, ...(afterPrompt ? { afterPrompt } : {}) };
  const caused = inputGapMs !== null && inputGapMs <= IDLE_BEFORE_LEAVE_MS;
  return { onset, meta, warn: caused && !afterPrompt };
}

function regainFocus(s: LeaveState, out: LeaveAction[]): LeaveState {
  if (s.focusLost) out.push({ do: "END", kind: "FOCUS_LOST", warn: s.focusLost.warn });
  return { ...s, blurAt: null, blurUnderPrompt: null, focusLost: null };
}

/** Starts FOCUS_LOST once the blur has lasted long enough outside any prompt. */
function maybeBeginFocusLost(s: LeaveState, t: number, out: LeaveAction[]): LeaveState {
  if (s.blurAt === null || s.focusLost) return s;
  if (underPrompt(s, t)) return s;
  // A blur that began under a prompt counts from the end of its grace.
  const from = s.blurUnderPrompt ? Math.max(s.blurAt, s.graceUntil) : s.blurAt;
  if (t - from < FOCUS_LOSS_AFTER_MS) return s;
  const ep = episode(s, s.blurAt, s.blurUnderPrompt);
  out.push({ do: "BEGIN", kind: "FOCUS_LOST", meta: ep.meta });
  return { ...s, focusLost: ep };
}

export function stepLeave(s: LeaveState, input: LeaveInput): { state: LeaveState; actions: LeaveAction[] } {
  const out: LeaveAction[] = [];
  let next = s;
  switch (input.type) {
    case "input":
      next = { ...s, lastInputAt: input.t };
      break;
    case "promptStart":
      next = { ...s, prompt: input.reason };
      break;
    case "promptEnd":
      next = { ...s, lastPrompt: s.prompt ?? s.lastPrompt, prompt: null, graceUntil: input.t + OWN_PROMPT_GRACE_MS };
      break;
    case "blur":
      if (s.blurAt === null) next = { ...s, blurAt: input.t, blurUnderPrompt: underPrompt(s, input.t) };
      break;
    case "focus":
      next = regainFocus(s, out);
      break;
    case "hidden":
      if (!s.hidden) {
        const ep = episode(s, input.t, underPrompt(s, input.t));
        out.push({ do: "BEGIN", kind: "TAB_HIDDEN", meta: ep.meta });
        next = { ...s, hidden: ep };
      }
      break;
    case "visible":
      if (s.hidden) out.push({ do: "END", kind: "TAB_HIDDEN", warn: s.hidden.warn });
      next = { ...s, hidden: null };
      if (input.hasFocus) next = regainFocus(next, out);
      break;
    case "tick":
      if (input.hasFocus && !input.hidden) {
        // A missed "visible" or "focus" event: close what is still open.
        if (s.hidden) {
          out.push({ do: "END", kind: "TAB_HIDDEN", warn: s.hidden.warn });
          next = { ...next, hidden: null };
        }
        if (next.blurAt !== null || next.focusLost) next = regainFocus(next, out);
      } else if (!input.hasFocus && next.blurAt === null) {
        // A missed "blur" event: the focus is away all the same.
        next = { ...next, blurAt: input.t, blurUnderPrompt: underPrompt(next, input.t) };
      }
      next = maybeBeginFocusLost(next, input.t, out);
      break;
  }
  return { state: next, actions: out };
}
