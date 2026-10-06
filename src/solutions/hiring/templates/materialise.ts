import type { StagePayload } from "../rules/patches";
import type { HiringTemplate } from "./types";

/** The template as builder payloads: competency keys become the organisation's ids. */
export function materialise(template: HiringTemplate, idOf: (key: string) => string): { stages: StagePayload[]; weights: Record<string, number> } {
  const stages = template.stages.map(({ activities, ...stage }) => ({
    ...stage,
    activities: activities.map(({ competencyKeys, ...activity }) => ({ ...activity, competencyIds: competencyKeys.map(idOf) })),
  }));
  const weights = Object.fromEntries(Object.entries(template.weights).map(([key, w]) => [idOf(key), w]));
  return { stages, weights };
}

export const templateMinutes = (template: HiringTemplate) => Math.round(template.stages.reduce((s, x) => s + x.durationSeconds, 0) / 60);
export const templateQuestionCount = (template: HiringTemplate) => template.stages.reduce((s, x) => s + x.activities.length, 0);

/** Every competency key the template uses: open questions first, then weights. */
export function templateCompetencyKeys(template: HiringTemplate): string[] {
  const keys = template.stages.flatMap((s) => s.activities.flatMap((a) => a.competencyKeys));
  return [...new Set([...keys, ...Object.keys(template.weights)])];
}
