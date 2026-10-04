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
          { id: "t1", polarity: "POSITIVE", label: { tr: "Örnek verdi", en: "Gave an example" }, archived: false },
          { id: "t2", polarity: "NEGATIVE", label: { tr: "eski", en: "old" }, archived: true },
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

  it("falls back to the profile defaults when weighting is on but no weights were saved yet", () => {
    const snapshot = buildScorecard({ content: { ...draft, weightsEnabled: true, draftWeights: null }, facts: library(), scale, profile: [] });
    expect(snapshot.weightsEnabled).toBe(true);
    expect(snapshot.competencies.map((c) => c.weight)).toEqual([50, 50]);
  });

  it("is a copy: editing the library afterwards changes nothing in it", () => {
    const lib = library();
    const snapshot = buildScorecard({ content: draft, facts: lib, scale, profile: [] });
    lib.get("c2")!.anchors[3]!.tr = "değişti";
    lib.get("c2")!.tags[0].label.tr = "değişti";
    scale.levels[0].label.tr = "değişti";
    expect(snapshot.competencies[0].anchors[3].tr).toBe("üç");
    expect(snapshot.competencies[0].tags[0].label.tr).toBe("Örnek verdi");
    expect(snapshot.scale.levels[0].label.tr).toBe("Beklenen düzeyde");
  });
});
