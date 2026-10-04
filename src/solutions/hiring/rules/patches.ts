import { z } from "zod";
import { LOCALES } from "@/i18n/locale";
import { ACTIVITY_TYPES, MAX_COMPETENCIES_PER_ACTIVITY, type ActivityType, type ContentActivity, type ContentStage } from "./content";

/**
 * Value ranges the builder accepts. Each one lies inside the database CHECK of
 * the same column (migrations 0005 and 0007; patches.test reads the CHECKs and
 * proves it), so a validated save never ends in a raw 23514.
 */
export const HIRING_LIMITS = {
  /** hiring_stage_duration: BETWEEN 60 AND 7200 */
  stageDurationSeconds: { min: 60, max: 7200 },
  /** hiring_stage_grace: >= 0 */
  stageGraceSeconds: { min: 0, max: 600 },
  /** hiring_activity_think: BETWEEN 0 AND 600 */
  thinkSeconds: { min: 0, max: 600 },
  /** hiring_activity_answer: NULL or > 0 */
  answerSeconds: { min: 30, max: 1800 },
  /** hiring_activity_takes: BETWEEN 1 AND 5 */
  maxTakes: { min: 1, max: 5 },
  /** hiring_min_evaluations: BETWEEN 1 AND 5 */
  minEvaluations: { min: 1, max: 5 },
  /** hiring_feedback_days: BETWEEN 1 AND 60 */
  feedbackDays: { min: 1, max: 60 },
} as const;

const whole = (limit: { min: number; max: number }) => z.number().int().min(limit.min).max(limit.max);

/** What the builder may change, validated on the server before any write. */
const text = (max: number) => z.object({ tr: z.string().max(max), en: z.string().max(max) });
const choiceSchema = z.object({ id: z.string().min(1).max(40), label: text(300), correct: z.boolean().optional() });

export const activityConfigSchema = z
  .object({
    choices: z.array(choiceSchema).max(10).optional(),
    minChars: z.number().int().min(0).max(20000).optional(),
    maxChars: z.number().int().min(1).max(20000).optional(),
    acceptedMimeTypes: z.array(z.string().max(100)).max(10).optional(),
    maxFileBytes: z.number().int().min(1).max(50 * 1024 * 1024).optional(),
    textAlternativeEnabled: z.boolean().optional(),
  })
  .strict();

const activityFields = {
  type: z.enum(ACTIVITY_TYPES),
  required: z.boolean(),
  prompt: text(2000),
  note: text(600),
  internalQuestion: z.string().max(1000).nullable(),
  expectedBehaviours: z.array(z.string().max(300)).max(10),
  redFlags: z.array(z.string().max(300)).max(10),
  managerNotes: z.string().max(2000).nullable(),
  answerExamples: z.object({ 1: z.string().max(600).optional(), 3: z.string().max(600).optional(), 5: z.string().max(600).optional() }).strict(),
  thinkSeconds: whole(HIRING_LIMITS.thinkSeconds),
  flexibleThink: z.boolean(),
  answerSeconds: whole(HIRING_LIMITS.answerSeconds).nullable(),
  maxTakes: whole(HIRING_LIMITS.maxTakes),
  config: activityConfigSchema,
};

export const activityPatchSchema = z.object(activityFields).partial().strict();
export const activityPayloadSchema = z.object({ ...activityFields, competencyIds: z.array(z.uuid()).max(MAX_COMPETENCIES_PER_ACTIVITY) });

const stageFields = {
  name: text(300),
  description: text(2000),
  internalPurpose: z.string().max(1000).nullable(),
  durationSeconds: whole(HIRING_LIMITS.stageDurationSeconds),
  graceSeconds: whole(HIRING_LIMITS.stageGraceSeconds),
  onTimeout: z.enum(["AUTO_SUBMIT", "AUTO_CLOSE", "ALLOW_GRACE", "ALLOW_LATE"]),
  backNavigation: z.boolean(),
};
export const stagePatchSchema = z.object(stageFields).partial().strict();
export const stagePayloadSchema = z.object({ ...stageFields, activities: z.array(activityPayloadSchema).max(20) });

