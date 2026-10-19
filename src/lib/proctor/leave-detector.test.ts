import { describe, expect, it } from "vitest";
import {
  FOCUS_LOSS_AFTER_MS,
  IDLE_BEFORE_LEAVE_MS,
  INITIAL_LEAVE_STATE,
  OWN_PROMPT_GRACE_MS,
  stepLeave,
  type LeaveAction,
  type LeaveInput,
  type LeaveState,
} from "./leave-detector";

/** Feeds inputs in order and collects every action. */
function run(inputs: LeaveInput[], from: LeaveState = INITIAL_LEAVE_STATE) {
  let state = from;
  const actions: LeaveAction[] = [];
  for (const input of inputs) {
    const r = stepLeave(state, input);
    state = r.state;
    actions.push(...r.actions);
  }
  return { state, actions };
}

/** 500 ms ticks from `from` to `to` (inclusive) with the given focus. */
function ticks(from: number, to: number, hasFocus: boolean, hidden = false): LeaveInput[] {
  const out: LeaveInput[] = [];
  for (let t = from; t <= to; t += 500) out.push({ type: "tick", t, hasFocus, hidden });
  return out;
}

describe("stepLeave: focus", () => {
  it("records a blur that lasts and warns when the student comes back", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "blur", t: 1_000 },
      ...ticks(1_500, 4_000, false),
      { type: "focus", t: 6_000 },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: 1_000 } },
      { do: "END", kind: "FOCUS_LOST", warn: true },
    ]);
  });

  it("ignores a blur shorter than the threshold", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "blur", t: 1_000 },
      ...ticks(1_500, 1_000 + FOCUS_LOSS_AFTER_MS - 500, false),
      { type: "focus", t: 1_000 + FOCUS_LOSS_AFTER_MS - 100 },
    ]);
    expect(actions).toEqual([]);
  });

  it("records but does not warn when there was no input before the loss", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "blur", t: IDLE_BEFORE_LEAVE_MS + 5_000 },
      ...ticks(IDLE_BEFORE_LEAVE_MS + 5_500, IDLE_BEFORE_LEAVE_MS + 9_000, false),
      { type: "focus", t: IDLE_BEFORE_LEAVE_MS + 10_000 },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: IDLE_BEFORE_LEAVE_MS + 5_000 } },
      { do: "END", kind: "FOCUS_LOST", warn: false },
    ]);
  });

  it("does not warn when the page never had any input", () => {
    const { actions } = run([{ type: "blur", t: 1_000 }, ...ticks(1_500, 4_000, false), { type: "focus", t: 5_000 }]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: null } },
      { do: "END", kind: "FOCUS_LOST", warn: false },
    ]);
  });

  it("a second blur does not start a stale episode after the focus came back", () => {
    // The old timer code lost the first timer on a second blur and began FOCUS_LOST after the return.
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "blur", t: 1_000 },
      { type: "blur", t: 1_200 },
      { type: "focus", t: 1_500 },
      ...ticks(2_000, 8_000, true),
    ]);
    expect(actions).toEqual([]);
  });

  it("closes the episode from the tick when the focus event is missed", () => {
    const { actions, state } = run([
      { type: "input", t: 0 },
      { type: "blur", t: 1_000 },
      ...ticks(1_500, 4_000, false),
      ...ticks(4_500, 5_000, true),
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: 1_000 } },
      { do: "END", kind: "FOCUS_LOST", warn: true },
    ]);
    expect(state.focusLost).toBeNull();
  });

  it("notices a loss of focus from the tick when the blur event is missed", () => {
    const { actions } = run([{ type: "input", t: 0 }, ...ticks(500, 3_500, false)]);
    expect(actions).toEqual([{ do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: 500 } }]);
  });
});

