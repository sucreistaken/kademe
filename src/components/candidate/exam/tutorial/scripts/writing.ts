import type { TutorialScript } from "../script-types";

/** Writing: a short e-mail task. Original demo text. */
export const WRITING_SCRIPT: TutorialScript = {
  section: "WRITING",
  stage: {
    layout: "task",
    nav: { current: 1, total: 2 },
    clock: "28:10",
    items: [
      {
        sequence: 1,
        section: "WRITING",
        type: "WRITING_PROMPT",
        prompt:
          "Sie haben am Samstag Geburtstag und machen eine kleine Party. Schreiben Sie Ihrer Freundin Mia eine E-Mail.\n\n" +
          "- Laden Sie Mia ein.\n- Sagen Sie, wann und wo die Party ist.\n- Fragen Sie, ob Mia etwas mitbringen kann.\n\nSchreiben Sie 30 bis 40 Wörter.",
        content: { kind: "WRITING", minWords: 30, maxWords: 40, studentPoints: ["Mia einladen", "Zeit und Ort nennen", "fragen, ob Mia etwas mitbringt"] },
        stimulus: null,
        answer: null,
      },
    ],
  },
  steps: [
    {
      id: "task",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "passage" } },
        { do: "move", to: { kind: "ui", name: "passage" } },
      ],
    },
    { id: "type", actions: [{ do: "type", into: { kind: "gap", item: 0, id: "text" }, text: "Liebe Mia,\nam Samstag habe ich Geburtstag und mache eine kleine Party. Kommst du?" }] },
    { id: "tools", actions: [{ do: "spotlight", on: { kind: "gap", item: 0, id: "text" } }] },
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