/** An opening's review rules (hiring_openings CHECKs); Task 20's settings write validates with it. */
export const openingRulesSchema = z
  .object({ minEvaluations: whole(HIRING_LIMITS.minEvaluations), feedbackDays: whole(HIRING_LIMITS.feedbackDays) })
  .partial()
  .strict();

/** A version's languages: a non-empty set without repeats that holds the default (hiring_versions CHECKs). */
export const versionLocalesSchema = z
  .object({ defaultLocale: z.enum(LOCALES), localeSet: z.array(z.enum(LOCALES)).min(1).max(LOCALES.length) })
  .refine((v) => new Set(v.localeSet).size === v.localeSet.length, { path: ["localeSet"], message: "repeated locale" })
  .refine((v) => v.localeSet.includes(v.defaultLocale), { path: ["defaultLocale"], message: "default locale not in the set" });

export type ActivityPatch = z.infer<typeof activityPatchSchema>;
export type ActivityPayload = z.infer<typeof activityPayloadSchema>;
export type StagePatch = z.infer<typeof stagePatchSchema>;
export type StagePayload = z.infer<typeof stagePayloadSchema>;
export type OpeningRules = z.infer<typeof openingRulesSchema>;
export type VersionLocales = z.infer<typeof versionLocalesSchema>;

/** HIRING-UX 5.5 defaults: 60 s flexible think time, 2 min answer, one retake. */
export function defaultsFor(type: ActivityType): Pick<ActivityPayload, "thinkSeconds" | "flexibleThink" | "answerSeconds" | "maxTakes" | "config"> {
  switch (type) {
    case "VIDEO":
    case "AUDIO":
      return { thinkSeconds: 60, flexibleThink: true, answerSeconds: 120, maxTakes: 2, config: { textAlternativeEnabled: false } };
    case "LONG_TEXT":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { minChars: 0, maxChars: 3000 } };
    case "SHORT_TEXT":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { minChars: 0, maxChars: 300 } };
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return {
        thinkSeconds: 0,
        flexibleThink: true,
        answerSeconds: null,
        maxTakes: 1,
        config: {
          choices: [
            { id: "a", label: { tr: "", en: "" } },
            { id: "b", label: { tr: "", en: "" } },
          ],
        },
      };
    case "FILE_UPLOAD":
      return { thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 10 * 1024 * 1024 } };
  }
}

export function emptyActivity(type: ActivityType): ActivityPayload {
  return {
    type,
    required: true,
    prompt: { tr: "", en: "" },
    note: { tr: "", en: "" },
    internalQuestion: null,
    expectedBehaviours: [],
    redFlags: [],
    managerNotes: null,
    answerExamples: {},
    ...defaultsFor(type),
    competencyIds: [],
  };
}

export function activityPayloadOf(a: ContentActivity): ActivityPayload {
  return {
    type: a.type,
    required: a.required,
    prompt: a.prompt,
    note: a.note,
    internalQuestion: a.internalQuestion,
    expectedBehaviours: a.expectedBehaviours,
    redFlags: a.redFlags,
    managerNotes: a.managerNotes,
    answerExamples: a.answerExamples,
    thinkSeconds: a.thinkSeconds,
    flexibleThink: a.flexibleThink,
    answerSeconds: a.answerSeconds,
    maxTakes: a.maxTakes,
    config: a.config,
    competencyIds: a.competencyIds,
  };
}

export function stagePayloadOf(stage: ContentStage): StagePayload {
  return {
    name: stage.name,
    description: stage.description,
    internalPurpose: stage.internalPurpose,
    durationSeconds: stage.durationSeconds,
    graceSeconds: stage.graceSeconds,
    onTimeout: stage.onTimeout,
    backNavigation: stage.backNavigation,
    activities: stage.activities.map(activityPayloadOf),
  };
}
