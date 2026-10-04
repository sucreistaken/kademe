import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemResponses } from "@/db/schema";
import { pCorrect } from "@/lib/exam/adaptive";
import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";
import {
  checkWrite,
  commitAnswer,
  getConsentText,
  hasConsented,
  loadState,
  recordConsent,
  recordDeviceCheck,
  resolveExamToken,
  startSection,
  workingAttempt,
  type CandidateState,
} from "@/lib/exam-flow";

/**
 * A scripted student, for the seed's demo data and for `pnpm verify:exam`.
 *
 * It drives the same functions the API routes call, in process, and answers
 * each objective item correctly with the Rasch probability for its ability.
 * It reads the key from the database to do that, which only a script on the
 * server can; the point is to exercise the engine end to end, not to model a
 * real student's mistakes.
 */

export type SimulatedStudent = {
  theta: number;
  rng: () => number;
  writing?: (snapshot: ItemSnapshot) => string;
  speaking?: (snapshot: ItemSnapshot) => string;
  /** Called with every state the flow returns, for assertions. */
  onState?: (state: CandidateState) => void;
  /** Stop after this many sections (to leave an exam half done). */
  stopAfterSections?: number;
  skipDeviceCheckGate?: boolean;
};

export function answerFor(snap: ItemSnapshot, correct: boolean): ItemAnswer {
  const { content: c, key: k } = snap;
  if (c.kind === "CHOICE" && k.kind === "CHOICE") {
    if (correct) return { choiceIds: [...k.correct] };
    const wrong = c.options.find((o) => !k.correct.includes(o.id));
    return { choiceIds: wrong ? [wrong.id] : [] };
  }
  if (c.kind === "TFNG" && k.kind === "TFNG") {
    const flip = { R: "F", F: "NG", NG: "R" } as const;
    return {
      tfng: Object.fromEntries(c.statements.map((s) => [s.id, correct ? k.answers[s.id] : flip[k.answers[s.id]]])),
    };
  }
  if (c.kind === "GAP" && k.kind === "GAP") {
    return {
      gaps: Object.fromEntries(
        c.gaps.map((g) => [g.id, correct ? k.answers[g.id][0] : (g.choices?.find((x) => !k.answers[g.id].includes(x)) ?? "xyz")]),
      ),
    };
  }
  if (c.kind === "MATCHING" && k.kind === "MATCHING") {
    const lefts = c.left.map((l) => l.id);
    return {
      matches: Object.fromEntries(
        lefts.map((l, i) => [l, correct ? k.pairs[l] : k.pairs[lefts[(i + 1) % lefts.length]]]),
      ),
    };
  }
  if (c.kind === "SHORT_TEXT" && k.kind === "SHORT_TEXT") return { text: correct ? k.accepted[0] : "falsch" };
  return {};
}

export async function simulateStudent(rawToken: string, student: SimulatedStudent) {
  const resolved = await resolveExamToken(rawToken);
  if (!resolved.ok) throw new Error(`token does not resolve: ${resolved.problem}`);
  const ctx = resolved.ctx;
  if (!(await hasConsented(ctx.assessment.id))) {
    const text = await getConsentText(ctx);
    await recordConsent(ctx, text.id, "127.0.0.1", "kademe-simulator");
  }
  const { attempt } = await workingAttempt(ctx.assessment.id);
  if (student.skipDeviceCheckGate !== false) await recordDeviceCheck(attempt.id);

  let sectionsDone = 0;
  let lastSection: string | null = null;
  for (let guard = 0; guard < 400; guard++) {
    const state = await loadState(ctx);
    student.onState?.(state);
    if (state.step === "DONE") return state;
    if (state.step === "SECTION_INTRO") {
      if (lastSection !== null) sectionsDone++;
      if (student.stopAfterSections !== undefined && sectionsDone >= student.stopAfterSections) return state;
      const started = await startSection(ctx, state.current!.position);
      if (!started.ok) throw new Error(`section start refused: ${started.code}`);
      lastSection = state.current!.section;
      continue;
    }
    if (state.step !== "ITEM" || !state.current?.item) throw new Error(`unexpected step ${state.step}`);
    const { position } = state.current;
    const sequence = state.current.item.sequence;
    const check = await checkWrite(ctx, position, sequence);
    if (!check.ok) throw new Error(`write refused: ${check.code}`);
    const [row] = await db
      .select()
      .from(itemResponses)
      .where(and(eq(itemResponses.sectionRunId, check.run.id), eq(itemResponses.sequence, sequence)));
    const snap = row.itemSnapshot;
    let answer: ItemAnswer;
    if (snap.content.kind === "WRITING") answer = { text: student.writing?.(snap) ?? "" };
    else if (snap.content.kind === "SPEAKING")
      answer = { text: student.speaking?.(snap) ?? "", usedTextAlternative: true };
    else answer = answerFor(snap, student.rng() < pCorrect(student.theta, snap.difficulty));
    // The browser answers with the aliased ids it was shown; do the same.
    const al = (id: string) => row.presentation.alias?.[id] ?? id;
    if (answer.choiceIds) answer.choiceIds = answer.choiceIds.map(al);
    if (answer.matches) answer.matches = Object.fromEntries(Object.entries(answer.matches).map(([k, v]) => [k, al(v)]));
    await commitAnswer(ctx, check.run, check.response, answer);
  }
  throw new Error("simulation did not finish");
}
