import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { TemplateGallery, type TemplateOption } from "./template-gallery";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;

const card = (key: string, group: TemplateOption["group"], name: string, competencies: string[]): TemplateOption => ({
  key,
  group,
  name,
  names: [name],
  summary: `${name} özeti.`,
  stageCount: 2,
  questionCount: 7,
  minutes: 25,
  competencies,
  stages: [
    { name: "Ön eleme", prompts: ["Kendini tanıt."] },
    { name: "İş örneği", prompts: ["Bu e-postaya cevap yaz."] },
  ],
});

const templates: TemplateOption[] = [
  card("customer-support", "GENERIC", "Müşteri Destek Uzmanı", ["Müşteri Odağı", "İletişim", "Problem Çözme", "Dördüncü"]),
  card("german-teacher", "LANGUAGE_SCHOOL", "Almanca Öğretmeni", ["Öğretim", "İletişim"]),
  card("warehouse", "EXTRA", "Depo Sorumlusu", ["Organizasyon"]),
];

const render = (props: { value?: string | null; list?: TemplateOption[] } = {}, locale: "tr" | "en" = "tr") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(TemplateGallery, { templates: props.list ?? templates, value: props.value ?? null, onChange: () => undefined }),
    ),
  );

const radio = (out: string, value: string) => out.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`))?.[0] ?? "";

describe("the template gallery (manager mockup 4b)", () => {
  it("groups the cards under their three headings, in the gallery's order", () => {
    const out = render();
    expect(out).toMatch(/<h2[^>]*>Genel roller<\/h2>/);
    expect(out).toMatch(/<h2[^>]*>Dil okulu<\/h2>/);
    expect(out).toMatch(/<h2[^>]*>Diğer roller<\/h2>/);
    expect(out.indexOf("Genel roller")).toBeLessThan(out.indexOf("Dil okulu"));
    expect(out.indexOf("Dil okulu")).toBeLessThan(out.indexOf("Diğer roller"));
    expect(out.indexOf('value="customer-support"')).toBeLessThan(out.indexOf('value="german-teacher"'));
    expect(out.indexOf('value="german-teacher"')).toBeLessThan(out.indexOf('value="warehouse"'));
  });

  it("leaves out a group with no templates", () => {
    const out = render({ list: [templates[0]] });
    expect(out).toContain("Genel roller");
    expect(out).not.toContain("Dil okulu");
    expect(out).not.toContain("Diğer roller");
  });

  it("shows each card's role tile, name, summary, meta line and at most three competencies", () => {
    const out = render();
    expect(out).toContain("lucide-headset");
    expect(out).toContain("Müşteri Destek Uzmanı");
    expect(out).toContain("Müşteri Destek Uzmanı özeti.");
    expect(out).toContain("2 aşama · 7 soru · 25 dk");
    expect(out).toContain("Problem Çözme");
    expect(out).not.toContain("Dördüncü");
    expect(out.match(/data-chip=""/g)).toHaveLength(3 + 2 + 1);
  });

  it("is one single choice: only the chosen card is checked", () => {
    const out = render({ value: "german-teacher" });
    expect(out).toMatch(/role="radiogroup"/);
    expect(radio(out, "german-teacher")).toContain('checked=""');
    expect(radio(out, "customer-support")).not.toContain('checked=""');
    expect(radio(out, "warehouse")).not.toContain('checked=""');
    expect(render()).not.toContain('checked=""');
  });

  it("offers an outlined preview on every card, and the preview is closed at first", () => {
    const out = render();
    expect(out.match(/<button type="button"[^>]*border-line[^>]*>Önizle/g)).toHaveLength(3);
    expect(out).not.toContain("Bu e-postaya cevap yaz.");
  });

  it("never draws sparkles", () => {
    expect(render({ value: "customer-support" })).not.toContain("lucide-sparkles");
  });

  it("speaks English on an English page", () => {
    const out = render({}, "en");
    expect(out).toContain("General roles");
    expect(out).toContain("Language school");
    expect(out).toContain("Other roles");
    expect(out).toContain("2 stages · 7 questions · 25 min");
    expect(out).toContain(">Preview");
  });
});
