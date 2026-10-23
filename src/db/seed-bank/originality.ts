import type { SeedItem, SeedStimulus } from "./types";

/**
 * Pure parts of the originality check: 8-word shingles, the stop-word rule
 * and the matching of bank strings against a source index. File access lives
 * in scripts/bank-originality.ts, so this module never reads the real sources.
 */

export const SHINGLE_SIZE = 8;
/** A shingle with this many stop words (or more) says nothing about copying. */
export const STOP_LIMIT = 6;

/** Very common German function words. Deliberately small. */
export const STOP_WORDS: ReadonlySet<string> = new Set(
  (
    "der die das den dem des ein eine einen einem einer eines und oder aber auch nicht kein keine keinen " +
    "ich du er sie es wir ihr mich dich sich mir dir ihm uns euch ihnen mein dein sein unser " +
    "ist sind war waren bin bist hat haben hatte hatten wird werden wurde wurden kann können muss müssen " +
    "in im an am auf aus bei mit nach von vom zu zum zur für über um durch bis als wie wenn dass da so " +
    "was wer wo wann man nur noch schon sehr mehr dann denn doch ja nein"
  ).split(" "),
);

/** Lower case, punctuation stripped, whitespace collapsed, umlauts and digits kept. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** True when the shingle is mostly function words and so does not count. */
export function isStopShingle(words: string[]): boolean {
  return words.filter((w) => STOP_WORDS.has(w)).length >= STOP_LIMIT;
}

/** Every counting 8-word shingle of the text, in order, duplicates removed. */
export function shingles(text: string): string[] {
  const words = tokenize(text);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    const window = words.slice(i, i + SHINGLE_SIZE);
    if (!isStopShingle(window)) out.add(window.join(" "));
  }
  return [...out];
}

/** shingle -> name of the first source that holds it. */
export type SourceIndex = Map<string, string>;

export function addSource(index: SourceIndex, name: string, text: string): void {
  for (const s of shingles(text)) if (!index.has(s)) index.set(s, name);
}

export type OriginalityHit = { shingle: string; source: string };

/** Token positions of `words` that lie inside an occurrence of an allowed phrase. */
function coveredPositions(words: string[], allowed: readonly string[]): boolean[] {
  const covered = new Array<boolean>(words.length).fill(false);
  for (const phrase of allowed) {
    const p = tokenize(phrase);
    if (p.length === 0) continue;
    for (let i = 0; i + p.length <= words.length; i++) {
      if (p.every((w, j) => words[i + j] === w)) for (let j = 0; j < p.length; j++) covered[i + j] = true;
    }
  }
  return covered;
}

/**
 * Shingles of `text` that appear in the index. A shingle whose 8 words all lie
 * inside occurrences of `allowed` phrases (standard exam instructions) in the
 * seed string does not count.
 */
export function findHits(text: string, index: SourceIndex, allowed: readonly string[] = []): OriginalityHit[] {
  const words = tokenize(text);
  const covered = allowed.length ? coveredPositions(words, allowed) : [];
  const seen = new Set<string>();
  const hits: OriginalityHit[] = [];
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    const window = words.slice(i, i + SHINGLE_SIZE);
    if (isStopShingle(window)) continue;
    if (allowed.length && covered.slice(i, i + SHINGLE_SIZE).every(Boolean)) continue;
    const shingle = window.join(" ");
    const source = index.get(shingle);
    if (source && !seen.has(shingle)) {
      seen.add(shingle);
      hits.push({ shingle, source });
    }
  }
  return hits;
}

export type SeedString = {
  /** Where the string lives, e.g. "item grammar-b1-ab12 prompt". */
  where: string;
  level: string;
  section: string;
  text: string;
};

/** Listening scripts are `Label: text` per line; the labels are not German prose. */
function stripSpeakerLabels(body: string): string {
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*[^:\n]{1,30}:\s+/u, ""))
    .join("\n");
}

/** The prompt with each `{{id}}` marker replaced by the first accepted answer, so the gap reads in context. */
export function promptInContext(item: Pick<SeedItem, "prompt" | "key">): string {
  if (item.key.kind !== "GAP") return item.prompt;
  const answers = item.key.answers;
  return item.prompt.replace(/\{\{\s*([^}\s]+)\s*\}\}/gu, (_m, id: string) => answers[id]?.[0] ?? "");
}

/**
 * Every German string of one item that candidates read: prompt (gaps filled in),
 * option and statement texts, and matching texts.
 */
export function itemStrings(item: SeedItem, itemKey: string): SeedString[] {
  const base = { level: item.level, section: item.section };
  const at = (what: string, text: string): SeedString => ({ ...base, where: `item ${itemKey} ${what}`, text });
  const out: SeedString[] = [at("prompt", promptInContext(item))];
  const c = item.content;
  if (c.kind === "CHOICE") for (const o of c.options) out.push(at(`option ${o.id}`, o.text));
  if (c.kind === "TFNG") for (const s of c.statements) out.push(at(`statement ${s.id}`, s.text));
  if (c.kind === "MATCHING") {
    for (const l of c.left) out.push(at(`left ${l.id}`, l.text));
    for (const r of c.right) out.push(at(`right ${r.id}`, r.text));
  }
  return out.filter((s) => s.text.trim() !== "");
}

export function stimulusStrings(s: SeedStimulus): SeedString[] {
  const base = { level: s.level, section: s.section };
  const body = s.section === "LISTENING" ? stripSpeakerLabels(s.body) : s.body;
  return [
    { ...base, where: `stimulus ${s.key} title`, text: s.title },
    { ...base, where: `stimulus ${s.key} body`, text: body },
  ];
}
