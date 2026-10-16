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

/** How many distractors a C-test with this many gaps gets. */
export const distractorCount = (gaps: number): number => Math.ceil(gaps * 0.6);

/**
 * Looks like a German word ending: no three vowels in a row, no new "ee", and
 * at most two letters longer than the real part. Mechanical variants that fail
 * this ("ue", "essanes", "ieen") are spotted at a glance and help nobody.
 */
function plausible(c: string, part: string): boolean {
  if (!c || c.length > part.length + 2) return false;
  if (/[aeiouäöü]{3}/i.test(c)) return false;
  if (c.includes("ee") && !part.includes("ee")) return false;
  return true;
}

/** Candidate wrong parts for one missing part, most convincing first. */
export function variantsOf(part: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s !== part && !out.includes(s) && plausible(s, part)) out.push(s);
  };
  // Swap a final ending for another ("hte" -> "hten", "ine" -> "iner").
  for (const e of ENDINGS) {
    if (!part.endsWith(e) || part.length === e.length) continue;
    const stem = part.slice(0, part.length - e.length);
    for (const e2 of ENDINGS) add(stem + e2);
    if (stem.length >= 2) add(stem);
  }
  // Swap a case ending's last consonant ("en" -> "em", "er"; "r" -> "m", "s").
  if (/e[nrsmt]$|^[nrsmt]$/.test(part)) {
    const head = part.slice(0, -1);
    for (const l of ["n", "r", "s", "m", "t"]) add(head + l);
  }
  // Add an ending that fits what the part ends with ("ht" -> "hte", "ine" -> "inen").
  const more = /e$/.test(part) ? ["n", "r", "s", "m"] : /[^aeiouäöü]$/i.test(part) ? ["e", "en", "er", "es"] : [];
  for (const e of more) add(part + e);
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
 * its missing part). `handWritten` are the key's own distractors: when given
 * they are used first (a seeded pick if there are more than needed) and only a
 * shortfall is topped up with the mechanical variants. Same input and seed
 * always give the same pool. May hold fewer distractors than asked for when a
 * text offers too few valid variants.
 */
export function buildCTestPool(
  gapIds: string[],
  answers: Record<string, string[]>,
  seed: number,
  handWritten?: string[],
): string[] {
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

  // Hand-written distractors go first, through the same safety filter.
  if (handWritten?.length) {
    for (const c of shuffled(handWritten, rng)) {
      if (picked.length >= wanted) break;
      if (valid(c)) take(c);
    }
  }

  // Spread distractors over different parts first, then top up from any part.
  // Parts of three letters or more come first: "ie" (die) or "u" (zu) give no
  // convincing variant.
  const parts = shuffled(correct, rng);
  const lists = [...parts.filter((p) => p.length >= 3), ...parts.filter((p) => p.length < 3)].map((p) =>
    shuffled(variantsOf(p), rng),
  );
  for (let round = 0; picked.length < wanted && round < 3; round++) {
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
