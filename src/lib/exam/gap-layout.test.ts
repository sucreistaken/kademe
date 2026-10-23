import { describe, expect, it } from "vitest";
import { hasGapLayout, splitGapLayout } from "./gap-layout";

describe("splitGapLayout", () => {
  it("parses a pipe table with a separator row", () => {
    const blocks = splitGapLayout("| Thema | Information |\n|---|---|\n| Ausgrabung begann | {{g1}} |\n| Fundstücke | {{g2}} Stück |");
    expect(blocks).toEqual([
      { kind: "table", header: ["Thema", "Information"], rows: [["Ausgrabung begann", "{{g1}}"], ["Fundstücke", "{{g2}} Stück"]] },
    ]);
  });

  it("keeps prose before and after a table", () => {
    const blocks = splitGapLayout("Hören Sie.\n\n| A | B |\n|---|---|\n| x | {{g1}} |\n\nDanach.");
    expect(blocks.map((b) => b.kind)).toEqual(["prose", "table", "prose"]);
  });

  it("parses consecutive label lines as a form", () => {
    const blocks = splitGapLayout("Anmeldekarte\nFamilienname: {{g1}}\nStraße: {{g2}}\nTelefon: {{g3}}");
    expect(blocks).toEqual([
      { kind: "prose", text: "Anmeldekarte" },
      { kind: "form", rows: [{ label: "Familienname", rest: "{{g1}}" }, { label: "Straße", rest: "{{g2}}" }, { label: "Telefon", rest: "{{g3}}" }] },
    ]);
  });

  it("leaves a single label line as prose", () => {
    expect(splitGapLayout("Befragte Haushalte insgesamt: {{g1}}")).toEqual([{ kind: "prose", text: "Befragte Haushalte insgesamt: {{g1}}" }]);
  });

  it("keeps a table with a mismatched separator as prose", () => {
    const text = "| A | B |\n|---|\n| x | {{g1}} |";
    expect(splitGapLayout(text)).toEqual([{ kind: "prose", text }]);
  });

  it("keeps a table without body rows as prose", () => {
    const text = "| A | B |\n|---|---|";
    expect(splitGapLayout(text).every((b) => b.kind === "prose")).toBe(true);
  });

  it("treats bare pipe lines (the seed bank style) as a table with the first line as header", () => {
    const blocks = splitGapLayout("Fund | Angabe | Weiteres\nMünzen | {{g3}} Silbermünzen | gefunden in einem {{g4}}\nKamm | Länge: {{g5}} Zentimeter | im {{g6}}");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "table", header: ["Fund", "Angabe", "Weiteres"] });
  });

  it("leaves plain prose alone", () => {
    expect(hasGapLayout("Anleitung.\n\nIch b{{g1}} hier und arb{{g2}} gern.")).toBe(false);
  });
});

describe("splitGapLayout on the starter bank", () => {
  it("never leaves a raw pipe or a typed marker out of a layout block", async () => {
    const { SEED_BANK } = await import("@/db/seed-bank");
    const gapItems = SEED_BANK.items.filter((i) => i.type === "GAP_FILL");
    const laidOut = gapItems.filter((i) => hasGapLayout(i.prompt));
    expect(laidOut.length).toBeGreaterThan(0);
    for (const i of gapItems) {
      for (const b of splitGapLayout(i.prompt)) {
        if (b.kind === "prose") expect(b.text).not.toMatch(/ \| .*\{\{g\d+\}\}/);
      }
    }
  });
});

describe("bare rows with an empty last cell", () => {
  it("keeps the row in the table", () => {
    const blocks = splitGapLayout("Fund | Angabe | Notiz\nMünzen | {{g1}} |\nKamm | {{g2}} | im Museum");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "table", rows: [["Münzen", "{{g1}}", ""], ["Kamm", "{{g2}}", "im Museum"]] });
  });
});
