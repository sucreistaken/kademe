import { describe, expect, it } from "vitest";
import { SEED_BANK } from "@/db/seed-bank";
import { gapRowNumber, linkInsertion, type GapPiece } from "./insertion-gaps";
import { passageBlocks } from "./passage-blocks";

const rows = (...labels: string[]) => labels.map((text, i) => ({ id: `l${i + 1}`, text }));

/** The text of each piece, with a gap drawn as {n}. */
const flat = (pieces: GapPiece[]) => pieces.map((p) => (p.kind === "gap" ? `{${p.number}}` : p.text)).join("");

describe("gapRowNumber", () => {
  it.each([
    ["Lücke 1", 1],
    ["Lücke (2)", 2],
    ["Lücke [3]", 3],
    ["lücke 4:", 4],
    ["[5]", 5],
    ["(6)", 6],
    ["7", 7],
    ["Stelle 8", 8],
  ])("reads %s as gap %i", (text, n) => {
    expect(gapRowNumber(text)).toBe(n);
  });

  it.each(["Absatz 1", "Ihr Sohn braucht Hilfe.", "Lücke", "Lücke 0", "Lücke 1 und 2", "Anzeige A", ""])("takes %s for no gap", (text) => {
    expect(gapRowNumber(text)).toBeNull();
  });
});

describe("linkInsertion: the three ways the bank writes a gap", () => {
  it("links (1) ________ to Lücke (1)", () => {
    const link = linkInsertion(["Hier steht etwas. (1) ________ Danach geht es weiter. (2) ________ Schluss."], rows("Lücke (1)", "Lücke (2)"));
    expect(link).not.toBeNull();
    expect(flat(link!.pieces[0])).toBe("Hier steht etwas. {1} Danach geht es weiter. {2} Schluss.");
    expect(link!.numbers.get("l2")).toBe(2);
  });

  it("links [1] ___ to Lücke [1]", () => {
    const link = linkInsertion(["Anfang. [1] ___ Mitte. [2] ___ Ende."], rows("Lücke [1]", "Lücke [2]"));
    expect(flat(link!.pieces[0])).toBe("Anfang. {1} Mitte. {2} Ende.");
  });

  it("links [Lücke 1] to Lücke 1, also when the marker is alone in its block", () => {
    const link = linkInsertion(["Erster Absatz.", "[Lücke 1]", "Zweiter Absatz.", "[Lücke 2]"], rows("Lücke 1", "Lücke 2"));
    expect(link!.pieces.map(flat)).toEqual(["Erster Absatz.", "{1}", "Zweiter Absatz.", "{2}"]);
  });

  it("returns the gap pieces with the row id they belong to", () => {
    const link = linkInsertion(["A (2) ____ B (1) ____ C"], [
      { id: "rowX", text: "Lücke 1" },
      { id: "rowY", text: "Lücke 2" },
    ]);
    expect(link!.pieces[0].filter((p) => p.kind === "gap")).toEqual([
      { kind: "gap", rowId: "rowY", number: 2 },
      { kind: "gap", rowId: "rowX", number: 1 },
    ]);
  });

  it("keeps every character outside the markers", () => {
    const text = "Satz eins. (1) ________ Satz zwei, mit Komma. (2) ________\nNeue Zeile.";
    const link = linkInsertion([text], rows("Lücke (1)", "Lücke (2)"));
    expect(flat(link!.pieces[0])).toBe("Satz eins. {1} Satz zwei, mit Komma. {2}\nNeue Zeile.");
  });

  it("lets a text without any gap stay one piece", () => {
    const link = linkInsertion(["Nichts zu sehen.", "(1) ____"], rows("Lücke 1"));
    expect(link!.pieces[0]).toEqual([{ kind: "text", text: "Nichts zu sehen." }]);
    expect(link!.pieces[1]).toEqual([{ kind: "gap", rowId: "l1", number: 1 }]);
  });
});

