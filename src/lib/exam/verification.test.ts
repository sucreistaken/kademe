import { describe, expect, it } from "vitest";
import { computeResult, type SectionEvidence } from "./result";
import type { ItemSnapshot, Section } from "./types";
import {
  aboveClaimPossible,
  bandOf,
  objectiveVerdict,
  productiveVerdict,
  reachedAnswerCap,
  skillShown,
  verificationBands,
  type VerificationBands,
} from "./verification";

const rules = { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [] as Section[], minHoldProbability: 0.5 };
const bands = (below: [number, number], at: [number, number], above: [number, number] = [0, 0]): VerificationBands => ({
  below: { earned: below[0], served: below[1] },
  at: { earned: at[0], served: at[1] },
  above: { earned: above[0], served: above[1] },
});
const obj = (section: "GRAMMAR" | "READING" | "LISTENING", b: VerificationBands, theta = 2): SectionEvidence => ({
  section,
  kind: "OBJECTIVE",
  // A ceiling-high estimate on purpose: the verdict must not read it.
  posterior: { mean: theta, sd: 0.4 },
  answered: 12,
  insufficient: false,
  bands: b,
});
const task = (level: "A0" | "A1" | "A2" | "B1", truncated = false, decider: "AI" | "TEACHER" = "AI") => ({ level, decider, truncated });
const prod = (section: "WRITING" | "SPEAKING", tasks: ReturnType<typeof task>[]): SectionEvidence => ({
  section,
  kind: "PRODUCTIVE",
  level: tasks[0].level,
  decider: tasks[0].decider,
  tasks,
});
const verify = (claimed: "A1" | "A2" | "C2", sections: SectionEvidence[], extra: Partial<Parameters<typeof computeResult>[0]> = {}) =>
  computeResult({ mode: "LEVEL_VERIFICATION", claimed, rules, sections, ...extra }).verification!;

describe("objective verdict", () => {
  it("passes at 60% pooled with the claim units at 50%", () => {
    // below 4/4, at 3/6: pooled 7/10 = 70%, at-claim exactly 50%.
    expect(objectiveVerdict(bands([4, 4], [3, 6]))).toBe("PASS");
  });
  it("is borderline when the at-claim guard is missed although pooled is 60% or more", () => {
    // below 5/5, at 2/6: pooled 7/11 = 63%, at-claim 33%.
    expect(objectiveVerdict(bands([5, 5], [2, 6]))).toBe("BORDERLINE");
  });
  it("is borderline from 50% to 59% pooled and fails below 50%", () => {
    expect(objectiveVerdict(bands([3, 5], [3, 5]))).toBe("PASS"); // exactly 60%
    expect(objectiveVerdict(bands([4, 5], [1, 5]))).toBe("BORDERLINE"); // 50%
    expect(objectiveVerdict(bands([2, 5], [3, 5]))).toBe("BORDERLINE");
    expect(objectiveVerdict(bands([2, 5], [2, 5]))).toBe("FAIL");
  });
  it("62.5% pooled: at-claim exactly 50% passes, 33% does not", () => {
    expect(objectiveVerdict(bands([7, 10], [3, 6]))).toBe("PASS"); // 10/16
    expect(objectiveVerdict(bands([8, 10], [2, 6]))).toBe("BORDERLINE"); // 10/16, at 33%
  });
  it("is inconclusive with fewer than 4 at-claim units", () => {
    expect(objectiveVerdict(bands([8, 8], [3, 3]))).toBe("INCONCLUSIVE");
  });
  it("does not count claim+1 units in the decision", () => {
    expect(objectiveVerdict(bands([2, 6], [2, 6], [8, 8]))).toBe("FAIL");
  });
});

describe("bands from items", () => {
  const choice = (level: "A1" | "A2" | "B1", n = 1): Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level"> =>
    ({
      type: "SINGLE_CHOICE",
      skillTag: "reading",
      level,
      content: { kind: "CHOICE", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }], multiple: false },
      key: { kind: "CHOICE", correct: ["a"] },
      n,
    }) as unknown as Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">;
  it("groups units by item level and counts blank and not-reached units as served, earned 0", () => {
    const b = verificationBands(
      [
        { itemSnapshot: choice("A1"), score: 1, answer: { choiceIds: ["a"] } },
        { itemSnapshot: choice("A2"), score: 1, answer: { choiceIds: ["a"] } },
        { itemSnapshot: choice("A2"), score: 0, answer: null },
        { itemSnapshot: choice("B1"), score: 0, answer: null },
      ],
      "A2",
    );
    expect(b).toEqual({ below: { earned: 1, served: 1 }, at: { earned: 1, served: 2 }, above: { earned: 0, served: 1 } });
  });
  it("folds below onto the claim for A1 and has no above for C2", () => {
    expect(bandOf("A1", "A1")).toBe("at");
    expect(bandOf("A2", "A1")).toBe("above");
    expect(bandOf("C2", "C2")).toBe("at");
    expect(bandOf("C1", "C2")).toBe("below");
  });
});

