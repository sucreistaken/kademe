import { describe, expect, it } from "vitest";
import {
  CANDIDATE_LOCALES,
  LOCALES,
  candidateLocaleFromAcceptLanguage,
  dirOf,
  isCandidateLocale,
  isLocale,
  panelLocaleOf,
} from "@/i18n/locale";

describe("candidate locales", () => {
  it("adds de, es and ar for the exam student and leaves the panel on tr and en", () => {
    expect([...CANDIDATE_LOCALES]).toEqual(["tr", "en", "de", "es", "ar"]);
    expect([...LOCALES]).toEqual(["tr", "en"]);
    expect(isLocale("de")).toBe(false);
    expect(isCandidateLocale("de")).toBe(true);
    expect(isCandidateLocale("fr")).toBe(false);
  });

  it("dirOf is rtl for Arabic only", () => {
    expect(CANDIDATE_LOCALES.filter((l) => dirOf(l) === "rtl")).toEqual(["ar"]);
    expect(dirOf("tr")).toBe("ltr");
    expect(dirOf("de")).toBe("ltr");
  });

  it("panelLocaleOf keeps Turkish and sends every other language to English", () => {
    expect(panelLocaleOf("tr")).toBe("tr");
    expect(CANDIDATE_LOCALES.filter((l) => l !== "tr").map(panelLocaleOf)).toEqual(["en", "en", "en", "en"]);
  });

  it("reads the first supported language of Accept-Language", () => {
    expect(candidateLocaleFromAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.5")).toBe("ar");
    expect(candidateLocaleFromAcceptLanguage("fr-FR,de;q=0.8")).toBe("de");
    expect(candidateLocaleFromAcceptLanguage("fr-FR")).toBe("tr");
    expect(candidateLocaleFromAcceptLanguage(null)).toBe("tr");
  });
});
