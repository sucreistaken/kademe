import { hasAnswer, typedMatches } from "@/lib/exam/item-scoring";
import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";

/**
 * What the teacher's item table shows for one served item, as data. The
 * components only draw it, so every decision here is unit-tested without a
 * renderer: the per-row view of matching, true/false/not-given and gap items,
 * the blank-versus-not-reached label, and the share of points in a section.
 */

export type ReviewMark = "correct" | "wrong" | "blank";

export type ReviewRow = {
  id: string;
  /** Matching: the left text. True/false: the statement. Gap: "1", "2" ... */
  label: string;
  /** What the student chose or typed; "" when the row is empty. For true/false it is the code R, F or NG. */
  given: string;
  /** Matching: the key target. True/false: the key code. Gap: every accepted spelling joined by " / ". */
  key: string;
  mark: ReviewMark;
};

export type ReviewRows = { variant: "MATCHING" | "TFNG" | "GAP"; rows: ReviewRow[] };

const markOf = (given: string, ok: boolean): ReviewMark => (!given ? "blank" : ok ? "correct" : "wrong");

/** A per-row breakdown for the item types that have several parts; null for the rest. */
export function reviewRows(s: ItemSnapshot, a: ItemAnswer | null): ReviewRows | null {
  const c = s.content;
  const k = s.key;
  const answer = a ?? {};
  if (c.kind === "MATCHING" && k.kind === "MATCHING") {
    const text = (id: string | undefined) => c.right.find((r) => r.id === id)?.text ?? "";
    return {
      variant: "MATCHING",
      rows: c.left.map((l) => {
        const given = text(answer.matches?.[l.id]);
        return { id: l.id, label: l.text, given, key: text(k.pairs[l.id]), mark: markOf(given, answer.matches?.[l.id] === k.pairs[l.id]) };
      }),
    };
  }
  if (c.kind === "TFNG" && k.kind === "TFNG") {
    return {
      variant: "TFNG",
      rows: c.statements.map((st) => {
        const given = answer.tfng?.[st.id] ?? "";
        return { id: st.id, label: st.text, given, key: k.answers[st.id] ?? "", mark: markOf(given, given === k.answers[st.id]) };
      }),
    };
  }
  if (c.kind === "GAP" && k.kind === "GAP") {
    return {
      variant: "GAP",
      rows: c.gaps.map((g, i) => {
        const given = answer.gaps?.[g.id] ?? "";
        const accepted = k.answers[g.id] ?? [];
        return { id: g.id, label: String(i + 1), given, key: accepted.join(" / "), mark: markOf(given.trim(), typedMatches(given, accepted)) };
      }),
    };
  }
  return null;
}

export type ResponseState = "ANSWERED" | "BLANK" | "NOT_REACHED";

/**
 * Whether the student answered, saw the item and left it empty, or never got
 * to it. A navigable (fixed-form) section presents every item at once, so an
 * empty item there was seen, whatever the stored `notReached` flag says (older
 * rows flagged blanks as not reached). In a one-way section the flag stands.
 */
export function responseState(
  r: { itemSnapshot: ItemSnapshot; answer: ItemAnswer | null; notReached: boolean },
  run: { navigable: boolean } | undefined,
): ResponseState {
  if (hasAnswer(r.itemSnapshot.type, r.answer)) return "ANSWERED";
  if (run?.navigable) return "BLANK";
  return r.notReached ? "NOT_REACHED" : "BLANK";
}

/** Items answered, the points share of those answers (partial credit counts), and how many earned only part. */
export function objectiveBasis(
  responses: Array<{ itemSnapshot: ItemSnapshot; answer: ItemAnswer | null; answeredAt: Date | null; score: number | null }>,
): { answered: number; pct: number; partial: number } {
  const answered = responses.filter((r) => r.answeredAt && hasAnswer(r.itemSnapshot.type, r.answer));
  const points = answered.reduce((sum, r) => sum + (r.score ?? 0), 0);
  return {
    answered: answered.length,
    pct: answered.length ? Math.round((points / answered.length) * 100) : 0,
    partial: answered.filter((r) => r.score !== null && r.score > 0 && r.score < 1).length,
  };
}

/** A typed objective answer the teacher may accept as correct: it earned less than full marks. */
export function canAcceptAsCorrect(r: { itemSnapshot: ItemSnapshot; answer: ItemAnswer | null; score: number | null }): boolean {
  const t = r.itemSnapshot.type;
  return (t === "GAP_FILL" || t === "SHORT_TEXT") && hasAnswer(t, r.answer) && (r.score ?? 0) < 1;
}
