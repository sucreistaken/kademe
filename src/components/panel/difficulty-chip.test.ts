import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DifficultyChip } from "./difficulty-chip";

const r = (difficulty: "EASY" | "MEDIUM" | "HARD", label: string) => renderToStaticMarkup(createElement(DifficultyChip, { difficulty, label }));

describe("DifficultyChip", () => {
  it.each([
    ["EASY", "Kolay", "bg-diff-easy", 1],
    ["MEDIUM", "Orta", "bg-diff-medium", 2],
    ["HARD", "Zor", "bg-diff-hard", 3],
  ] as const)("%s says the word, shows %s filled steps and uses its tint with ink text", (d, label, tint, filled) => {
    const h = r(d, label);
    expect(h).toContain(label);
    expect(h).toContain(tint);
    expect(h).toContain("text-ink");
    expect(h.match(/data-step="on"/g)?.length).toBe(filled);
    expect(h.match(/data-step="off"/g)?.length ?? 0).toBe(3 - filled);
  });

  it("never fills red with white text", () => {
    expect(r("HARD", "Zor")).not.toMatch(/text-white|bg-red\b/);
  });
});
