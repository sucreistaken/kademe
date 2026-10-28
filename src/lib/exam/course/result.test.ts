import { describe, expect, it } from "vitest";
import { defaultCourseRules, FINAL_RULES } from "./catalog";
import { computeCourseResult, courseMinPoints, type CourseResultInput, type CourseTaskPoints } from "./result";
import { COURSE_KEYS, type CourseCriterion, type CourseKey, type CourseRules } from "./types";

/**
 * The cut scores are the school's: Halil Bey's B1 sheet has 64 points (10
 * Lesen, 25 Sprachbausteine, 9 Schreiben, 20 Sprechen), passes at 42 (65%),
 * sends 38-41 to B1.2, 28-37 to B1.1 and 0-27 below B1, and wants 12 of 20 in
 * speaking and more than 0 for the writing content. The same shares apply to
 * the 74 point final tests (with listening) and, at 60%, the 56 point interim
 * tests.
 */

/** `total` spread over `n` slots, each at most `cap`. */
function spread(total: number, n: number, cap: number): number[] {
  if (total > n * cap) throw new Error(`${total} does not fit ${n} x ${cap}`);
  const out = new Array<number>(n).fill(0);
  for (let left = total, i = 0; left > 0; i = (i + 1) % n) {
    if (out[i] < cap) {
      out[i] += 1;
      left -= 1;
    }
  }
  return out;
}

