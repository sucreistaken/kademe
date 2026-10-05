import type { FooterAction } from "@/components/visual/footer-action";
import type { Focusable } from "@/hooks/use-step-focus";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";

/**
 * The runner's own filled button as data (Task 10, STATUS item 23). Before,
 * it was `disabled` while it saved and said nothing, so for a moment it went
 * pale with no reason: "soluk, nedensiz". Now (C15, plan decision 4) a button
 * that waits always says why next to it, and one that works stays filled
 * (StepFooter draws busy as aria-disabled with a spinner).
 */
export type RunnerFooterState = {
  /** A failed submit: the button sends it again. */
  retrying: boolean;
  /** A commit or a submit is in flight. */
  busy: boolean;
  /** The 8 second strip before the last stage closes. */
  delayed: boolean;
  /** Time is up on a stage that closes by itself. */
  locked: boolean;
  /** A file of this question is still uploading. */
  uploading: boolean;
  required: boolean;
  answered: boolean;
};

export type RunnerFooterWords = { label: string; retry: string; busy: string; sending: string; timeUp: string; uploading: string; required: string };

/** What a required question waits for, in its own words (3.6 "Önce cevabını yaz.", 3.7 "Bir seçenek seç."). */
export function requiredKey(type: CandidateActivity["type"] | null | undefined): "requiredChoice" | "requiredText" | "requiredReason" {
  if (type === "SINGLE_CHOICE" || type === "MULTI_CHOICE") return "requiredChoice";
  if (type === "LONG_TEXT" || type === "SHORT_TEXT") return "requiredText";
  return "requiredReason";
}

/** Why the button waits, or null: it works (busy says it on itself), retries, or is free. */
export function runnerWaitReason(state: RunnerFooterState, words: RunnerFooterWords): string | null {
  if (state.retrying || state.busy) return null;
  if (state.delayed) return words.sending;
  if (state.locked) return words.timeUp;
  if (state.uploading) return words.uploading;
  if (state.required && !state.answered) return words.required;
  return null;
}

/** The button without its click (the runner adds it where it renders, so no render-time call holds its handler). */
export function runnerPrimary(input: { state: RunnerFooterState; words: RunnerFooterWords }): Omit<Extract<FooterAction, { kind: "button" }>, "onClick"> {
  const { state, words } = input;
  return {
    kind: "button",
    id: "activity-next",
    label: state.retrying ? words.retry : words.label,
    busy: state.busy,
    busyLabel: words.busy,
    waitReason: runnerWaitReason(state, words),
  };
}

/**
 * Task 9 carry: "Geri al" took the strip away, so focus goes back to the
 * button that was pressed: the runner's own, or on a recorded question its
 * "Bu cevabı kullan" (or the written answer's send); with none of them, the
 * question's heading.
 */
export const UNDO_FOCUS_IDS = ["activity-next", "record-use", "send-written"] as const;
export function undoFocus(byId: (id: string) => Focusable | null, heading: Focusable | null): void {
  for (const id of UNDO_FOCUS_IDS) {
    const target = byId(id);
    if (target) return target.focus();
  }
  heading?.focus();
}
