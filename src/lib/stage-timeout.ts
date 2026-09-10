import type { TimeoutBehaviour } from "./timer";
import type { ResponsePayload } from "@/db/schema/types";

/**
 * The rules for what happens to a stage when its deadline passes.
 *
 * Kept free of database imports on purpose: these are the decisions worth
 * testing, and a test that has to stand up Postgres to check "a half finished
 * stage is kept, not discarded" will not get written.
 */

export type CloseDecision =
  | { action: "CLOSE"; completion: "COMPLETE" | "PARTIAL" | "EXPIRED"; late: boolean }
  | { action: "LEAVE_OPEN"; reason: string };

/**
 * Pure so the rules can be tested without a database. `answered` counts the
 * required activities the candidate actually filled in.
 */
export function decideClose(input: {
  behaviour: TimeoutBehaviour;
  requiredCount: number;
  answeredRequired: number;
  answeredAny: number;
}): CloseDecision {
  const { behaviour, requiredCount, answeredRequired, answeredAny } = input;

  // ALLOW_LATE means the manager chose to let a slow candidate finish. Closing
  // the run behind their back would throw away work they are still doing.
  if (behaviour === "ALLOW_LATE") {
    return { action: "LEAVE_OPEN", reason: "stage allows late submission" };
  }

  // AUTO_CLOSE discards rather than submits: the manager asked for a hard stop.
  if (behaviour === "AUTO_CLOSE") {
    return { action: "CLOSE", completion: "EXPIRED", late: true };
  }

  // AUTO_SUBMIT and ALLOW_GRACE both end in a submit. Grace is already baked
  // into deadline_at by computeDeadline(), so by the time we get here it is
  // spent and the two behave the same.
  const complete = requiredCount > 0 && answeredRequired >= requiredCount;
  if (complete) return { action: "CLOSE", completion: "COMPLETE", late: true };
  if (answeredAny > 0) return { action: "CLOSE", completion: "PARTIAL", late: true };
  return { action: "CLOSE", completion: "EXPIRED", late: true };
}

/** True when a response actually carries something worth keeping. */
export function hasAnswer(payload: ResponsePayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.text && payload.text.trim().length > 0) return true;
  if (payload.choiceIds && payload.choiceIds.length > 0) return true;
  if (payload.mediaAssetId) return true;
  if (payload.fileAssetIds && payload.fileAssetIds.length > 0) return true;
  return false;
}

/**
 * What a stage looks like in a new attempt.
 *
 * "Carried" means the candidate already settled this stage and is not being
 * asked to redo it, so the new run points at the old one instead of copying it.
 * A stage the candidate never reached is NOT carried: it is still outstanding,
 * and closing it would take away a chance they never had.
 */
export function carryDecision(input: {
  inRetakeScope: boolean;
  priorCompletion: "PENDING" | "COMPLETE" | "PARTIAL" | "SKIPPED" | "EXPIRED" | null;
}): "FRESH" | "CARRY" {
  if (input.inRetakeScope) return "FRESH";
  if (input.priorCompletion === null) return "FRESH";
  if (input.priorCompletion === "PENDING") return "FRESH";
  return "CARRY";
}
