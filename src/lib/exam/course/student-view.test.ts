import { describe, expect, it } from "vitest";
import { candidateSafe } from "@/lib/candidate-safe";
import { COURSE_KEYS, type CourseResult } from "./types";
import { COURSE_TESTS } from "./catalog";
import { candidateTestName, studentCourseResult } from "./student-view";

/** The student's side of a course result: the German name, and what leaves the server after release. */

const ready: CourseResult = {
  key: "B1",
  form: "A",
  sections: {
    READING: { points: 8, max: 10, pending: false },
    GRAMMAR: { points: 20, max: 25, pending: false },
    LISTENING: { points: 7, max: 10, pending: false },
    WRITING: { points: 6, max: 9, pending: false },
    SPEAKING: { points: 15, max: 20, pending: false },
  },
  total: 56,
  max: 74,
  pct: 75.7,
  outcome: "PASS",
  reasons: [],
  recommendation: "B2.1",
  focus: null,
};

describe("the name a course test is called by", () => {
  it("is the German name for every course, whatever name the exam was stored under", () => {
    for (const key of COURSE_KEYS) {
      expect(candidateTestName("Herbstgruppe Oktober", { course: { key } })).toBe(COURSE_TESTS[key].germanName);
    }
    expect(candidateTestName("x", { course: { key: "B1" } })).toBe("Abschlusstest B1");
    expect(candidateTestName("x", { course: { key: "A2.1" } })).toBe("Zwischentest A2.1");
  });

  it("leaves the stored name of any other exam alone", () => {
    expect(candidateTestName("Placement test, 45 min", {})).toBe("Placement test, 45 min");
    expect(candidateTestName("Placement test, 45 min", undefined)).toBe("Placement test, 45 min");
    expect(candidateTestName("Placement test, 45 min", null)).toBe("Placement test, 45 min");
  });

  it("keeps the stored name when the key is not a course the catalog knows", () => {
    expect(candidateTestName("Stored", { course: { key: "Z9" as never } })).toBe("Stored");
  });
});

describe("the released course result", () => {
  it("lists the points per section in the order of the test, with the total and the course to continue in", () => {
    const r = studentCourseResult(ready, "PASS");
    expect(r).toEqual({
      outcome: "PASS",
      sections: [
        { section: "READING", points: 8, max: 10 },
        { section: "GRAMMAR", points: 20, max: 25 },
        { section: "LISTENING", points: 7, max: 10 },
        { section: "WRITING", points: 6, max: 9 },
        { section: "SPEAKING", points: 15, max: 20 },
      ],
      total: 56,
      max: 74,
      recommendation: "B2.1",
      focus: null,
    });
  });

  it("follows the computed outcome when the teacher set none, and carries a focus flag", () => {
    const failed: CourseResult = { ...ready, outcome: "FAIL", reasons: ["SPEAKING_BELOW_MIN"], recommendation: "B1.2", focus: "SPEAKING" };
    expect(studentCourseResult(failed, null)).toMatchObject({ outcome: "FAIL", recommendation: "B1.2", focus: "SPEAKING" });
    expect(studentCourseResult(failed, undefined)).toMatchObject({ outcome: "FAIL" });
    // INCONCLUSIVE is not a course outcome: the computed one stands.
    expect(studentCourseResult(failed, "INCONCLUSIVE")).toMatchObject({ outcome: "FAIL" });
  });

  it("takes the teacher's PASS or FAIL as the outcome, and then withholds a course worked out for the other one", () => {
    const failed: CourseResult = { ...ready, outcome: "FAIL", recommendation: "B1.2", focus: "WRITING" };
    const overridden = studentCourseResult(failed, "PASS");
    expect(overridden?.outcome).toBe("PASS");
    expect(overridden?.recommendation).toBeNull();
    expect(overridden?.focus).toBeNull();
    // The same outcome keeps both.
    expect(studentCourseResult(failed, "FAIL")).toMatchObject({ outcome: "FAIL", recommendation: "B1.2", focus: "WRITING" });
  });

  it("is nothing while a section is undecided or the total is not known", () => {
    expect(studentCourseResult(null, "PASS")).toBeNull();
    expect(studentCourseResult(undefined, "PASS")).toBeNull();
    expect(studentCourseResult({ ...ready, total: null, outcome: null }, null)).toBeNull();
    expect(studentCourseResult({ ...ready, outcome: null }, null)).toBeNull();
    const pending = { ...ready, sections: { ...ready.sections, SPEAKING: { points: null, max: 20, pending: true } } };
    expect(studentCourseResult(pending, "PASS")).toBeNull();
  });

  it("lists only the sections the test has", () => {
    const noSpeaking = { ...ready, sections: { ...ready.sections } } as CourseResult;
    delete noSpeaking.sections.SPEAKING;
    expect(studentCourseResult(noSpeaking, null)?.sections.map((s) => s.section)).toEqual(["READING", "GRAMMAR", "LISTENING", "WRITING"]);
  });

  it("carries no question, no key, no level, no percentage and no field a student body would have stripped", () => {
    const r = studentCourseResult(ready, "PASS");
    const json = JSON.stringify(r);
    expect(Object.keys(r ?? {}).sort()).toEqual(["focus", "max", "outcome", "recommendation", "sections", "total"]);
    for (const x of ["pct", "reasons", "form", "level", "prompt", "options", "answers", "skillTag"]) expect(json).not.toContain(`"${x}"`);
    // candidateSafe leaves it as it is.
    expect(candidateSafe(r)).toEqual(r);
  });
});
