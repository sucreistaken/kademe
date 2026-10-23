import { describe, expect, it } from "vitest";
import { BAND_CENTER } from "./cefr";
import { BLANK_MIN_UNITS, CHANCE_MAX_LEVEL, CHANCE_MIN_UNITS, CHANCE_Z, chanceTest, chanceUnitsOf, countsForChance, sectionChance } from "./chance";
import { autoFinalizes, computeResult, isUncertainResult, studentWaitingFor, type SectionEvidence } from "./result";
import { CLOZE_SKILL_TAG, C_TEST_SKILL_TAG, WORD_BANK_SKILL_TAG, type Cefr, type ItemContent, type ItemKey, type ItemSnapshot, type ItemType } from "./types";

type Snap = Pick<ItemSnapshot, "type" | "skillTag" | "content" | "key" | "level">;
const snap = (type: ItemType, content: ItemContent, key: ItemKey, level: Cefr = "A1", skillTag = "reading.detail"): Snap => ({ type, skillTag, content, key, level });

const gaps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i}` }));
const answers = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`g${i}`, [`w${i}`]]));
const cloze = (level: Cefr = "A1") => snap("GAP_FILL", { kind: "GAP", gaps: gaps(11).map((g) => ({ ...g, choices: ["a", "b", "c", "d"] })) }, { kind: "GAP", answers: answers(11) }, level, CLOZE_SKILL_TAG);
const wordBank = (level: Cefr = "A1") => snap("GAP_FILL", { kind: "GAP", gaps: gaps(8) }, { kind: "GAP", answers: answers(8), distractors: ["x", "y", "z", "v"] }, level, WORD_BANK_SKILL_TAG);
const single = (level: Cefr = "A2") => snap("SINGLE_CHOICE", { kind: "CHOICE", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }, { id: "c", text: "c" }] }, { kind: "CHOICE", correct: ["a"] }, level);

describe("chanceUnitsOf: answer units and their guessing chance", () => {
  it("counts one unit per single-choice item at one over the options", () => {
    expect(chanceUnitsOf(single(), 1)).toEqual({ units: 1, answered: 1, expected: expect.closeTo(1 / 3, 10), variance: expect.closeTo(2 / 9, 10), right: 1 });
  });

  it("counts answered units from the answer: blanks carry no chance and no evidence", () => {
    expect(chanceUnitsOf(single(), 0, null)).toEqual({ units: 1, answered: 0, expected: 0, variance: 0, right: 0 });
    expect(chanceUnitsOf(single(), 0, { choiceIds: ["b"] })).toMatchObject({ answered: 1, right: 0 });
    const tfng = snap("TRUE_FALSE_NG", { kind: "TFNG", statements: [{ id: "s1", text: "" }, { id: "s2", text: "" }, { id: "s3", text: "" }] }, { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "R" } });
    expect(chanceUnitsOf(tfng, 1 / 3, { tfng: { s1: "R" } })).toMatchObject({ units: 3, answered: 1, expected: 1 / 3, right: 1 });
    expect(chanceUnitsOf(cloze(), 2 / 11, { gaps: { g0: "w0", g1: "w1", g2: " " } })).toMatchObject({ units: 11, answered: 2, expected: 0.5, right: 2 });
    const m = snap("MATCHING", { kind: "MATCHING", left: [{ id: "l1", text: "" }, { id: "l2", text: "" }], right: [{ id: "r1", text: "" }, { id: "r2", text: "" }] }, { kind: "MATCHING", pairs: { l1: "r1", l2: "r2" } });
    expect(chanceUnitsOf(m, 0, { matches: { l1: "", l2: "r1" } })).toMatchObject({ answered: 1, expected: 0.5, right: 0 });
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
    expect(chanceUnitsOf(mixed, 0.5)).toEqual({ units: 2, answered: 2, expected: 0.5, variance: 0.25, right: 1 });
  });

  it("counts a tick-n item's boxes at correct over options, and nothing for writing", () => {
    const multi = snap("MULTI_CHOICE", { kind: "CHOICE", options: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `o${i}`, text: "" })), pick: 2 }, { kind: "CHOICE", correct: ["o1", "o2"] });
    expect(chanceUnitsOf(multi, 0.5)).toMatchObject({ units: 2, expected: 2 * (2 / 6), right: 1 });
    expect(chanceUnitsOf(snap("WRITING_PROMPT", { kind: "WRITING", minWords: 30, maxWords: 60 }, { kind: "NONE" }), 0)).toBeNull();
  });
});

describe("chanceTest", () => {
  // `n` served units at level `level`, `answered` of them answered, `right` right, chance `p` each.
  const u = (level: Cefr, n: number, answered: number, right: number, p = 0.25) => ({ level, units: n, answered, expected: answered * p, variance: answered * p * (1 - p), right });

  it("tests the answered units only, up to the one-sided bound", () => {
    // 40 answered cloze gaps: 10 expected by guessing, sd sqrt(7.5) = 2.74, bound 10 + 2.054 * 2.74 = 15.6.
    expect(CHANCE_Z).toBe(2.054);
    expect(chanceTest([u("A1", 40, 40, 15)])).toMatchObject({ enough: true, atChance: true, units: 40, beginner: { answered: 40, right: 15, expected: 10 } });
    expect(chanceTest([u("A1", 40, 40, 16)]).atChance).toBe(false);
  });

  it("does not count blanks as evidence: a few right answers among many blanks are German", () => {
    // 40 served, 4 answered, all right: 1 expected, far above.
    expect(chanceTest([u("A1", 40, 4, 4)]).atChance).toBe(false);
    // 40 served, 1 answered and right: one right guess is still chance (bound 0.25 + 2.054 * 0.43).
    expect(chanceTest([u("A1", 40, 1, 1)]).atChance).toBe(true);
  });

  it("needs both tests: right answers on B1 to C2 material also count", () => {
    expect(chanceTest([u("A1", 11, 11, 3), u("A2", 11, 11, 2), u("B1", 11, 11, 11)])).toMatchObject({ beginner: { aboveChance: false }, all: { aboveChance: true }, atChance: false });
    expect(chanceTest([u("A1", 11, 11, 3), u("A2", 11, 11, 2), u("B1", 11, 11, 3)]).atChance).toBe(true);
  });

  it("decides nothing below the minimum of served A1 to A2 units, answered or not", () => {
    expect(CHANCE_MIN_UNITS).toBe(16);
    expect(chanceTest([u("A1", 15, 15, 0), u("B1", 40, 40, 0)])).toMatchObject({ enough: false, atChance: false });
    expect(chanceTest([u("A1", 16, 3, 0)]).atChance).toBe(true);
  });

  it("calls a fully blank section at chance once it served enough units of any level", () => {
    expect(BLANK_MIN_UNITS).toBe(8);
    expect(chanceTest([u("B1", 8, 0, 0)])).toMatchObject({ blank: true, enough: true, atChance: true });
    expect(chanceTest([u("B1", 7, 0, 0)])).toMatchObject({ blank: true, enough: false, atChance: false });
  });

  it("one right typed answer is above chance (nothing to guess)", () => {
    expect(chanceTest([u("A1", 20, 5, 1, 0)]).atChance).toBe(false);
    expect(chanceTest([u("A1", 20, 5, 0, 0)]).atChance).toBe(true);
  });
});

describe("sectionChance", () => {
  /** A text with `answered` gaps filled, `right` of them right (the first ones). */
  const text = (itemSnapshot: Snap, answered: number, right: number) => {
    const n = itemSnapshot.content.kind === "GAP" ? itemSnapshot.content.gaps.length : 0;
    const gapsAnswer = Object.fromEntries(Array.from({ length: answered }, (_, i) => [`g${i}`, i < right ? `w${i}` : "falsch"]));
    return { itemSnapshot, score: right / n, answer: answered ? { gaps: gapsAnswer } : null };
  };
  const choice = (itemSnapshot: Snap, picked: boolean, right: boolean) => ({ itemSnapshot, score: right ? 1 : 0, answer: picked ? { choiceIds: [right ? "a" : "b"] } : null });

  it("reads answered units from the stored answers", () => {
    expect(CHANCE_MAX_LEVEL).toBe("A2");
    expect(countsForChance("A2")).toBe(true);
    expect(countsForChance("B1")).toBe(false);
    const t = sectionChance([text(cloze("A1"), 5, 3), text(cloze("A2"), 0, 0)]);
    expect(t).toMatchObject({ units: 22, beginner: { answered: 5, right: 3 } });
  });

  it("B1 and B2 texts fully right are German: not at chance, even with the A1 to A2 texts at chance", () => {
    const t = sectionChance([text(cloze("A1"), 11, 3), text(cloze("A2"), 11, 2), text(cloze("B1"), 11, 11), text(cloze("B2"), 11, 11)]);
    expect(t).toMatchObject({ beginner: { aboveChance: false }, all: { aboveChance: true }, atChance: false });
  });

  it("an A1 cloze 10/11 with everything else blank is not at chance", () => {
    const t = sectionChance([text(cloze("A1"), 10, 10), text(cloze("A2"), 0, 0), text(wordBank("A2"), 0, 0), text(cloze("B1"), 0, 0)]);
    expect(t.atChance).toBe(false);
  });

  it("both cloze texts skipped and the A2 word bank 8/8 is not at chance", () => {
    const t = sectionChance([text(cloze("A1"), 0, 0), text(cloze("A2"), 0, 0), text(wordBank("A2"), 8, 8)]);
    expect(t).toMatchObject({ enough: true, atChance: false });
  });

  it("quick screen: word banks skipped, cloze 6/11 and 5/11 is not at chance", () => {
    const t = sectionChance([
      text(cloze("A1"), 11, 6),
      text(cloze("A2"), 11, 5),
      text(cloze("B1"), 0, 0),
      text(cloze("B2"), 0, 0),
      text(wordBank("A1"), 0, 0),
      text(wordBank("A2"), 0, 0),
      text(wordBank("B1"), 0, 0),
    ]);
    expect(t).toMatchObject({ units: 38, beginner: { answered: 22, right: 6 + 5 }, atChance: false });
  });

  it("a guessing student with no German is at chance", () => {
    const t = sectionChance([text(cloze("A1"), 11, 3), text(cloze("A2"), 11, 2), text(wordBank("A1"), 8, 1), text(wordBank("A2"), 8, 0), text(cloze("B1"), 11, 3)]);
    expect(t).toMatchObject({ enough: true, blank: false, atChance: true });
  });

  it("is above chance for a real beginner on A1 to A2 texts", () => {
    expect(sectionChance([text(cloze("A1"), 11, 8), text(cloze("A2"), 11, 5), text(wordBank("A1"), 8, 4)]).atChance).toBe(false);
  });

  it("does not judge a section with one short beginner text (one reading text cannot tell A0 from A1)", () => {
    const t = sectionChance([choice(single("A2"), true, false), choice(single("A2"), true, false), choice(single("B1"), true, false)]);
    expect(t).toMatchObject({ enough: false, atChance: false });
  });

  it("calls a fully blank section at chance whatever its levels, once it served enough units", () => {
    const blank = sectionChance([text(cloze("B1"), 0, 0), { itemSnapshot: cloze("B2"), score: 0, answer: {} }]);
    expect(blank).toMatchObject({ blank: true, atChance: true });
    expect(sectionChance([choice(single("B1"), false, false), choice(single("B2"), false, false)])).toMatchObject({ blank: true, enough: false, atChance: false });
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

  it("keeps the tested tally on an AT_CHANCE skill, and says when the section was blank", () => {
    const chance = { atChance: true, blank: false, beginner: { answered: 22, right: 5, expected: 5.5, sd: 2, aboveChance: false } };
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", BAND_CENTER.A1), chance } as SectionEvidence] });
    expect(r.skills.GRAMMAR?.chance).toEqual({ right: 5, answered: 22, blank: false });
    const blank = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", -3.5), chance: { atChance: true, blank: true } } as SectionEvidence] });
    expect(blank.skills.GRAMMAR?.chance).toEqual({ right: 0, answered: 0, blank: true });
  });

  it("keeps A1 when the band is below A1 but the answers show German (blanks pulled the estimate down)", () => {
    const tally = (aboveChance: boolean) => ({ answered: 10, right: 10, expected: 2.5, sd: 1.4, aboveChance });
    const shows = { atChance: false, blank: false, beginner: tally(true), all: tally(true) };
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", -3.5), chance: shows } as SectionEvidence] });
    expect(r.skills.GRAMMAR?.level).toBe("A1");
    // Only right answers on B1 to C2 material: still German.
    const high = { ...shows, beginner: tally(false) };
    expect(computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", -3.5), chance: high } as SectionEvidence] }).skills.GRAMMAR?.level).toBe("A1");
    // Nothing credible above chance, too few units for the rule: the band's A0 stands.
    const thin = { atChance: false, blank: false, beginner: tally(false), all: tally(false) };
    expect(computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", -3.5), chance: thin } as SectionEvidence] }).skills.GRAMMAR?.level).toBe("A0");
  });

  it("AT_CHANCE wins over the A1 floor of a section that stopped short of its minimum", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [{ ...obj("GRAMMAR", -3.5, true), insufficient: true } as SectionEvidence] });
    expect(r.skills.GRAMMAR).toMatchObject({ level: "A0", reason: "AT_CHANCE", insufficient: true });
  });

  it("drops AT_CHANCE when a teacher sets the skill's level", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true)], overrides: { skills: { GRAMMAR: "A1" } } });
    expect(r.skills.GRAMMAR).toMatchObject({ level: "A1", decider: "TEACHER" });
    expect(r.skills.GRAMMAR?.reason).toBeUndefined();
    expect(r.skills.GRAMMAR?.chance).toBeUndefined();
  });
});

describe("CHANCE_BELOW_POOLED: a section at chance pulls the overall to A0 while the pooled estimate is A1 or higher", () => {
  const rules = { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 };
  const obj = (section: "GRAMMAR" | "READING" | "LISTENING", mean: number, atChance = false): SectionEvidence => ({
    section,
    kind: "OBJECTIVE",
    posterior: { mean, sd: 0.3 },
    answered: 12,
    insufficient: false,
    chance: { atChance },
  });
  const flow = { status: "AWAITING_REVIEW", hasProductive: false, anyUndecided: false, clean: true };

  it("placement: flagged, uncertain, never finalized or released by itself", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true), obj("READING", BAND_CENTER.A2, true), obj("LISTENING", BAND_CENTER.A2)] });
    expect(r.overall).toBe("A0");
    expect(r.reviewReasons).toEqual(["CHANCE_BELOW_POOLED"]);
    // The placement itself is clear (A2 band, tight): only the review reason holds it.
    expect(r.placement?.borderline).toBe(false);
    expect(isUncertainResult(r)).toBe(true);
    expect(autoFinalizes({ ...flow, computed: r })).toBe(false);
    expect(studentWaitingFor({ hasProductive: false, final: false, computed: r })).toBe("REVIEW");
  });

  it("level verification: flagged and uncertain too, although it has no placement", () => {
    const r = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "A1", rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true), obj("READING", BAND_CENTER.A2)] });
    expect(r.placement).toBe(null);
    expect(r.overall).toBe("A0");
    expect(r.reviewReasons).toEqual(["CHANCE_BELOW_POOLED"]);
    expect(isUncertainResult(r)).toBe(true);
    expect(autoFinalizes({ ...flow, computed: r })).toBe(false);
  });

  it("is not raised when the pooled estimate is below the A1 band too, or when the overall is not A0", () => {
    const low = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "A1", rules, sections: [obj("GRAMMAR", -3.6, true), obj("READING", -3.6)] });
    expect(low.overall).toBe("A0");
    expect(low.reviewReasons).toBeUndefined();
    expect(isUncertainResult(low)).toBe(false);
    const notA0 = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2, true), obj("READING", BAND_CENTER.A2), obj("LISTENING", BAND_CENTER.A2)] });
    expect(notA0.overall).toBe("A2");
    expect(notA0.reviewReasons).toBeUndefined();
  });
});
