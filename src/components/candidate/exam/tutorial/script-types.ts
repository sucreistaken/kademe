import type { CandidateItem } from "@/lib/exam/safe";
import type { ItemAnswer, Section } from "@/lib/exam/types";

/**
 * A "how it works" tutorial: the real exam screen drawn in an inert demo
 * stage, with a scripted fake cursor, captions and narration. A script says
 * what the stage shows and what happens on it, step by step; timeline.ts
 * turns it into a state at any moment, so playing, pausing and seeking are
 * one pure function of the time.
 */
export type TutorialScript = {
  section: Section;
  stage: {
    layout: "single" | "reading" | "listening" | "task";
    items: CandidateItem[];
    passage?: { title: string; text: string };
    nav: { current: number; total: number };
    clock: string;
  };
  steps: TutorialStep[];
};

export type TutorialStep = { id: string; minMs?: number; actions: DemoAction[] };

/**
 * What happens on the stage. A click or drag answer is a patch merged into
 * the item's answer when the press (or the drop) happens; its record fields
 * (gaps, matches, tfng) merge key by key. `mark: true` toggles the Mark of the
 * clicked item (a `ui` target marks the first item on the stage). A spotlight
 * holds until the next spotlight of the same step and ends with the step.
 * `opens: true`: the click opens the list of a matching row or gap (the target
 * is a `matchRow`); the list stays open until the next click.
 */
export type DemoAction =
  | { do: "spotlight"; on: Target | null }
  | { do: "move"; to: Target }
  | { do: "click"; on: Target; answer?: Partial<ItemAnswer>; mark?: boolean; opens?: boolean }
  | { do: "drag"; from: Target; to: Target; answer: Partial<ItemAnswer> }
  | { do: "type"; into: Target; text: string }
  | { do: "wait"; ms: number };

/**
 * A place on the stage. `item` is the index into `stage.items`. Ids:
 * option = a choice option id, a cloze word, `<statement>:<value>` for true or
 * false, `<row>:<target>` for an entry of a matching row's open list;
 * matchRow = the button that opens a matching row's list (a gap in the reading
 * text, or the row's "Choose" button), by row id; tray = the list of lettered
 * sentences in a text-insertion item (id unused); gap = a gap id, or "text"
 * for the item's free text field; chip = a drag chip (no screen has one now).
 * `ui` names the parts of the screen around the item.
 */
export type Target =
  | { kind: "option" | "matchRow" | "tray" | "gap" | "chip"; item: number; id: string }
  | { kind: "ui"; name: "timer" | "mark" | "next" | "strip" | "passage" | "player" | "notes" | "record" | "tools" };

export type UiName = Extract<Target, { kind: "ui" }>["name"];

/** Narration length per step id, in milliseconds (from narration.json, or estimated from the caption). */
export type StepDurations = Record<string, number>;
