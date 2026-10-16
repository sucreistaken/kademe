import { mulberry32 } from "./adaptive";
import { normalizeAnswer, typedMatches } from "./item-scoring";

/**
 * The word-part pool of a C-test: the missing part of every gap plus plausible
 * wrong parts, shuffled. Built on the server from the key, so the browser gets
 * only a flat list of strings and never learns which part belongs to which gap.
 *
 * Distractors are inflection variants of the real parts ("hte" -> "hten",
 * "ht"; "en" -> "em", "er"), so telling them apart stays a grammar question
 * and not an elimination game.
 */

/** Final inflection endings a distractor may swap in or out. */
const ENDINGS = ["e", "en", "er", "es", "em", "n", "s", "t", "st", "te", "ten"];
/** Single letters tried in place of the final letter. */
const LETTERS = ["e", "n", "r", "s", "t", "m"];

/** How many distractors a C-test with this many gaps gets. */
export const distractorCount = (gaps: number): number => Math.ceil(gaps * 0.6);

/** Candidate wrong parts for one missing part, in a fixed order. */
export function variantsOf(part: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s && s !== part && !out.includes(s)) out.push(s);
  };
  // Swap a final ending for another, or drop it ("hte" -> "ht", "htem").
  for (const e of ENDINGS) {
    if (!part.endsWith(e) || part.length === e.length) continue;
    const stem = part.slice(0, part.length - e.length);
    add(stem);
    for (const e2 of ENDINGS) add(stem + e2);
  }
  // Add an ending ("ht" -> "hte", "hten").
  for (const e of ENDINGS) add(part + e);
  // Change the last letter ("en" -> "em", "er").
  const chars = [...part];
  chars.pop();
  for (const l of LETTERS) add(chars.join("") + l);
  // Drop the last letter.
  if (chars.length) add(chars.join(""));
  return out;
}

function shuffled<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `gapIds` in text order, `answers` as in the key (the first entry of a gap is
 * its missing part). Same input and seed always give the same pool. May hold
 * fewer distractors than asked for when a text offers too few valid variants.
 */
export function buildCTestPool(gapIds: string[], answers: Record<string, string[]>, seed: number): string[] {
  const rng = mulberry32(seed);
  const correct = gapIds.map((g) => answers[g]?.[0] ?? "").filter((p) => p.trim());
  // Everything any gap accepts, whole words included: a distractor equal to one
  // would also score, and one equal under normalisation would leak the key.
  const accepted = gapIds.flatMap((g) => answers[g] ?? []);
  const taken = new Set(correct.map(normalizeAnswer));
  const wanted = distractorCount(correct.length);
  const picked: string[] = [];
  const valid = (c: string) => !!c.trim() && !taken.has(normalizeAnswer(c)) && !typedMatches(c, accepted);
  const take = (c: string) => {
    picked.push(c);
    taken.add(normalizeAnswer(c));
  };

  // Spread distractors over different parts first, then top up from any part.
  const lists = shuffled(correct, rng).map((p) => shuffled(variantsOf(p), rng));
  for (let round = 0; picked.length < wanted && round < 2; round++) {
    for (const list of lists) {
      if (picked.length >= wanted) break;
      const c = list.find(valid);
      if (c !== undefined) take(c);
    }
  }
  return shuffled([...correct, ...picked], rng);
}

/** Stable seed for presentations stored before `poolSeed` existed. */
export function seedFromText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
