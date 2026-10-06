import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateContext } from "@/lib/candidate-context";
import type { MediaAssetRow } from "@/solutions/types";

const s = vi.hoisted(() => ({
  calls: [] as string[],
  hctx: { assessment: { id: "a", orgId: "o", solution: "HIRING" }, hiring: { consentTextId: "ct-frozen" } },
}));

vi.mock("@/db", () => ({ db: {} }));
const c = vi.hoisted(() => ({
  loadHiringContext: async (ctx: { assessment: { id: string } }) => (ctx.assessment.id === "a" ? s.hctx : null),
  hiringServes: vi.fn<(ctx: CandidateContext) => Promise<boolean>>(async () => true),
  loadHiringState: async () => ({ step: "CONSENT" }),
  hiringTitle: async () => "Ürün Tasarımcısı · Ekim",
  stageHeartbeat: vi.fn<(h: unknown) => Promise<{ deadlineAt: Date | null }>>(async () => ({ deadlineAt: null })),
  runningSegment: async () => ({ kind: "stage_run", runId: "r" }),
  attachMedia: vi.fn<(asset: MediaAssetRow) => Promise<void>>(async () => undefined),
  salvageHiringUploads: vi.fn<(now?: Date, limit?: number) => Promise<{ scanned: number; salvaged: number; failed: number; skipped: number }>>(),
  closeExpiredStageRuns: vi.fn<(now?: Date, limit?: number) => Promise<{ scanned: number; closed: number }>>(),
}));
vi.mock("./server/candidate", () => c);
vi.mock("./server/consent", () => ({ loadConsentText: async (orgId: string, id: string) => ({ id, orgId }) }));
const t = vi.hoisted(() => ({ hiringToday: vi.fn(async () => [{ id: "row" }]) }));
vi.mock("./server/today", () => t);

import { hiringModule } from "./module";

const ctx = (id: string) => ({ assessment: { id, orgId: "o", solution: "HIRING" } }) as Parameters<typeof hiringModule.candidate.loadState>[0];

beforeEach(() => {
  s.calls = [];
  c.attachMedia.mockClear();
  c.hiringServes.mockClear();
  c.salvageHiringUploads.mockReset().mockImplementation(async () => {
    s.calls.push("salvage");
    return { scanned: 0, salvaged: 0, failed: 0, skipped: 0 };
  });
  c.closeExpiredStageRuns.mockReset().mockImplementation(async () => {
    s.calls.push("close");
    return { scanned: 1, closed: 1 };
  });
});

