import { describe, expect, it } from "vitest";
import { SEED_PARTS } from "@/db/seed-bank";
import { parseTaskPrompt, splitTaskPrompt, type ParsedTaskPrompt } from "./task-prompt";

/** Every letter and digit of a prompt, in order (list numbers excluded, the list draws them): what must survive the layout. */
const letters = (s: string) => s.replace(/^\s*\d+[.)]\s+/gmu, "").replace(/[^\p{L}\p{N}]/gu, "");

function rebuilt(p: ParsedTaskPrompt): string {
  return [
    p.topic ? `Thema ${p.topic}` : "",
    p.card ? `${p.card.lead} ${p.card.text}` : "",
    ...p.blocks.map((b) => (b.kind === "text" ? b.lines.join(" ") : b.items.join(" "))),
  ].join(" ");
}

describe("parseTaskPrompt", () => {
  it("turns a speaking card prompt into topic, card and instruction", () => {
    const p = parseTaskPrompt('Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"\n\nStellen Sie einer Kollegin eine Frage mit diesem Wort. Dann antworten Sie selbst auf Ihre Frage.');
    expect(p.topic).toBe("Arbeit");
    expect(p.card).toEqual({ lead: "Auf Ihrer Karte steht:", text: "Mittagspause?" });
    expect(p.blocks).toEqual([{ kind: "text", lines: ["Stellen Sie einer Kollegin eine Frage mit diesem Wort.", "Dann antworten Sie selbst auf Ihre Frage."] }]);
  });

  it("makes dash lines a list and keeps the instruction lines around it", () => {
    const p = parseTaskPrompt("Erzählen Sie von Ihrem Tag:\n\n- Wann stehen Sie auf?\n- Was machen Sie am Abend?\n\nSchreiben Sie 20 bis 30 Wörter.");
    expect(p.topic).toBeNull();
    expect(p.card).toBeNull();
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Erzählen Sie von Ihrem Tag:"] },
      { kind: "list", ordered: false, items: ["Wann stehen Sie auf?", "Was machen Sie am Abend?"] },
      { kind: "text", lines: ["Schreiben Sie 20 bis 30 Wörter."] },
    ]);
  });

  it("starts a list right after a sentence that ends in a colon", () => {
    const p = parseTaskPrompt("Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter). Gehen Sie auf die folgenden Punkte ein:\n- Meinung.\n- Beispiele.");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Schreiben Sie einen Forumsbeitrag (ca. 150 Wörter).", "Gehen Sie auf die folgenden Punkte ein:"] },
      { kind: "list", ordered: false, items: ["Meinung.", "Beispiele."] },
    ]);
  });

  it("does not split inside quotation marks or after abbreviations", () => {
    const p = parseTaskPrompt("Ein Kollege sagt: „Großraumbüros sind modern. Einzelbüros nicht mehr.“ Reagieren Sie (z. B. mit einem Beispiel). Danke.");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Ein Kollege sagt: „Großraumbüros sind modern. Einzelbüros nicht mehr.“", "Reagieren Sie (z. B. mit einem Beispiel).", "Danke."] },
    ]);
  });

  it("makes numbered lines an ordered list", () => {
    const p = parseTaskPrompt("Sprechen Sie über diese fünf Punkte:\n\n1. Stellen Sie das Thema vor.\n2. Nennen Sie Vor- und Nachteile.");
    expect(p.blocks[1]).toEqual({ kind: "list", ordered: true, items: ["Stellen Sie das Thema vor.", "Nennen Sie Vor- und Nachteile."] });
  });

  it("reads inline ' - ' points as a list", () => {
    const p = parseTaskPrompt("Sprechen Sie über - Name - Wohnort - Hobbys");
    expect(p.blocks).toEqual([
      { kind: "text", lines: ["Sprechen Sie über"] },
      { kind: "list", ordered: false, items: ["Name", "Wohnort", "Hobbys"] },
    ]);
  });

  it("keeps a plain one-line prompt as one line", () => {
    expect(parseTaskPrompt("Beschreiben Sie Ihren Tag.")).toEqual({ topic: null, card: null, blocks: [{ kind: "text", lines: ["Beschreiben Sie Ihren Tag."] }] });
  });

  it("returns nothing for an empty prompt", () => {
    expect(parseTaskPrompt("")).toEqual({ topic: null, card: null, blocks: [] });
  });

  it("loses no words on any real seed writing or speaking prompt", () => {
    const items = [...SEED_PARTS.writing.items, ...SEED_PARTS.speaking.items];
    expect(items.length).toBeGreaterThan(50);
    for (const item of items) {
      const p = parseTaskPrompt(item.prompt);
      expect(letters(rebuilt(p)), item.prompt).toBe(letters(item.prompt));
      expect(p.blocks.every((b) => (b.kind === "text" ? b.lines.length > 0 : b.items.length > 0))).toBe(true);
    }
  });

  it("finds the card on every real seed card prompt", () => {
    const cards = SEED_PARTS.speaking.items.filter((i) => /Auf \w+ \p{L}+ steht/u.test(i.prompt));
    expect(cards.length).toBeGreaterThan(0);
    for (const item of cards) {
      const p = parseTaskPrompt(item.prompt);
      expect(p.card, item.prompt).not.toBeNull();
      expect(p.topic, item.prompt).not.toBeNull();
    }
  });
});

describe("splitTaskPrompt (moved here from review-cards)", () => {
  it("still splits the topic from the card", () => {
    expect(splitTaskPrompt('Thema: Arbeit. Auf Ihrer Karte steht: "Mittagspause?"')).toEqual(["Thema: Arbeit.", 'Auf Ihrer Karte steht: "Mittagspause?"']);
  });
});
