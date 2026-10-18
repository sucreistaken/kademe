import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { candidateMessages } from "@/i18n/candidate";
import { CANDIDATE_LOCALES } from "@/i18n/locale";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("next-intl", async (orig) => ({ ...(await orig<typeof import("next-intl")>()), useLocale: () => "en" }));

import type { CandidateItem } from "@/lib/exam/safe";
import { WritingItem } from "./ItemView";
import { TASK_LEFT, TASK_RIGHT, TASK_SPLIT } from "./item-parts";

describe("invite section task count", () => {
  const count = (locale: (typeof CANDIDATE_LOCALES)[number], n: number) =>
    createTranslator({ locale, messages: candidateMessages[locale] })(
      "exam.tasks" as never,
      { n } as never,
    );
  it("is a singular form for one in English, German and Spanish", () => {
    expect(count("en", 1)).toBe("1 task");
    expect(count("de", 1)).toBe("1 Aufgabe");
    expect(count("es", 1)).toBe("1 tarea");
    expect(count("en", 3)).toBe("3 tasks");
  });
  it("covers the Arabic plural categories and the Turkish single form", () => {
    expect(count("ar", 1)).toBe("مهمة واحدة");
    expect(count("ar", 2)).toBe("مهمتان");
    expect(count("ar", 3)).toBe("3 مهام");
    expect(count("tr", 1)).toBe("1 görev");
    expect(count("tr", 4)).toBe("4 görev");
  });
});

describe("writing task layout", () => {
  const item = {
    sequence: 1,
    section: "WRITING",
    type: "WRITING_PROMPT",
    prompt: "Ihr Chef ist krank.\n\nSchreiben Sie ihm eine Nachricht.",
    content: { kind: "WRITING", minWords: 40, maxWords: 80 },
  } as unknown as CandidateItem;
  const html = renderToStaticMarkup(createElement(WritingItem, { item, answer: {}, onChange: () => {}, disabled: false }));

  it("puts the task and the answer in two columns from lg and keeps the field filling the height", () => {
    expect(TASK_SPLIT).toContain("lg:grid-cols-2");
    expect(html).toContain(TASK_SPLIT);
    expect(html).toContain(TASK_LEFT);
    expect(html).toContain(TASK_RIGHT);
    expect(html).toMatch(/<textarea[^>]*lang="de"[^>]*class="[^"]*lg:flex-1/);
  });
  it("uses logical, dash-free classes", () => {
    for (const c of [TASK_SPLIT, TASK_LEFT, TASK_RIGHT]) expect(c).not.toMatch(/\b(pl|pr|ml|mr|left|right|text-left|text-right)-/);
    expect(TASK_LEFT).toContain("lg:pe-2");
  });
});
