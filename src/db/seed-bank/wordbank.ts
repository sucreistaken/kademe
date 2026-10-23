import { typedMatches } from "@/lib/exam/item-scoring";
import { WORD_BANK_SKILL_TAG } from "@/lib/exam/types";
import { markGaps, splitTopic, textPrompt, type TextSpec } from "./cloze";
import type { SeedItem } from "./types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * Word-bank builder (spec 2026-10-18). A short coherent text whose first and
 * last sentences stay intact; in the body every gap is written inline as
 * `[[answer]]` or `[[answer#topic]]`, one whole word (the optional `#topic` is a
 * topic id from `topics.ts`, stored in `key.topics[gN]` and stripped from the text). The pool shows the answers and the
 * distractors as whole words; each pool word fits exactly one gap and a
 * distractor fits none (the author's job, checked by the blind solve).
 *
 * The distractors go into the answer key, as with the C-test, and the exam
 * builds the pool from key and gaps when it serves the item.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

const INSTRUCTION =
  "Lesen Sie den Text. Setzen Sie die passenden Wörter in die Lücken ein. Jedes Wort passt nur in eine Lücke, einige Wörter bleiben übrig.";

const isWholeWord = (w: string) => /^\S+$/u.test(w);

export function wordBank(level: Level, within: Within, spec: TextSpec & { distractors: string[] }): SeedItem {
  const gaps: Array<{ id: string; answer: string }> = [];
  const topics: Record<string, string> = {};
  const marked = markGaps(spec.body, (rawInner, n) => {
    const { rest: inner, topic } = splitTopic(rawInner, n, "word-bank");
    if (topic) topics[`g${n}`] = topic;
    if (inner.includes("|")) throw new Error(`word-bank gap ${n} takes one answer and no choices`);
    const answer = inner.trim();
    if (!answer) throw new Error(`word-bank gap ${n} has no answer`);
    if (!isWholeWord(answer)) throw new Error(`word-bank gap ${n} ("${answer}") is not one whole word`);
    // Two gaps with one answer would let that word fit both.
    if (typedMatches(answer, gaps.map((g) => g.answer))) throw new Error(`word-bank answer "${answer}" repeats`);
    gaps.push({ id: `g${n}`, answer });
  });
  const distractors = spec.distractors.map((d) => d.trim());
  if (distractors.length < 3) throw new Error(`word bank needs at least 3 distractors, has ${distractors.length}`);
  distractors.forEach((d, j) => {
    if (!isWholeWord(d)) throw new Error(`word-bank distractor "${d}" is not one whole word`);
    if (typedMatches(d, gaps.map((g) => g.answer))) throw new Error(`word-bank distractor "${d}" equals an answer`);
    if (typedMatches(d, distractors.slice(0, j))) throw new Error(`word-bank distractor "${d}" repeats`);
  });
  return {
    section: "GRAMMAR",
    level,
    type: "GAP_FILL",
    skillTag: WORD_BANK_SKILL_TAG,
    within,
    prompt: textPrompt(INSTRUCTION, spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id })) },
    key: {
      kind: "GAP",
      answers: Object.fromEntries(gaps.map((g) => [g.id, [g.answer]])),
      distractors,
      ...(Object.keys(topics).length ? { topics } : {}),
    },
    explanation:
      "Wortschatz-Lückentext: Erster und letzter Satz sind vollständig. Ganze Wörter aus einem Pool; jedes Wort passt in genau eine Lücke, die übrigen Wörter passen in keine. Jede Lücke zählt einzeln." +
      (spec.note ? ` Geprüft: ${spec.note}` : ""),
  };
}
