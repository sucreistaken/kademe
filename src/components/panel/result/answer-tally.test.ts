import { describe, expect, it } from "vitest";
import type { ItemSnapshot } from "@/lib/exam/types";
import { answerTally, itemTally, type TallyResponse } from "./answer-tally";

const base = { id: "i", section: "GRAMMAR", level: "B1", difficulty: 0, stimulusId: null, orderInStimulus: 0, rubric: null, points: 1, stimulus: null, skillTag: "x" } as const;

const ctest = {
  ...base,
  type: "GAP_FILL",
  prompt: "Ich mö{{g1}} gern und arb{{g2}} viel.",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["chte"], g2: ["eite"] } },
} as ItemSnapshot;
const tfng = {
  ...base,
  type: "TRUE_FALSE_NG",
  prompt: "Text",
  content: { kind: "TFNG", statements: [{ id: "s1", text: "a" }, { id: "s2", text: "b" }, { id: "s3", text: "c" }] },
  key: { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } },
} as ItemSnapshot;
const choice = {
  ...base,
  type: "SINGLE_CHOICE",
  prompt: "Q",
  content: { kind: "CHOICE", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
  key: { kind: "CHOICE", correct: ["a"] },
} as ItemSnapshot;
const short = {
  ...base,
  type: "SHORT_TEXT",
  prompt: "Q",
  content: { kind: "SHORT_TEXT" },
  key: { kind: "SHORT_TEXT", accepted: ["Berlin"] },
} as ItemSnapshot;

const r = (id: string, itemSnapshot: ItemSnapshot, answer: TallyResponse["answer"], score: number | null, notReached = false): TallyResponse => ({ id, itemSnapshot, answer, score, notReached });

describe("answerTally", () => {
  it("counts each gap, statement and single item as one answer", () => {
    const t = answerTally([
      r("1", ctest, { gaps: { g1: "chte", g2: "x" } }, 0.5),
      r("2", tfng, { tfng: { s1: "R", s2: "R", s3: "NG" } }, 0.67),
      r("3", choice, { choiceIds: ["a"] }, 1),
      r("4", choice, { choiceIds: ["b"] }, 0),
    ]);
    expect(t).toEqual({ correct: 1 + 2 + 1 + 0, total: 2 + 3 + 1 + 1 });
  });
  it("counts a blank item as asked, a not-reached one not at all", () => {
    expect(answerTally([r("1", choice, null, 0), r("2", choice, null, null, true)])).toEqual({ correct: 0, total: 1 });
    expect(answerTally([r("1", choice, null, 0, true)], {}, { navigable: true })).toEqual({ correct: 0, total: 1 });
  });
  it("counts a teacher-accepted gap and a whole accepted short answer as correct", () => {
    const t = answerTally([r("1", ctest, { gaps: { g1: "chte", g2: "xyz" } }, 0.5), r("2", short, { text: "Berlín" }, 0)], { "1": { gapIds: ["g2"] }, "2": { gapIds: [] } });
    expect(t).toEqual({ correct: 3, total: 3 });
  });
  it("leaves a writing task out", () => {
    const writing = { ...base, type: "WRITING_PROMPT", prompt: "w", content: { kind: "TEXT" }, key: { kind: "NONE" } } as unknown as ItemSnapshot;
    expect(itemTally({ itemSnapshot: writing, answer: { text: "hi" }, score: null }, undefined)).toBeNull();
  });
});
