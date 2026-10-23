import { describe, expect, it } from "vitest";
import { BAND_CENTER } from "./cefr";
import { BLANK_MIN_UNITS, CHANCE_MAX_LEVEL, CHANCE_MIN_UNITS, CHANCE_Z, chanceTest, chanceUnitsOf, countsForChance, sectionChance } from "./chance";
import { computeResult, isUncertainResult, type SectionEvidence } from "./result";
import { CLOZE_SKILL_TAG, C_TEST_SKILL_TAG, WORD_BANK_SKILL_TAG, type Cefr, type ItemAnswer, type ItemContent, type ItemKey, type ItemSnapshot, type ItemType } from "./types";

type Snap = Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">;
const snap = (type: ItemType, content: ItemContent, key: ItemKey, level: Cefr = "A1", skillTag = "reading.detail"): Snap => ({ type, skillTag, content, key, level });

const gaps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i}` }));
const answers = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`g${i}`, [`w${i}`]]));
const cloze = (level: Cefr = "A1") => snap("GAP_FILL", { kind: "GAP", gaps: gaps(11).map((g) => ({ ...g, choices: ["a", "b", "c", "d"] })) }, { kind: "GAP", answers: answers(11) }, level, CLOZE_SKILL_TAG);
const wordBank = (level: Cefr = "A1") => snap("GAP_FILL", { kind: "GAP", gaps: gaps(8) }, { kind: "GAP", answers: answers(8), distractors: ["x", "y", "z", "v"] }, level, WORD_BANK_SKILL_TAG);
const single = (level: Cefr = "A2") => snap("SINGLE_CHOICE", { kind: "CHOICE", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }, { id: "c", text: "c" }] }, { kind: "CHOICE", correct: ["a"] }, level);

describe("chanceUnitsOf: answer units and their guessing chance", () => {
  it("counts one unit per single-choice item at one over the options", () => {
    expect(chanceUnitsOf(single(), 1)).toEqual({ units: 1, expected: expect.closeTo(1 / 3, 10), variance: expect.closeTo(2 / 9, 10), right: 1 });
  });

  it("counts statements at a third, or a half when two-way", () => {
    const tfng = (twoWay?: boolean) =>
      snap("TRUE_FALSE_NG", { kind: "TFNG", statements: [{ id: "s1", text: "" }, { id: "s2", text: "" }, { id: "s3", text: "" }], ...(twoWay ? { twoWay } : {}) }, { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "R" } });
    expect(chanceUnitsOf(tfng(), 2 / 3)).toMatchObject({ units: 3, expected: 1, right: 2 });
    expect(chanceUnitsOf(tfng(true), 1)).toMatchObject({ units: 3, expected: 1.5, right: 3 });
  });

  it("counts pairs at one over the right-hand column", () => {
    const m = snap("MATCHING", { kind: "MATCHING", left: [{ id: "l1", text: "" }, { id: "l2", text: "" }], right: [1, 2, 3, 4].map((i) => ({ id: `r${i}`, text: "" })) }, { kind: "MATCHING", pairs: { l1: "r1", l2: "r2" } });
    expect(chanceUnitsOf(m, 0.5)).toMatchObject({ units: 2, expected: 0.5, right: 1 });
  });

  it("counts gaps: a quarter for a cloze, one over the pool for a word bank, nothing for a typed gap", () => {
    expect(chanceUnitsOf(cloze(), 4 / 11)).toMatchObject({ units: 11, expected: 11 / 4, right: 4 });
    expect(chanceUnitsOf(wordBank(), 0.5)).toMatchObject({ units: 8, expected: 8 / 12, right: 4 });
    const cTest = snap("GAP_FILL", { kind: "GAP", gaps: gaps(20) }, { kind: "GAP", answers: answers(20) }, "A1", C_TEST_SKILL_TAG);
    expect(chanceUnitsOf(cTest, 0.1)).toMatchObject({ units: 20, expected: 0, variance: 0, right: 2 });
    const mixed = snap("GAP_FILL", { kind: "GAP", gaps: [{ id: "g0", choices: ["a", "b"] }, { id: "g1" }] }, { kind: "GAP", answers: answers(2) }, "A1", "grammar.dativ");
    expect(chanceUnitsOf(mixed, 0.5)).toEqual({ units: 2, expected: 0.5, variance: 0.25, right: 1 });
  });

  it("counts a tick-n item's boxes at correct over options, and nothing for writing", () => {
    const multi = snap("MULTI_CHOICE", { kind: "CHOICE", options: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `o${i}`, text: "" })), pick: 2 }, { kind: "CHOICE", correct: ["o1", "o2"] });
    expect(chanceUnitsOf(multi, 0.5)).toMatchObject({ units: 2, expected: 2 * (2 / 6), right: 1 });
    expect(chanceUnitsOf(snap("WRITING_PROMPT", { kind: "WRITING", minWords: 30, maxWords: 60 }, { kind: "NONE" }), 0)).toBeNull();
  });
});

describe("chanceTest", () => {
  const units = (n: number, p: number, right: number) => ({ units: n, expected: n * p, variance: n * p * (1 - p), right });

  it("is at chance up to the one-sided bound and above chance past it", () => {
    // 40 cloze gaps: 10 expected by guessing, sd sqrt(7.5) = 2.74, bound 10 + 2.054 * 2.74 = 15.6.
    expect(CHANCE_Z).toBe(2.054);
    expect(chanceTest([units(40, 0.25, 15)])).toMatchObject({ enough: true, atChance: true, expected: 10 });
    expect(chanceTest([units(40, 0.25, 16)]).atChance).toBe(false);
  });

  it("decides nothing below the minimum number of units", () => {
    expect(CHANCE_MIN_UNITS).toBe(16);
    expect(chanceTest([units(15, 0.25, 0)])).toMatchObject({ enough: false, atChance: false });
    expect(chanceTest([units(16, 0.25, 0)]).atChance).toBe(true);
  });

  it("one right typed answer is above chance (nothing to guess)", () => {
    expect(chanceTest([units(20, 0, 1)]).atChance).toBe(false);
    expect(chanceTest([units(20, 0, 0)]).atChance).toBe(true);
  });
});

describe("sectionChance", () => {
  const r = (itemSnapshot: Snap, score: number, answer: ItemAnswer | null = { gaps: { g0: "x" } }) => ({ itemSnapshot, score, answer });

  it("counts only units written for A1 and A2", () => {
    expect(CHANCE_MAX_LEVEL).toBe("A2");
    expect(countsForChance("A2")).toBe(true);
    expect(countsForChance("B1")).toBe(false);
    // Two A1-A2 texts at chance, plus a B1 and a B2 text full of right answers that do not count.
    const t = sectionChance([r(cloze("A1"), 3 / 11), r(cloze("A2"), 2 / 11), r(cloze("B1"), 1), r(cloze("B2"), 1)]);
    expect(t).toMatchObject({ units: 22, right: 5, atChance: true });
  });

  it("is above chance for a real beginner on A1 to A2 texts", () => {
    expect(sectionChance([r(cloze("A1"), 8 / 11), r(cloze("A2"), 5 / 11), r(wordBank("A1"), 4 / 8)]).atChance).toBe(false);
  });

  it("does not judge a section with one short beginner text (one reading text cannot tell A0 from A1)", () => {
    const t = sectionChance([r(single("A2"), 0, { choiceIds: ["b"] }), r(single("A2"), 0, { choiceIds: ["b"] }), r(single("B1"), 0, { choiceIds: ["b"] })]);
    expect(t).toMatchObject({ enough: false, atChance: false });
  });

  it("calls a blank section at chance whatever its levels, once it has enough units", () => {
    expect(BLANK_MIN_UNITS).toBe(8);
    const blank = sectionChance([r(cloze("B1"), 0, null), r(cloze("B2"), 0, {})]);
    expect(blank).toMatchObject({ blank: true, units: 22, atChance: true });
    expect(sectionChance([r(single("B1"), 0, null), r(single("B2"), 0, null)])).toMatchObject({ blank: true, enough: false, atChance: false });
  });

  it("skips unscored responses", () => {
    expect(sectionChance([{ itemSnapshot: cloze("A1"), score: null, answer: null }]).units).toBe(0);
  });
});

describe("the chance rule in the result", () => {
  const rules = { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 };
  const obj = (section: "GRAMMAR" | "READING" | "LISTENING", mean: number, atChance?: boolean): SectionEvidence => ({
    section,
    kind: "OBJECTIVE",
    posterior: { mean, sd: 0.4 },
    answered: 12,
    insufficient: false,
    ...(atChance === undefined ? {} : { chance: { atChance } }),
  });
  const prod = (section: "WRITING" | "SPEAKING", level: "A0" | "A1"): SectionEvidence => ({ section, kind: "PRODUCTIVE", level, decider: "TEACHER" });

  it("makes a section at chance A0 with the reason AT_CHANCE, whatever its band", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true)] });
    expect(r.skills.GRAMMAR).toMatchObject({ level: "A0", reason: "AT_CHANCE", decider: "ENGINE" });
    const above = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, false)] });
    expect(above.skills.GRAMMAR?.level).toBe("A2");
    expect(above.skills.GRAMMAR?.reason).toBeUndefined();
  });

  it("gives a student with no German A0 overall: grammar at chance, reading and listening in a band, writing and speaking A0", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.A1, true), obj("READING", BAND_CENTER.A2), obj("LISTENING", BAND_CENTER.A1), prod("WRITING", "A0"), prod("SPEAKING", "A0")],
    });
    expect(r.overall).toBe("A0");
  });

  it("keeps an A1 student A1: grammar above chance", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.A1, false), obj("READING", BAND_CENTER.A1), obj("LISTENING", BAND_CENTER.A1), prod("WRITING", "A1"), prod("SPEAKING", "A1")],
    });
    expect(r.overall).toBe("A1");
    expect(isUncertainResult(r)).toBe(false);
  });

  it("fails a verification on a section at chance like any section below the claim", () => {
    const r = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "A2", rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true), obj("READING", BAND_CENTER.A2)] });
    expect(r.verification!.outcome).toBe("FAIL");
    expect(r.verification!.reasons).toContain("SKILL_BELOW:GRAMMAR");
  });
});
