import type { HiringDraft } from "@/solutions/hiring/ai/draft";

/**
 * Why an AI screen action was refused. Each code has its own sentence on
 * screen (components/hiring/ai/refusal-copy.ts), never the raw code.
 *
 * NOT_FOUND, CLOSED, FORBIDDEN: the opening may not be changed by this viewer.
 * LIBRARY_FORBIDDEN: the role may change the opening but not the library.
 * INVALID: a malformed request. NO_DRAFT: only a published version exists (or
 * it was published meanwhile); "Düzenlemeye başla" opens the draft, the AI
 * screen never does (ruling C5). JOB_AD_TOO_SHORT / JOB_AD_TOO_LONG: the ad.
 * RATE_LIMITED: too many AI requests (ai-limit). UNCONFIGURED: no AI connected.
 * PROVIDER_FAILED: the model could not be reached. SCHEMA_FAILED: its answer
 * was unusable after one repair. COMPETENCY, CHOICE_COMPETENCY,
 * TOO_MANY_COMPETENCIES, STAGE_FULL: the draft refused the stage.
 * NAME_REQUIRED: a competency card without a name. IN_USE: an accepted
 * competency is used now, so it stays in the library. NOT_CREATED: it was an
 * existing library competency, which an undo never archives.
 */
export type AiCode =
  | "NOT_FOUND"
  | "CLOSED"
  | "FORBIDDEN"
  | "LIBRARY_FORBIDDEN"
  | "INVALID"
  | "NO_DRAFT"
  | "JOB_AD_TOO_SHORT"
  | "JOB_AD_TOO_LONG"
  | "RATE_LIMITED"
  | "UNCONFIGURED"
  | "PROVIDER_FAILED"
  | "SCHEMA_FAILED"
  | "COMPETENCY"
  | "CHOICE_COMPETENCY"
  | "TOO_MANY_COMPETENCIES"
  | "STAGE_FULL"
  | "NAME_REQUIRED"
  | "IN_USE"
  | "NOT_CREATED";

export type AiRefusal = { ok: false; code: AiCode };
export type GenerateResult = { ok: true; draft: HiringDraft; budgetWarning: string | null } | AiRefusal;
export type AcceptStageResult = { ok: true; stageId: string } | AiRefusal;
export type AcceptCompetencyResult = { ok: true; id: string; created: boolean } | AiRefusal;
export type AiDone = { ok: true } | AiRefusal;
