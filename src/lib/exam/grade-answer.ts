import type { AiMessage } from "@/lib/ai";
import {
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  guardPreA1,
  parseGradingAnswer,
  skillLevelFromCriteria,
  verifyEvidence,
  type GradingProposal,
  type SpeakingGradingInput,
  type WritingGradingInput,
} from "./grading";
import { ruleProposal, ruleVerdict, withLengthFlag, type RuleReason } from "./grading-rules";
import type { ProductiveSection, ResultLevel } from "./types";

/**
 * One answer in, one proposal out: the whole grading path except the database.
 *
 * The grading job (`runGrading`) and the calibration harness
 * (`scripts/grading-calibration.ts`) both go through here, so what the harness
 * measures is what a candidate's answer meets: the same rules, the same
 * prompt, the same repair attempt, the same checks on the model's answer. Only
 * how the model is called differs, and it is passed in (`ModelCall`).
 */

export type GradingJob =
  | ({ section: "WRITING" } & WritingGradingInput)
  | ({ section: "SPEAKING" } & SpeakingGradingInput);

/** What the model call gives back. `runId` is the audit row, when there is one. */
export type ModelAnswer = { text: string; model: string; runId: string | null };
export type ModelCall = (messages: AiMessage[]) => Promise<ModelAnswer>;

/** The `ai_model` of a proposal that a fixed rule made without a model. */
export const RULE_MODEL = "rule";

export type GradeAnswerResult =
  | {
      status: "PROPOSED";
      /** Who made it: the model (then the code checked it) or a fixed rule (`grading-rules.ts`), with no model call. */
      source: "MODEL" | "RULE";
      /** What is stored. For a model: evidence verified, A0 guarded, capped. */
      proposal: GradingProposal;
      /** The level the skill gets: lower median of the assessable criteria, else the overall level. */
      level: ResultLevel;
      /** The model's proposal as parsed, before any check. For a rule, the same as `proposal`. */
      raw: GradingProposal;
      /** The model's name, or `RULE_MODEL`. */
      model: string;
      runId: string | null;
      /** How many model calls it took (0 for a rule, 2 when the first answer was unusable). */
      calls: number;
      rule?: RuleReason;
    }
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
  const checked = capByTaskLevel(guardPreA1(verifyEvidence(raw, source), source), job.taskLevel);
  return withLengthFlag(checked, { section: job.section, text: source, minWords: job.section === "WRITING" ? job.minWords : undefined });
}

export async function gradeAnswer(job: GradingJob, call: ModelCall): Promise<GradeAnswerResult> {
  const section: ProductiveSection = job.section;
  const verdict = ruleVerdict({
    section,
    text: answerText(job),
    taskText: job.task,
    minWords: job.section === "WRITING" ? job.minWords : undefined,
    register: job.register,
  });
  if (verdict) {
    const proposal = ruleProposal(section, verdict, job.rationaleLocale);
    return {
      status: "PROPOSED",
      source: "RULE",
      proposal,
      level: "A0",
      raw: proposal,
      model: RULE_MODEL,
      runId: null,
      calls: 0,
      rule: verdict.reason,
    };
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
      return { status: "PROPOSED", source: "MODEL", proposal, level, raw: parsed.proposal, model: answer.model, runId: answer.runId, calls };
    }
    lastError = parsed.error;
    attemptMessages = buildGradingRepairMessages(messages, answer.text, parsed.error);
  }
  return { status: "UNPARSEABLE", error: lastError, model, runId, calls };
}
