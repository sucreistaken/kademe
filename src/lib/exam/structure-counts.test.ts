import { describe, expect, it } from "vitest";
import { CALIBRATION_FIXTURES } from "./grading-calibration/fixtures";
import { structureCounts, structureLine } from "./structure-counts";

const count = (text: string) => structureCounts(text);

describe("structureCounts", () => {
  it("is zero everywhere for a text of short present tense main clauses", () => {
    const c = count("Hallo Tim, ich habe am Samstag Zeit. Ich komme um vier Uhr. Ich bringe einen Salat mit. Viele Grüße, Elif");
    expect(c).toMatchObject({ basicClauses: 0, advancedClauses: 0, relativeClauses: 0, konjunktivII: 0, participles: 0, zuInfinitives: 0, longWords: 0 });
    expect(c.twoPartConnectors).toEqual([]);
    expect(c.sentences).toBe(4);
  });

  it("counts subordinators by how early they are taught", () => {
    const c = count("Ich bleibe zu Hause, weil ich krank bin. Ich glaube, dass es geht, obwohl es regnet, damit wir sparen. Falls du kommst, sag es mir.");
    expect(c.basicClauses).toBe(2);
    expect(c.advancedClauses).toBe(3);
  });

  it("counts relative clauses after a comma but not a demonstrative main clause", () => {
    expect(count("Ich kenne den Mann, der dort wohnt, und die Frau, die ihn besucht.").relativeClauses).toBe(2);
    expect(count("Das Essen ist gut, das ist wahr. Wir bleiben, ich weiß.").relativeClauses).toBe(0);
  });

  it("counts Konjunktiv II, participles and zu-infinitives", () => {
    const c = count("Ich wäre gern gekommen, aber ich hätte keine Zeit gehabt. Es ist schwer, das Haus zu verlassen. Er hat gearbeitet. Wir sprechen mit meinen Kollegen zu essen.");
    expect(c.konjunktivII).toBe(2);
    expect(c.participles).toBe(3);
    // "zu verlassen" counts; "zu essen" counts; a determiner after zu does not ("zu meinen Kollegen").
    expect(count("Ich spreche zu meinen Kollegen.").zuInfinitives).toBe(0);
    expect(c.zuInfinitives).toBe(2);
  });

  it("names the two-part connectors it finds", () => {
    const c = count("Einerseits spart man Zeit, andererseits fehlen die Kollegen. Man sollte nicht nur arbeiten, sondern auch leben.");
    expect(c.twoPartConnectors).toEqual(["einerseits ... andererseits", "nicht nur ... sondern auch"]);
  });

  it("counts different long words once and measures the share of different words", () => {
    const c = count("Arbeitszeitkonten sind sinnvoll. Arbeitszeitkonten helfen bei Arbeitszeitmodelle und der Vereinbarkeit von Familie und Beruf.");
    expect(c.longWords).toBe(2);
    expect(c.distinctWords).toBeLessThan(1);
    expect(count("").distinctWords).toBe(0);
  });

  it("separates a clean A1 text from a C1 text on the fixtures", () => {
    const find = (id: string) => structureCounts(CALIBRATION_FIXTURES.find((f) => f.id === id)!.text);
    const a1 = find("w-a1-krank/a1-clean");
    const c1 = find("w-c1-noten/c1");
    const patterns = (c: ReturnType<typeof structureCounts>) => c.basicClauses + c.advancedClauses + c.relativeClauses + c.konjunktivII + c.participles + c.zuInfinitives;
    expect(patterns(a1)).toBe(0);
    expect(patterns(c1)).toBeGreaterThan(8);
    expect(c1.longWords).toBeGreaterThan(5);
  });
});

describe("structureLine", () => {
  const c = structureCounts("Ich bleibe zu Hause, weil ich krank bin.");

  it("states every count and leaves the sentence count out for a transcript", () => {
    const written = structureLine(c, { sentences: true });
    const spoken = structureLine(c, { sentences: false });
    expect(written).toContain("sentences 1");
    expect(spoken).not.toContain("sentences");
    for (const text of [written, spoken]) {
      expect(text).toContain("subordinate clauses with weil, dass, wenn or ob 1");
      expect(text).toContain("two-part connectors none");
      expect(text).not.toContain("\u2014");
    }
  });
});
