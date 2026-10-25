/**
 * A count of the grammar patterns in an answer, made by a text search.
 *
 * What a grader tends to get wrong is RANGE: a flawless text of short main
 * clauses reads as "no errors, so a high level". The counts below are facts
 * the model cannot miscount, given to it next to the word count. They are
 * approximate on purpose (a pattern search, no parser): it can miss a pattern
 * and, rarely, count one that is not there, and the prompt says so. They are
 * support for the RANGE criterion, not proof, and nothing in the code decides a
 * level from them.
 */

const TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Lower case word tokens, as the copy check, the German check and the pattern counts see a text. */
export function wordTokens(text: string): string[] {
  return text.normalize("NFC").toLowerCase().match(TOKEN) ?? [];
}

/** Conjunctions that open a subordinate clause, by the level they are first taught at. */
const SUBORDINATORS_BASIC = ["weil", "dass", "daß", "wenn", "ob"];
const SUBORDINATORS_ADVANCED = [
  "obwohl",
  "damit",
  "bevor",
  "nachdem",
  "falls",
  "während",
  "solange",
  "sobald",
  "seitdem",
  "sodass",
  "indem",
  "sofern",
  "zumal",
  "wobei",
  "obgleich",
  "ehe",
  "soweit",
  "insofern",
];

const RELATIVE_AFTER_COMMA = /,\s+(?:der|die|das|dem|den|dessen|deren|denen|welche[rsnm]?|wo|wovon|woraus|womit|wofür|worauf|wodurch|was)\s+(?!ich\b|du\b|ist\b|sind\b|war\b|waren\b)/giu;

/** Subjunctive II forms (not möchte, not sollte or wollte, which are as often past tense or a fixed phrase). */
const KONJUNKTIV_II =
  /\b(?:würde|würdest|würden|würdet|wäre|wärst|wären|wärt|hätte|hättest|hätten|hättet|könnte|könntest|könnten|müsste|müsstest|müssten|dürfte|dürften)\b/giu;

/** A participle as Perfekt and Passiv form it: ge-…-t or ge-…-en, three letters or more in between. */
const PARTICIPLE = /^ge[a-zäöüß]{3,}(?:t|en)$/u;
const ARTICLE_LIKE = new Set(["meinen", "deinen", "seinen", "ihren", "unseren", "euren", "einen", "keinen", "diesen", "jenen", "anderen", "allen", "vielen", "manchen", "welchen", "solchen"]);

const TWO_PART: Array<[RegExp, string]> = [
  [/einerseits[\s\S]*andererseits/iu, "einerseits ... andererseits"],
  [/sowohl[\s\S]*als auch/iu, "sowohl ... als auch"],
  [/weder[\s\S]*noch/iu, "weder ... noch"],
  [/entweder[\s\S]*oder/iu, "entweder ... oder"],
  [/nicht nur[\s\S]*sondern auch/iu, "nicht nur ... sondern auch"],
  [/\bje\b[\s\S]*\bdesto\b|\bje\b[\s\S]*\bumso\b/iu, "je ... desto"],
  [/zwar[\s\S]*aber/iu, "zwar ... aber"],
];

export type StructureCounts = {
  words: number;
  sentences: number;
  /** Basic subordinators (weil, dass, wenn, ob), occurrences. */
  basicClauses: number;
  /** Other subordinators (obwohl, damit, bevor, nachdem, falls, während, sodass, indem, sofern, zumal ...), occurrences. */
  advancedClauses: number;
  relativeClauses: number;
  konjunktivII: number;
  /** Words shaped like a participle (gemacht, gefahren): Perfekt, Passiv or an attribute. */
  participles: number;
  zuInfinitives: number;
  twoPartConnectors: string[];
  /** Different words of 14 letters or more (compounds and nominalisations). */
  longWords: number;
  /** Share of different words among all words, 0 to 1. */
  distinctWords: number;
};

const occurrences = (words: string[], list: string[]): number => words.filter((w) => list.includes(w)).length;

export function structureCounts(text: string): StructureCounts {
  const words = wordTokens(text);
  const sentences = text.split(/[.!?]+(?:\s|$)/u).filter((s) => /[\p{L}]/u.test(s)).length;
  const zu = [...text.matchAll(/\bzu\s+([a-zäöüß]{3,}(?:en|n))\b/gu)].filter((m) => !ARTICLE_LIKE.has(m[1])).length;
  const letters = (w: string) => [...w.replace(/[^\p{L}]/gu, "")].length;
  return {
    words: words.length,
    sentences,
    basicClauses: occurrences(words, SUBORDINATORS_BASIC),
    advancedClauses: occurrences(words, SUBORDINATORS_ADVANCED),
    relativeClauses: [...text.matchAll(RELATIVE_AFTER_COMMA)].length,
    konjunktivII: [...text.matchAll(KONJUNKTIV_II)].length,
    participles: words.filter((w) => PARTICIPLE.test(w)).length,
    zuInfinitives: zu,
    twoPartConnectors: TWO_PART.filter(([re]) => re.test(text)).map(([, name]) => name),
    longWords: new Set(words.filter((w) => letters(w) >= 14)).size,
    distinctWords: words.length ? Math.round((new Set(words).size / words.length) * 100) / 100 : 0,
  };
}

/**
 * The line the grader prompt carries. A transcript has no reliable sentence
 * boundaries (the recogniser adds them), so a spoken answer leaves them out.
 */
export function structureLine(c: StructureCounts, options: { sentences: boolean }): string {
  const parts = [
    ...(options.sentences ? [`sentences ${c.sentences}`] : []),
    `subordinate clauses with weil, dass, wenn or ob ${c.basicClauses}`,
    `with obwohl, damit, bevor, nachdem, falls, während, sodass, indem, sofern, zumal and similar ${c.advancedClauses}`,
    `relative clauses ${c.relativeClauses}`,
    `Konjunktiv II forms (würde, wäre, hätte, könnte ...) ${c.konjunktivII}`,
    `participles (Perfekt, Passiv) ${c.participles}`,
    `zu-infinitives ${c.zuInfinitives}`,
    `two-part connectors ${c.twoPartConnectors.length ? c.twoPartConnectors.join(", ") : "none"}`,
    `different words of 14 or more letters ${c.longWords}`,
    `share of different words ${Math.round(c.distinctWords * 100)}%`,
  ];
  return parts.join("; ");
}
