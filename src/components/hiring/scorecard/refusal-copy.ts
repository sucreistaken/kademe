import type { ScorecardCode } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/result";
import type { ManagerMessages } from "@/i18n/manager";

export type ScorecardKey = keyof ManagerMessages["hiringScorecard"] & string;
type Translate = (key: ScorecardKey, values?: Record<string, string | number>) => string;

const KEYS: Record<ScorecardCode | "NETWORK", ScorecardKey> = {
  NOT_FOUND: "errNotFound",
  CLOSED: "errClosed",
  FORBIDDEN: "errForbidden",
  LIBRARY_FORBIDDEN: "errLibraryForbidden",
  INVALID: "errInvalid",
  NO_DRAFT: "errNoDraft",
  STALE: "errStale",
  NO_LIVE: "errNoLive",
  REASON_REQUIRED: "reasonRequired",
  NOT_WHOLE: "errNotWhole",
  NOT_100: "errNot100",
  WEIGHTS_MISSING: "errWeightsMissing",
  NO_CHANGE: "errNoChange",
  ANCHORS_REQUIRED: "errAnchorsRequired",
  ARCHIVED: "errArchived",
  NETWORK: "saveFailed",
};

/**
 * The sentence for a refused scorecard write (carry 7): every code the actions
 * answer has its own, never a raw code. NOT_100 states the total the server
 * counted; NOT_WHOLE never states a total, so it cannot contradict the one on
 * screen. NETWORK: the request itself failed.
 */
export function refusalText(refusal: { code: ScorecardCode | "NETWORK"; total?: number }, t: Translate): string {
  return t(KEYS[refusal.code], { total: refusal.total ?? 0 });
}
