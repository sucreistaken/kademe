import { describe, expect, it } from "vitest";
import { answerProgress, progressState, type ProgressContent } from "./answer-progress";

const tfng: ProgressContent = { kind: "TFNG", statements: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] };
const gap: ProgressContent = { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] };
const matching: ProgressContent = { kind: "MATCHING", left: [{ id: "l1" }, { id: "l2" }, { id: "l3" }] };

describe("answerProgress", () => {
  it("counts a choice as one sub-answer, single or multiple", () => {
    expect(answerProgress({ kind: "CHOICE" }, null)).toEqual({ filled: 0, total: 1 });
    expect(answerProgress({ kind: "CHOICE" }, { choiceIds: [] })).toEqual({ filled: 0, total: 1 });
    expect(answerProgress({ kind: "CHOICE" }, { choiceIds: ["a", "b"] })).toEqual({ filled: 1, total: 1 });
  });

  it("counts every true/false statement, ignoring unknown values and ids", () => {
    expect(answerProgress(tfng, { tfng: { s1: "R", s3: "NG" } })).toEqual({ filled: 2, total: 3 });
    expect(answerProgress(tfng, { tfng: { s1: "X" as "R", other: "F" } })).toEqual({ filled: 0, total: 3 });
  });

  it("counts gaps with text in them; spaces are empty", () => {
    expect(answerProgress(gap, { gaps: { g1: "ging", g2: "   " } })).toEqual({ filled: 1, total: 2 });
    expect(answerProgress(gap, {})).toEqual({ filled: 0, total: 2 });
  });

  it("treats a matching row set back to the empty option as empty", () => {
    expect(answerProgress(matching, { matches: { l1: "r1", l2: "", l3: "r3" } })).toEqual({ filled: 2, total: 3 });
    expect(answerProgress(matching, { matches: { l1: "", l2: "", l3: "" } })).toEqual({ filled: 0, total: 3 });
  });

  it("counts a text or a recording once", () => {
    for (const kind of ["SHORT_TEXT", "WRITING", "SPEAKING"] as const) {
      expect(answerProgress({ kind }, { text: "  " })).toEqual({ filled: 0, total: 1 });
      expect(answerProgress({ kind }, { text: "Hallo" })).toEqual({ filled: 1, total: 1 });
      expect(answerProgress({ kind }, { mediaAssetId: "m1" })).toEqual({ filled: 1, total: 1 });
    }
  });

  it("accepts the student's item content as it is sent", () => {
    // The CandidateContent shape (with options, texts and aliases) fits ProgressContent.
    const content = { kind: "MATCHING" as const, left: [{ id: "l1", text: "A" }], right: [{ id: "o1", text: "B" }] };
    expect(answerProgress(content, { matches: { l1: "o1" } })).toEqual({ filled: 1, total: 1 });
  });
});

describe("progressState", () => {
  it("is empty, partial or complete", () => {
    expect(progressState({ filled: 0, total: 3 })).toBe("EMPTY");
    expect(progressState({ filled: 2, total: 3 })).toBe("PARTIAL");
    expect(progressState({ filled: 3, total: 3 })).toBe("COMPLETE");
    expect(progressState({ filled: 1, total: 1 })).toBe("COMPLETE");
  });
});