describe("linkInsertion: robustness", () => {
  it("prefers the marker with a blank over a bare number in the running text", () => {
    const link = linkInsertion(["Siehe Regel (1) oben. Der Satz fehlt. (1) ________ Weiter."], rows("Lücke (1)"));
    expect(link).not.toBeNull();
    expect(flat(link!.pieces[0])).toBe("Siehe Regel (1) oben. Der Satz fehlt. {1} Weiter.");
  });

  it("accepts a bare marker when it is the only one", () => {
    const link = linkInsertion(["Satz davor. (1) Satz danach."], rows("Lücke (1)"));
    expect(flat(link!.pieces[0])).toBe("Satz davor. {1} Satz danach.");
  });

  it("takes a bare number between two blanks", () => {
    const link = linkInsertion(["Davor ___ 1 ___ danach"], rows("1"));
    expect(flat(link!.pieces[0])).toBe("Davor {1} danach");
  });

  it("leaves an example gap (0) in the text", () => {
    const link = linkInsertion(["Beispiel (0) ________ steht fest. (1) ________ Ende."], rows("Lücke 1"));
    expect(flat(link!.pieces[0])).toBe("Beispiel (0) ________ steht fest. {1} Ende.");
  });

  it("gives up when a row has no marker in the passage", () => {
    expect(linkInsertion(["Text mit (1) ________ nur einer Lücke."], rows("Lücke 1", "Lücke 2"))).toBeNull();
  });

  it("gives up when two blank-marked occurrences compete for one number", () => {
    expect(linkInsertion(["(1) ________ und noch einmal (1) ________"], rows("Lücke 1"))).toBeNull();
  });

  it("gives up when two bare occurrences compete and none has a blank", () => {
    expect(linkInsertion(["Erst (1) dann (1)."], rows("Lücke 1"))).toBeNull();
  });

  it("gives up when a row is not a gap label, or two rows share a number", () => {
    expect(linkInsertion(["(1) ________"], rows("Absatz 1"))).toBeNull();
    expect(linkInsertion(["(1) ________ (2) ________"], rows("Lücke 1", "Lücke 1"))).toBeNull();
    expect(linkInsertion(["(1) ________"], [])).toBeNull();
  });

  it("works across blocks and is not fooled by a number inside a longer one", () => {
    const link = linkInsertion(["Block eins (10) ________.", "Block zwei (1) ________."], rows("Lücke 1", "Lücke 10"));
    expect(link!.pieces.map(flat)).toEqual(["Block eins {10}.", "Block zwei {1}."]);
  });
});

/** A sentence-gap item in the bank: every row is a gap label. */
const insertionItems = SEED_BANK.items.filter(
  (it) => it.content.kind === "MATCHING" && it.stimulusKey && it.content.left.length > 0 && it.content.left.every((l) => gapRowNumber(l.text) !== null),
);

describe("linkInsertion over the seed bank", () => {
  const stimuli = new Map(SEED_BANK.stimuli.map((s) => [s.key, s]));

  it("finds the sentence-gap items", () => {
    expect(insertionItems.length).toBeGreaterThanOrEqual(8);
  });

  it("links every one of them to its passage, one marker per row", () => {
    const failed: string[] = [];
    for (const it of insertionItems) {
      if (it.content.kind !== "MATCHING") continue;
      const stimulus = stimuli.get(it.stimulusKey as string);
      if (!stimulus) {
        failed.push(`${it.stimulusKey}: no stimulus`);
        continue;
      }
      const texts = passageBlocks(stimulus.body, stimulus.title).map((b) => (b.kind === "text" ? b.lines.join("\n") : ""));
      const link = linkInsertion(texts, it.content.left);
      if (!link) {
        failed.push(`${stimulus.title}: ${it.content.left.map((l) => l.text).join(", ")}`);
        continue;
      }
      const gaps = link.pieces.flat().filter((p) => p.kind === "gap");
      if (gaps.length !== it.content.left.length) failed.push(`${stimulus.title}: ${gaps.length} gaps for ${it.content.left.length} rows`);
    }
    expect(failed).toEqual([]);
  });
});
