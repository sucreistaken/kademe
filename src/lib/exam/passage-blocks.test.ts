import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { parseCardHeading, passageBlocks } from "./passage-blocks";

const KURS = `Berger Logistik: Weiterbildung im Herbst

Kurs 1: Excel für Anfänger
Montag, 6. und 13. Oktober, 9 bis 12 Uhr, Raum 104
Tabellen und einfache Rechnungen am Computer. Bitte bringen Sie Ihren Laptop mit.

Kurs 2: Erste Hilfe im Betrieb
Mittwoch, 15. Oktober, 8 bis 16 Uhr, Kantine (Erdgeschoss)

Anmeldung bis zum 1. Oktober bei Frau Demir.`;

describe("parseCardHeading", () => {
  it.each([
    ["Anzeige B", "B", null],
    ["Kurs 1:", "1", null],
    ["Kurs 1: Excel für Anfänger", "1", "Excel für Anfänger"],
    ["Termin 2 - Mittwoch", "2", "Mittwoch"],
    ["C)", "C", null],
    ["A  Computerkurs", "A", "Computerkurs"],
    ["A: Miriam Kessler", "A", "Miriam Kessler"],
  ])("%s -> marker %s, title %s", (heading, marker, title) => {
    expect(parseCardHeading(heading)).toEqual({ marker, title });
  });
  it("gives nothing for a line that is not a card heading", () => {
    expect(parseCardHeading("Wir suchen eine Fahrerin.")).toEqual({ marker: null, title: null });
  });
});

