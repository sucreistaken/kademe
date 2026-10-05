import { describe, expect, it, vi } from "vitest";
import type { CandidateResponseView } from "@/solutions/hiring/rules/candidate-state";
import { closeQuestion, commitNeeded, recoveryFor, RequestTimeout, settleWithin, withTimeout } from "./runner-steps";
import { resumeOf } from "./runner-model";

const refusal = (code: string, status = 409) => Object.assign(new Error(code), { code, status });
const response = (activityId: string, closed: boolean): CandidateResponseView => ({
  activityId,
  text: "",
  choiceIds: [],
  usedTextAlternative: false,
  takesUsed: 0,
  recording: null,
  file: null,
  answered: closed,
  closed,
});

describe("closing a question (review Critical: a closed last question is never committed again)", () => {
  it("(a) the last commit landed but its answer was lost: the next press finishes the stage instead of looping", async () => {
    const commit = vi.fn(async () => {
      throw refusal("ACTIVITY_CLOSED");
    });
    const submit = vi.fn(async () => undefined);
    // The tab still believes the question is open, so it commits; the server says it is closed already.
    await expect(closeQuestion({ last: true, skipCommit: false, commit, submit })).resolves.toEqual({ kind: "finished" });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("(b) the commit landed, the stage submit failed, the candidate reloads: no commit, only the submit", async () => {
    // After the reload the server's state says the last question is closed, and the runner opens on it.
    const responses = [response("q1", true), response("q2", true)];
    const index = resumeOf(responses).index;
    expect(index).toBe(1);
    const skipCommit = !commitNeeded({ responses, activityId: "q2", backNavigation: false });
    expect(skipCommit).toBe(true);
    const commit = vi.fn();
    const submit = vi.fn(async () => undefined);
    await expect(closeQuestion({ last: true, skipCommit, commit, submit })).resolves.toEqual({ kind: "finished" });
    expect(commit).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("commits an open question, and in a stage with a way back commits a closed one again (the server allows it)", () => {
    expect(commitNeeded({ responses: [response("q1", false)], activityId: "q1", backNavigation: false })).toBe(true);
    expect(commitNeeded({ responses: [response("q1", true)], activityId: "q1", backNavigation: true })).toBe(true);
    expect(commitNeeded({ responses: [], activityId: "q1", backNavigation: false })).toBe(true);
  });

  it("moves on after a commit of a question that is not the last, and never submits then", async () => {
    const next = { step: "STAGE" } as never;
    const submit = vi.fn();
    await expect(closeQuestion({ last: false, skipCommit: false, commit: async () => next, submit })).resolves.toEqual({ kind: "advanced", next });
    expect(submit).not.toHaveBeenCalled();
  });

  it("never submits the stage for a closed question that is not the last (fix round 2): it only moves on", async () => {
    const commit = vi.fn();
    const submit = vi.fn();
    await expect(closeQuestion({ last: false, skipCommit: true, commit, submit })).resolves.toEqual({ kind: "skipped" });
    expect(commit).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("passes on every other refusal, and ACTIVITY_CLOSED on a question that is not the last", async () => {
    const submit = vi.fn();
    await expect(closeQuestion({ last: true, skipCommit: false, commit: async () => Promise.reject(refusal("REQUIRED_MISSING", 422)), submit })).rejects.toMatchObject({ code: "REQUIRED_MISSING" });
    await expect(closeQuestion({ last: false, skipCommit: false, commit: async () => Promise.reject(refusal("ACTIVITY_CLOSED")), submit })).rejects.toMatchObject({ code: "ACTIVITY_CLOSED" });
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("a tab behind the server (review Important: the refresh must re-seed the runner)", () => {
  it("reloads the page for every refusal that means the tab is behind, the same stage included", () => {
    for (const code of ["ACTIVITY_CLOSED", "ACTIVITY_ORDER", "STAGE_NOT_STARTED", "ACTIVITY_NOT_FOUND", "STAGE_MISMATCH", "NO_STAGE", "STAGE_EXPIRED"]) {
      expect(recoveryFor(code), code).toBe("reload");
    }
    expect(recoveryFor("REQUIRED_MISSING")).toBe("show");
    expect(recoveryFor("")).toBe("show");
  });

  it("the fresh state a reload reads opens on the fresh question (another tab closed the first one)", () => {
    // The stale tab was on q1; the server has q1 closed by now.
    expect(resumeOf([response("q1", true), response("q2", false), response("q3", false)]).index).toBe(1);
  });
});

describe("a request that never answers (Minor 10)", () => {
  it("gives up after the limit, so the button is never stuck on 'Kaydediliyor'", async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise<string>(() => undefined);
      const timed = withTimeout(never, 20_000);
      const caught = timed.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(20_000);
      const err = await caught;
      expect(err).toBeInstanceOf(RequestTimeout);
      // No status: the runner shows its own words, never a browser's.
      expect((err as { status?: unknown }).status).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes an answer or a refusal through untouched", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(refusal("STAGE_MISMATCH")), 1000)).rejects.toMatchObject({ code: "STAGE_MISMATCH" });
  });
});

describe("a save that hangs before a close (fix round 2)", () => {
  it("stops waiting for the pending saves after the limit, so the commit (which carries its own answer) still goes", async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const waited = settleWithin(new Promise<void>(() => undefined), 5000).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(4999);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waited;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes on at once when the saves settle, and never rejects", async () => {
    await expect(settleWithin(Promise.resolve(), 5000)).resolves.toBeUndefined();
    await expect(settleWithin(Promise.reject(new Error("x")), 5000)).resolves.toBeUndefined();
  });
});