describe("productive verdict", () => {
  it("passes when every task is at or above the claim", () => {
    expect(productiveVerdict([task("A2"), task("B1")], "A2")).toBe("PASS");
  });
  it("fails when every task is below, or any task two levels below", () => {
    expect(productiveVerdict([task("A1"), task("A1")], "A2")).toBe("FAIL");
    expect(productiveVerdict([task("A2"), task("A0")], "A2")).toBe("FAIL");
  });
  it("splits when some pass and some are one level below", () => {
    expect(productiveVerdict([task("A1"), task("A2")], "A2")).toBe("SPLIT");
  });
  it("sends a truncated take to the teacher instead of failing it", () => {
    expect(productiveVerdict([task("A1", true), task("A2")], "A2")).toBe("TRUNCATED");
    expect(productiveVerdict([task("A1", true), task("A1", true)], "A2")).toBe("TRUNCATED");
    // The teacher has decided the take: it is judged like any other.
    expect(productiveVerdict([task("A1", true, "TEACHER"), task("A2")], "A2")).toBe("SPLIT");
    // Other tasks failing on their own still fail.
    expect(productiveVerdict([task("A1", true), task("A0")], "A2")).toBe("FAIL");
  });
  it("detects a take that reached the answer time cap", () => {
    expect(reachedAnswerCap(60_000, 60)).toBe(true);
    expect(reachedAnswerCap(58_600, 60)).toBe(true);
    expect(reachedAnswerCap(55_000, 60)).toBe(false);
    expect(reachedAnswerCap(null, 60)).toBe(false);
  });
});