describe("passageBlocks", () => {
  it("turns the parts of the Weiterbildung notice into cards and keeps the company line as intro", () => {
    const blocks = passageBlocks(KURS, "Weiterbildung im Herbst");
    expect(blocks).toEqual([
      { kind: "text", lines: ["Berger Logistik: Weiterbildung im Herbst"] },
      {
        kind: "card",
        heading: "Kurs 1: Excel für Anfänger",
        marker: "1",
        title: "Excel für Anfänger",
        lines: ["Montag, 6. und 13. Oktober, 9 bis 12 Uhr, Raum 104", "Tabellen und einfache Rechnungen am Computer. Bitte bringen Sie Ihren Laptop mit."],
      },
      { kind: "card", heading: "Kurs 2: Erste Hilfe im Betrieb", marker: "2", title: "Erste Hilfe im Betrieb", lines: ["Mittwoch, 15. Oktober, 8 bis 16 Uhr, Kantine (Erdgeschoss)"] },
      { kind: "text", lines: ["Anmeldung bis zum 1. Oktober bei Frau Demir."] },
    ]);
  });

  it("makes a card of each lone-letter advert", () => {
    const blocks = passageBlocks("A\nCafé sucht Aushilfe.\n\nB\nWir suchen eine Fahrerin.\n\nC)\nNachhilfe in Mathematik.", "Kleinanzeigen");
    expect(blocks).toEqual([
      { kind: "card", heading: "A", marker: "A", title: null, lines: ["Café sucht Aushilfe."] },
      { kind: "card", heading: "B", marker: "B", title: null, lines: ["Wir suchen eine Fahrerin."] },
      { kind: "card", heading: "C)", marker: "C", title: null, lines: ["Nachhilfe in Mathematik."] },
    ]);
  });

  it("accepts a bare keyword label and a letter label with its title on the same line", () => {
    const ads = passageBlocks("Anzeige A\nCafé sucht Aushilfe.\n\nAnzeige B\nHotel sucht Personal.", "Drei Jobanzeigen");
    expect(ads.map((b) => b.kind)).toEqual(["card", "card"]);
    const courses = passageBlocks("A  Computerkurs\nWord und Excel.\n\nB  Fotostudio Klick\nBewerbungsfotos.", "Kurse");
    expect(courses).toEqual([
      { kind: "card", heading: "A  Computerkurs", marker: "A", title: "Computerkurs", lines: ["Word und Excel."] },
      { kind: "card", heading: "B  Fotostudio Klick", marker: "B", title: "Fotostudio Klick", lines: ["Bewerbungsfotos."] },
    ]);
    const voices = passageBlocks("A: Miriam Kessler, Psychologin\nMeine Meinung.\n\nB: Tobias Hahn, Personalleiter\nUnsere Erfahrung.", "Stimmen");
    expect(voices.map((b) => b.kind)).toEqual(["card", "card"]);
  });

  it("does not take a sentence that merely starts like a label for a heading", () => {
    const blocks = passageBlocks("Kursleiter Max kommt.\n\nText ist wichtig: lesen Sie.\n\nA lot of work.", "T");
    expect(blocks.every((b) => b.kind === "text")).toBe(true);
  });

  it("keeps a normal article as prose", () => {
    const blocks = passageBlocks("Viele Menschen möchten lernen.\n\nIm ersten Stock gibt es einen Lernraum.\n\nJeden Dienstag gibt es ein Sprachcafé.", "Lernen nach der Arbeit");
    expect(blocks.every((b) => b.kind === "text")).toBe(true);
    expect(blocks).toHaveLength(3);
  });

  it("uses no cards when only one block qualifies", () => {
    const blocks = passageBlocks("Einleitung.\n\nKurs 1: Excel\nMontag\n\nSchluss.", "Titel");
    expect(blocks.every((b) => b.kind === "text")).toBe(true);
  });

  it("drops a first line that repeats the title, ignoring case and spacing", () => {
    const blocks = passageBlocks("Neu in der  Stadtbibliothek: Lernen\n\nErster Absatz.", "neu in der stadtbibliothek: lernen");
    expect(blocks).toEqual([{ kind: "text", lines: ["Erster Absatz."] }]);
  });

  it("drops a title repeat but keeps the rest of the same block", () => {
    const blocks = passageBlocks("Titel\nZeile eins\nZeile zwei\n\nAbsatz.", "Titel");
    expect(blocks).toEqual([{ kind: "text", lines: ["Zeile eins", "Zeile zwei"] }, { kind: "text", lines: ["Absatz."] }]);
  });

  it("drops a company-prefixed title line when the block has more lines", () => {
    const blocks = passageBlocks("Firma X: Weiterbildung im Herbst\nAnmeldung bis Freitag.", "Weiterbildung im Herbst");
    expect(blocks).toEqual([{ kind: "text", lines: ["Anmeldung bis Freitag."] }]);
  });

  it("does not treat a longer word ending in the title as a repeat", () => {
    const blocks = passageBlocks("Sommerfest\n\nText.", "fest");
    expect(blocks[0]).toEqual({ kind: "text", lines: ["Sommerfest"] });
  });

  it("is safe on empty or CRLF input", () => {
    expect(passageBlocks("", "T")).toEqual([]);
    expect(passageBlocks("A\r\nEins\r\n\r\nB\r\nZwei", "T")).toHaveLength(2);
  });
});

describe("passageBlocks over the seed bank", () => {
  const reading = SEED_BANK.stimuli.filter((s) => s.section === "READING");

  it("never loses text: every word of the body survives except the dropped title line", () => {
    for (const s of reading) {
      const out = passageBlocks(s.body, s.title)
        .flatMap((b) => (b.kind === "card" ? [b.heading, ...b.lines] : b.lines))
        .join(" ");
      const words = (t: string) => t.replace(/[^\p{L}\p{N}]/gu, "");
      const first = words(s.body.split("\n")[0]);
      const all = words(s.body);
      expect([all, all.slice(first.length)]).toContain(words(out));
    }
  });

  it("makes cards only of the known multi-part texts", () => {
    const withCards = reading.filter((s) => passageBlocks(s.body, s.title).some((b) => b.kind === "card")).map((s) => s.title);
    console.info(`reading texts: ${reading.length}, with cards: ${withCards.length}`, withCards);
    expect(withCards.length).toBeGreaterThan(0);
  });
});
