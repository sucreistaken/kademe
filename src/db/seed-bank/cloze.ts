import { typedMatches } from "@/lib/exam/item-scoring";
import { CLOZE_SKILL_TAG } from "@/lib/exam/types";
import type { SeedItem } from "./types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * Multiple-choice cloze builder (spec 2026-10-18). A short coherent text whose
 * first and last sentences stay intact; in the body every gap is written
 * inline as `[[answer|wrong1|wrong2|wrong3]]`. The student picks one of the
 * four words per gap, each gap scores on its own.
 *
 * The answer's place among the choices is fixed here (the seed key hashes the
 * content) and the exam shuffles the choices again when it serves them.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

export type TextSpec = {
  /** A short German title, shown as the first line of the text. */
  title: string;
  /** Intact first sentence, no gaps. */
  first: string;
  /** The sentences with gaps. */
  body: string;
  /** Intact last sentence, no gaps. */
  last: string;
  /** Teacher-facing note on what the gaps test, appended to the explanation. */
  note?: string;
};

const INSTRUCTION = "Lesen Sie den Text. Wählen Sie für jede Lücke das passende Wort.";

const INLINE_GAP = /\[\[([^\]]*)\]\]/g;
const BRACKETS = /\[\[|\]\]|\{\{|\}\}/;

/**
 * Replaces every `[[...]]` in `body` by a `{{gN}}` marker, numbered from 1 in
 * reading order, and hands each bracket's inner text to `onGap`. Throws when
 * the body has no gap or a bracket is left over.
 */
export function markGaps(body: string, onGap: (inner: string, n: number) => void): string {
  let n = 0;
  const marked = body.replace(INLINE_GAP, (_, inner: string) => {
    n++;
    onGap(inner, n);
    return `{{g${n}}}`;
  });
  if (n === 0) throw new Error(`text has no gap: "${body.slice(0, 40)}"`);
  if (BRACKETS.test(marked.replace(/\{\{g\d+\}\}/g, ""))) throw new Error(`text has a stray bracket: "${body.slice(0, 40)}"`);
  return marked;
}

/** Instruction, title and text as separate paragraphs; the first and last sentence may not hold a gap. */
export function textPrompt(instruction: string, spec: TextSpec, marked: string): string {
  for (const intact of [spec.title, spec.first, spec.last]) {
    if (BRACKETS.test(intact)) throw new Error(`gap outside the body: "${intact}"`);
  }
  return `${instruction}\n\n${spec.title}\n\n${spec.first} ${marked} ${spec.last}`;
}

/** Index of the answer among its four choices: spread by gap and answer, the same on every build. */
function answerSlot(answer: string, n: number): number {
  let h = n;
  for (const ch of answer) h = (h * 31 + ch.codePointAt(0)!) % 10007;
  return h % 4;
}

export function cloze(level: Level, within: Within, spec: TextSpec): SeedItem {
  const gaps: Array<{ id: string; answer: string; choices: string[] }> = [];
  const marked = markGaps(spec.body, (inner, n) => {
    const [answer, ...wrong] = inner.split("|").map((s) => s.trim());
    if (!answer) throw new Error(`cloze gap ${n} has no answer`);
    if (wrong.length !== 3) throw new Error(`cloze gap ${n} ("${answer}") needs exactly 3 distractors, has ${wrong.length}`);
    if (wrong.some((w) => !w)) throw new Error(`cloze gap ${n} ("${answer}") has an empty distractor`);
    const options = [answer, ...wrong];
    // Read as the scorer reads them: case, ß/ss and ae/ä do not tell two options apart.
    if (options.some((o, j) => options.some((p, k) => k > j && typedMatches(o, [p])))) {
      throw new Error(`cloze gap ${n} ("${answer}") has two equal options`);
    }
    const choices = [...wrong];
    choices.splice(answerSlot(answer, n), 0, answer);
    gaps.push({ id: `g${n}`, answer, choices });
  });
  return {
    section: "GRAMMAR",
    level,
    type: "GAP_FILL",
    skillTag: CLOZE_SKILL_TAG,
    within,
    prompt: textPrompt(INSTRUCTION, spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id, choices: g.choices })) },
    key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, [g.answer]])) },
    explanation:
      "MC-Lückentext: Erster und letzter Satz sind vollständig. Jede Lücke hat vier Optionen, genau eine passt grammatisch und inhaltlich. Jede Lücke zählt einzeln." +
      (spec.note ? ` Geprüft: ${spec.note}` : ""),
  };
}
