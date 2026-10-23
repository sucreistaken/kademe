import { typedMatches } from "@/lib/exam/item-scoring";
import { OPEN_CLOZE_SKILL_TAG } from "@/lib/exam/types";
import { markGaps, textPrompt, type TextSpec } from "./cloze";
import type { SeedItem } from "./types";

/*
 * A seed item's text is part of its seed key (seed-key.ts). Changing the
 * wording of an item here makes it a new item: the bank top-up then adds it
 * next to the old one in every organisation that already has the old one. To
 * fix wording, add a new item (and retire the old row) rather than editing.
 */

/**
 * Open cloze builder (OSD ZB2/ZC1 style). A short coherent text whose first and
 * last sentences stay intact; in the body every gap is written inline as
 * `[[answer/variant#topic]]` and the student types one word into it:
 *
 *   - `answer/variant`: "/" separates the accepted spellings (at least one;
 *     every one a single word). The first is the model answer. Compared after
 *     `normalizeAnswer`, so case, spacing, ss/sz and ae/umlaut need no variants.
 *   - `#topic` (optional): a topic id for the placement report, stored in
 *     `key.topics[gN]`. Topic ids are free strings here; a later task checks
 *     them against `topics.ts`.
 *
 * Example: `Wir bleiben zu Hause, [[weil/da#nebensatz]] es regnet.`
 *
 * No pool and no choices: the content has plain typed gaps and the exam draws
 * the text with an inline input per gap.
 */

type Level = SeedItem["level"];
type Within = NonNullable<SeedItem["within"]>;

const INSTRUCTION = "Lesen Sie den Text. Schreiben Sie in jede Lücke ein passendes Wort.";

const isWholeWord = (w: string) => /^\S+$/u.test(w);

export function openCloze(level: Level, within: Within, spec: TextSpec): SeedItem {
  const gaps: Array<{ id: string; accepted: string[] }> = [];
  const topics: Record<string, string> = {};
  const marked = markGaps(spec.body, (inner, n) => {
    if (inner.includes("|")) throw new Error(`open cloze gap ${n} takes accepted spellings with "/", not choices with "|"`);
    const hash = inner.indexOf("#");
    const spellings = (hash >= 0 ? inner.slice(0, hash) : inner).split("/").map((s) => s.trim());
    const topic = hash >= 0 ? inner.slice(hash + 1).trim() : "";
    if (hash >= 0 && !topic) throw new Error(`open cloze gap ${n} has an empty topic after "#"`);
    if (topic.includes("#")) throw new Error(`open cloze gap ${n} has more than one "#"`);
    if (spellings.some((s) => !s)) throw new Error(`open cloze gap ${n} has an empty answer`);
    const bad = spellings.find((s) => !isWholeWord(s));
    if (bad) throw new Error(`open cloze gap ${n} ("${bad}") is not one whole word`);
    spellings.forEach((s, j) => {
      if (typedMatches(s, spellings.slice(0, j))) throw new Error(`open cloze gap ${n} lists "${s}" twice`);
    });
    gaps.push({ id: `g${n}`, accepted: spellings });
    if (topic) topics[`g${n}`] = topic;
  });
  return {
    section: "GRAMMAR",
    level,
    type: "GAP_FILL",
    skillTag: OPEN_CLOZE_SKILL_TAG,
    within,
    prompt: textPrompt(INSTRUCTION, spec, marked),
    content: { kind: "GAP", gaps: gaps.map((g) => ({ id: g.id })) },
    key: {
      kind: "GAP",
      answers: Object.fromEntries(gaps.map((g) => [g.id, g.accepted])),
      ...(Object.keys(topics).length ? { topics } : {}),
    },
    explanation:
      "Offener Lückentext: Erster und letzter Satz sind vollständig. In jede Lücke gehört genau ein Wort, ohne Auswahl und ohne Wortpool. Alle akzeptierten Schreibweisen stehen im Schlüssel. Jede Lücke zählt einzeln." +
      (spec.note ? ` Geprüft: ${spec.note}` : ""),
  };
}
