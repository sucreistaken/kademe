import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "@/i18n/messages/screens.de.json";
import en from "@/i18n/messages/screens.en.json";
import tr from "@/i18n/messages/screens.tr.json";
import { CourseFormPicker, CourseKindChoice } from "./invite-choice";

// The real provider types `children` as required, which createElement's third argument cannot satisfy.
const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; timeZone?: string; children?: ReactNode }>;
const noop = () => {};

const dict = { de, en, tr };
const render = (locale: keyof typeof dict, child: ReactNode) =>
  renderToStaticMarkup(createElement(Provider, { locale, timeZone: "Europe/Berlin", messages: { courseInvite: dict[locale].courseInvite } }, child));

/** Every radio of the markup with its group, value and checked state (React does not keep prop order in the markup). */
function radios(html: string, name: string): Array<{ value: string; checked: boolean }> {
  return [...html.matchAll(/<input\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(`name="${name}"`))
    .map((tag) => ({ value: /value="([^"]*)"/.exec(tag)?.[1] ?? "", checked: /\bchecked=""/.test(tag) }));
}

const kinds = (locale: keyof typeof dict, kind: "INTERIM" | "FINAL" | null, course: Parameters<typeof CourseKindChoice>[0]["course"] = null) =>
  render(locale, createElement(CourseKindChoice, { kind, course, onKind: noop, onCourse: noop }));

describe("the course test choice on the invite step", () => {
  it("offers the two kinds under the panel's own words", () => {
    expect(kinds("de", null)).toContain("Zwischentest");
    expect(kinds("de", null)).toContain("Abschlusstest");
    expect(kinds("tr", null)).toContain("Kurs ara sınavı");
    expect(kinds("tr", null)).toContain("Kurs sonu sınavı");
    expect(kinds("en", null)).toContain("Mid-course test");
    expect(kinds("en", null)).toContain("End-of-course test");
  });

  it("shows no course chips before a kind is picked", () => {
    const html = kinds("de", null);
    expect(radios(html, "invite-course")).toEqual([]);
    expect(html).not.toContain("Welcher Kurs?");
  });

  it("lists the four courses of the picked kind, in level order", () => {
    const interim = kinds("de", "INTERIM");
    expect(radios(interim, "invite-course").map((r) => r.value)).toEqual(["A1.1", "A2.1", "B1.1", "B2.1"]);
    expect(radios(kinds("de", "FINAL"), "invite-course").map((r) => r.value)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(interim).toContain("Welcher Kurs?");
  });

  it("marks the chosen course and only that one", () => {
    const chosen = radios(kinds("de", "INTERIM", "B1.1"), "invite-course");
    expect(chosen.filter((r) => r.checked).map((r) => r.value)).toEqual(["B1.1"]);
  });

  it("marks the picked kind", () => {
    expect(radios(kinds("de", "FINAL"), "invite-course-kind")).toEqual([
      { value: "INTERIM", checked: false },
      { value: "FINAL", checked: true },
    ]);
    expect(radios(kinds("de", null), "invite-course-kind").every((r) => !r.checked)).toBe(true);
  });

  it("never asks for a claimed level", () => {
    for (const locale of ["de", "en", "tr"] as const) {
      expect(kinds(locale, "FINAL", "B1")).not.toContain("invite-claim");
    }
  });
});

describe("the form picker", () => {
  const picker = (locale: keyof typeof dict, value: "AUTO" | "A" | "B") => render(locale, createElement(CourseFormPicker, { value, onChange: noop }));

  it("offers automatic, form A and form B", () => {
    const html = picker("de", "AUTO");
    expect(radios(html, "invite-course-form").map((r) => r.value)).toEqual(["AUTO", "A", "B"]);
    expect(html).toContain("Automatisch (A/B abwechselnd)");
    expect(html).toContain("Form A");
    expect(html).toContain("Form B");
  });

  it("marks the chosen form, and only that one", () => {
    expect(radios(picker("en", "AUTO"), "invite-course-form").filter((r) => r.checked).map((r) => r.value)).toEqual(["AUTO"]);
    expect(radios(picker("en", "B"), "invite-course-form").filter((r) => r.checked).map((r) => r.value)).toEqual(["B"]);
  });

  it("speaks Turkish and English too", () => {
    expect(picker("tr", "AUTO")).toContain("Otomatik (A/B dönüşümlü)");
    expect(picker("en", "AUTO")).toContain("Automatic (alternating A/B)");
  });
});
