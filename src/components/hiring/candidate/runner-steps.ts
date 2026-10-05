import type { CandidateResponseView, HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";

/**
 * The stage runner's async steps without React, so the paths a lost answer or
 * a reload can take are unit tested (Task 13 review).
 */

const codeOf = (err: unknown) => (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "");

/**
 * Whether "Sonraki soru" / "Aşamayı bitir" still has to close the question.
 * In a stage without a way back a question the server shows closed cannot be
 * committed again (the server refuses with ACTIVITY_CLOSED): it was closed
 * already, by this tab, before a reload or a lost answer.
 */
export function commitNeeded(input: { responses: CandidateResponseView[]; activityId: string; backNavigation: boolean }): boolean {
  if (input.backNavigation) return true;
  return !input.responses.find((r) => r.activityId === input.activityId)?.closed;
}

export type CloseResult = { kind: "advanced"; next: HiringCandidateState } | { kind: "finished" };

/**
 * Closes the open question and, on the last one, the stage. ACTIVITY_CLOSED
 * on the last question means an earlier press already closed it (its answer
 * was lost on the way): the question is done, the stage submit follows.
 * `submit` deals with its own failure (the runner shows it with a retry).
 */
export async function closeQuestion(input: {
  last: boolean;
  skipCommit: boolean;
  commit: () => Promise<HiringCandidateState>;
  submit: () => Promise<void>;
}): Promise<CloseResult> {
  if (!input.skipCommit) {
    try {
      const next = await input.commit();
      if (!input.last) return { kind: "advanced", next };
    } catch (err) {
      if (!(input.last && codeOf(err) === "ACTIVITY_CLOSED")) throw err;
    }
  }
  await input.submit();
  return { kind: "finished" };
}

/** Refusals that mean this tab is behind the server, whatever stage it shows. */
const STALE = new Set(["STAGE_MISMATCH", "ACTIVITY_CLOSED", "ACTIVITY_ORDER", "NO_STAGE", "STAGE_EXPIRED", "STAGE_NOT_STARTED", "ACTIVITY_NOT_FOUND"]);

/**
 * What a refusal asks of the runner. "reload": the page is read again from
 * the server (a fresh runner from the fresh state; router.refresh() would keep
 * the old runner when the stage did not change). "show": say it and stay.
 */
export function recoveryFor(code: string): "reload" | "show" {
  return STALE.has(code) ? "reload" : "show";
}

/** A request that took longer than allowed; it carries no status, so the runner says its own words. */
export class RequestTimeout extends Error {
  readonly code = "TIMEOUT";
  constructor() {
    super("timeout");
  }
}

/** Minor 10: the runner's busy state never outlives a request that does not answer. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new RequestTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}