describe("claim verdict", () => {
  it("the real A2 case: skills pass, truncated speaking, so a teacher decides and the hint shows", () => {
    // Reading 10.67/11 and listening all right on A1 and A2 units (an estimate of B2 or C1), grammar fine.
    const v = verify("A2", [
      obj("READING", bands([5.67, 6], [5, 5], [3, 4]), 1.2),
      obj("LISTENING", bands([6, 6], [5, 5], [3, 3]), 1.8),
      obj("GRAMMAR", bands([5, 6], [6, 8], [2, 2]), 0.6),
      prod("WRITING", [task("A2"), task("A2")]),
      prod("SPEAKING", [task("A1", true), task("A2")]),
    ]);
    expect(v.outcome).toBe("INCONCLUSIVE");
    expect(v.reasons).toEqual(["TRUNCATED_TAKE:SPEAKING"]);
    // The hint reads the objective skills only: a speaking take cut by the timer says nothing about B1.
    expect(v.hint).toBe("ABOVE_CLAIM_POSSIBLE");
    // Graded take not cut (the real recording was 50.6 s of 60): the tasks split, a teacher decides all the same.
    const split = verify("A2", [obj("READING", bands([5.67, 6], [5, 5], [3, 4]), 1.2), prod("SPEAKING", [task("A1"), task("A2")])]);
    expect(split.outcome).toBe("INCONCLUSIVE");
    expect(split.reasons).toEqual(["SKILL_SPLIT:SPEAKING"]);
  });

  it("shows the hint when every skill passes and the claim+1 units were mostly earned", () => {
    const v = verify("A2", [obj("READING", bands([5, 6], [5, 5], [3, 4])), obj("LISTENING", bands([6, 6], [5, 5], [4, 4])), prod("SPEAKING", [task("A2"), task("B1")])]);
    expect(v.outcome).toBe("PASS");
    expect(v.hint).toBe("ABOVE_CLAIM_POSSIBLE");
  });

  it("has no hint on a C2 claim or below 75% of the claim+1 units", () => {
    expect(verify("C2", [obj("READING", bands([5, 6], [5, 5], [4, 4]))]).hint).toBeUndefined();
    expect(verify("A2", [obj("READING", bands([5, 6], [5, 5], [2, 4]))]).hint).toBeUndefined();
    expect(aboveClaimPossible([bands([1, 1], [1, 1], [3, 3])], "A2")).toBe(false);
  });

  it("an A1 claim folds below onto the claim: one pool, both thresholds", () => {
    expect(verify("A1", [obj("READING", bands([0, 0], [6, 10]))]).outcome).toBe("PASS");
    expect(objectiveVerdict(bands([0, 0], [5, 10]))).toBe("BORDERLINE");
    expect(verify("A1", [obj("READING", bands([0, 0], [4, 10]))]).outcome).toBe("FAIL");
  });

  it("is inconclusive with a skill that served fewer than 4 at-claim units", () => {
    const v = verify("A2", [obj("READING", bands([6, 6], [3, 3]))]);
    expect(v.outcome).toBe("INCONCLUSIVE");
    expect(v.reasons).toEqual(["FEW_AT_CLAIM_UNITS:READING"]);
  });

  it("tolerates exactly one borderline objective skill that is not required", () => {
    const sections = [obj("READING", bands([5, 5], [5, 5])), obj("GRAMMAR", bands([3, 6], [4, 8]))];
    expect(verify("A2", sections).outcome).toBe("PASS");
    expect(verify("A2", [...sections, obj("LISTENING", bands([3, 6], [4, 8]))]).outcome).toBe("INCONCLUSIVE");
    const required = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "A2", rules: { ...rules, requiredSkills: ["GRAMMAR"] }, sections }).verification!;
    expect(required.outcome).toBe("INCONCLUSIVE");
  });

  it("one objective skill below the cut goes to the teacher while the pool holds; far below, at chance or two failing skills fail", () => {
    const one = [obj("READING", bands([5, 5], [5, 5])), obj("LISTENING", bands([5, 5], [5, 5])), obj("GRAMMAR", bands([2, 5], [2, 5]))];
    expect(verify("A2", one).outcome).toBe("INCONCLUSIVE");
    const two = [obj("READING", bands([5, 5], [5, 5])), obj("LISTENING", bands([2, 5], [2, 5])), obj("GRAMMAR", bands([2, 5], [2, 5]))];
    expect(verify("A2", two).outcome).toBe("FAIL");
  });

  it("fails on any failing skill, a required one included, and on a skill at chance", () => {
    const failing = [obj("READING", bands([5, 5], [5, 5])), obj("GRAMMAR", bands([1, 5], [1, 5]))];
    expect(verify("A2", failing).outcome).toBe("FAIL");
    const atChance = { ...obj("GRAMMAR", bands([5, 5], [5, 5])), chance: { atChance: true } } as SectionEvidence;
    expect(verify("A2", [atChance]).outcome).toBe("FAIL");
  });

  it("a teacher skill level wins: at or above the claim passes, below fails", () => {
    const sections = [obj("READING", bands([5, 5], [5, 5])), prod("SPEAKING", [task("A1", true), task("A2")])];
    const up = verify("A2", sections, { overrides: { skills: { SPEAKING: "A2" } } });
    expect(up.outcome).toBe("PASS");
    const down = verify("A2", sections, { overrides: { skills: { SPEAKING: "A1" } } });
    expect(down.outcome).toBe("FAIL");
  });

  it("a teacher's overall level decides the claim: at or above passes, below fails", () => {
    const sections = [obj("READING", bands([5, 5], [5, 5])), prod("SPEAKING", [task("A1", true), task("A2")])];
    expect(verify("A2", sections).outcome).toBe("INCONCLUSIVE");
    const up = verify("A2", sections, { overrides: { overall: "A2" } });
    expect(up.outcome).toBe("PASS");
    expect(up.reasons).toContain("TEACHER_DECISION");
    expect(verify("A2", sections, { overrides: { overall: "A1" } }).outcome).toBe("FAIL");
  });

  it("waits while a grading is pending", () => {
    const v = verify("A2", [obj("READING", bands([5, 5], [5, 5])), { section: "SPEAKING", kind: "PRODUCTIVE", level: null, decider: null }]);
    expect(v.outcome).toBe("INCONCLUSIVE");
    expect(v.reasons).toContain("AWAITING_GRADING");
  });

  it("does not touch placement or the stored levels of the skills", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ section: "READING", kind: "OBJECTIVE", posterior: { mean: 0, sd: 0.4 }, answered: 12, insufficient: false }] });
    expect(r.verification).toBe(null);
    expect(r.skills.READING?.verdict).toBeUndefined();
    expect(r.placement).not.toBe(null);
  });

  it("shows reached, not reached or teacher review", () => {
    expect(skillShown("PASS", "INCONCLUSIVE")).toBe("REACHED");
    expect(skillShown("FAIL", "FAIL")).toBe("NOT_REACHED");
    expect(skillShown("SPLIT", "INCONCLUSIVE")).toBe("REVIEW");
    expect(skillShown("BORDERLINE", "PASS")).toBe("REACHED");
    expect(skillShown("BORDERLINE", "INCONCLUSIVE")).toBe("REVIEW");
  });
});
