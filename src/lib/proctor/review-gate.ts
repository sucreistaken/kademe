import type { ProctoringPolicy } from "@/lib/proctor/policy";
import { TAXONOMY, type ProctorEventType } from "@/lib/proctor/taxonomy";

/**
 * Which flags are worth an AI second look, and which reviews count against
 * the per-attempt budget. Pure, so it is tested without a database.
 *
 * Every reviewable flag makes a claim the frames have to show
 * (src/lib/exam/proctor-review.ts, CLAIMS): a screen claim needs a screen
 * frame, a person claim a webcam frame. A flag whose frames cannot exist is not
 * queued: under STANDARD there is no screen share, so a TAB_HIDDEN review could
 * only ever come back without an answer, and it used to use up the budget that
 * a later PHONE_DETECTED or MULTIPLE_FACES needed.
 */

export type ReviewClaim = "SCREEN" | "PERSON";

const CLAIM: Partial<Record<ProctorEventType, ReviewClaim>> = {
  TAB_HIDDEN: "SCREEN",
  FOCUS_LOST: "SCREEN",
  SECOND_SCREEN_DETECTED: "SCREEN",
  NO_FACE: "PERSON",
  MULTIPLE_FACES: "PERSON",
  PHONE_DETECTED: "PERSON",
};

/** What the flag's frames have to show, or null when it is never reviewed. */
export function reviewClaim(type: ProctorEventType): ReviewClaim | null {
  return TAXONOMY[type].aiReview ? (CLAIM[type] ?? null) : null;
}

/** Queue a review only when the policy asks for one and captures the frames the claim needs. */
export function shouldQueueReview(
  type: ProctorEventType,
  policy: Pick<ProctoringPolicy, "aiSecondLook" | "camera" | "screenShare">,
): boolean {
  if (!policy.aiSecondLook) return false;
  const claim = reviewClaim(type);
  if (claim === "SCREEN") return policy.screenShare;
  if (claim === "PERSON") return policy.camera;
  return false;
}

/**
 * Review statuses that use up the budget: a model call was made (DONE, FAILED)
 * or may still be (QUEUED). A SKIPPED review made none (no frames for the
 * moment, or no vision model configured), so it leaves the budget to the
 * flags that come later.
 */
export const BUDGETED_REVIEW_STATUSES = ["QUEUED", "DONE", "FAILED"] as const;

export function countsAgainstBudget(status: string): boolean {
  return (BUDGETED_REVIEW_STATUSES as readonly string[]).includes(status);
}
