import type { TutorialScript } from "../script-types";

/** Grammar: a tiny multiple-choice cloze. Original demo text. */
export const GRAMMAR_SCRIPT: TutorialScript = {
  section: "GRAMMAR",
  stage: {
    layout: "single",
    nav: { current: 4, total: 12 },
    clock: "18:40",
    items: [
      {
        sequence: 4,
        section: "GRAMMAR",
        type: "GAP_FILL",
        prompt:
          "Wählen Sie für jede Lücke das passende Wort.\n\nMein Sonntag\n\nAm Sonntag {{g1}} ich lange. Dann frühstücke ich {{g2}} meiner Schwester. Am Nachmittag gehen wir {{g3}} Kino.",
        content: {
          kind: "GAP",
          cloze: true,
          gaps: [
            { id: "g1", choices: ["schlafe", "schläft", "schlafen", "geschlafen"] },
            { id: "g2", choices: ["mit", "bei", "von", "zu"] },
            { id: "g3", choices: ["ins", "im", "in", "am"] },
          ],
        },
        stimulus: null,
        answer: null,
      },
    ],
  },
  steps: [
    {
      id: "gap",
      actions: [
        { do: "spotlight", on: { kind: "gap", item: 0, id: "g1" } },
        { do: "move", to: { kind: "gap", item: 0, id: "g1" } },
      ],
    },
    { id: "pick", actions: [{ do: "click", on: { kind: "option", item: 0, id: "schlafe" }, answer: { gaps: { g1: "schlafe" } } }] },
    { id: "again", actions: [{ do: "click", on: { kind: "option", item: 0, id: "mit" }, answer: { gaps: { g2: "mit" } } }] },
    { id: "mark", actions: [{ do: "click", on: { kind: "ui", name: "mark" }, mark: true }] },
    {
      id: "strip",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "strip" } },
        { do: "move", to: { kind: "ui", name: "strip" } },
      ],
    },
    {
      id: "timer",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "timer" } },
        { do: "move", to: { kind: "ui", name: "timer" } },
      ],
    },
    { id: "next", actions: [{ do: "click", on: { kind: "ui", name: "next" } }] },
  ],
};
