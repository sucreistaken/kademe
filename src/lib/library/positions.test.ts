import { describe, expect, it } from "vitest";
import { positionFormValue, splitList, validWeight } from "./positions";

describe("position form helpers", () => {
  it("splits a comma list into trimmed, non-empty, unique items", () => {
    expect(splitList(" Figma, Türkçe ,, Figma ,")).toEqual(["Figma", "Türkçe"]);
    expect(splitList("")).toEqual([]);
  });

  it("accepts a whole number from 0 to 100 as importance", () => {
    for (const ok of ["0", "7", "60", "100"]) expect(validWeight(ok), ok).toBe(true);
    for (const bad of ["", "abc", "101", "-1", "2.5", " 5", "1000"]) expect(validWeight(bad), bad).toBe(false);
  });
});

describe("positionFormValue", () => {
  it("turns a stored position into form text and back to the same save", () => {
    const value = positionFormValue({
      name: "Tasarımcı",
      team: null,
      shortDescription: null,
      jobDescription: "İlan",
      skills: ["Figma", "Türkçe"],
      languages: [],
      profile: [
        { competencyId: "a", weight: 60, expectedLevel: null, archived: true },
        { competencyId: "b", weight: 20, expectedLevel: 3 },
      ],
    });
    expect(value).toEqual({
      name: "Tasarımcı",
      team: "",
      shortDescription: "",
      jobDescription: "İlan",
      skills: "Figma, Türkçe",
      languages: "",
      profile: [
        { competencyId: "a", weight: "60", expectedLevel: "none", archived: true },
        { competencyId: "b", weight: "20", expectedLevel: "3", archived: false },
      ],
    });
    expect(splitList(value.skills)).toEqual(["Figma", "Türkçe"]);
  });
});
