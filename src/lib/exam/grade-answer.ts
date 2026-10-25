import type { AiMessage } from "@/lib/ai";
import {
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  emptyAnswerReason,
  guardPreA1,
  parseGradingAnswer,
  skillLevelFromCriteria,
  verifyEvidence,
  type GradingProposal,
  type SpeakingGradingInput,
  type WritingGradingInput,
} from "./grading";
import type { ProductiveSection, ResultLevel } from "./types";

/**
 * One answer in, one proposal out: the whole grading path except the database.
 *
 * The grading job (`runGrading`) and the calibration harness
 * (`scripts/grading-calibration.ts`) both go through here, so what the harness
 * measures is what a candidate's answer meets: the same prompt, the same
 * repair attempt, the same checks on the model's answer. Only how the model is
 * called differs, and it is passed in (`ModelCall`).
 */

export type GradingJob =
  | ({ section: "WRITING" } & WritingGradingInput)
  | ({ section: "SPEAKING" } & SpeakingGradingInput);

/** What the model call gives back. `runId` is the audit row, when there is one. */
export type ModelAnswer = { text: string; model: string; runId: string | null };
export type ModelCall = (messages: AiMessage[]) => Promise<ModelAnswer>;

export type GradeAnswerResult =
  | {
      status: "PROPOSED";
      /** After the checks: evidence verified, A0 guarded, capped. This is what is stored. */
      proposal: GradingProposal;
      /** The level the skill gets: lower median of the assessable criteria, else the overall level. */
      level: ResultLevel;
      /** The model's proposal as parsed, before any check. */
      raw: GradingProposal;
      model: string;
      runId: string | null;
      /** How many model calls it took (2 when the first answer was unusable). */
      calls: number;
    }
  | { status: "EMPTY" }
  | { status: "UNPARSEABLE"; error: string; model: string | null; runId: string | null; calls: number };

/** The text the answer consists of: the written text or the transcript. */
export function answerText(job: GradingJob): string {
  return job.section === "WRITING" ? job.text : job.transcript;
}

export function messagesFor(job: GradingJob): AiMessage[] {
  return job.section === "WRITING" ? buildWritingGradingMessages(job) : buildSpeakingGradingMessages(job);
}

/** Checks that run on every parsed proposal, in this order. Shared with the unit tests. */
export function finishProposal(raw: GradingProposal, job: GradingJob): GradingProposal {
  const source = answerText(job);
  return capByTaskLevel(guardPreA1(verifyEvidence(raw, source), source), job.taskLevel);
}

export async function gradeAnswer(job: GradingJob, call: ModelCall): Promise<GradeAnswerResult> {
  const source = answerText(job);
  const section: ProductiveSection = job.section;
  if (job.section === "WRITING") {
    if (emptyAnswerReason(source, job.minWords) === "EMPTY") return { status: "EMPTY" };
  } else if (!source.trim()) {
    return { status: "EMPTY" };
  }

  const messages = messagesFor(job);
  let attemptMessages = messages;
  let lastError = "";
  let model: string | null = null;
  let runId: string | null = null;
  let calls = 0;
  for (let round = 0; round < 2; round++) {
    const answer = await call(attemptMessages);
    calls += 1;
    model = answer.model;
    runId = answer.runId;
    const parsed = parseGradingAnswer(answer.text, section);
    if (parsed.ok) {
      const proposal = finishProposal(parsed.proposal, job);
      const level = skillLevelFromCriteria(proposal) ?? proposal.overallLevel;
      return { status: "PROPOSED", proposal, level, raw: parsed.proposal, model: answer.model, runId: answer.runId, calls };
    }
    lastError = parsed.error;
    attemptMessages = buildGradingRepairMessages(messages, answer.text, parsed.error);
  }
  return { status: "UNPARSEABLE", error: lastError, model, runId, calls };
}
