import { describe, expect, it } from "vitest";
import { buildScorecard } from "./scorecard";
import { activity, content, facts, stage } from "./test-fixtures";

const scale = { min: 1, max: 5, levels: [{ value: 3, label: { tr: "Beklenen düzeyde", en: "Meets the bar" } }] };
const library = () =>
  new Map([
    ["c1", facts("c1")],
    [
      "c2",
      facts("c2", {
        anchors: { 1: { tr: "bir", en: "one" }, 2: { tr: " ", en: "" }, 3: { tr: "üç", en: "" }, 5: { tr: "beş", en: "" } },
        tags: [
          { id: "t1", orderIndex: 0, polarity: "POSITIVE", label: { tr: "Örnek verdi", en: "Gave an example" }, archived: false },
          { id: "t2", orderIndex: 1, polarity: "NEGATIVE", label: { tr: "eski", en: "old" }, archived: true },
        ],
      }),
    ],
    ["unused", facts("unused")],
  ]);
const draft = content([
  stage("s1", [
    activity("a1", { competencyIds: ["c2"] }),
    activity("a2", { competencyIds: ["c1", "c2"] }),
    activity("q", { type: "SINGLE_CHOICE" }),
  ]),
]);

describe("scorecard snapshot (hiring solution design 2.3)", () => {
  it("lists the measured competencies in the order they first appear, and nothing else", () => {
    expect(buildScorecard({ content: draft, facts: library(), scale, profile: [] }).competencies.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("copies the written anchors and the tags that are not archived", () => {
    const [c2] = buildScorecard({ content: draft, facts: library(), scale, profile: [] }).competencies;
    expect(Object.keys(c2.anchors)).toEqual(["1", "3", "5"]);
    expect(c2.tags).toEqual([{ id: "t1", polarity: "POSITIVE", label: { tr: "Örnek verdi", en: "Gave an example" } }]);
  });

  it("uses profile defaults when weighting is off and the draft's weights when it is on", () => {
    const off = buildScorecard({
      content: draft,
      facts: library(),
      scale,
      profile: [
        { competencyId: "c1", weight: 60 },
        { competencyId: "c2", weight: 20 },
      ],
    });
    expect(off.weightsEnabled).toBe(false);
    expect(off.competencies.map((c) => c.weight)).toEqual([25, 75]);
    const on = buildScorecard({ content: { ...draft, weightsEnabled: true, draftWeights: { c1: 30, c2: 70 } }, facts: library(), scale, profile: [] });
    expect(on.weightsEnabled).toBe(true);
    expect(on.competencies.map((c) => c.weight)).toEqual([70, 30]);
  });

  it("refuses to snapshot a measured competency that has no weight while weighting is on", () => {
    const missing = { ...draft, weightsEnabled: true, draftWeights: { c2: 100 } };
    expect(() => buildScorecard({ content: missing, facts: library(), scale, profile: [] })).toThrow(/c1/);
    expect(() => buildScorecard({ content: { ...draft, weightsEnabled: true, draftWeights: null }, facts: library(), scale, profile: [] })).toThrow(/weight/);
  });

  it("builds the same snapshot from shuffled input", () => {
    const a = (id: string, n: number, ids: string[]) => activity(id, { orderIndex: n, competencyIds: ids });
    const ordered = content([stage("s1", [a("a1", 0, ["c2"]), a("a2", 1, ["c1"])], { orderIndex: 0 }), stage("s2", [a("a3", 0, ["c1"])], { orderIndex: 1 })]);
    const shuffled = content([...ordered.stages].reverse().map((s) => ({ ...s, activities: [...s.activities].reverse() })));
    const lib = library();
    const reversedLib = library();
    // t0 sorts before t1 by id but comes after it in the library's order: the library's order wins.
    const late = { id: "t0", orderIndex: 2, polarity: "NEGATIVE" as const, label: { tr: "b", en: "b" }, archived: false };
    const tie = { id: "t3", orderIndex: 2, polarity: "POSITIVE" as const, label: { tr: "c", en: "c" }, archived: false };
    lib.get("c2")!.tags.push(late, tie);
    reversedLib.get("c2")!.tags.push(tie, late);
    reversedLib.get("c2")!.tags.reverse();
    const one = buildScorecard({ content: ordered, facts: lib, scale: structuredClone(scale), profile: [] });
    const two = buildScorecard({ content: shuffled, facts: reversedLib, scale: structuredClone(scale), profile: [] });
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    expect(one.competencies.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(one.competencies[0].tags.map((t) => t.id)).toEqual(["t1", "t0", "t3"]);
  });

  it("records its schema version and each competency's description", () => {
    const lib = library();
    lib.get("c2")!.description = { tr: "Açıkça anlatır.", en: "Explains clearly." };
    const snapshot = buildScorecard({ content: draft, facts: lib, scale, profile: [] });
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.competencies.map((c) => c.description)).toEqual([
      { tr: "Açıkça anlatır.", en: "Explains clearly." },
      { tr: "", en: "" },
    ]);
  });

  it("is a copy: editing the library afterwards changes nothing in it", () => {
    const lib = library();
    const localScale = structuredClone(scale);
    const snapshot = buildScorecard({ content: draft, facts: lib, scale: localScale, profile: [] });
    lib.get("c2")!.anchors[3]!.tr = "değişti";
    lib.get("c2")!.tags[0].label.tr = "değişti";
    localScale.levels[0].label.tr = "değişti";
    expect(snapshot.competencies[0].anchors[3].tr).toBe("üç");
    expect(snapshot.competencies[0].tags[0].label.tr).toBe("Örnek verdi");
    expect(snapshot.scale.levels[0].label.tr).toBe("Beklenen düzeyde");
  });
});
