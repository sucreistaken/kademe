import type { SeedItem } from "./types";

/**
 * C-test builder. A C-test is a short coherent text whose first and last
 * sentences stay intact; from the second word of the second sentence on, every
 * second word loses its second half (for an odd length the larger half). The
 * student types the missing part, each gap scores on its own.
 *
 * The damage is computed here instead of written by hand so the rule is the
 * same in every text. One-letter words and numbers are not counted.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

const INSTRUCTION =
  "Ergänzen Sie die fehlenden Wortteile. In jedem zweiten Wort fehlt die zweite Hälfte.";

export function damageWord(word: string): { kept: string; missing: string } {
  const letters = [...word];
  const keep = Math.floor(letters.length / 2);
  return { kept: letters.slice(0, keep).join(""), missing: letters.slice(keep).join("") };
}

const TOKEN = /^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u;

export function cTest(
  level: Level,
  within: Within,
  text: {
    first: string;
    body: string;
    last: string;
    /** Further completions accepted for gap number n (1-based), only where equally correct. */
    variants?: Record<number, string[]>;
  },
): SeedItem {
  let counted = 0;
  const gaps: Array<{ id: string; answers: string[] }> = [];
  const damaged = text.body
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const m = token.match(TOKEN);
      if (!m) throw new Error(`C-test token "${token}" is not one word with punctuation`);
      const [, lead, word, trail] = m;
      if ([...word].length < 2 || /\d/.test(word)) return token;
      counted++;
      if (counted % 2 === 1) return token;
      const { kept, missing } = damageWord(word);
      const n = gaps.length + 1;
      gaps.push({ id: `g${n}`, answers: [missing, ...(text.variants?.[n] ?? [])] });
      return `${lead}${kept}{{g${n}}}${trail}`;
    })
    .join(" ");
  return {
    section: "GRAMMAR",
    level,
    type: "GAP_FILL",
    skillTag: "grammar.ctest",
    within,
    prompt: `${INSTRUCTION}\n\n${text.first} ${damaged} ${text.last}`,
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id })) },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, g.answers])) },
    explanation:
      "C-Test: Erster und letzter Satz sind vollständig; ab dem zweiten Wort des zweiten Satzes fehlt bei jedem zweiten Wort die zweite Hälfte (bei ungerader Länge der größere Teil). Jede Lücke zählt einzeln.",
  };
}
