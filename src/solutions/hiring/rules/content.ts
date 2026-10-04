import type { AnswerExamples, HiringActivityConfig } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import type { Locale } from "@/i18n/locale";

/**
 * The shape of one hiring assessment version as the rules see it. Pure: the
 * server loads it (server/content.ts), the rules judge it, the screens show it.
 */
export const ACTIVITY_TYPES = ["VIDEO", "AUDIO", "LONG_TEXT", "SHORT_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE", "FILE_UPLOAD"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type StageTimeout = "AUTO_SUBMIT" | "AUTO_CLOSE" | "ALLOW_GRACE" | "ALLOW_LATE";

/** Choice questions are auto-scored into the separate knowledge score and measure no competency. */
export const isChoice = (type: ActivityType) => type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";
export const isRecorded = (type: ActivityType) => type === "VIDEO" || type === "AUDIO";
/** Agrees with the database: hiring_at_most_two_competencies allows order_index 0 and 1 only. */
export const MAX_COMPETENCIES_PER_ACTIVITY = 2;

export type ContentActivity = {
  id: string;
  orderIndex: number;
  type: ActivityType;
  required: boolean;
  prompt: I18nText;
  note: I18nText;
  internalQuestion: string | null;
  expectedBehaviours: string[];
  redFlags: string[];
  managerNotes: string | null;
  answerExamples: AnswerExamples;
  thinkSeconds: number;
  flexibleThink: boolean;
  answerSeconds: number | null;
  maxTakes: number;
  config: HiringActivityConfig;
  competencyIds: string[];
};

export type ContentStage = {
  id: string;
  orderIndex: number;
  name: I18nText;
  description: I18nText;
  internalPurpose: string | null;
  durationSeconds: number;
  graceSeconds: number;
  onTimeout: StageTimeout;
  backNavigation: boolean;
  activities: ContentActivity[];
};

export type VersionContent = {
  id: string;
  number: number;
  status: "DRAFT" | "PUBLISHED";
  defaultLocale: Locale;
  localeSet: Locale[];
  weightsEnabled: boolean;
  draftWeights: Record<string, number> | null;
  previewedAt: Date | null;
  stages: ContentStage[];
};

/** What the rules need to know about a library competency. */
export type CompetencyFacts = {
  id: string;
  name: I18nText;
  archived: boolean;
  anchors: Partial<Record<number, I18nText>>;
  tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText; archived: boolean }>;
};

/** Stable reading order: by position, ties by id, so the loader's row order never matters. */
export function byOrder<T extends { orderIndex: number; id: string }>(a: T, b: T): number {
  return a.orderIndex - b.orderIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export const orderedStages = (content: { stages: ContentStage[] }): ContentStage[] => [...content.stages].sort(byOrder);
export const orderedActivities = (stage: { activities: ContentActivity[] }): ContentActivity[] => [...stage.activities].sort(byOrder);

/** Competencies the questions measure, in the order they first appear. Choice questions measure none. */
export function usedCompetencyIds(content: { stages: ContentStage[] }): string[] {
  const seen: string[] = [];
  for (const stage of orderedStages(content)) {
    for (const activity of orderedActivities(stage)) {
      if (isChoice(activity.type)) continue;
      for (const id of activity.competencyIds) if (!seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}

export function totalSeconds(content: { stages: ContentStage[] }): number {
  return content.stages.reduce((sum, stage) => sum + stage.durationSeconds, 0);
}
