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

/** "skipped": a closed question that is not the last (no way back): the runner only moves on. */
export type CloseResult = { kind: "advanced"; next: HiringCandidateState } | { kind: "skipped" } | { kind: "finished" };

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
  /** Task 13 residual: the runner takes the committed state before the stage submit, so a failed submit shows the question closed. */
  onCommitted?: (next: HiringCandidateState) => void;
}): Promise<CloseResult> {
  // Fix round 2: only the last question's close may lead to the stage submit.
  if (input.skipCommit && !input.last) return { kind: "skipped" };
  if (!input.skipCommit) {
    try {
      const next = await input.commit();
      if (!input.last) return { kind: "advanced", next };
      input.onCommitted?.(next);
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

/**
 * Fix round 2: waits for `promise` (the pending autosaves) at most `ms`, and
 * never fails. A hung save cannot hold up a commit or a submit, which carry
 * their own answer anyway.
 */
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(id);
        resolve();
      },
      () => {
        clearTimeout(id);
        resolve();
      },
    );
  });
}

/**
 * Final wave A-M3: before the runner reloads the page (a stale stage at 0:00,
 * or the candidate's "Sayfayı yenile"), it waits while a take or an upload
 * still holds it (capture-hold), so a finishing upload is not cut; never
 * longer than `maxMs`, then it goes anyway. "free" when nothing held it (any
 * more), "timeout" when the bound ran out.
 */
export function afterCaptureFree(held: () => boolean, subscribe: (listener: () => void) => () => void, maxMs: number): Promise<"free" | "timeout"> {
  if (!held()) return Promise.resolve("free");
  return new Promise((resolve) => {
    let finished = false;
    let unsubscribe: () => void = () => undefined;
    const finish = (result: "free" | "timeout") => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const timer = setTimeout(() => finish("timeout"), maxMs);
    unsubscribe = subscribe(() => {
      if (!held()) finish("free");
    });
    // A release between the first look and the subscription is not missed.
    if (!held()) finish("free");
  });
}
