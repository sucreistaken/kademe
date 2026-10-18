import { answerProgress, type ProgressContent } from "@/components/candidate/exam/answer-progress";
import type { SectionConfig } from "./blueprint";
import { isObjectiveSection, type ItemAnswer, type Section } from "./types";

/**
 * The rules for moving around inside a section, kept pure so they are tested
 * without a database (exam-flow.ts applies them under its own reads).
 *
 * Two kinds of section:
 *  - One way (adaptive sections, and speaking): the server picks the next item
 *    from the answers so far, so an answer is final once the student moves on
 *    and only the first open item takes a write.
 *  - Navigable (fixed forms: objective sections with a plan, and writing): every
 *    planned item is served at the start. The student moves to any item, changes
 *    answers (kept as drafts), flags items, and the section closes only from the
 *    review step or when its clock runs out. Every saved draft is scored then.
 *
 * Speaking stays one way: a recording has think and answer time and takes that
 * are counted on the server, and coming back to it would reopen all of that.
 */

/** Whether a started run is navigable. Decided once, when the section starts. */
export function isNavigableRun(section: Section, hasPlan: boolean): boolean {
  return hasPlan && section !== "SPEAKING";
}

/** The same decision from the blueprint, before the section starts (for its introduction). */
export function isNavigableConfig(s: Pick<SectionConfig, "section" | "adaptive">): boolean {
  if (s.section === "SPEAKING") return false;
  return !isObjectiveSection(s.section) || !s.adaptive;
}

export type NavTarget = { sequence: number; answered: boolean; notReached: boolean };

const isOpen = (t: NavTarget | null): t is NavTarget => !!t && !t.answered && !t.notReached;

/**
 * Whether a write (a draft, a commit, a listening play, a recording) may land
 * on `target`. One way: only on the first open item. Navigable: on any open
 * item of the section. A listening testlet is shown whole, so in a one-way
 * section its other open items (`sharesTestlet`: the same recording as the
 * first open item) take drafts and answers too.
 */
export function canWrite(input: {
  navigable: boolean;
  target: NavTarget | null;
  firstOpen: number | null;
  sharesTestlet?: boolean;
}): boolean {
  if (!isOpen(input.target)) return false;
  if (input.navigable) return true;
  return input.firstOpen === null || input.firstOpen === input.target.sequence || input.sharesTestlet === true;
}

/** Flags exist only where the student can come back to an item. */
export function canFlag(input: { navigable: boolean; target: NavTarget | null }): boolean {
  return input.navigable && isOpen(input.target);
}

export type MoveTo = number | "REVIEW";

export type MoveDecision = { ok: true; cursor: number; review: false } | { ok: true; review: true } | { ok: false };

/** A move to a served item of the section, or to the review step. Never in a one-way section. */
export function decideMove(input: { navigable: boolean; to: unknown; sequences: readonly number[] }): MoveDecision {
  if (!input.navigable) return { ok: false };
  if (input.to === "REVIEW") return { ok: true, review: true };
  if (typeof input.to === "number" && Number.isInteger(input.to) && input.sequences.includes(input.to)) {
    return { ok: true, cursor: input.to, review: false };
  }
  return { ok: false };
}

/**
 * Whether the student may close the section now. A navigable section closes
 * only from its review step (or on the clock, which does not ask); a one-way
 * section may be ended early at any time, as before.
 */
export function canFinish(input: { navigable: boolean; review: boolean }): boolean {
  return !input.navigable || input.review;
}

/** The item the screen shows: the stored cursor if it is still a served item, else the first one. */
export function currentSequence(cursor: number | null, sequences: readonly number[]): number | null {
  if (sequences.length === 0) return null;
  return cursor !== null && sequences.includes(cursor) ? cursor : sequences[0];
}

/** The item after (or before) `from`, or null at the end. "Next" from the last item is the review step. */
export function neighbour(sequences: readonly number[], from: number, step: 1 | -1): number | null {
  const sorted = [...sequences].sort((a, b) => a - b);
  const i = sorted.indexOf(from);
  if (i < 0) return null;
  return sorted[i + step] ?? null;
}

/** One cell of the progress strip. Says nothing about right or wrong: only what the student filled in. */
export type NavEntry = { sequence: number; filled: number; total: number; flagged: boolean };

export function navEntries(
  responses: ReadonlyArray<{ sequence: number; content: ProgressContent; answer: ItemAnswer | null; flagged: boolean }>,
): NavEntry[] {
  return [...responses]
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) => ({ sequence: r.sequence, ...answerProgress(r.content, r.answer), flagged: r.flagged }));
}

/** Where a listening recording sits among the section's recordings: "text 2 of 3". */
export type ListeningPosition = { index: number; total: number };

/**
 * The 1-based place of `stimulusId` among the DISTINCT listening recordings of
 * a section run, counted in item order (by sequence), and how many there are.
 * Null when the recording is not among them. Needs every item of the run, so
 * it is only asked for in a fixed form where the whole plan is served.
 * Carries counts only: no ids and nothing from the keys leave this function.
 */
export function listeningPosition(
  rows: ReadonlyArray<{ sequence: number; stimulusId: string | null; listening: boolean }>,
  stimulusId: string | null,
): ListeningPosition | null {
  if (!stimulusId) return null;
  const order: string[] = [];
  for (const r of [...rows].sort((a, b) => a.sequence - b.sequence)) {
    if (r.listening && r.stimulusId && !order.includes(r.stimulusId)) order.push(r.stimulusId);
  }
  const at = order.indexOf(stimulusId);
  return at < 0 ? null : { index: at + 1, total: order.length };
}
