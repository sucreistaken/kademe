import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CandidateIntl } from "@/components/candidate/Intl";
import { LanguageFlag } from "@/components/candidate/LanguageFlag";
import { LanguagePicker } from "@/components/candidate/LanguagePicker";
import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CANDIDATE_LOCALES, type CandidateLocale } from "@/i18n/locale";

const intl = (locale: CandidateLocale, child: React.ReactNode) => createElement(CandidateIntl, { locale, timeZone: "UTC" } as ComponentProps<typeof CandidateIntl>, child);

const picker = (current: CandidateLocale, locales: CandidateLocale[] = [...CANDIDATE_LOCALES]) =>
  renderToStaticMarkup(intl(current, createElement(LanguagePicker, { locales, current })));

describe("the language picker", () => {
  it("shows the current language's flag and its own name on the button", () => {
    const html = picker("de");
    expect(html).toContain("Deutsch");
    expect(html).toContain("<svg");
    expect(html).toContain('lang="de"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("Arabic shows the letter badge instead of a country flag", () => {
    const html = picker("ar");
    expect(html).toContain("العربية");
    expect(html).toContain("ع");
    expect(html).not.toContain(`viewBox="0 0 24 16"`);
  });

  it("names the control for a screen reader, in the student's language", () => {
    expect(picker("en")).toContain('aria-label="Language: English"');
  });

  it("is not drawn when there is only one language to choose", () => {
    expect(picker("tr", ["tr"])).toBe("");
    expect(renderToStaticMarkup(createElement(LanguageSwitch, { locales: ["tr"], current: "tr" }))).toBe("");
  });

  it("has a flag for every language", () => {
    for (const locale of CANDIDATE_LOCALES) {
      const html = renderToStaticMarkup(createElement(LanguageFlag, { locale }));
      expect(html, locale).toContain('aria-hidden="true"');
      expect(html.length, locale).toBeGreaterThan(40);
    }
  });
});

describe("the candidate frame's direction", () => {
  const shell = (locale: CandidateLocale) =>
    renderToStaticMarkup(intl(locale, createElement(CandidateShell, { locale, header: false } as ComponentProps<typeof CandidateShell>, "x")));

  it("Arabic runs right to left and every other language left to right", () => {
    expect(shell("ar")).toContain('lang="ar" dir="rtl"');
    for (const locale of ["tr", "en", "de", "es"] as const) expect(shell(locale)).toContain(`lang="${locale}" dir="ltr"`);
  });
});
