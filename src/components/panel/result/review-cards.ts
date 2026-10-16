import { hasAnswer, typedMatches } from "@/lib/exam/item-scoring";
import { withPoolInstruction } from "@/lib/exam/ctest-instruction";
import { matchingTargets } from "@/lib/exam/safe";
import { isCTest, type ItemAnswer, type ItemSnapshot } from "@/lib/exam/types";
import type { ReviewMark } from "./review-rows";

/**
 * What the teacher reads for one served item, as plain data: a text with its
 * gaps filled in, the options with the pick marked, statement rows with a
 * student letter against the key letter. The result screen draws it and the
 * printable report may reuse it, so nothing here knows about JSX or language:
 * the callers translate the marks and letters.
 */

export type GapSegment =
  | { kind: "text"; text: string }
  | {
      kind: "gap";
      id: string;
      /** 1-based, in the order the gaps appear in the text. */
      n: number;
      /** C-test: the letters printed before the gap. Empty for an ordinary gap. */
      stem: string;
      /** What the student typed, "" when empty. */
      given: string;
      /** The whole word as the student wrote it (stem included), "" when empty. */
      shown: string;
      /** The whole correct word (stem included). */
      expected: string;
      mark: ReviewMark;
    };

export type ChoiceOption = { id: string; letter: string; text: string; picked: boolean; correct: boolean };
export type TfngRow = { id: string; text: string; given: string; key: string; mark: ReviewMark };
export type MatchRow = { id: string; text: string; givenLetter: string; givenText: string; keyLetter: string; keyText: string; mark: ReviewMark };

export type ReviewCard =
  | { kind: "GAP"; ctest: boolean; segments: GapSegment[]; right: number; total: number }
  | { kind: "CHOICE"; multiple: boolean; options: ChoiceOption[]; mark: ReviewMark }
  | { kind: "TFNG"; rows: TfngRow[] }
  | { kind: "MATCHING"; rows: MatchRow[] }
  | { kind: "TEXT"; given: string; accepted: string[]; mark: ReviewMark }
  | { kind: "OTHER" };

const markOf = (given: string, ok: boolean): ReviewMark => (!given ? "blank" : ok ? "correct" : "wrong");
const letterOf = (i: number) => (i >= 0 && i < 26 ? String.fromCharCode(65 + i) : String(i + 1));
const MARKER = /(\{\{[A-Za-z0-9_-]+\}\})/g;
const markerId = (part: string) => part.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/)?.[1] ?? null;
const lower = (s: string) => s.toLocaleLowerCase("de-DE");

/** A prompt with its `{{id}}` gap markers shown as a plain blank, for items that are not gap items. */
export function plainPrompt(prompt: string): string {
  return prompt.replace(/\{\{[^}]+\}\}/g, "___");
}

function stemBefore(text: string, ctest: boolean): string {
  return ctest ? (text.match(/[\p{L}\p{N}]+$/u)?.[0] ?? "") : "";
}

/**
 * The text of a gap item cut into text and gap segments. In a C-test the word
 * stem right before a gap moves from the text into the gap, so each gap holds
 * a whole word: "mö" + "chte" reads "möchte". A typed full word that already
 * starts with the stem is not given the stem twice.
 */
export function gapSegments(s: ItemSnapshot, a: ItemAnswer | null, acceptedGaps: readonly string[] = []): GapSegment[] | null {
  const c = s.content;
  const k = s.key;
  if (c.kind !== "GAP" || k.kind !== "GAP") return null;
  const ctest = isCTest(s);
  const parts = (ctest ? withPoolInstruction(s.prompt) : s.prompt).split(MARKER);
  const out: GapSegment[] = [];
  let n = 0;
  parts.forEach((part, i) => {
    const id = markerId(part);
    if (!id) {
      const next = markerId(parts[i + 1] ?? "") ? stemBefore(part, ctest) : "";
      const text = next ? part.slice(0, part.length - next.length) : part;
      if (text) out.push({ kind: "text", text });
      return;
    }
    if (!c.gaps.some((g) => g.id === id)) {
      out.push({ kind: "text", text: "___" });
      return;
    }
    const stem = stemBefore(parts[i - 1] ?? "", ctest);
    const given = (a?.gaps?.[id] ?? "").trim();
    const accepted = k.answers[id] ?? [];
    const full = (w: string) => !!stem && lower(w).startsWith(lower(stem)) && w.length > stem.length;
    const wholeKey = accepted.find(full);
    const expected = !stem ? (accepted[0] ?? "") : (wholeKey ?? `${stem}${[...accepted].sort((x, y) => x.length - y.length)[0] ?? ""}`);
    const shown = !given ? "" : stem && !(wholeKey && full(given)) ? `${stem}${given}` : given;
    const mark: ReviewMark = acceptedGaps.includes(id) && given ? "accepted" : markOf(given, typedMatches(given, accepted));
    n += 1;
    out.push({ kind: "gap", id, n, stem, given, shown, expected, mark });
  });
  return out;
}

