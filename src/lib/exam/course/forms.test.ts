import { describe, expect, it } from "vitest";
import { assignCourseForms, isCourseForm, singleInviteForm, unseenForm } from "./forms";
import type { CourseForm } from "./types";

const none = (): Set<CourseForm> => new Set();
const sat = (...forms: CourseForm[]): Set<CourseForm> => new Set(forms);

describe("unseenForm", () => {
  it("is the other form when the student sat exactly one", () => {
    expect(unseenForm(sat("A"))).toBe("B");
    expect(unseenForm(sat("B"))).toBe("A");
  });

  it("is null when the student sat none or both: nothing speaks for either form", () => {
    expect(unseenForm(none())).toBeNull();
    expect(unseenForm(sat("A", "B"))).toBeNull();
  });
});

describe("singleInviteForm", () => {
  it("gives the unseen form, else A", () => {
    expect(singleInviteForm(sat("A"))).toBe("B");
    expect(singleInviteForm(sat("B"))).toBe("A");
    expect(singleInviteForm(none())).toBe("A");
    expect(singleInviteForm(sat("A", "B"))).toBe("A");
  });
});

describe("assignCourseForms", () => {
  it("alternates A, B, A, B in list order for students nobody has seen", () => {
    expect(assignCourseForms([none(), none(), none(), none(), none()], null)).toEqual(["A", "B", "A", "B", "A"]);
    expect(assignCourseForms([none()], null)).toEqual(["A"]);
    expect(assignCourseForms([], null)).toEqual([]);
  });

  it("gives a returning student the form they did not sit, whatever their place in the list", () => {
    // Row 1 and 3 are "A" places, row 2 and 4 "B" places.
    expect(assignCourseForms([sat("A"), none(), sat("A"), none()], null)).toEqual(["B", "B", "B", "B"]);
    expect(assignCourseForms([sat("B"), sat("B"), sat("B"), sat("B")], null)).toEqual(["A", "A", "A", "A"]);
    expect(assignCourseForms([none(), sat("B"), none(), sat("A")], null)).toEqual(["A", "A", "A", "B"]);
  });

  it("alternates a student who sat both forms like a new one", () => {
    expect(assignCourseForms([sat("A", "B"), sat("A", "B"), sat("A", "B")], null)).toEqual(["A", "B", "A"]);
  });

  it("a returning student never shifts anyone else's form: the same list splits the same way", () => {
    const fresh = assignCourseForms([none(), none(), none(), none()], null);
    const withReturning = assignCourseForms([none(), sat("A"), none(), none()], null);
    expect(fresh).toEqual(["A", "B", "A", "B"]);
    expect(withReturning).toEqual(["A", "B", "A", "B"]);
    expect(withReturning.filter((_, i) => i !== 1)).toEqual(fresh.filter((_, i) => i !== 1));
  });

  it("a forced form wins for every row, history included", () => {
    expect(assignCourseForms([none(), sat("A"), sat("B"), sat("A", "B")], "A")).toEqual(["A", "A", "A", "A"]);
    expect(assignCourseForms([none(), sat("A"), sat("B"), sat("A", "B")], "B")).toEqual(["B", "B", "B", "B"]);
  });
});

describe("isCourseForm", () => {
  it("accepts A and B only", () => {
    expect(isCourseForm("A")).toBe(true);
    expect(isCourseForm("B")).toBe(true);
    for (const v of ["a", "C", "", null, undefined, 1, "AB"]) expect(isCourseForm(v), String(v)).toBe(false);
  });
});
