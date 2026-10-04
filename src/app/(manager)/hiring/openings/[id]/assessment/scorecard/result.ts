import type { I18nText } from "@/db/schema/types";

/**
 * Why a scorecard write was refused. Each code has its own sentence on screen
 * (components/hiring/scorecard/refusal-copy.ts), never the raw code.
 *
 * NOT_FOUND, CLOSED, FORBIDDEN: the opening may not be changed by this viewer.
 * LIBRARY_FORBIDDEN: the role may change the opening but not the library.
 * INVALID: a malformed request. NO_DRAFT: the draft was published meanwhile.
 * STALE: the form was loaded for another version (a newer one went live, or
 * a new draft replaced the one on screen); reload. NO_LIVE: nothing published.
 * REASON_REQUIRED: a live weight change without a reason. NOT_WHOLE: a weight
 * that is not a whole 0-100. NOT_100: whole weights, wrong total.
 * WEIGHTS_MISSING: weighting on and a measured competency has no weight.
 * NO_CHANGE: a live change equal to the current set.
 * ANCHORS_REQUIRED: level 1, 3 or 5 empty. ARCHIVED: the competency is archived.
 */
export type ScorecardCode =
  | "NOT_FOUND"
  | "CLOSED"
  | "FORBIDDEN"
  | "LIBRARY_FORBIDDEN"
  | "INVALID"
  | "NO_DRAFT"
  | "STALE"
  | "NO_LIVE"
  | "REASON_REQUIRED"
  | "NOT_WHOLE"
  | "NOT_100"
  | "WEIGHTS_MISSING"
  | "NO_CHANGE"
  | "ANCHORS_REQUIRED"
  | "ARCHIVED";

export type ScorecardRefusal = { ok: false; code: ScorecardCode; total?: number; competencyId?: string };
export type WeightsResult = { ok: true } | ScorecardRefusal;
export type AnchorsResult = { ok: true; anchors: Record<number, I18nText> } | ScorecardRefusal;
