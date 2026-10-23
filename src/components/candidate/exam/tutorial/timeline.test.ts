import { describe, expect, it } from "vitest";
import type { CandidateItem } from "@/lib/exam/safe";
import type { TutorialScript } from "./script-types";
import {
  actionMs,
  buildTimeline,
  CARRY_MS,
  estimateNarrationMs,
  formatPlayTime,
  mergeAnswer,
  MOVE_MS,
  PRESS_MS,
  stateAt,
  stepIndexAt,
  TYPE_CHAR_MS,
} from "./timeline";

const choice: CandidateItem = {
  sequence: 1,
  section: "READING",
  type: "SINGLE_CHOICE",
  prompt: "Was passt?",
  content: { kind: "CHOICE", multiple: false, options: [{ id: "a", text: "Ja" }, { id: "b", text: "Nein" }] },
  stimulus: null,
  answer: null,
};
const matching: CandidateItem = {
  sequence: 2,
  section: "READING",
  type: "MATCHING",
  prompt: "Ordnen Sie zu.",
  content: { kind: "MATCHING", left: [{ id: "s1", text: "Eins" }, { id: "s2", text: "Zwei" }], right: [{ id: "ra", text: "Anzeige A" }, { id: "rb", text: "Anzeige B" }] },
  stimulus: null,
  answer: null,
};
const writing: CandidateItem = {
  sequence: 3,
  section: "WRITING",
  type: "WRITING_PROMPT",
  prompt: "Schreiben Sie.",
  content: { kind: "WRITING", minWords: 10, maxWords: 40 },
  stimulus: null,
  answer: null,
};

const script: TutorialScript = {
  section: "READING",
  stage: { layout: "single", items: [choice, matching, writing], nav: { current: 1, total: 3 }, clock: "10:00" },
  steps: [
    { id: "look", minMs: 2000, actions: [{ do: "spotlight", on: { kind: "ui", name: "timer" } }, { do: "move", to: { kind: "option", item: 0, id: "a" } }] },
    {
      id: "answer",
      actions: [
        { do: "click", on: { kind: "option", item: 0, id: "b" }, answer: { choiceIds: ["b"] } },
        { do: "click", on: { kind: "ui", name: "mark" }, mark: true },
      ],
    },
    { id: "drag", actions: [{ do: "drag", from: { kind: "chip", item: 1, id: "rb" }, to: { kind: "matchRow", item: 1, id: "s1" }, answer: { matches: { s1: "rb" } } }] },
    { id: "type", actions: [{ do: "type", into: { kind: "gap", item: 2, id: "text" }, text: "Hallo" }, { do: "wait", ms: 500 }] },
  ],
};