const writingTask = (inhalt: number, wortschatz: number, grammatik: number): CourseTaskPoints => ({ INHALT: inhalt, WORTSCHATZ: wortschatz, GRAMMATIK: grammatik });
const SPEAKING_IDS: CourseCriterion[] = ["KOMMUNIKATION", "WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "KOHAERENZ"];
/** A speaking task worth `total` of 20. */
const speakingTask = (total: number): CourseTaskPoints => Object.fromEntries(SPEAKING_IDS.map((id, i) => [id, spread(total, 5, 4)[i]]));

type Shape = { reading: number; grammar: number; listening?: number };
const SHEET_64: Shape = { reading: 10, grammar: 25 };
const FINAL_74: Shape = { reading: 10, grammar: 25, listening: 10 };
const INTERIM_56: Shape = { reading: 6, grammar: 15, listening: 6 };

/** Objective points `right` spread over the form's sections in telc order, each filled up to its maximum. */
function objectiveOf(shape: Shape, right: number): CourseResultInput["objective"] {
  const maxes = [shape.reading, shape.grammar, ...(shape.listening !== undefined ? [shape.listening] : [])];
  const rights = new Array<number>(maxes.length).fill(0);
  let left = right;
  maxes.forEach((max, i) => {
    rights[i] = Math.min(max, left);
    left -= rights[i];
  });
  if (left > 0) throw new Error(`${right} does not fit ${maxes.join("+")}`);
  return {
    READING: { right: rights[0], max: shape.reading },
    GRAMMAR: { right: rights[1], max: shape.grammar },
    ...(shape.listening !== undefined ? { LISTENING: { right: rights[2], max: shape.listening } } : {}),
  };
}

function input(key: CourseKey, shape: Shape, parts: { right: number; writing: CourseTaskPoints; speaking: number | number[] }, rules: CourseRules = defaultCourseRules(key)): CourseResultInput {
  const speaking = (Array.isArray(parts.speaking) ? parts.speaking : [parts.speaking]).map(speakingTask);
  return { config: { key, form: "A", rules }, objective: objectiveOf(shape, parts.right), writing: [parts.writing], speaking };
}

/** The base that makes up 18 points of writing and speaking: 6 + 12, both exactly at their usual minimum. */
const BASE = { writing: writingTask(2, 2, 2), speaking: 12 };

describe("courseMinPoints", () => {
  it("is ceil(pct * max / 100), the school's 65% of 64 being 42", () => {
    expect(courseMinPoints(65, 64)).toBe(42);
    expect(courseMinPoints(59, 64)).toBe(38);
    expect(courseMinPoints(43.75, 64)).toBe(28);
    expect(courseMinPoints(60, 20)).toBe(12);
  });
  it("does not let floating point error push a whole number up", () => {
    expect(courseMinPoints(43.75, 64)).toBe(28);
    expect(courseMinPoints(33.3, 30)).toBe(10);
    expect(courseMinPoints(70, 10)).toBe(7);
    expect(courseMinPoints(57, 100)).toBe(57);
  });
  it("rounds up inside a point and is never negative", () => {
    expect(courseMinPoints(60, 56)).toBe(34);
    expect(courseMinPoints(65, 74)).toBe(49);
    expect(courseMinPoints(0, 74)).toBe(0);
  });
});

describe("the school's 64 point sheet (B1 final test without listening)", () => {
  // Points over the whole test; writing 6 and speaking 12 stay fixed, the objective part makes up the rest.
  const rows: Array<[total: number, outcome: "PASS" | "FAIL", recommendation: string]> = [
    [18, "FAIL", "A2.2"],
    [27, "FAIL", "A2.2"],
    [28, "FAIL", "B1.1"],
    [37, "FAIL", "B1.1"],
    [38, "FAIL", "B1.2"],
    [41, "FAIL", "B1.2"],
    [42, "PASS", "B2.1"],
    [53, "PASS", "B2.1"],
  ];
  it.each(rows)("%i of 64 points: %s, continue in %s", (total, outcome, recommendation) => {
    const r = computeCourseResult(input("B1", SHEET_64, { ...BASE, right: total - 18 }));
    expect(r.max).toBe(64);
    expect(r.total).toBe(total);
    expect(r.outcome).toBe(outcome);
    expect(r.recommendation).toBe(recommendation);
    expect(r.focus).toBeNull();
    expect(r.reasons).toEqual(outcome === "PASS" ? [] : ["BELOW_PASS"]);
  });

  it("passes the full 64 points", () => {
    const r = computeCourseResult(input("B1", SHEET_64, { right: 35, writing: writingTask(3, 3, 3), speaking: 20 }));
    expect(r).toMatchObject({ total: 64, max: 64, pct: 100, outcome: "PASS", recommendation: "B2.1" });
  });

  it("holds a student with 12 of 20 in speaking and fails one with 11, however well the written test went", () => {
    const written = { right: 35, writing: writingTask(3, 3, 3) };
    expect(computeCourseResult(input("B1", SHEET_64, { ...written, speaking: 12 }))).toMatchObject({ total: 56, outcome: "PASS", reasons: [], focus: null });
    const weak = computeCourseResult(input("B1", SHEET_64, { ...written, speaking: 11 }));
    // 55 points are a pass on the total; the speaking minimum alone sends the student to B1.2 with a speaking focus.
    expect(weak).toMatchObject({ total: 55, outcome: "FAIL", reasons: ["SPEAKING_BELOW_MIN"], recommendation: "B1.2", focus: "SPEAKING" });
  });

  it("fails 0 points of content whatever the total, with a writing focus", () => {
    const r = computeCourseResult(input("B1", SHEET_64, { right: 35, writing: writingTask(0, 3, 3), speaking: 20 }));
    expect(r).toMatchObject({ total: 61, outcome: "FAIL", reasons: ["WRITING_CONTENT_ZERO"], recommendation: "B1.2", focus: "WRITING" });
  });

  it("names speaking when both the speaking minimum and the content failed it", () => {
    const r = computeCourseResult(input("B1", SHEET_64, { right: 35, writing: writingTask(0, 3, 3), speaking: 11 }));
    expect(r).toMatchObject({ outcome: "FAIL", reasons: ["SPEAKING_BELOW_MIN", "WRITING_CONTENT_ZERO"], recommendation: "B1.2", focus: "SPEAKING" });
  });

  it("goes by the points band, with no focus, when the points fail too", () => {
    // 41 points with speaking 11: under 42, so B1.2 by the band, not by the speaking rule.
    const r = computeCourseResult(input("B1", SHEET_64, { right: 24, writing: writingTask(2, 2, 2), speaking: 11 }));
    expect(r.total).toBe(41);
    expect(r).toMatchObject({ outcome: "FAIL", reasons: ["BELOW_PASS", "SPEAKING_BELOW_MIN"], recommendation: "B1.2", focus: null });
    // 27 points with content 0: the level below, still no focus.
    const low = computeCourseResult(input("B1", SHEET_64, { right: 11, writing: writingTask(0, 2, 2), speaking: 12 }));
    expect(low.total).toBe(27);
    expect(low).toMatchObject({ reasons: ["BELOW_PASS", "WRITING_CONTENT_ZERO"], recommendation: "A2.2", focus: null });
  });

  it("reports the share of the maximum", () => {
    expect(computeCourseResult(input("B1", SHEET_64, { ...BASE, right: 24 })).pct).toBe(65.6);
  });
});

describe("a 74 point final test (with listening)", () => {
  // 65% of 74 = 48.1 -> 49; 59% = 43.66 -> 44; 43.75% = 32.375 -> 33.
  const rows: Array<[total: number, outcome: "PASS" | "FAIL", recommendation: string]> = [
    [32, "FAIL", "A2.2"],
    [33, "FAIL", "B1.1"],
    [43, "FAIL", "B1.1"],
    [44, "FAIL", "B1.2"],
    [48, "FAIL", "B1.2"],
    [49, "PASS", "B2.1"],
  ];
  it.each(rows)("%i of 74 points: %s, continue in %s", (total, outcome, recommendation) => {
    const r = computeCourseResult(input("B1", FINAL_74, { ...BASE, right: total - 18 }));
    expect(r.max).toBe(74);
    expect(r.total).toBe(total);
    expect(r.outcome).toBe(outcome);
    expect(r.recommendation).toBe(recommendation);
  });

  it("lists the sections in telc order", () => {
    const r = computeCourseResult(input("B1", FINAL_74, { ...BASE, right: 30 }));
    expect(Object.keys(r.sections)).toEqual(["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"]);
    expect(r.sections.WRITING).toEqual({ points: 6, max: 9, pending: false });
    expect(r.sections.SPEAKING).toEqual({ points: 12, max: 20, pending: false });
  });
});

describe("a 56 point interim test", () => {
  // 60% of 56 = 33.6 -> 34.
  it.each([
    [33, "FAIL", "B1.1"],
    [34, "PASS", "B1.2"],
  ] as const)("%i of 56 points: %s, continue in %s", (total, outcome, recommendation) => {
    const r = computeCourseResult(input("B1.1", INTERIM_56, { ...BASE, right: total - 18 }));
    expect(r.max).toBe(56);
    expect(r.total).toBe(total);
    expect(r.outcome).toBe(outcome);
    expect(r.recommendation).toBe(recommendation);
  });

  it("has no speaking minimum and no band: 8 of 20 in speaking does not fail a passing total", () => {
    const r = computeCourseResult(input("B1.1", INTERIM_56, { right: 27, writing: writingTask(3, 3, 3), speaking: 8 }));
    expect(r).toMatchObject({ total: 44, outcome: "PASS", reasons: [], recommendation: "B1.2", focus: null });
  });

  it("fails 0 points of content and repeats the first half, with a writing focus", () => {
    const r = computeCourseResult(input("B1.1", INTERIM_56, { right: 27, writing: writingTask(0, 3, 3), speaking: 20 }));
    expect(r).toMatchObject({ outcome: "FAIL", reasons: ["WRITING_CONTENT_ZERO"], recommendation: "B1.1", focus: "WRITING" });
  });
});

describe("the course to continue in, level by level", () => {
  const FULL = { right: 45, writing: writingTask(3, 3, 3), speaking: 20 };
  const NOTHING = { right: 0, writing: writingTask(1, 0, 0), speaking: 0 };
  it.each([
    ["A1", "A2.1", "A1.1"],
    ["A2", "B1.1", "A1.2"],
    ["B1", "B2.1", "A2.2"],
    ["B2", "C1.1", "B1.2"],
  ] as const)("final test %s: a pass starts %s, far below the pass starts %s", (key, pass, bottom) => {
    expect(computeCourseResult(input(key, FINAL_74, FULL)).recommendation).toBe(pass);
    expect(computeCourseResult(input(key, FINAL_74, NOTHING)).recommendation).toBe(bottom);
  });

  it.each([
    ["A1.1", "A1.2", "A1.1"],
    ["A2.1", "A2.2", "A2.1"],
    ["B1.1", "B1.2", "B1.1"],
    ["B2.1", "B2.2", "B2.1"],
  ] as const)("interim test %s: a pass continues in %s, a fail repeats %s", (key, pass, repeat) => {
    const shape = INTERIM_56;
    expect(computeCourseResult(input(key, shape, { right: 27, writing: writingTask(3, 3, 3), speaking: 20 })).recommendation).toBe(pass);
    expect(computeCourseResult(input(key, shape, { right: 0, writing: writingTask(1, 0, 0), speaking: 0 })).recommendation).toBe(repeat);
  });

  it("covers every course key", () => {
    for (const key of COURSE_KEYS) {
      const shape = key.includes(".") ? INTERIM_56 : FINAL_74;
      const r = computeCourseResult(input(key, shape, { right: 0, writing: writingTask(1, 0, 0), speaking: 0 }));
      expect(r.key).toBe(key);
      expect(r.outcome).toBe("FAIL");
      expect(r.recommendation).toMatch(/^(A1|A2|B1|B2)\.[12]$/);
    }
  });

  it("falls back from the second half band to the first when only the first is set, and to the level below when neither is", () => {
    const only1: CourseRules = { ...FINAL_RULES, secondHalfPct: null };
    const none: CourseRules = { ...FINAL_RULES, secondHalfPct: null, firstHalfPct: null };
    // 38 points: the second half band would take it, but with no second half share it lands in the first half.
    expect(computeCourseResult(input("B1", SHEET_64, { ...BASE, right: 20 }, only1)).recommendation).toBe("B1.1");
    expect(computeCourseResult(input("B1", SHEET_64, { ...BASE, right: 20 }, none)).recommendation).toBe("A2.2");
  });
});

describe("pending sections", () => {
  const ready = input("B1", FINAL_74, { right: 40, writing: writingTask(3, 3, 3), speaking: 15 });

  it("holds back the total and every verdict while a section waits", () => {
    const r = computeCourseResult({ ...ready, writing: [] });
    expect(r.sections.WRITING).toEqual({ points: null, max: 9, pending: true });
    expect(r).toMatchObject({ total: null, pct: null, outcome: null, reasons: [], recommendation: null, focus: null, max: 74 });
    // The sections that are done keep their points.
    expect(r.sections.READING?.pending).toBe(false);
    expect(r.sections.SPEAKING).toMatchObject({ points: 15, pending: false });
  });

  it("keeps a speaking task pending while AUSSPRACHE has no number (a transcript cannot judge it)", () => {
    const task = speakingTask(16);
    const withoutPronunciation: CourseTaskPoints = { ...task, AUSSPRACHE: null };
    const r = computeCourseResult({ ...ready, speaking: [withoutPronunciation] });
    expect(r.sections.SPEAKING).toEqual({ points: null, max: 20, pending: true });
    expect(r.outcome).toBeNull();
    // A criterion that is absent altogether is the same.
    const { AUSSPRACHE: _dropped, ...absent } = task;
    void _dropped;
    expect(computeCourseResult({ ...ready, speaking: [absent] }).sections.SPEAKING?.pending).toBe(true);
    // Once a teacher sets it, the section scores.
    expect(computeCourseResult({ ...ready, speaking: [task] }).sections.SPEAKING).toEqual({ points: 16, max: 20, pending: false });
  });

  it("keeps the whole speaking section pending while one of its tasks has a missing number", () => {
    const r = computeCourseResult({ ...ready, speaking: [speakingTask(15), { ...speakingTask(15), KOHAERENZ: null }, speakingTask(15)] });
    expect(r.sections.SPEAKING?.pending).toBe(true);
    expect(r.total).toBeNull();
  });

  it("waits for an objective section that is not scored yet", () => {
    const r = computeCourseResult({ ...ready, objective: { ...ready.objective, LISTENING: { right: null, max: 10 } } });
    expect(r.sections.LISTENING).toEqual({ points: null, max: 10, pending: true });
    expect(r.outcome).toBeNull();
    expect(r.max).toBe(74);
  });

  it("is pending when the writing task has a criterion missing", () => {
    const r = computeCourseResult({ ...ready, writing: [{ INHALT: 3, WORTSCHATZ: 2 }] });
    expect(r.sections.WRITING?.pending).toBe(true);
  });
});

describe("speaking over several tasks", () => {
  const base = { right: 40, writing: writingTask(3, 3, 3) };
  it("is the mean of the task totals, rounded down", () => {
    expect(computeCourseResult(input("B1", FINAL_74, { ...base, speaking: [14, 15] })).sections.SPEAKING?.points).toBe(14);
    expect(computeCourseResult(input("B1", FINAL_74, { ...base, speaking: [12, 12, 13] })).sections.SPEAKING?.points).toBe(12);
    expect(computeCourseResult(input("B1", FINAL_74, { ...base, speaking: [11, 12, 12] })).sections.SPEAKING?.points).toBe(11);
    expect(computeCourseResult(input("B1", FINAL_74, { ...base, speaking: [20, 20, 20] })).sections.SPEAKING?.points).toBe(20);
  });
  it("fails the speaking minimum on a mean of 11.67 although two tasks reached 12", () => {
    const r = computeCourseResult(input("B1", FINAL_74, { ...base, speaking: [12, 12, 11] }));
    expect(r.sections.SPEAKING?.points).toBe(11);
    expect(r.reasons).toContain("SPEAKING_BELOW_MIN");
  });
});

describe("rules that can be switched off", () => {
  const zeroContent = { right: 35, writing: writingTask(0, 3, 3), speaking: 20 };
  it("does not fail 0 points of content when the rule is off", () => {
    const rules: CourseRules = { ...FINAL_RULES, writingContentZeroFails: false };
    expect(computeCourseResult(input("B1", SHEET_64, zeroContent, rules))).toMatchObject({ outcome: "PASS", reasons: [], recommendation: "B2.1" });
  });
  it("has no speaking minimum when it is null", () => {
    const rules: CourseRules = { ...FINAL_RULES, speakingMinPct: null };
    const r = computeCourseResult(input("B1", SHEET_64, { right: 35, writing: writingTask(3, 3, 3), speaking: 2 }, rules));
    expect(r).toMatchObject({ total: 46, outcome: "PASS", reasons: [] });
  });
  it("takes any pass share", () => {
    const rules: CourseRules = { ...FINAL_RULES, passPct: 50 };
    expect(computeCourseResult(input("B1", SHEET_64, { ...BASE, right: 14 }, rules))).toMatchObject({ total: 32, outcome: "PASS" });
    expect(computeCourseResult(input("B1", SHEET_64, { ...BASE, right: 13 }, rules))).toMatchObject({ total: 31, outcome: "FAIL" });
  });
});

describe("defensive input", () => {
  it("clamps points to their maximum and below zero", () => {
    const r = computeCourseResult({
      config: { key: "B1", form: "B", rules: FINAL_RULES },
      objective: { READING: { right: 99, max: 10 }, GRAMMAR: { right: -3, max: 25 } },
      writing: [{ INHALT: 7, WORTSCHATZ: -1, GRAMMATIK: 2.4 }],
      speaking: [{ KOMMUNIKATION: 9, WORTSCHATZ: 4, GRAMMATIK: 4, AUSSPRACHE: 4, KOHAERENZ: 4 }],
    });
    expect(r.form).toBe("B");
    expect(r.sections.READING?.points).toBe(10);
    expect(r.sections.GRAMMAR?.points).toBe(0);
    expect(r.sections.WRITING?.points).toBe(5);
    expect(r.sections.SPEAKING?.points).toBe(20);
  });
  it("treats a form without writing or speaking as having none", () => {
    const r = computeCourseResult({
      config: { key: "A1.1", form: null, rules: defaultCourseRules("A1.1") },
      objective: { READING: { right: 6, max: 6 } },
      writing: null,
      speaking: null,
    });
    expect(r).toMatchObject({ form: null, total: 6, max: 6, outcome: "PASS", recommendation: "A1.2" });
  });
});
