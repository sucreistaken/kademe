import { describe, expect, it } from "vitest";
import { consentIsFallback, consentShownLocale } from "./consent-locale";

const BODY = { tr: "Türkçe metin", en: "English text" };

describe("which consent text the student is shown, and so what the record says", () => {
  it("Turkish and English students read their own language", () => {
    expect(consentShownLocale("tr", BODY)).toBe("tr");
    expect(consentShownLocale("en", BODY)).toBe("en");
  });

  it.each(["de", "es", "ar"] as const)("%s students read the English text and the record says English", (locale) => {
    expect(consentIsFallback(locale)).toBe(true);
    expect(consentShownLocale(locale, BODY)).toBe("en");
  });

  it("a fallback student who opened the Turkish text is recorded as Turkish", () => {
    expect(consentShownLocale("de", BODY, "tr")).toBe("tr");
    expect(consentShownLocale("ar", BODY, "tr")).toBe("tr");
  });

  it("the Turkish choice is not honoured for a student whose language has its own text, or for other values", () => {
    expect(consentShownLocale("en", BODY, "tr")).toBe("en");
    expect(consentShownLocale("es", BODY, "de")).toBe("en");
    expect(consentShownLocale("es", BODY, undefined)).toBe("en");
  });

  it("falls back to Turkish when no English text is on file", () => {
    expect(consentShownLocale("en", { tr: "Türkçe metin", en: "" })).toBe("tr");
    expect(consentShownLocale("de", { tr: "Türkçe metin", en: "" })).toBe("tr");
  });

  it("Turkish and English are not fallbacks", () => {
    expect(consentIsFallback("tr")).toBe(false);
    expect(consentIsFallback("en")).toBe(false);
  });
});
