import type { AiMessage } from "@/lib/ai";
import {
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  guardPreA1,
  mergeProposals,
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

export type GradeOptions = {
  /**
   * How many independent model answers to take and merge (`mergeProposals`).
   * They are asked for at the same time, so the wait is that of one answer.
   * Default 1.
   */
  samples?: number;
};

export async function gradeAnswer(job: GradingJob, call: ModelCall, options: GradeOptions = {}): Promise<GradeAnswerResult> {
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
  const typed = job.section === "SPEAKING" && !!job.typed;
  const samples = Math.max(1, Math.floor(options.samples ?? 1));
  let calls = 0;
  const proposed = (raw: GradingProposal, answer: ModelAnswer): GradeAnswerResult => {
    const proposal = finishProposal(raw, job);
    const level = skillLevelFromCriteria(proposal) ?? proposal.overallLevel;
    return { status: "PROPOSED", source: "MODEL", proposal, level, raw, model: answer.model, runId: answer.runId, calls };
  };

  if (samples > 1) {
    // Several answers at once; the ones that parse are merged. If none does, fall through to the repair attempt below.
    // A call that failed is left out as long as another one answered; if every call failed, the first error is thrown.
    const settled = await Promise.allSettled(Array.from({ length: samples }, () => call(messages)));
    calls += samples;
    const answers = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (answers.length === 0) throw (settled[0] as PromiseRejectedResult).reason;
    const parsed = answers.map((a) => parseGradingAnswer(a.text, section, { typed }));
    const good = parsed.flatMap((p) => (p.ok ? [p.proposal] : []));
    if (good.length > 0) return proposed(mergeProposals(good), answers[parsed.findIndex((p) => p.ok)]);
  }

  let attemptMessages = messages;
  let lastError = "";
  let model: string | null = null;
  let runId: string | null = null;
  for (let round = 0; round < 2; round++) {
    const answer = await call(attemptMessages);
    calls += 1;
    model = answer.model;
    runId = answer.runId;
    const parsed = parseGradingAnswer(answer.text, section, { typed });
    if (parsed.ok) return proposed(parsed.proposal, answer);
    lastError = parsed.error;
    attemptMessages = buildGradingRepairMessages(messages, answer.text, parsed.error);
  }
  return { status: "UNPARSEABLE", error: lastError, model, runId, calls };
}
