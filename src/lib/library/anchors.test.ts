import { describe, expect, it } from "vitest";
import { anchorHint, hasText, missingAnchorLevels, REQUIRED_ANCHOR_LEVELS } from "./anchors";

describe("anchors", () => {
  it("requires levels 1, 3 and 5", () => {
    expect(REQUIRED_ANCHOR_LEVELS).toEqual([1, 3, 5]);
  });

  it("counts a level as written when either language has text", () => {
    expect(hasText({ tr: "  ", en: "" })).toBe(false);
    expect(hasText({ tr: "", en: "Asks a question" })).toBe(true);
    expect(hasText(null)).toBe(false);
  });

  it("lists the required levels that are missing, in order", () => {
    expect(missingAnchorLevels({})).toEqual([1, 3, 5]);
    expect(missingAnchorLevels({ 1: { tr: "a", en: "" }, 5: { tr: " ", en: "" } })).toEqual([3, 5]);
    expect(missingAnchorLevels({ 1: { tr: "a", en: "" }, 3: { tr: "b", en: "" }, 5: { tr: "c", en: "" } })).toEqual([]);
  });

  it("flags a trait word instead of a behaviour (HIRING-UX 5.10)", () => {
    expect(anchorHint("İyi iletişimci", "tr")).toBe("ADJECTIVE");
    expect(anchorHint("Çok iyi ve güçlü bir iletişimci", "tr")).toBe("ADJECTIVE");
    expect(anchorHint("A strong, confident communicator", "en")).toBe("ADJECTIVE");
  });

  it("flags a definition too short to describe a behaviour", () => {
    expect(anchorHint("Soruyu özetler", "tr")).toBe("TOO_SHORT");
  });

  it("accepts an observable behaviour, even with one trait word in a long sentence", () => {
    expect(anchorHint("Karşı tarafın sorusunu kendi cümleleriyle özetler.", "tr")).toBeNull();
    expect(anchorHint("Sets expectations up front, delivers bad news in time and follows up in writing.", "en")).toBeNull();
    expect(anchorHint("", "tr")).toBeNull();
  });
});
