import { describe, expect, it } from "vitest";
import { SEED_PARTS } from "@/db/seed-bank";
import { splitInstruction } from "./prompt-instruction";

describe("splitInstruction", () => {
  it("treats a whole true/false or matching prompt as instruction", () => {
    expect(splitInstruction("Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.", "whole")).toEqual({
      instruction: "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.",
      content: "",
    });
  });

  it("splits an imperative paragraph from the content under it", () => {
    expect(splitInstruction("Ergänzen Sie das fehlende Wort.\n\nDas Ergebnis ist überraschend, {{g1}} kaum jemand damit rechnete.", "stem")).toEqual({
      instruction: "Ergänzen Sie das fehlende Wort.",
      content: "Das Ergebnis ist überraschend, {{g1}} kaum jemand damit rechnete.",
    });
  });

  it("splits an imperative first sentence when the gap comes later", () => {
    expect(splitInstruction("Ergänzen Sie ein Adjektiv auf -bar. Man kann dieses Problem nicht lösen. = Es ist nicht {{g1}}.", "stem")).toEqual({
      instruction: "Ergänzen Sie ein Adjektiv auf -bar.",
      content: "Man kann dieses Problem nicht lösen. = Es ist nicht {{g1}}.",
    });
  });

  it("keeps a question stem and a bare sentence as content", () => {
    expect(splitInstruction("Wann fährt der Zug ab?", "stem")).toEqual({ instruction: null, content: "Wann fährt der Zug ab?" });
    expect(splitInstruction("Die Kundendaten wurden weitergegeben, {{g1}} sie gefragt worden wären.", "stem").instruction).toBeNull();
  });

  it("does not split when the imperative sentence carries a quotation and the gap", () => {
    const p = "Formen Sie den Satz um: „Herr Brandt behauptet, er habe nichts gewusst.“\n→ Herr Brandt {{g1}} nichts gewusst haben.";
    expect(splitInstruction(p, "stem")).toEqual({ instruction: null, content: p });
  });

  it("never loses or reorders text on a real seed prompt", () => {
    const squash = (s: string) => s.replace(/\s+/g, " ").trim();
    const items = Object.values(SEED_PARTS).flatMap((p) => p.items);
    expect(items.length).toBeGreaterThan(300);
    for (const item of items) {
      const mode = item.type === "TRUE_FALSE_NG" || item.type === "MATCHING" ? "whole" : "stem";
      const { instruction, content } = splitInstruction(item.prompt, mode);
      expect(squash(`${instruction ?? ""} ${content}`), item.prompt).toBe(squash(item.prompt));
      expect(instruction?.includes("{{") ?? false).toBe(false);
    }
  });
});
