import type { CandidateStimulus } from "@/lib/exam/safe";
import type { TutorialScript } from "../script-types";

const CLIP: CandidateStimulus = { kind: "LISTENING", title: "Hörtext 2", durationMs: 32_000, playsLeft: 2, maxPlays: 2 };

/** Listening: one recording with two questions on one page (a picture choice and true or false). Original demo text. */
export const LISTENING_SCRIPT: TutorialScript = {
  section: "LISTENING",
  stage: {
    layout: "listening",
    nav: { current: 3, total: 8 },
    clock: "21:05",
    items: [
      {
        sequence: 3,
        section: "LISTENING",
        type: "SINGLE_CHOICE",
        prompt: "Was kauft Lena am Samstag?",
        content: {
          kind: "CHOICE",
          multiple: false,
          options: [
            { id: "pa", text: "Bild A", image: { slot: "dress", w: 960, h: 640, alt: "Zwei Frauen in langen Kleidern gehen über ein Feld." } },
            { id: "pb", text: "Bild B", image: { slot: "guitar", w: 960, h: 641, alt: "Eine Hand spielt auf einer Gitarre." } },
            { id: "pc", text: "Bild C", image: { slot: "hat-scarf", w: 960, h: 643, alt: "Eine Frau trägt im Schnee eine Mütze und einen Schal." } },
          ],
        },
        stimulus: CLIP,
        answer: null,
      },
      {
        sequence: 4,
        section: "LISTENING",
        type: "TRUE_FALSE_NG",
        prompt: "Richtig oder falsch?",
        content: { kind: "TFNG", twoWay: true, statements: [{ id: "st1", text: "Lena kauft das Geschenk für sich selbst." }] },
        stimulus: CLIP,
        answer: null,
      },
    ],
  },
  steps: [
    {
      id: "read",
      actions: [
        { do: "move", to: { kind: "option", item: 0, id: "pa" } },
        { do: "move", to: { kind: "option", item: 0, id: "pc" } },
        { do: "move", to: { kind: "option", item: 1, id: "st1:R" } },
      ],
    },
    {
      id: "play",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "player" } },
        { do: "click", on: { kind: "ui", name: "player" } },
      ],
    },
    { id: "plays", actions: [{ do: "spotlight", on: { kind: "ui", name: "player" } }] },
    {
      id: "answer",
      actions: [
        { do: "click", on: { kind: "option", item: 0, id: "pb" }, answer: { choiceIds: ["pb"] } },
        { do: "click", on: { kind: "option", item: 1, id: "st1:F" }, answer: { tfng: { st1: "F" } } },
      ],
    },
    { id: "mark", actions: [{ do: "click", on: { kind: "ui", name: "mark" }, mark: true }] },
    {
      id: "strip",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "strip" } },
        { do: "move", to: { kind: "ui", name: "strip" } },
        { do: "wait", ms: 800 },
        { do: "move", to: { kind: "ui", name: "next" } },
      ],
    },
    {
      id: "timer",
      actions: [
        { do: "spotlight", on: { kind: "ui", name: "timer" } },
        { do: "move", to: { kind: "ui", name: "timer" } },
      ],
    },
  ],
};
