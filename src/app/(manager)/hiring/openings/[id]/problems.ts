import type { managerT } from "@/i18n/manager";
import type { Locale } from "@/i18n/locale";
import { pickText } from "@/lib/i18n-text";
import { orderedActivities, orderedStages, type CompetencyFacts, type VersionContent } from "@/solutions/hiring/rules/content";
import type { PublishProblem } from "@/solutions/hiring/rules/gate";

type T = ReturnType<typeof managerT>;

/**
 * One gate problem as a sentence and the place that fixes it (HIRING-UX R2:
 * "Yayınla" states its reason). `href` is null while the page that fixes the
 * problem does not exist yet (ruling C7): the builder (Task 15) and the
 * scorecard (Task 16) add their links when they add their routes. A missing
 * anchor is fixed on the library competency, which exists.
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
  switch (problem.code) {
    case "NO_STAGE":
      return { text: t("hiringGate.noStage"), href: null };
    case "EMPTY_STAGE_NAME":
      return { text: t("hiringGate.emptyStageName", { stage: stage(problem.stageId) }), href: null };
    case "EMPTY_STAGE":
      return { text: t("hiringGate.emptyStage", { stage: stage(problem.stageId) }), href: null };
    case "EMPTY_PROMPT":
      return { text: t("hiringGate.emptyPrompt", { activity: activity(problem.activityId) }), href: null };
    case "NO_COMPETENCY":
      return { text: t("hiringGate.noCompetency", { activity: activity(problem.activityId) }), href: null };
    case "TOO_MANY_COMPETENCIES":
      return { text: t("hiringGate.tooMany", { activity: activity(problem.activityId) }), href: null };
    case "CHOICE_WITH_COMPETENCY":
      return { text: t("hiringGate.choiceWithCompetency", { activity: activity(problem.activityId) }), href: null };
    case "CHOICE_NEEDS_OPTIONS":
      return { text: t("hiringGate.choiceOptions", { activity: activity(problem.activityId) }), href: null };
    case "CHOICE_NEEDS_ANSWER":
      return { text: t("hiringGate.choiceAnswer", { activity: activity(problem.activityId) }), href: null };
    case "COMPETENCY_MISSING":
      return { text: t("hiringGate.competencyMissing"), href: null };
    case "COMPETENCY_ARCHIVED":
      return { text: t("hiringGate.competencyArchived", { competency: competency(problem.competencyId) }), href: null };
    case "ANCHOR_MISSING":
      return {
        text: t("hiringGate.anchorMissing", { competency: competency(problem.competencyId), level: problem.level }),
        href: `/library/competencies/${problem.competencyId}`,
      };
    case "WEIGHTS_NOT_100":
      return { text: t("hiringGate.weights", { total: problem.total }), href: null };
    case "WEIGHTS_MISSING":
      return { text: t("hiringGate.weightsMissing", { competency: competency(problem.competencyId) }), href: null };
    default: {
      // A new PublishProblem code is a type error here until it has its sentence.
      const unhandled: never = problem;
      return unhandled;
    }
  }
}
