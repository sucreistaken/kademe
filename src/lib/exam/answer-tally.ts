import { hasAnswer } from "./item-scoring";
import { reviewRows, responseState } from "./review-rows";
import type { ItemAnswer, ItemSnapshot } from "./types";

/**
 * The one score unit of the teacher screens and the printable report: an
 * answer. A gap, a true/false/not-given statement, a matching row and a single
 * item (choice, short text) count one each. A teacher-accepted answer counts
 * as correct. An item the student never reached is left out. The Summary tab,
 * the skill tab header and the report all read these two numbers, so one
 * student never shows three different scores.
 */

export type AnswerTally = { correct: number; total: number };

export type TallyResponse = {
  id?: string;
  itemSnapshot: ItemSnapshot;
  answer: ItemAnswer | null;
  score: number | null;
  notReached: boolean;
};

/** Teacher acceptances by response id (`gapIds` empty: the whole short answer was accepted). */
export type TallyAcceptances = Record<string, { gapIds: string[] }>;

/** The tally of one served item, or null when it has no countable answers (a writing or speaking task). */
export function itemTally(r: Pick<TallyResponse, "itemSnapshot" | "answer" | "score">, acceptance: { gapIds: string[] } | undefined): AnswerTally | null {
  const rows = reviewRows(r.itemSnapshot, r.answer, acceptance?.gapIds ?? []);
  if (rows) return { correct: rows.rows.filter((x) => x.mark === "correct" || x.mark === "accepted").length, total: rows.rows.length };
  const k = r.itemSnapshot.key;
  if (k.kind !== "CHOICE" && k.kind !== "SHORT_TEXT") return null;
  const wholeAccepted = !!acceptance && acceptance.gapIds.length === 0;
  const answered = hasAnswer(r.itemSnapshot.type, r.answer);
  return { correct: answered && (wholeAccepted || (r.score ?? 0) >= 1) ? 1 : 0, total: 1 };
}

/** The answers of one objective section: correct over total, not-reached items excluded. */
export function answerTally(responses: readonly TallyResponse[], acceptances: TallyAcceptances = {}, run?: { navigable: boolean }): AnswerTally {
  const out: AnswerTally = { correct: 0, total: 0 };
  for (const r of responses) {
    if (responseState(r, run) === "NOT_REACHED") continue;
    const t = itemTally(r, r.id ? acceptances[r.id] : undefined);
    if (!t) continue;
    out.correct += t.correct;
    out.total += t.total;
  }
  return out;
}
