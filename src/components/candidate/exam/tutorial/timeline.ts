import type { ItemAnswer } from "@/lib/exam/types";
import type { DemoAction, StepDurations, Target, TutorialScript, UiName } from "./script-types";

/**
 * The tutorial's clock. A step lasts as long as the longest of its narration,
 * its actions and its minimum; inside a step the actions run one after the
 * other. Everything the stage shows at a moment comes from `stateAt`, a pure
 * function of the script and the time, so pausing, seeking and replaying never
 * leave anything behind.
 */

/** The fake cursor's travel to a target. */
export const MOVE_MS = 600;
/** A press (click, pick up, drop) and the short hold after it. */
export const PRESS_MS = 300;
/** Carrying a dragged chip from where it was picked up to where it is dropped. */
export const CARRY_MS = 900;
/** One typed character. */
export const TYPE_CHAR_MS = 55;

/**
 * The narration voice's pace per word, by language, measured on the recorded
 * captions (2026-10-23); Turkish and Arabic words are longer, so fewer of them
 * take as long. Other languages use the English pace.
 */
export const MS_PER_WORD: Record<string, number> = { en: 320, de: 350, es: 390, tr: 480, ar: 560 };
/** The quiet before and after a recorded caption. */
export const NARRATION_PAD_MS = 600;
/** The quiet gap after a recorded step, so two narrations never run back to back. */
export const RECORDED_GAP_MS = 350;

/** Narration time from the caption's word count when there is no recording. */
export function estimateNarrationMs(text: string, locale = "en"): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return words === 0 ? 0 : NARRATION_PAD_MS + words * (MS_PER_WORD[locale] ?? MS_PER_WORD.en);
}

export function actionMs(action: DemoAction): number {
  switch (action.do) {
    case "spotlight":
      return 0;
    case "move":
      return MOVE_MS;
    case "click":
      return MOVE_MS + PRESS_MS;
    case "drag":
      return MOVE_MS + PRESS_MS + CARRY_MS + PRESS_MS;
    case "type":
      return MOVE_MS + PRESS_MS + action.text.length * TYPE_CHAR_MS;
    case "wait":
      return Math.max(0, action.ms);
  }
}

/** When an action changes the stage: the press of a click, the drop of a drag, the first typed letter. */
function effectAt(action: DemoAction, start: number): number {
  switch (action.do) {
    case "click":
      return start + MOVE_MS;
    case "drag":
      return start + MOVE_MS + PRESS_MS + CARRY_MS;
    case "type":
      return start + MOVE_MS + PRESS_MS;
    default:
      return start;
  }
}

export type TimedAction = { action: DemoAction; start: number; end: number; effect: number };
export type TimedStep = { id: string; index: number; start: number; end: number; actions: TimedAction[] };
export type Timeline = { steps: TimedStep[]; total: number };

export function buildTimeline(script: TutorialScript, narration: StepDurations = {}): Timeline {
  let at = 0;
  const steps = script.steps.map((step, index) => {
    const start = at;
    let cursor = start;
    const actions = step.actions.map((action) => {
      const timed = { action, start: cursor, end: cursor + actionMs(action), effect: effectAt(action, cursor) };
      cursor = timed.end;
      return timed;
    });
    const length = Math.max(narration[step.id] ?? 0, cursor - start, step.minMs ?? 0);
    at = start + length;
    return { id: step.id, index, start, end: at, actions };
  });
  return { steps, total: at };
}

/** The step playing at `t` (the last one at or after the end). */
export function stepIndexAt(timeline: Timeline, t: number): number {
  const i = timeline.steps.findIndex((s) => t < s.end);
  return i === -1 ? Math.max(0, timeline.steps.length - 1) : i;
}

export type DemoState = {
  /** The time, clamped to the timeline. */
  t: number;
  step: number;
  /** The id of the step whose caption shows. */
  caption: string;
  /** Each stage item's answer, by item index. */
  answers: ItemAnswer[];
  /** Each stage item's Mark, by item index. */
  marks: boolean[];
  /** Where the cursor is (or is heading); null before the first move. */
  cursor: Target | null;
  /** The latest press at or before `t`, for the click ripple. */
  press: { at: number; target: Target } | null;
  /** A dragged chip on its way (picked up, not yet dropped). */
  carry: { from: Target; since: number } | null;
  spotlight: Target | null;
  /** The field being typed into, while letters still arrive. */
  typing: Target | null;
  /** When each part of the screen around the items was clicked. */
  uiPresses: Partial<Record<UiName, number[]>>;
  /** The matching row or gap whose list a click has opened and no later click has closed. */
  open: Target | null;
};

