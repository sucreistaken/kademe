import { describe, expect, it } from "vitest";
import { problemMessage } from "@/lib/problem-message";
import { isProblemArea, problemWindowStart, splitProblemMessage } from "./problem-reports";

describe("splitProblemMessage", () => {
  it("takes the area and the note apart", () => {
    expect(splitProblemMessage("EXAM_END: Das Audio ist ausgefallen.")).toEqual({ area: "EXAM_END", note: "Das Audio ist ausgefallen." });
  });

  it("reads a report with no words as its area alone", () => {
    expect(splitProblemMessage("SYSTEM_CHECK")).toEqual({ area: "SYSTEM_CHECK", note: "" });
  });

  it("keeps a note that itself holds colons or line breaks whole", () => {
    expect(splitProblemMessage("EXAM_END: camera=ok: no\nsecond line")).toEqual({ area: "EXAM_END", note: "camera=ok: no\nsecond line" });
  });

  it("treats a message with no area head as all note", () => {
    expect(splitProblemMessage("My screen froze.")).toEqual({ area: null, note: "My screen froze." });
    expect(splitProblemMessage(null)).toEqual({ area: null, note: "" });
  });

  it("is the inverse of problemMessage", () => {
    for (const [area, note] of [["EXAM_END", "It broke."], ["LINK", ""]] as const) {
      expect(splitProblemMessage(problemMessage(area, note))).toEqual({ area, note });
    }
  });

  it("knows the exam's own areas", () => {
    expect(isProblemArea("EXAM_END")).toBe(true);
    expect(isProblemArea("HELP")).toBe(false);
  });
});

describe("problemWindowStart", () => {
  it("is seven days before now", () => {
    expect(problemWindowStart(new Date("2026-10-18T12:00:00Z")).toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });
});