describe("the hiring module (plan 2)", () => {
  it("gives Today hiring's own rows and has no proctoring (plan 4)", async () => {
    expect(await hiringModule.today("o", "u", "tr")).toEqual([{ id: "row" }]);
    expect(t.hiringToday).toHaveBeenCalledWith("o", "u", "tr");
    expect(await hiringModule.proctorPolicy("a")).toBeNull();
  });

  it("answers the core from the invitation's hiring terms", async () => {
    expect(await hiringModule.candidate.loadState(ctx("a"))).toEqual({ step: "CONSENT" });
    expect(await hiringModule.candidate.title(ctx("a"))).toBe("Ürün Tasarımcısı · Ekim");
    expect(await hiringModule.candidate.consentText(ctx("a"))).toEqual({ id: "ct-frozen", orgId: "o" });
    expect(await hiringModule.attempts.openSegment("t")).toEqual({ kind: "stage_run", runId: "r" });
  });

  it("tells the core which invitations it serves through hiringServes (spec 6, C6)", async () => {
    expect(await hiringModule.candidate.serves!(ctx("a"))).toBe(true);
    expect(c.hiringServes.mock.calls[0][0]).toEqual(ctx("a"));
  });

  it("maps a bare hiring step to its page for core callers", () => {
    expect(hiringModule.candidateStepPath("tok", { step: "CONSENT" })).toBe("/a/tok");
    expect(hiringModule.candidateStepPath("tok", { step: "INFO" })).toBe("/a/tok/info");
    expect(hiringModule.candidateStepPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(hiringModule.candidateStepPath("tok", { step: "STAGE", position: 2 })).toBe("/a/tok/stage/2");
    expect(hiringModule.candidateStepPath("tok", { step: "STAGE" })).toBe("/a/tok/stage/1");
    expect(hiringModule.candidateStepPath("tok", { step: "DONE" })).toBe("/a/tok/done");
    expect(hiringModule.candidateStepPath("tok", { step: "CLOSED" })).toBe("/a/tok");
  });

  it("refuses loudly for an invitation without hiring terms instead of guessing", async () => {
    await expect(hiringModule.candidate.loadState(ctx("other"))).rejects.toThrow(/no hiring terms/);
  });

  it("refuses loudly on every path that needs the hiring terms (requireHiring), writing no heartbeat", async () => {
    c.stageHeartbeat.mockClear();
    await expect(hiringModule.candidate.title(ctx("other"))).rejects.toThrow("assessment other has no hiring terms");
    await expect(hiringModule.candidate.heartbeat(ctx("other"))).rejects.toThrow("assessment other has no hiring terms");
    await expect(hiringModule.candidate.consentText(ctx("other"))).rejects.toThrow("assessment other has no hiring terms");
    expect(c.stageHeartbeat).not.toHaveBeenCalled();
  });

  it("anchors the clock through the running stage of the invitation's own hiring terms (heartbeat)", async () => {
    const deadlineAt = new Date("2026-10-05T09:10:00Z");
    c.stageHeartbeat.mockClear().mockResolvedValueOnce({ deadlineAt });
    expect(await hiringModule.candidate.heartbeat(ctx("a"))).toEqual({ deadlineAt });
    expect(c.stageHeartbeat).toHaveBeenCalledTimes(1);
    expect(c.stageHeartbeat.mock.calls[0][0]).toBe(s.hctx);
  });

  it("never terminates an attempt (HIRING-UX R13) and salvages before it closes", async () => {
    await expect(hiringModule.attempts.terminate("t")).resolves.toBeUndefined();
    expect(await hiringModule.attempts.closeExpired!(new Date(), 10)).toEqual({ scanned: 1, closed: 1 });
    expect(s.calls).toEqual(["salvage", "close"]);
  });
});

describe("hiring's cron sweep and media hook (Task 8)", () => {
  it("salvages abandoned uploads first, then closes the stage runs whose clock ran out, with the cron's time and batch", async () => {
    const now = new Date("2026-10-05T09:00:00Z");
    expect(await hiringModule.attempts.closeExpired!(now, 50)).toEqual({ scanned: 1, closed: 1 });
    expect(s.calls).toEqual(["salvage", "close"]);
    expect(c.salvageHiringUploads.mock.calls[0][0]).toBe(now);
    expect(c.closeExpiredStageRuns.mock.calls[0]).toEqual([now, 50]);
  });

  it("still closes runs when the salvage throws (a storage outage cannot keep stages open)", async () => {
    c.salvageHiringUploads.mockReset().mockRejectedValueOnce(new Error("storage down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await hiringModule.attempts.closeExpired!(new Date(), 50)).toEqual({ scanned: 1, closed: 1 });
    expect(c.closeExpiredStageRuns).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it("attaches a finished recording or file to the candidate's answer", async () => {
    const asset = { id: "m1" } as MediaAssetRow;
    await hiringModule.attempts.onMediaComplete(asset);
    expect(c.attachMedia.mock.calls[0][0]).toBe(asset);
  });

  it("decides the answer again when an upload fails for good", async () => {
    const asset = { id: "m2", status: "FAILED" } as MediaAssetRow;
    await hiringModule.attempts.onMediaFailed!(asset);
    expect(c.attachMedia.mock.calls[0][0]).toBe(asset);
  });
});
