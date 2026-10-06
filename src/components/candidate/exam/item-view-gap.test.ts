import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({ useT: () => (key: string) => key }));

import type { CandidateItem } from "@/lib/exam/safe";
import { ItemView } from "./ItemView";

function gapItem(attached: boolean): CandidateItem {
  return {
    sequence: 1,
    section: "GRAMMAR",
    type: "GAP_FILL",
    prompt: "Anleitung.\n\nIch b{{g1}} hier und arb{{g2}} gern.",
    content: { kind: "GAP", gaps: [{ id: "g1", choices: null }, { id: "g2", choices: null }], ...(attached ? { attached: true as const } : {}) },
    stimulus: null,
    answer: null,
  };
}

const render = (item: CandidateItem) => renderToStaticMarkup(createElement(ItemView, { item, answer: {}, onChange: () => {} }));

describe("gap items", () => {
  it("C-test: each input sits right after its word stem, unbreakable, without a left margin and sized to the stem", () => {
    const html = render(gapItem(true));
    expect(html).toMatch(/<span>Anleitung\.\n\nIch <\/span><span class="whitespace-nowrap">b<input[^>]*size="2"[^>]*class="ml-0 /);
    expect(html).toMatch(/<span> hier und <\/span><span class="whitespace-nowrap">arb<input[^>]*size="4"/);
    expect(html).not.toContain("mx-1");
  });

  it("an ordinary gap item renders as before", () => {
    const html = render(gapItem(false));
    expect(html).toContain("<span>Anleitung.\n\nIch b</span><input");
    expect(html).toMatch(/<input[^>]*size="8"[^>]*class="mx-1 /);
    expect(html).not.toContain("whitespace-nowrap");
  });
});
