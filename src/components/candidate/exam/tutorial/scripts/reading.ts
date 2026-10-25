import type { CandidateStimulus } from "@/lib/exam/safe";
import type { TutorialScript } from "../script-types";

/**
 * The demo text: two missing sentences, each gap at the start of its paragraph
 * so its list opens right under the line's left edge. The list is drawn inside
 * the reading pane (the stage has no page to put it on), so the text goes on
 * for two more paragraphs: they give the pane the room the open list needs
 * without a scroll bar. Original demo text.
 */
const PASSAGE = {
  title: "Der Stadtpark",
  text:
    "(1) ________ Am Morgen ist er noch ruhig, und nur ein paar Läufer sind unterwegs.\n\n" +
    "(2) ________ Dann sitzen viele Menschen auf den Bänken und lesen oder spielen Karten.\n\n" +
    "Im Winter ist es hier still, und der Park schließt schon um fünf Uhr.\n\n" +
    "Im Frühling blühen die Kirschbäume, und die ersten Gäste kommen zurück.",
};

const STIMULUS: CandidateStimulus = { kind: "READING", title: PASSAGE.title, text: PASSAGE.text };

/** Reading: a text with two missing sentences. Click a gap, pick a sentence from the list. Original demo text. */
export const READING_SCRIPT: TutorialScript = {
  section: "READING",
  stage: {
    layout: "reading",
    nav: { current: 5, total: 10 },
    clock: "23:40",
    passage: PASSAGE,
    items: [
      {
        sequence: 5,
        section: "READING",
        type: "MATCHING",
        prompt: "Lesen Sie den Text. Zwei Sätze fehlen. Welcher Satz passt in welche Lücke? Ein Satz passt nicht.",
        content: {
          kind: "MATCHING",
          left: [
            { id: "g1", text: "Lücke (1)" },
            { id: "g2", text: "Lücke (2)" },
          ],
          right: [
            // Short on purpose: each is one line in the open list, which keeps the list inside the pane.
            { id: "ra", text: "A: Am Nachmittag kommen viele Familien." },
            { id: "rb", text: "B: Er liegt mitten in der Stadt." },
            { id: "rc", text: "C: Abends gibt es dort Konzerte." },
          ],
        },
        stimulus: STIMULUS,
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
        { do: "wait", ms: 2600 },
        { do: "spotlight", on: { kind: "tray", item: 0, id: "" } },
        { do: "move", to: { kind: "tray", item: 0, id: "" } },
      ],
    },
    {
      id: "gap",
      actions: [{ do: "click", on: { kind: "matchRow", item: 0, id: "g1" }, opens: true }],
    },
    {
      id: "pick",
      actions: [{ do: "click", on: { kind: "option", item: 0, id: "g1:rb" }, answer: { matches: { g1: "rb" } } }],
    },
    {
      id: "used",
      actions: [
        { do: "click", on: { kind: "matchRow", item: 0, id: "g2" }, opens: true },
        { do: "wait", ms: 1200 },
        { do: "click", on: { kind: "option", item: 0, id: "g2:ra" }, answer: { matches: { g2: "ra" } } },
      ],
    },
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