describe("tutorial timeline", () => {
  it("makes each step as long as the longest of narration, actions and minimum", () => {
    const tl = buildTimeline(script, { look: 1000, answer: 5000 });
    expect(tl.steps.map((s) => s.end - s.start)).toEqual([
      2000, // minMs beats the 600 ms move and the 1000 ms narration
      5000, // narration beats two clicks
      MOVE_MS + PRESS_MS + CARRY_MS + PRESS_MS, // actions only
      MOVE_MS + PRESS_MS + 5 * TYPE_CHAR_MS + 500,
    ]);
    expect(tl.total).toBe(tl.steps[3].end);
    expect(tl.steps[1].start).toBe(2000);
  });

  it("runs the actions of a step one after the other", () => {
    const tl = buildTimeline(script);
    const [first, second] = tl.steps[1].actions;
    expect(first.start).toBe(tl.steps[1].start);
    expect(second.start).toBe(first.end);
    expect(first.end - first.start).toBe(actionMs(first.action));
  });

  it("answers on the press, not before", () => {
    const tl = buildTimeline(script);
    const press = tl.steps[1].start + MOVE_MS;
    expect(stateAt(script, press - 1).answers[0]).toEqual({});
    expect(stateAt(script, press - 1).cursor).toEqual({ kind: "option", item: 0, id: "b" });
    const after = stateAt(script, press);
    expect(after.answers[0]).toEqual({ choiceIds: ["b"] });
    expect(after.press).toEqual({ at: press, target: { kind: "option", item: 0, id: "b" } });
  });

  it("toggles the Mark of the first item from the screen's Mark button", () => {
    const tl = buildTimeline(script);
    const markPress = tl.steps[1].actions[1].effect;
    expect(stateAt(script, markPress - 1).marks).toEqual([false, false, false]);
    const s = stateAt(script, markPress);
    expect(s.marks).toEqual([true, false, false]);
    expect(s.uiPresses.mark).toEqual([markPress]);
  });

  it("carries a dragged chip and drops it into the row at the end", () => {
    const tl = buildTimeline(script);
    const d = tl.steps[2].actions[0];
    expect(stateAt(script, d.start + 10).cursor).toEqual({ kind: "chip", item: 1, id: "rb" });
    const carrying = stateAt(script, d.start + MOVE_MS + 50);
    expect(carrying.carry).toEqual({ from: { kind: "chip", item: 1, id: "rb" }, since: d.start + MOVE_MS });
    expect(carrying.cursor).toEqual({ kind: "matchRow", item: 1, id: "s1" });
    expect(carrying.answers[1]).toEqual({});
    const dropped = stateAt(script, d.effect);
    expect(dropped.carry).toBeNull();
    expect(dropped.answers[1]).toEqual({ matches: { s1: "rb" } });
  });

  it("types letter by letter into the free text field", () => {
    const tl = buildTimeline(script);
    const ty = tl.steps[3].actions[0];
    expect(stateAt(script, ty.effect).answers[2].text).toBe("H");
    expect(stateAt(script, ty.effect + 2 * TYPE_CHAR_MS).answers[2].text).toBe("Hal");
    expect(stateAt(script, ty.effect + 2 * TYPE_CHAR_MS).typing).toEqual({ kind: "gap", item: 2, id: "text" });
    const done = stateAt(script, ty.end + 1);
    expect(done.answers[2].text).toBe("Hallo");
    expect(done.typing).toBeNull();
  });

  it("holds a spotlight for its own step only and names the caption's step", () => {
    expect(stateAt(script, 100).spotlight).toEqual({ kind: "ui", name: "timer" });
    expect(stateAt(script, 100).caption).toBe("look");
    const second = buildTimeline(script).steps[1].start;
    expect(stateAt(script, second).spotlight).toBeNull();
    expect(stateAt(script, second).caption).toBe("answer");
  });

  it("is a pure function of the time: seeking back undoes answers", () => {
    const end = buildTimeline(script).total;
    expect(stateAt(script, end).answers[0]).toEqual({ choiceIds: ["b"] });
    expect(stateAt(script, 0).answers).toEqual([{}, {}, {}]);
    expect(stateAt(script, end + 10_000).t).toBe(end);
    expect(stateAt(script, -5).t).toBe(0);
  });

  it("finds the step at a time, the last one at the end", () => {
    const tl = buildTimeline(script);
    expect(stepIndexAt(tl, 0)).toBe(0);
    expect(stepIndexAt(tl, tl.steps[2].start)).toBe(2);
    expect(stepIndexAt(tl, tl.total)).toBe(3);
  });

  it("merges record fields of an answer patch key by key", () => {
    expect(mergeAnswer({ gaps: { g1: "a" } }, { gaps: { g2: "b" } })).toEqual({ gaps: { g1: "a", g2: "b" } });
    expect(mergeAnswer({ choiceIds: ["a"] }, { choiceIds: ["b"] })).toEqual({ choiceIds: ["b"] });
  });

  it("estimates narration from the caption's words and formats play time", () => {
    expect(estimateNarrationMs("")).toBe(0);
    expect(estimateNarrationMs("one two three")).toBe(500 + 3 * 420);
    expect(formatPlayTime(0)).toBe("0:00");
    expect(formatPlayTime(40_999)).toBe("0:40");
    expect(formatPlayTime(61_000)).toBe("1:01");
  });
});
