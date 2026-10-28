import { parseTaskPrompt } from "@/lib/exam/task-prompt";

/**
 * What the mascot says on the speaking task of a course test (spec 2026-10-28):
 * the first sentence of the task prompt, in German, and how fast it is typed
 * in. Pure, so both are tested without a browser.
 */

/** A longer sentence is cut at a word and ends in an ellipsis: the card beside it has the rest. */
export const MASCOT_LINE_MAX = 120;

function shorten(line: string, max: number): string {
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // A cut that would leave a few letters only is not worth keeping at a word.
  const kept = space >= max / 2 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,;:.]+$/u, "")}…`;
}

/**
 * The line the mascot says, taken from the same text the task card shows
 * (`item.prompt`): the first sentence under the topic and the card line
 * ("Thema: ...", "Auf Ihrer Karte steht: ..."). A prompt with no running text
 * falls back to its card, then its topic. Null when there is nothing to say, in
 * which case the screen shows no mascot.
 */
export function mascotLine(prompt: string, max = MASCOT_LINE_MAX): string | null {
  const parsed = parseTaskPrompt(prompt);
  // A line of stray punctuation (the full stop after a quoted card word) is not a sentence.
  const sentence = parsed.blocks.flatMap((b) => (b.kind === "text" ? b.lines : [])).find((l) => /\p{L}/u.test(l));
  const line = (sentence ?? parsed.card?.text ?? parsed.topic ?? "").replace(/\s+/gu, " ").trim();
  return line ? shorten(line, max) : null;
}

/** Calm typing: 38 ms a letter, quicker for a long line so the whole line never takes more than 4.5 s. */
export function typingStepMs(length: number): number {
  if (length <= 0) return 0;
  return Math.min(38, 4500 / length);
}

/** How many letters of `length` are shown after `count` steps (never more than the line has). */
export function lettersShown(count: number, length: number): number {
  return Math.max(0, Math.min(Math.floor(count), length));
}

/** The mouth moves from the first letter until the last one is typed. */
export function isTalking(count: number, length: number): boolean {
  return length > 0 && lettersShown(count, length) < length;
}
