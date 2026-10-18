import { describe, expect, it } from "vitest";
import { arabicFontStack } from "./font-stack";

describe("arabicFontStack", () => {
  it("puts the Latin web font first and the Arabic web font before any local Arial fallback", () => {
    // The family lists next/font hands out (seen in the production build, 2026-10-18).
    expect(arabicFontStack("'Nunito', 'Nunito Fallback'", "'Noto Sans Arabic', 'Noto Sans Arabic Fallback'")).toBe(
      "'Nunito', 'Noto Sans Arabic', 'Noto Sans Arabic Fallback', 'Nunito Fallback'",
    );
  });

  it("works when a font has no fallback face", () => {
    expect(arabicFontStack("'Nunito', 'Nunito Fallback'", "'Noto Sans Arabic'")).toBe("'Nunito', 'Noto Sans Arabic', 'Nunito Fallback'");
    expect(arabicFontStack("'Nunito'", "'Noto Sans Arabic'")).toBe("'Nunito', 'Noto Sans Arabic'");
  });
});
