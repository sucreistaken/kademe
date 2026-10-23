import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { drawFormatOf, itemFormatOf } from "./item-format";
import { CLOZE_SKILL_TAG, OPEN_CLOZE_SKILL_TAG, type ItemContent, type ItemType } from "./types";

const image = { storageKey: "bank/images/0123456789abcdef.webp", w: 640, h: 480, alt: "Bild" };
const of = (type: ItemType, content: ItemContent, skillTag = "reading.detail") => itemFormatOf({ type, skillTag, content });
const options = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, text: `Option ${i}` }));
const rows = [{ id: "l1", text: "Sie suchen einen Sprachkurs." }];

describe("itemFormatOf", () => {
  it("a text with gaps is its kind, whatever its type and content", () => {
    expect(of("GAP_FILL", { kind: "GAP", gaps: [{ id: "g1", choices: ["a", "b", "c", "d"] }] }, CLOZE_SKILL_TAG)).toBe("CLOZE");
    expect(of("GAP_FILL", { kind: "GAP", gaps: [{ id: "g1" }] }, OPEN_CLOZE_SKILL_TAG)).toBe("OPEN");
  });

  it("a choice question is its type, with PICK for tick-n and PICTURE for picture options", () => {
    expect(of("SINGLE_CHOICE", { kind: "CHOICE", options: options(4) })).toBe("SINGLE_CHOICE");
    expect(of("SINGLE_CHOICE", { kind: "CHOICE", options: options(3).map((o) => ({ ...o, image })) })).toBe("SINGLE_CHOICE/PICTURE");
    expect(of("MULTI_CHOICE", { kind: "CHOICE", options: options(8), pick: 4 })).toBe("MULTI_CHOICE/PICK");
    expect(of("MULTI_CHOICE", { kind: "CHOICE", options: options(8) })).toBe("MULTI_CHOICE");
  });

  it("true / false keeps its Ja / Nein wording apart; two answers or three is the same format", () => {
    const statements = [{ id: "s1", text: "Der Kurs ist kostenlos." }];
    expect(of("TRUE_FALSE_NG", { kind: "TFNG", statements })).toBe("TRUE_FALSE_NG");
    expect(of("TRUE_FALSE_NG", { kind: "TFNG", statements, twoWay: true })).toBe("TRUE_FALSE_NG");
    expect(of("TRUE_FALSE_NG", { kind: "TFNG", statements, wording: "JA_NEIN" })).toBe("TRUE_FALSE_NG/JA_NEIN");
  });

  it("matching to bare letters (ads, people, pictures named by a letter) differs from matching to worded targets", () => {
    const ads = ["Anzeige A", "Anzeige B", "Anzeige C", "Keine Anzeige passt"].map((text, i) => ({ id: `r${i}`, text }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: ads })).toBe("MATCHING/LETTERS");
    const people = ["Person A", "Person B", "Person C"].map((text, i) => ({ id: `r${i}`, text }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: people })).toBe("MATCHING/LETTERS");
    const pictures = ["Bild A", "Bild B", "Bild C"].map((text, i) => ({ id: `r${i}`, text, image }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: pictures })).toBe("MATCHING/LETTERS/PICTURE");
    // Picture targets with worded captions: the student still picks letters from the gallery (ItemView: lettersOnly).
    const captioned = ["Ein Fahrrad", "Ein Regenschirm", "Eine Tasse"].map((text, i) => ({ id: `r${i}`, text, image }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: captioned })).toBe("MATCHING/LETTERS/PICTURE");
    const headings = ["A: Neue Kurse im Herbst", "B: Freibad öffnet früher", "C: Linie 14 endet am Markt"].map((text, i) => ({ id: `r${i}`, text }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: headings })).toBe("MATCHING/WORDS");
    const names = ["Lena", "Murat", "Josefine", "Keine der drei Personen"].map((text, i) => ({ id: `r${i}`, text }));
    expect(of("MATCHING", { kind: "MATCHING", left: rows, right: names })).toBe("MATCHING/WORDS");
  });

  it("drawFormatOf falls back to the item type for content that breaks itemFormatOf, and never throws", () => {
    const broken = [
      { type: "MATCHING" as const, content: { kind: "MATCHING" } as unknown as ItemContent },
      { type: "SINGLE_CHOICE" as const, content: { kind: "CHOICE" } as unknown as ItemContent },
      { type: "TRUE_FALSE_NG" as const, content: null as unknown as ItemContent },
    ];
    for (const b of broken) {
      const item = { ...b, skillTag: "reading.detail" };
      expect(() => itemFormatOf(item)).toThrow();
      expect(drawFormatOf(item)).toBe(b.type);
    }
    const fine = { type: "SINGLE_CHOICE" as const, skillTag: "reading.detail", content: { kind: "CHOICE" as const, options: options(4) } };
    expect(drawFormatOf(fine)).toBe(itemFormatOf(fine));
  });

  it("every objective item of the starter bank has a format, and reading and listening offer several per level", () => {
    const objective = SEED_BANK.items.filter((i) => i.section === "GRAMMAR" || i.section === "READING" || i.section === "LISTENING");
    for (const i of objective) expect(itemFormatOf(i)).toMatch(/^[A-Z_]+(\/[A-Z_]+)*$/);
    for (const section of ["READING", "LISTENING"] as const) {
      const levels = new Set(objective.filter((i) => i.section === section).map((i) => i.level));
      for (const level of levels) {
        const formats = new Set(objective.filter((i) => i.section === section && i.level === level).map(itemFormatOf));
        expect(formats.size, `${section} ${level}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