describe("stepLeave: our own prompts", () => {
  it("a picker that takes the focus is not a loss", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "promptStart", t: 0, reason: "SCREEN" },
      { type: "blur", t: 100 },
      ...ticks(500, 8_000, false),
      { type: "promptEnd", t: 8_000 },
      { type: "focus", t: 8_400 },
      ...ticks(8_500, 12_000, true),
    ]);
    expect(actions).toEqual([]);
  });

  it("the focus may come back within the grace after the prompt closes", () => {
    const end = 8_000;
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "promptStart", t: 0, reason: "FULLSCREEN" },
      { type: "promptEnd", t: end },
      { type: "blur", t: end + 200 },
      ...ticks(end + 500, end + OWN_PROMPT_GRACE_MS + FOCUS_LOSS_AFTER_MS - 500, false),
      { type: "focus", t: end + OWN_PROMPT_GRACE_MS + FOCUS_LOSS_AFTER_MS - 100 },
    ]);
    expect(actions).toEqual([]);
  });

  it("records, without a warning, a loss that outlasts the prompt and its grace", () => {
    const end = 5_000;
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "promptStart", t: 0, reason: "SCREEN" },
      { type: "blur", t: 100 },
      { type: "promptEnd", t: end },
      ...ticks(end, end + OWN_PROMPT_GRACE_MS + FOCUS_LOSS_AFTER_MS + 500, false),
      { type: "focus", t: 20_000 },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: 100, afterPrompt: "SCREEN" } },
      { do: "END", kind: "FOCUS_LOST", warn: false },
    ]);
  });

  it("a blur long after the prompt counts normally again", () => {
    const { actions } = run([
      { type: "promptStart", t: 0, reason: "SCREEN" },
      { type: "promptEnd", t: 1_000 },
      { type: "input", t: 9_000 },
      { type: "blur", t: 10_000 },
      ...ticks(10_500, 13_000, false),
      { type: "focus", t: 14_000 },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "FOCUS_LOST", meta: { inputGapMs: 1_000 } },
      { do: "END", kind: "FOCUS_LOST", warn: true },
    ]);
  });
});

describe("stepLeave: visibility", () => {
  it("a tab switch after input is recorded at once and warned on return", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "hidden", t: 300 },
      { type: "visible", t: 9_000, hasFocus: true },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "TAB_HIDDEN", meta: { inputGapMs: 300 } },
      { do: "END", kind: "TAB_HIDDEN", warn: true },
    ]);
  });

  it("a display that sleeps after minutes without input is recorded without a warning", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "hidden", t: 120_000 },
      { type: "visible", t: 180_000, hasFocus: true },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "TAB_HIDDEN", meta: { inputGapMs: 120_000 } },
      { do: "END", kind: "TAB_HIDDEN", warn: false },
    ]);
  });

  it("a hide during our own prompt is recorded without a warning", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "promptStart", t: 0, reason: "FULLSCREEN" },
      { type: "hidden", t: 200 },
      { type: "visible", t: 900, hasFocus: true },
      { type: "promptEnd", t: 1_000 },
    ]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "TAB_HIDDEN", meta: { inputGapMs: 200, afterPrompt: "FULLSCREEN" } },
      { do: "END", kind: "TAB_HIDDEN", warn: false },
    ]);
  });

  it("a tick with focus closes a hide whose visible event was missed", () => {
    const { actions } = run([{ type: "input", t: 0 }, { type: "hidden", t: 100 }, ...ticks(5_000, 5_000, true)]);
    expect(actions).toEqual([
      { do: "BEGIN", kind: "TAB_HIDDEN", meta: { inputGapMs: 100 } },
      { do: "END", kind: "TAB_HIDDEN", warn: true },
    ]);
  });

  it("does not begin the same hide twice", () => {
    const { actions } = run([
      { type: "input", t: 0 },
      { type: "hidden", t: 100 },
      { type: "hidden", t: 200 },
    ]);
    expect(actions.filter((a) => a.do === "BEGIN")).toHaveLength(1);
  });
});
