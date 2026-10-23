import { describe, expect, it } from "vitest";
import {
  CANDIDATE_LOCALES,
  DEFAULT_CANDIDATE_LOCALE,
  DEFAULT_LOCALE,
  LOCALES,
  candidateLocaleFromAcceptLanguage,
  dirOf,
  isCandidateLocale,
  isLocale,
  PANEL_LOCALES,
  contentLocale,
  isPanelLocale,
  panelLocaleFromAcceptLanguage,
  panelLocaleOf,
  type CandidateLocale,
} from "@/i18n/locale";
import { candidateMessages, messagesFor } from "@/i18n/candidate";

describe("candidate locales", () => {
  it("adds de, es and ar for the exam student and leaves the panel on tr and en", () => {
    expect([...CANDIDATE_LOCALES]).toEqual(["tr", "en", "de", "es", "ar"]);
    expect([...LOCALES]).toEqual(["tr", "en"]);
    expect(isLocale("de")).toBe(false);
    expect(isCandidateLocale("de")).toBe(true);
    expect(isCandidateLocale("fr")).toBe(false);
  });

  it("students default to English while the panel default stays Turkish (owner 2026-10-23)", () => {
    expect(DEFAULT_CANDIDATE_LOCALE).toBe("en");
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(messagesFor("xx" as CandidateLocale)).toBe(candidateMessages.en);
  });

  it("dirOf is rtl for Arabic only", () => {
    expect(CANDIDATE_LOCALES.filter((l) => dirOf(l) === "rtl")).toEqual(["ar"]);
    expect(dirOf("tr")).toBe("ltr");
    expect(dirOf("de")).toBe("ltr");
  });

  it("panelLocaleOf keeps Turkish and German and sends Spanish and Arabic to English", () => {
    expect(panelLocaleOf("tr")).toBe("tr");
    expect(panelLocaleOf("de")).toBe("de");
    expect(CANDIDATE_LOCALES.filter((l) => l !== "tr" && l !== "de").map(panelLocaleOf)).toEqual(["en", "es", "ar"].map(() => "en"));
  });

  it("the panel adds German on top of tr and en and Locale does not grow", () => {
    expect([...PANEL_LOCALES]).toEqual(["tr", "en", "de"]);
    expect([...LOCALES]).toEqual(["tr", "en"]);
    expect(isPanelLocale("de")).toBe(true);
    expect(isPanelLocale("es")).toBe(false);
    expect(isLocale("de")).toBe(false);
  });

  it("contentLocale reads German panel users the English database text", () => {
    expect(contentLocale("tr")).toBe("tr");
    expect(contentLocale("en")).toBe("en");
    expect(contentLocale("de")).toBe("en");
  });

  it("the first render of the panel follows Accept-Language over tr, en and de", () => {
    expect(panelLocaleFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.5")).toBe("de");
    expect(panelLocaleFromAcceptLanguage("fr-FR,en;q=0.8")).toBe("en");
    expect(panelLocaleFromAcceptLanguage("es-ES")).toBe("tr");
    expect(panelLocaleFromAcceptLanguage(null)).toBe("tr");
  });

  it("reads the first supported language of Accept-Language", () => {
    expect(candidateLocaleFromAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.5")).toBe("ar");
    expect(candidateLocaleFromAcceptLanguage("fr-FR,de;q=0.8")).toBe("de");
    expect(candidateLocaleFromAcceptLanguage("fr-FR")).toBe("en");
    expect(candidateLocaleFromAcceptLanguage(null)).toBe("en");
    expect(candidateLocaleFromAcceptLanguage("tr-TR,tr;q=0.9")).toBe("tr");
  });
});
