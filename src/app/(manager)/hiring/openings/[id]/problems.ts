import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import { orderedActivities, orderedStages, type CompetencyFacts, type VersionContent } from "@/solutions/hiring/rules/content";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";

type T = ReturnType<typeof managerT>;

/**
 * One gate problem as a sentence and the place that fixes it (HIRING-UX R2:
 * "Yayınla" states its reason). Structure problems open the builder on the
 * stage or question at fault (`?stage=` / `?activity=`). A missing anchor and
 * the weights are fixed on the scorecard (Task 16): `?anchors=` opens that
 * competency's anchor Sheet, `?weights=1` opens the weights section.
 *
 * Stages and questions are named by their place on screen (orderIndex), the
 * same order the gate reports them in.
 */
export function describeProblem(
  problem: PublishProblem,
  ctx: { content: VersionContent; facts: ReadonlyMap<string, CompetencyFacts>; locale: Locale; openingId: string },
  t: T,
): { text: string; href: string | null } {
  const stages = orderedStages(ctx.content);
  const stage = (stageId: string) => t("hiringGate.stageLabel", { n: stages.findIndex((s) => s.id === stageId) + 1 });
  const activity = (activityId: string) => {
    for (const [i, s] of stages.entries()) {
      const j = orderedActivities(s).findIndex((a) => a.id === activityId);
      if (j >= 0) return t("hiringGate.activityLabel", { stage: i + 1, n: j + 1 });
    }
    return "";
  };
  const competency = (id: string) => pickText(ctx.facts.get(id)?.name, ctx.locale);
  const builder = `/hiring/openings/${ctx.openingId}/assessment/edit`;
  const atStage = (stageId: string) => `${builder}?stage=${stageId}`;
  const atActivity = (activityId: string) => `${builder}?activity=${activityId}`;
  const scorecard = `/hiring/openings/${ctx.openingId}/assessment/scorecard`;
  /** The first question (in screen order) that measures this competency, where it can be removed or replaced. */
  const usedAt = (competencyId: string) => {
    for (const s of stages) for (const a of orderedActivities(s)) if (a.competencyIds.includes(competencyId)) return atActivity(a.id);
    return builder;
  };
  switch (problem.code) {
    case "NO_STAGE":
      return { text: t("hiringGate.noStage"), href: builder };
    case "EMPTY_STAGE_NAME":
      return { text: t("hiringGate.emptyStageName", { stage: stage(problem.stageId) }), href: atStage(problem.stageId) };
    case "EMPTY_STAGE":
      return { text: t("hiringGate.emptyStage", { stage: stage(problem.stageId) }), href: atStage(problem.stageId) };
    case "EMPTY_PROMPT":
      return { text: t("hiringGate.emptyPrompt", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "NO_COMPETENCY":
      return { text: t("hiringGate.noCompetency", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "TOO_MANY_COMPETENCIES":
      return { text: t("hiringGate.tooMany", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "CHOICE_WITH_COMPETENCY":
      return { text: t("hiringGate.choiceWithCompetency", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "CHOICE_NEEDS_OPTIONS":
      return { text: t("hiringGate.choiceOptions", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "CHOICE_NEEDS_ANSWER":
      return { text: t("hiringGate.choiceAnswer", { activity: activity(problem.activityId) }), href: atActivity(problem.activityId) };
    case "NO_MEASURED_COMPETENCY":
      return { text: t("hiringGate.noMeasuredCompetency"), href: builder };
    case "COMPETENCY_MISSING":
      return { text: t("hiringGate.competencyMissing"), href: usedAt(problem.competencyId) };
    case "COMPETENCY_ARCHIVED":
      return { text: t("hiringGate.competencyArchived", { competency: competency(problem.competencyId) }), href: usedAt(problem.competencyId) };
    case "ANCHOR_MISSING":
      return {
        text: t("hiringGate.anchorMissing", { competency: competency(problem.competencyId), level: problem.level }),
        href: `${scorecard}?anchors=${problem.competencyId}`,
      };
    case "WEIGHTS_NOT_100":
      return { text: t("hiringGate.weights", { total: problem.total }), href: `${scorecard}?weights=1` };
    case "WEIGHTS_MISSING":
      return { text: t("hiringGate.weightsMissing", { competency: competency(problem.competencyId) }), href: `${scorecard}?weights=1` };
    default: {
      // A new PublishProblem code is a type error here until it has its sentence.
      const unhandled: never = problem;
      return unhandled;
    }
  }
}