const RECORD_FIELDS = ["gaps", "matches", "tfng"] as const;

/** A click's answer patch merged into an item's answer; record fields merge key by key. */
export function mergeAnswer(base: ItemAnswer, patch: Partial<ItemAnswer>): ItemAnswer {
  const out: ItemAnswer = { ...base, ...patch };
  for (const field of RECORD_FIELDS) {
    const add = patch[field];
    if (add) (out as Record<string, unknown>)[field] = { ...(base[field] ?? {}), ...add };
  }
  return out;
}

/** The item a target belongs to; the screen around the items counts as the first item. */
export const itemOf = (target: Target): number => (target.kind === "ui" ? 0 : target.item);

/** Types `text` after what the field held: the free text field ("text") or one gap. */
function typedInto(answer: ItemAnswer, field: Target, before: string, text: string): ItemAnswer {
  if (field.kind === "gap" && field.id !== "text") return mergeAnswer(answer, { gaps: { [field.id]: before + text } });
  return { ...answer, text: before + text };
}

function fieldValue(answer: ItemAnswer, field: Target): string {
  if (field.kind === "gap" && field.id !== "text") return answer.gaps?.[field.id] ?? "";
  return answer.text ?? "";
}

export function stateAtTimeline(script: TutorialScript, timeline: Timeline, time: number): DemoState {
  const t = Math.min(Math.max(0, time), timeline.total);
  const current = stepIndexAt(timeline, t);
  const answers = script.stage.items.map((it) => it.answer ?? {});
  const marks = script.stage.items.map(() => false);
  const state: DemoState = {
    t,
    step: current,
    caption: timeline.steps[current]?.id ?? "",
    answers,
    marks,
    cursor: null,
    press: null,
    carry: null,
    spotlight: null,
    typing: null,
    uiPresses: {},
    open: null,
  };
  const pressed = (at: number, target: Target) => {
    state.press = { at, target };
    if (target.kind === "ui") (state.uiPresses[target.name] ??= []).push(at);
  };
  for (const step of timeline.steps) {
    if (step.start > t) break;
    state.spotlight = null;
    for (const { action, start, end, effect } of step.actions) {
      if (start > t) break;
      switch (action.do) {
        case "spotlight":
          state.spotlight = action.on;
          break;
        case "move":
          state.cursor = action.to;
          break;
        case "click": {
          state.cursor = action.on;
          if (t < effect) break;
          pressed(effect, action.on);
          const i = itemOf(action.on);
          if (action.answer && answers[i]) answers[i] = mergeAnswer(answers[i], action.answer);
          if (action.mark && i < marks.length) marks[i] = !marks[i];
          state.open = action.opens ? action.on : null;
          break;
        }
        case "drag": {
          state.cursor = action.from;
          const pickUp = start + MOVE_MS;
          if (t < pickUp) break;
          state.cursor = action.to;
          if (t < effect) {
            if (state.press?.at !== pickUp) state.press = { at: pickUp, target: action.from };
            state.carry = { from: action.from, since: pickUp };
            break;
          }
          state.carry = null;
          pressed(effect, action.to);
          const i = itemOf(action.to);
          if (answers[i]) answers[i] = mergeAnswer(answers[i], action.answer);
          break;
        }
        case "type": {
          state.cursor = action.into;
          if (t < effect) break;
          const i = itemOf(action.into);
          if (!answers[i]) break;
          pressed(effect, action.into);
          const letters = Math.min(action.text.length, Math.floor((t - effect) / TYPE_CHAR_MS) + 1);
          answers[i] = typedInto(answers[i], action.into, fieldValue(answers[i], action.into), action.text.slice(0, letters));
          state.typing = t < end ? action.into : null;
          break;
        }
        case "wait":
          break;
      }
    }
  }
  return state;
}

/** The stage at `tMs`: answers, marks, cursor, spotlight and the caption's step. */
export function stateAt(script: TutorialScript, tMs: number, narration: StepDurations = {}): DemoState {
  return stateAtTimeline(script, buildTimeline(script, narration), tMs);
}

/** "0:07": elapsed play time, whole seconds rounded down. */
export function formatPlayTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
