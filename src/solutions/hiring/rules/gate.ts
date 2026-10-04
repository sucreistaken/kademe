import { hasText, missingAnchorLevels } from "@/lib/library/anchors";
import { isChoice, MAX_COMPETENCIES_PER_ACTIVITY, orderedActivities, orderedStages, usedCompetencyIds, type CompetencyFacts, type VersionContent } from "./content";
import { missingWeights, weightsProblem } from "./weights";

export type PublishProblem =
  | { code: "NO_STAGE" }
  | { code: "EMPTY_STAGE_NAME"; stageId: string }
  | { code: "EMPTY_STAGE"; stageId: string }
  | { code: "EMPTY_PROMPT"; activityId: string }
  | { code: "NO_COMPETENCY"; activityId: string }
  | { code: "TOO_MANY_COMPETENCIES"; activityId: string }
  | { code: "CHOICE_WITH_COMPETENCY"; activityId: string }
  | { code: "CHOICE_NEEDS_OPTIONS"; activityId: string }
  | { code: "CHOICE_NEEDS_ANSWER"; activityId: string }
  | { code: "COMPETENCY_MISSING"; competencyId: string }
  | { code: "COMPETENCY_ARCHIVED"; competencyId: string }
  | { code: "ANCHOR_MISSING"; competencyId: string; level: number }
  /** Every question is a choice, so the version would measure no competency and give no scorecard. */
  | { code: "NO_MEASURED_COMPETENCY" }
  | { code: "WEIGHTS_NOT_100"; total: number }
  | { code: "WEIGHTS_MISSING"; competencyId: string };

/**
 * The readiness rows (HIRING-UX 5.4) each problem belongs to: "Değerlendirme
 * kuruldu", "Puan kartında her yetkinliğin çapası var" and the weights row.
 * Every code is in exactly one group (a test pins it).
 */
export const STRUCTURE_PROBLEMS: ReadonlyArray<PublishProblem["code"]> = [
  "NO_STAGE",
  "EMPTY_STAGE_NAME",
  "EMPTY_STAGE",
  "EMPTY_PROMPT",
  "NO_COMPETENCY",
  "TOO_MANY_COMPETENCIES",
  "CHOICE_WITH_COMPETENCY",
  "CHOICE_NEEDS_OPTIONS",
  "CHOICE_NEEDS_ANSWER",
];
export const ANCHOR_PROBLEMS: ReadonlyArray<PublishProblem["code"]> = ["NO_MEASURED_COMPETENCY", "COMPETENCY_MISSING", "COMPETENCY_ARCHIVED", "ANCHOR_MISSING"];
export const WEIGHT_PROBLEMS: ReadonlyArray<PublishProblem["code"]> = ["WEIGHTS_NOT_100", "WEIGHTS_MISSING"];

/**
 * The server-side publish gate. Every reason the draft cannot be published, in
 * screen order; an empty list means it can. Pure: the caller loads the draft
 * and the library facts inside the publishing transaction.
 */
export function publishProblems(content: VersionContent, facts: ReadonlyMap<string, CompetencyFacts>): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (content.stages.length === 0) problems.push({ code: "NO_STAGE" });
  for (const stage of orderedStages(content)) {
    if (!hasText(stage.name)) problems.push({ code: "EMPTY_STAGE_NAME", stageId: stage.id });
    if (stage.activities.length === 0) problems.push({ code: "EMPTY_STAGE", stageId: stage.id });
    for (const activity of orderedActivities(stage)) {
      if (!hasText(activity.prompt)) problems.push({ code: "EMPTY_PROMPT", activityId: activity.id });
      if (isChoice(activity.type)) {
        if (activity.competencyIds.length > 0) problems.push({ code: "CHOICE_WITH_COMPETENCY", activityId: activity.id });
        // Every option needs text and its own id; a blank or repeated one is not a usable option.
        const choices = activity.config.choices ?? [];
        const correct = choices.filter((c) => c.correct).length;
        const usable = choices.length >= 2 && choices.every((c) => hasText(c.label)) && new Set(choices.map((c) => c.id)).size === choices.length;
        if (!usable) problems.push({ code: "CHOICE_NEEDS_OPTIONS", activityId: activity.id });
        else if (activity.type === "SINGLE_CHOICE" ? correct !== 1 : correct < 1) {
          problems.push({ code: "CHOICE_NEEDS_ANSWER", activityId: activity.id });
        }
      } else if (activity.competencyIds.length === 0) {
        problems.push({ code: "NO_COMPETENCY", activityId: activity.id });
      } else if (activity.competencyIds.length > MAX_COMPETENCIES_PER_ACTIVITY) {
        problems.push({ code: "TOO_MANY_COMPETENCIES", activityId: activity.id });
      }
    }
  }
  const used = usedCompetencyIds(content);
  // A version must measure at least one competency. Only said when every question is a choice:
  // no question at all is NO_STAGE / EMPTY_STAGE, an unmeasured open question is NO_COMPETENCY.
  const questions = content.stages.flatMap((s) => s.activities);
  if (used.length === 0 && questions.length > 0 && questions.every((a) => isChoice(a.type))) problems.push({ code: "NO_MEASURED_COMPETENCY" });
  for (const id of used) {
    const f = facts.get(id);
    if (!f) {
      problems.push({ code: "COMPETENCY_MISSING", competencyId: id });
      continue;
    }
    if (f.archived) problems.push({ code: "COMPETENCY_ARCHIVED", competencyId: id });
    for (const level of missingAnchorLevels(f.anchors)) problems.push({ code: "ANCHOR_MISSING", competencyId: id, level });
  }
  if (content.weightsEnabled) {
    const weights = content.draftWeights ?? {};
    // A competency added after the weights were saved would be published at 0%: name it instead of the total.
    const missing = missingWeights(weights, used);
    for (const id of missing) problems.push({ code: "WEIGHTS_MISSING", competencyId: id });
    const problem = missing.length === 0 ? weightsProblem(weights, used) : null;
    if (problem) problems.push({ code: "WEIGHTS_NOT_100", total: problem.total });
  }
  return problems;
}
