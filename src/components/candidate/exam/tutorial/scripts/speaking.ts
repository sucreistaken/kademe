import type { TutorialScript } from "../script-types";

/** Speaking: one task with thinking time and a recording (shown, never recorded). Original demo text. */
export const SPEAKING_SCRIPT: TutorialScript = {
  section: "SPEAKING",
  stage: {
    layout: "task",
    nav: { current: 1, total: 3 },
    clock: "11:30",
    items: [
      {
        sequence: 1,
        section: "SPEAKING",
        type: "SPEAKING_PROMPT",
        prompt:
          "Thema: Freizeit.\n\nErzählen Sie von Ihrem Wochenende.\n\n- Was machen Sie am Samstag?\n- Mit wem verbringen Sie den Sonntag?\n- Was möchten Sie gern einmal ausprobieren?",
        content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1, studentPoints: ["Samstag", "Sonntag", "etwas Neues"] },
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
    { id: "think", actions: [{ do: "spotlight", on: { kind: "ui", name: "record" } }] },
    { id: "record", actions: [{ do: "click", on: { kind: "ui", name: "record" } }] },
    { id: "talk", actions: [{ do: "spotlight", on: { kind: "ui", name: "record" } }] },
    { id: "stop", actions: [{ do: "click", on: { kind: "ui", name: "record" }, answer: { mediaAssetId: "tutorial" } }] },
    { id: "next", actions: [{ do: "click", on: { kind: "ui", name: "next" } }] },
    {
      id: "timer",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "timer" } },
        { do: "move", to: { kind: "ui", name: "timer" } },
      ],
    },
  ],
};
