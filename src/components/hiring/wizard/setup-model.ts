import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import { isChoice, orderedActivities, orderedStages, totalSeconds, type ActivityType, type ContentStage } from "@/solutions/hiring/rules/content";
import type { OpeningRulesInput } from "@/solutions/hiring/rules/opening-rules";

/**
 * HIRING-UX 5.20 steps 2 and 3 on /hiring/openings/[id]/setup: "Sorular"
 * (#questions) and "Önizle ve yayınla" (#publish). Pure, so each rule has a
 * test; the page and the client component read it.
 */
export const SETUP_STEPS = ["questions", "publish"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The wizard's address for an opening's step. */
export const setupHref = (openingId: string, step: SetupStep = "questions") => `/hiring/openings/${openingId}/setup#${step}`;

/**
 * Where "Kuruluma devam et" and "Sıradaki: … ›" go now that setup is the
 * wizard: the questions while the assessment, its anchors or its weights are
 * not done, the publish step otherwise (team, deadline and the preview live
 * there).
 */
export function wizardNext(openingId: string, rows: ReadonlyArray<{ key: string; state: string }>): string {
  const questionsOpen = rows.some((r) => (r.key === "assessment" || r.key === "anchors" || r.key === "weights") && r.state !== "done");
  return setupHref(openingId, questionsOpen ? "questions" : "publish");
}

/** Step 2's one scorecard line: how many competencies are measured and whether the weights are equal. */
export function scorecardLine(input: { measured: number; weightsEnabled: boolean; weights: Record<string, number> | null }): { count: number; weights: "equal" | "custom" } {
  const values = input.weightsEnabled && input.weights ? Object.values(input.weights) : [];
  const custom = values.length > 1 && values.some((v) => v !== values[0]);
  return { count: input.measured, weights: custom ? "custom" : "equal" };
}

/** Step 3's short candidate preview: each stage's name, minutes and question count, and the totals. */
export function candidatePreview(content: { stages: ContentStage[] }, locale: Locale) {
  const stages = orderedStages(content).map((s) => ({
    id: s.id,
    name: pickText(s.name, locale),
    minutes: Math.round(s.durationSeconds / 60),
    questions: orderedActivities(s).length,
  }));
  return {
    stages,
    minutes: Math.round(totalSeconds(content) / 60),
    questions: stages.reduce((sum, s) => sum + s.questions, 0),
  };
}

/**
 * Step 3's team: "Sadece sen" (the default, user decision 2026-10-07) is the
 * manager alone, reviewing and deciding; "Kişi ekle" adds people next to them.
 * The decider stays whoever is set (the creator, unless team and rules changed it).
 */
export type TeamChoice = { solo: boolean; others: string[] };

export function teamChoiceOf(memberIds: readonly string[], me: string): TeamChoice {
  const others = memberIds.filter((id) => id !== me);
  return { solo: others.length === 0, others };
}

export function membersOf(choice: TeamChoice, me: string): string[] {
  return choice.solo ? [me] : [me, ...choice.others.filter((id) => id !== me)];
}

/** The rules step 3 saves before publishing: the saved ones with the step's team, deadline and rules. */
export function publishRules(saved: OpeningRulesInput, change: { team: TeamChoice; me: string; deadline: string; blindMode: boolean; feedbackDays: number; candidateContactEmail: string; finishSurveyEnabled: boolean }): OpeningRulesInput {
  return {
    ...saved,
    memberIds: membersOf(change.team, change.me),
    decisionMakerId: saved.decisionMakerId ?? change.me,
    deadline: change.deadline || null,
    blindMode: change.blindMode,
    feedbackDays: change.feedbackDays,
    candidateContactEmail: change.candidateContactEmail,
    finishSurveyEnabled: change.finishSurveyEnabled,
  };
}

/** True when the step's rules differ from what is saved (only then they are saved before "Yayınla"). */
export function rulesChanged(saved: OpeningRulesInput, next: OpeningRulesInput): boolean {
  const sameMembers = saved.memberIds.length === next.memberIds.length && saved.memberIds.every((id) => next.memberIds.includes(id));
  return (
    !sameMembers ||
    saved.decisionMakerId !== next.decisionMakerId ||
    saved.deadline !== next.deadline ||
    saved.blindMode !== next.blindMode ||
    saved.feedbackDays !== next.feedbackDays ||
    saved.candidateContactEmail !== next.candidateContactEmail ||
    (saved.finishSurveyEnabled ?? false) !== (next.finishSurveyEnabled ?? false)
  );
}

/** The sentence key (hiringWizard.*) for a refusal of the wizard's AI actions. */
export function aiCodeKey(code: string): "aiUnconfigured" | "aiRateLimited" | "aiFailed" | "aiForbidden" | "aiClosed" | "aiNoAd" | "aiAdTooLong" | "aiChoice" | "undoFailed" | "aiNoDraft" {
  switch (code) {
    case "JOB_AD_TOO_LONG":
      return "aiAdTooLong";
    case "CHOICE_QUESTION":
      return "aiChoice";
    case "UNDO_EXPIRED":
      return "undoFailed";
    case "NO_DRAFT":
      return "aiNoDraft";
    case "UNCONFIGURED":
      return "aiUnconfigured";
    case "RATE_LIMITED":
      return "aiRateLimited";
    case "FORBIDDEN":
    case "LIBRARY_FORBIDDEN":
      return "aiForbidden";
    case "CLOSED":
      return "aiClosed";
    case "JOB_AD_TOO_SHORT":
      return "aiNoAd";
    default:
      return "aiFailed";
  }
}

/**
 * The name a stage gets when "+ Kendi sorunu ekle" needs a new one (HIRING-UX
 * 5.20 item 4): "Sorular" / "Questions", then "Sorular 2", "Sorular 3", the
 * first number no stage uses yet, so nobody has to name a stage to go on.
 */
export function defaultStageName(existing: ReadonlyArray<{ tr: string; en: string }>): { tr: string; en: string } {
  const used = new Set(existing.flatMap((n) => [n.tr.trim(), n.en.trim()]));
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? { tr: "Sorular", en: "Questions" } : { tr: `Sorular ${n}`, en: `Questions ${n}` };
    if (!used.has(name.tr) && !used.has(name.en)) return name;
  }
}

/** Whether "AI ile düzelt" is offered on a question: never on a choice question, which the server refuses (CHOICE_QUESTION). */
export const canFixWithAi = (type: ActivityType) => !isChoice(type);

/**
 * How long the undo of an AI change is offered: the server signs the token for
 * ten minutes (revise-undo.ts), so the line stays that long, or until the next
 * change replaces it. A plain delete keeps the 8 second strip.
 */
export const AI_UNDO_MS = 10 * 60 * 1000;

/**
 * Step 2's lead and whether "AI'a söyle" is shown. With questions it always
 * is. On an empty list it is only when the position has a job ad, and then it
 * writes the first questions with the instruction (a revision of the empty
 * list); without an ad the lead promises no AI.
 */
export function questionsIntro(input: { questions: number; canDraft: boolean }): { lead: "questionsLead" | "questionsLeadEmpty" | "questionsLeadEmptyNoAi"; tellBox: boolean } {
  if (input.questions > 0) return { lead: "questionsLead", tellBox: true };
  return input.canDraft ? { lead: "questionsLeadEmpty", tellBox: true } : { lead: "questionsLeadEmptyNoAi", tellBox: false };
}
