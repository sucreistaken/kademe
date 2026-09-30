import type { TimeoutBehaviour } from "./timer";

/** The answer shape these helpers inspect. Kept local; the exam stores `ItemAnswer`. */
type ResponsePayload = { text?: string; choiceIds?: string[]; mediaAssetId?: string; fileAssetIds?: string[] };

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

/**
 * The SQL predicate in `closeExpiredRuns()` spelled out as a function, so the
 * rule it encodes can be tested without Postgres. The two have to agree.
 *
 * ALLOW_LATE runs are not due: `decideClose()` would only leave them open, and
 * a query that keeps returning them fills the batch with rows nothing will ever
 * settle, until fifty abandoned late-allowed runs starve every other stage.
 */
export function isDueForClose(
  run: {
    behaviour: TimeoutBehaviour;
    completion: "PENDING" | "COMPLETE" | "PARTIAL" | "SKIPPED" | "EXPIRED";
    submittedAt: Date | null;
    deadlineAt: Date | null;
  },
  now: Date,
): boolean {
  if (run.behaviour === "ALLOW_LATE") return false;
  if (run.completion !== "PENDING") return false;
  if (run.submittedAt !== null) return false;
  if (run.deadlineAt === null) return false;
  return run.deadlineAt.getTime() < now.getTime();
}

/**
 * An upload has to be at least this old before the sweep considers it
 * abandoned. A recording in progress is minutes old; the browser that started
 * one half an hour ago and never completed it is not coming back.
 */
export const SALVAGE_MIN_AGE_MS = 30 * 60 * 1000;

/**
 * A heartbeat inside this window means the candidate's tab is alive (it beats
 * every 15 seconds), so the browser will finish or fail the upload itself and
 * the server must keep its hands off.
 */
export const SALVAGE_QUIET_MS = 5 * 60 * 1000;

export type SalvageDecision =
  | { action: "SALVAGE" }
  | { action: "SKIP"; reason: string };

/**
 * Whether the server should finalise an UPLOADING media asset on the browser's
 * behalf. Pure, and deliberately conservative: salvaging too early turns a
 * live recording into a truncated one, while salvaging too late only delays a
 * clip nobody was going to see anyway.
 */
export function decideSalvage(
  input: {
    assetCreatedAt: Date;
    /** Null when the asset is not attached to any stage run. */
    run: {
      completion: "PENDING" | "COMPLETE" | "PARTIAL" | "SKIPPED" | "EXPIRED";
      deadlineAt: Date | null;
      lastHeartbeatAt: Date | null;
    } | null;
  },
  now: Date,
): SalvageDecision {
  const age = now.getTime() - input.assetCreatedAt.getTime();
  if (age < SALVAGE_MIN_AGE_MS) {
    return { action: "SKIP", reason: "upload is too recent to call abandoned" };
  }

  // No run at all: nothing will ever complete this upload, so the age alone
  // is enough.
  if (!input.run) return { action: "SALVAGE" };

  const { run } = input;
  if (
    run.lastHeartbeatAt &&
    now.getTime() - run.lastHeartbeatAt.getTime() < SALVAGE_QUIET_MS
  ) {
    return { action: "SKIP", reason: "candidate tab is still alive" };
  }

  if (run.completion !== "PENDING") return { action: "SALVAGE" };
  if (run.deadlineAt && run.deadlineAt.getTime() < now.getTime()) {
    return { action: "SALVAGE" };
  }
  return { action: "SKIP", reason: "stage run is still open and in time" };
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
