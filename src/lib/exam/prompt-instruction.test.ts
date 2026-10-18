import { describe, expect, it } from "vitest";
import { SEED_PARTS } from "@/db/seed-bank";
import { splitInstruction, splitPromptBlocks, splitTextLead, splitTitle } from "./prompt-instruction";

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

  it("does not take a modal or auxiliary question for an instruction", () => {
    expect(splitInstruction("Können Sie mir helfen?\n\nIch suche den Bahnhof.", "stem").instruction).toBeNull();
    expect(splitInstruction("Haben Sie einen Termin frei? Ja, am Montag.", "stem").instruction).toBeNull();
    expect(splitInstruction("Möchten Sie Tee oder Kaffee?\n\nIch hätte gern {{g1}}.", "stem").instruction).toBeNull();
    // A real imperative still splits.
    expect(splitInstruction("Beantworten Sie die Frage.\n\nKönnen Sie mir helfen?", "stem").instruction).toBe("Beantworten Sie die Frage.");
  });

  it("does not split when the imperative sentence carries a quotation and the gap", () => {
    const p = "Formen Sie den Satz um: „Herr Brandt behauptet, er habe nichts gewusst.“\n→ Herr Brandt {{g1}} nichts gewusst haben.";
    expect(splitInstruction(p, "stem")).toEqual({ instruction: null, content: p });
  });

  it("reads a wh-question inside a whole prompt as a stem and keeps the order", () => {
    expect(splitPromptBlocks("Lesen Sie die Situationen. Welche Anzeige passt? Jede Anzeige passt höchstens einmal. Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“.")).toEqual([
      { kind: "instruction", text: "Lesen Sie die Situationen." },
      { kind: "question", text: "Welche Anzeige passt?" },
      { kind: "instruction", text: "Jede Anzeige passt höchstens einmal. Wenn keine Anzeige passt, wählen Sie „Keine Anzeige passt“." },
    ]);
    expect(splitPromptBlocks("Wer vertritt welche Ansicht?")).toEqual([{ kind: "question", text: "Wer vertritt welche Ansicht?" }]);
  });

  it("keeps the true/false scheme question as instruction", () => {
    expect(splitPromptBlocks("Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage.")).toEqual([
      { kind: "instruction", text: "Richtig, falsch oder nicht im Text? Entscheiden Sie für jede Aussage." },
    ]);
    expect(splitPromptBlocks("Richtig (R), falsch (F) oder steht nicht im Text (NG)?").map((b) => b.kind)).toEqual(["instruction"]);
    expect(splitPromptBlocks("  ")).toEqual([]);
  });

  it("takes a short unpunctuated line before the text as its title", () => {
    expect(splitTitle("Mein Wochenende\n\nAm Samstag {{g1}} ich.")).toEqual({ title: "Mein Wochenende", text: "Am Samstag {{g1}} ich." });
    expect(splitTitle("Am Samstag {{g1}} ich.\n\nDann gehe ich heim.")).toEqual({ title: null, text: "Am Samstag {{g1}} ich.\n\nDann gehe ich heim." });
    expect(splitTitle("Ein Satz.\n\nMehr Text {{g1}}.").title).toBeNull();
    expect(splitTitle("Nur ein Absatz mit {{g1}}").title).toBeNull();
  });

  it("splits instruction, title and the start of the text", () => {
    expect(splitTextLead("Lesen Sie den Text.\n\nMein Tag\n\nHeute ist Montag. ")).toEqual({
      instruction: "Lesen Sie den Text.",
      title: "Mein Tag",
      rest: "Heute ist Montag.",
    });
  });

  it("finds the title of every real cloze and word-bank seed text", () => {
    const texts = Object.values(SEED_PARTS)
      .flatMap((p) => p.items)
      .filter((i) => i.skillTag === "grammar.cloze" || i.skillTag === "grammar.wordbank");
    expect(texts.length).toBeGreaterThan(20);
    for (const item of texts) {
      const { instruction, title, rest } = splitTextLead(item.prompt);
      expect(instruction, item.prompt).not.toBeNull();
      expect(title, item.prompt).not.toBeNull();
      expect(rest).toContain("{{");
    }
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
      if (mode === "whole") expect(squash(splitPromptBlocks(item.prompt).map((b) => b.text).join(" ")), item.prompt).toBe(squash(item.prompt));
    }
  });
});
