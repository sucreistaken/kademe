import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));

import { SEED_BANK } from "@/db/seed-bank";
import { TaskPromptCard } from "./TaskPromptCard";

const render = (text: string) => renderToStaticMarkup(createElement(TaskPromptCard, { text }));

describe("task prompt with a pipe table", () => {
  const seed = SEED_BANK.items.find((i) => i.type === "WRITING_PROMPT" && i.prompt.includes("Lindental"))!;

  it("shows the real Lindental seed prompt's table as a read-only table without raw pipes", () => {
    const html = render(seed.prompt);
    expect(html).toContain("<table");
    expect(html.match(/<tr>/g)).toHaveLength(5);
    expect(html).toContain("Öffentlicher Nahverkehr");
    expect(html).toContain("41 %");
    expect(html).not.toContain("|");
    expect(html).not.toContain("<input");
    expect(html).toContain("Leserbrief");
  });

  it("a prompt without a table renders without one", () => {
    expect(render("Thema: Arbeit.\n\nSchreiben Sie einen Brief.")).not.toContain("<table");
  });
});
