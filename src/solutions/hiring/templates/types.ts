import type { I18nText } from "@/db/schema/types";
import type { ActivityPayload, StagePayload } from "../rules/patches";

/** A question as a template states it: competencies by library key, never by id. */
export type TemplateActivity = Omit<ActivityPayload, "competencyIds"> & { competencyKeys: string[] };
export type TemplateStage = Omit<StagePayload, "activities"> & { activities: TemplateActivity[] };
export type TemplateGroup = "GENERIC" | "LANGUAGE_SCHOOL" | "EXTRA";

/** A ready assessment for one role (spec 2026-10-06-hiring-ready-templates-design, section 3). */
export type HiringTemplate = {
  key: string;
  group: TemplateGroup;
  name: I18nText;
  /** One line for the gallery card. */
  summary: I18nText;
  /** Written into a position that has no job ad yet. */
  jobAd: I18nText;
  /** Competency key to whole percentage; exactly the competencies the open questions measure, summing to 100. */
  weights: Record<string, number>;
  stages: TemplateStage[];
};
