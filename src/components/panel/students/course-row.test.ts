import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filterStudents } from "@/app/(manager)/exam/students/export/filter";
import { COURSE_OUTCOME_OVERRIDE_KEY } from "@/components/panel/course/outcome";
import { managerT } from "@/i18n/manager";
import { defaultCourseRules } from "@/lib/exam/course/catalog";
import type { CourseResult } from "@/lib/exam/course/types";
import type { ComputedResult } from "@/lib/exam/result";
import { CourseResultCell } from "./course-cells";
import { courseSearchText, studentCourseOf, type StudentCourse } from "./course-row";

const config = (key: "B1.1" | "B1" = "B1", form: "A" | "B" | null = "A") => ({ key, form, rules: defaultCourseRules(key) });

const course = (over: Partial<CourseResult> = {}): CourseResult => ({
  key: "B1",
  form: "A",
  sections: {},
  total: 52,
  max: 74,
  pct: 70.3,
  outcome: "PASS",
  reasons: [],
  recommendation: "B2.1",
  focus: null,
  ...over,
});

const computed = (c: CourseResult | null): ComputedResult => ({ skills: {}, overall: null, pooled: null, status: "READY", verification: null, course: c });

describe("studentCourseOf: what the list shows for a course test", () => {
  it("is null for an exam that is not a course test", () => {
    expect(studentCourseOf({ course: undefined, computed: computed(null), finalOutcome: null, final: false })).toBeNull();
  });

  it("names the course and the form before any result exists, with the catalog's points", () => {
    expect(studentCourseOf({ course: config("B1.1", "B"), computed: null, finalOutcome: null, final: false })).toEqual({
      key: "B1.1",
      form: "B",
      points: null,
      max: 56,
      outcome: null,
      final: false,
      recommendation: null,
    });
    expect(studentCourseOf({ course: config("B1"), computed: undefined, finalOutcome: null, final: false })?.max).toBe(74);
  });

  it("shows the points and the engine's outcome as a draft until the teacher finalizes", () => {
    const row = studentCourseOf({ course: config(), computed: computed(course()), finalOutcome: null, final: false });
    expect(row).toMatchObject({ points: 52, max: 74, outcome: "PASS", final: false, recommendation: "B2.1" });
  });

  it("has no points and no outcome while a section is pending", () => {
    const row = studentCourseOf({ course: config(), computed: computed(course({ total: null, pct: null, outcome: null, recommendation: null })), finalOutcome: null, final: false });
    expect(row).toMatchObject({ points: null, outcome: null });
  });

  it("takes the frozen outcome once the result is final", () => {
    const row = studentCourseOf({ course: config(), computed: computed(course({ outcome: "PASS" })), finalOutcome: "FAIL", final: true });
    expect(row).toMatchObject({ outcome: "FAIL", final: true });
  });

  it("shows the teacher's PASS or FAIL decision in a draft", () => {
    const skillOverrides = { [COURSE_OUTCOME_OVERRIDE_KEY]: { level: "FAIL", decider: "TEACHER" as const, userId: "u1", reason: "retake", at: "2026-10-28T10:00:00.000Z" } };
    expect(studentCourseOf({ course: config(), computed: computed(course({ outcome: "PASS" })), skillOverrides, finalOutcome: null, final: false })?.outcome).toBe("FAIL");
  });

  it("falls back to the blueprint's form when the engine has not named one", () => {
    expect(studentCourseOf({ course: config("B1", "B"), computed: computed(course({ form: null })), finalOutcome: null, final: false })?.form).toBe("B");
  });
});

describe("the list's search finds a course", () => {
  const rows = [
    { status: "FINAL", name: "Anna Muster", email: "anna@example.com", course: studentCourseOf({ course: config("B1.1", "A"), computed: null, finalOutcome: null, final: false }) },
    { status: "FINAL", name: "Ben Probe", email: "ben@example.com", course: studentCourseOf({ course: config("B1", "B"), computed: null, finalOutcome: null, final: false }) },
    { status: "FINAL", name: "Cem Test", email: "cem@example.com", course: null },
  ] as const;

  it("matches the course key", () => {
    expect(filterStudents(rows, "all", "B1.1", "de").map((r) => r.name)).toEqual(["Anna Muster"]);
    expect(filterStudents(rows, "all", "b1", "de").map((r) => r.name)).toEqual(["Anna Muster", "Ben Probe"]);
  });

  it("matches the form, and still matches the name and the e-mail", () => {
    expect(filterStudents(rows, "all", "form b", "de").map((r) => r.name)).toEqual(["Ben Probe"]);
    expect(filterStudents(rows, "all", "cem@", "de").map((r) => r.name)).toEqual(["Cem Test"]);
  });

  it("adds nothing for an exam that is not a course test", () => {
    expect(courseSearchText(null)).toBe("");
    expect(courseSearchText(rows[0].course)).toBe("B1.1 form A");
  });
});

describe("CourseResultCell", () => {
  const cell = (c: Partial<StudentCourse>, locale: "de" | "en" | "tr" = "de") =>
    renderToStaticMarkup(createElement(CourseResultCell, { course: { key: "B1", form: "A", points: 52, max: 74, outcome: "PASS", final: true, recommendation: null, ...c }, t: managerT(locale) }));

  it("says Bestanden or Nicht bestanden with the points", () => {
    expect(cell({})).toContain("Bestanden");
    expect(cell({})).toContain("52/74");
    expect(cell({ outcome: "FAIL", points: 31 })).toContain("Nicht bestanden");
    expect(cell({ outcome: "FAIL", points: 31 })).toContain("31/74");
  });

  it("speaks the panel language", () => {
    expect(cell({}, "en")).toContain("Passed");
    expect(cell({ outcome: "FAIL" }, "en")).toContain("Not passed");
    expect(cell({}, "tr")).toContain("Geçti");
  });

  it("gives the points a readable title", () => {
    expect(cell({})).toContain('title="52 von 74 Punkten"');
  });

  it("is a dash until there is anything to say", () => {
    const html = cell({ outcome: null, points: null });
    expect(html).toContain(">-<");
    expect(html).not.toContain("/74");
  });

  it("is muted before the teacher finalized, and never red", () => {
    const draft = cell({ final: false });
    expect(draft).toContain("text-muted");
    for (const html of [draft, cell({ outcome: "FAIL" })]) expect(html).not.toMatch(/danger|red/);
  });
});
