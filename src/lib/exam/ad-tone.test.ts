import { describe, expect, it } from "vitest";
import { AD_TONES, AD_TONE_CLASSES, adTone } from "./ad-tone";

describe("adTone", () => {
  it("maps letters A.. onto the fixed cycle and wraps after six", () => {
    expect(["A", "B", "C", "D", "E", "F", "G"].map((m) => adTone(m, 99))).toEqual(["sky", "mint", "peach", "lilac", "butter", "sand", "sky"]);
  });
  it("maps numbers 1.. the same way", () => {
    expect(["1", "2", "3", "6", "7"].map((m) => adTone(m, 99))).toEqual(["sky", "mint", "peach", "sand", "sky"]);
  });
  it("falls back to the block index without a usable marker", () => {
    expect(adTone(null, 2)).toBe("peach");
    expect(adTone("0", 1)).toBe("mint");
    expect(adTone("AB", 7)).toBe("mint");
  });
  it("has classes written out for every tone", () => {
    for (const t of AD_TONES) expect(AD_TONE_CLASSES[t].card).toContain(`bg-ad-${t}`);
  });
});
