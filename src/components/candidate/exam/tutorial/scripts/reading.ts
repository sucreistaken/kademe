import type { TutorialScript } from "../script-types";

/** Reading: two short ads and two situations to match. Original demo text. */
export const READING_SCRIPT: TutorialScript = {
  section: "READING",
  stage: {
    layout: "reading",
    nav: { current: 5, total: 10 },
    clock: "23:40",
    passage: {
      title: "Kleinanzeigen",
      text:
        "Anzeige A: Fahrrad zu verkaufen\nGut erhaltenes Stadtrad mit Licht und Korb, drei Jahre alt. 120 Euro, Abholung in Lindenau.\n\n" +
        "Anzeige B: Nachhilfe in Mathematik\nStudentin hilft Schülerinnen und Schülern der Klassen 5 bis 10. Montag bis Donnerstag ab 16 Uhr, 15 Euro pro Stunde.",
    },
    items: [
      {
        sequence: 5,
        section: "READING",
        type: "MATCHING",
        prompt: "Lesen Sie die Situationen und die Anzeigen. Welche Anzeige passt?",
        content: {
          kind: "MATCHING",
          left: [
            { id: "s1", text: "Ihr Sohn braucht Hilfe bei den Hausaufgaben in Mathe." },
            { id: "s2", text: "Sie suchen ein günstiges Fahrrad für den Weg zur Arbeit." },
          ],
          right: [
            { id: "ra", text: "Anzeige A" },
            { id: "rb", text: "Anzeige B" },
          ],
        },
        stimulus: null,
        answer: null,
      },
    ],
  },
  steps: [
    {
      id: "passage",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "passage" } },
        { do: "move", to: { kind: "ui", name: "passage" } },
      ],
    },
    {
      id: "situations",
      actions: [
        { do: "spotlight", on: { kind: "matchRow", item: 0, id: "s1" } },
        { do: "move", to: { kind: "matchRow", item: 0, id: "s1" } },
      ],
    },
    {
      id: "drag",
      actions: [{ do: "drag", from: { kind: "chip", item: 0, id: "rb" }, to: { kind: "matchRow", item: 0, id: "s1" }, answer: { matches: { s1: "rb" } } }],
    },
    { id: "click", actions: [{ do: "click", on: { kind: "option", item: 0, id: "s2:ra" }, answer: { matches: { s2: "ra" } } }] },
    {
      id: "notes",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "notes" } },
        { do: "move", to: { kind: "ui", name: "notes" } },
      ],
    },
    {
      id: "mark",
      actions: [
        { do: "click", on: { kind: "ui", name: "mark" }, mark: true },
        { do: "spotlight", on: { kind: "ui", name: "strip" } },
        { do: "move", to: { kind: "ui", name: "strip" } },
      ],
    },
    {
      id: "next",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "timer" } },
        { do: "move", to: { kind: "ui", name: "timer" } },
        { do: "wait", ms: 1200 },
        { do: "spotlight", on: null },
        { do: "click", on: { kind: "ui", name: "next" } },
      ],
    },
  ],
};
