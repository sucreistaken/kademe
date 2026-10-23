import { describe, expect, it } from "vitest";
import { blindItems, renderSlots } from "./blind-items";
import type { SeedBankPart, SeedItem } from "./types";

const img = (alt: string) => ({ storageKey: "bank/images/0123456789abcdef.webp", w: 100, h: 80, alt });
const base = { section: "READING" as const, level: "A2" as const };

const items: SeedItem[] = [
  {
    ...base,
    type: "SINGLE_CHOICE",
    skillTag: "reading.detail",
    prompt: "Was passt?",
    content: { kind: "CHOICE", options: [{ id: "a", text: "", image: img("ein roter Apfel") }, { id: "b", text: "Birne" }] },
    key: { kind: "CHOICE", correct: ["a"] },
  },
  {
    ...base,
    type: "MATCHING",
    skillTag: "reading.matching",
    prompt: "Ordnen Sie zu.",
    content: {
      kind: "MATCHING",
      left: [{ id: "l1", text: "Bäckerei" }],
      right: [{ id: "r1", text: "Brot", image: img("ein Laib Brot") }, { id: "r2", text: "Milch" }],
    },
    key: { kind: "MATCHING", pairs: { l1: "r1" } },
  },
  {
    ...base,
    type: "TRUE_FALSE_NG",
    skillTag: "reading.tfng",
    prompt: "Ja oder Nein?",
    content: { kind: "TFNG", statements: [{ id: "s1", text: "Anna wohnt in Köln." }], wording: "JA_NEIN" },
    key: { kind: "TFNG", answers: { s1: "R" } },
  },
  {
    ...base,
    type: "TRUE_FALSE_NG",
    skillTag: "reading.tfng",
    prompt: "Ja oder Nein, zwei Wege.",
    content: { kind: "TFNG", statements: [{ id: "s1", text: "Ben arbeitet." }], wording: "JA_NEIN", twoWay: true },
    key: { kind: "TFNG", answers: { s1: "F" } },
  },
  {
    ...base,
    type: "MULTI_CHOICE",
    skillTag: "reading.detail",
    prompt: "Was stimmt?",
    content: {
      kind: "CHOICE",
      options: [{ id: "a", text: "Eins" }, { id: "b", text: "Zwei" }, { id: "c", text: "Drei" }],
      pick: 2,
    },
    key: { kind: "CHOICE", correct: ["a", "b"] },
  },
  {
    section: "GRAMMAR",
    level: "A2",
    type: "GAP_FILL",
    skillTag: "grammar.open",
    prompt: "Ich bleibe zu Hause, {{g1}} es regnet. Er {{g2}} müde.",
    content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
    key: { kind: "GAP", answers: { g1: ["weil"], g2: ["ist"] } },
  },
  {
    section: "LISTENING",
    level: "A2",
    type: "SHORT_TEXT",
    skillTag: "listening.detail",
    prompt: "Wie viel Prozent?",
    content: { kind: "SHORT_TEXT", maxChars: 40 },
    key: { kind: "SHORT_TEXT", accepted: ["vierzig Prozent"] },
  },
];
const bank: SeedBankPart = { stimuli: [], items };
const rendered = blindItems(bank, "A2").map((b) => renderSlots(b));

describe("renderSlots", () => {
  it("prints picture alts from the raw content for options and matching targets", () => {
    expect(rendered[0].lines).toEqual(["- (a) [Bild: ein roter Apfel]", "- (b) Birne"]);
    expect(rendered[1].lines).toContain("- A: [Bild: ein Laib Brot] Brot");
    expect(rendered[1].lines).toContain("- B: Milch");
  });
  it("asks for J / N / T under the Ja / Nein wording, J / N when two way", () => {
    expect(rendered[2].lines.at(-1)).toBe("Antwort je Aussage: J (ja), N (nein) oder T (Text sagt dazu nichts).");
    expect(rendered[3].lines.at(-1)).toBe("Antwort je Aussage: J (ja) oder N (nein).");
  });
  it("says how many boxes to tick", () => {
    expect(rendered[4].lines.at(-1)).toBe("Kreuzen Sie 2 an.");
  });
  it("renders open gaps as typed slots", () => {
    expect(rendered[5].lines).toContain("- [g1]");
    expect(rendered[5].lines).toContain("Schreibe in jede Lücke genau ein passendes Wort.");
    expect(rendered[5].template).toMatch(/: g1=\.\.\., g2=\.\.\.$/);
  });
  it("gives a short answer item a text= template line", () => {
    expect(rendered[6].lines).toEqual(["Kurze Antwort (höchstens 40 Zeichen)."]);
    expect(rendered[6].template).toMatch(/^listening-a2-[0-9a-f]{16}: text=\.\.\.$/);
  });
  it("never leaks key words", () => {
    const all = rendered.flatMap((r) => [...r.lines, r.template]).join("\n");
    expect(all).not.toContain("weil");
    expect(all).not.toContain("correct");
    expect(all).not.toContain("vierzig");
  });
});