/** The card of one item, or `OTHER` for types the table never breaks down (writing, speaking). */
export function reviewCard(s: ItemSnapshot, a: ItemAnswer | null, acceptedGaps: readonly string[] = []): ReviewCard {
  const c = s.content;
  const k = s.key;
  const answer = a ?? {};
  if (c.kind === "GAP" && k.kind === "GAP") {
    const segments = gapSegments(s, a, acceptedGaps) ?? [];
    const gaps = segments.flatMap((g) => (g.kind === "gap" ? [g] : []));
    return { kind: "GAP", ctest: isCTest(s), segments, right: gaps.filter((g) => g.mark === "correct" || g.mark === "accepted").length, total: gaps.length };
  }
  if (c.kind === "CHOICE" && k.kind === "CHOICE") {
    const picked = answer.choiceIds ?? [];
    const options = c.options.map((o, i) => ({ id: o.id, letter: letterOf(i), text: o.text, picked: picked.includes(o.id), correct: k.correct.includes(o.id) }));
    const same = picked.length === k.correct.length && picked.every((id) => k.correct.includes(id));
    return { kind: "CHOICE", multiple: s.type === "MULTI_CHOICE", options, mark: picked.length === 0 ? "blank" : same ? "correct" : "wrong" };
  }
  if (c.kind === "TFNG" && k.kind === "TFNG") {
    return {
      kind: "TFNG",
      rows: c.statements.map((st) => {
        const given = answer.tfng?.[st.id] ?? "";
        return { id: st.id, text: st.text, given, key: k.answers[st.id] ?? "", mark: markOf(given, given === k.answers[st.id]) };
      }),
    };
  }
  if (c.kind === "MATCHING" && k.kind === "MATCHING") {
    const targets = matchingTargets(c.right);
    const find = (id: string | undefined) => {
      const t = targets.find((x) => x.id === id);
      return t ? { letter: t.badge === "0" ? "" : t.badge, text: t.label } : { letter: "", text: "" };
    };
    return {
      kind: "MATCHING",
      rows: c.left.map((l) => {
        const g = find(answer.matches?.[l.id]);
        const key = find(k.pairs[l.id]);
        return { id: l.id, text: l.text, givenLetter: g.letter, givenText: g.text, keyLetter: key.letter, keyText: key.text, mark: markOf(g.text, answer.matches?.[l.id] === k.pairs[l.id]) };
      }),
    };
  }
  if (k.kind === "SHORT_TEXT") {
    const given = (answer.text ?? "").trim();
    return { kind: "TEXT", given, accepted: k.accepted, mark: markOf(given, typedMatches(given, k.accepted)) };
  }
  return { kind: "OTHER" };
}

/** "18 / 24 correct": items answered fully right over items served (partial credit does not count as right). */
export function sectionScoreSummary(responses: Array<{ itemSnapshot: ItemSnapshot; answer: ItemAnswer | null; score: number | null }>): { right: number; total: number; blank: number } {
  return {
    right: responses.filter((r) => (r.score ?? 0) >= 1).length,
    total: responses.length,
    blank: responses.filter((r) => !hasAnswer(r.itemSnapshot.type, r.answer)).length,
  };
}

export { splitTaskPrompt } from "@/lib/exam/task-prompt";
