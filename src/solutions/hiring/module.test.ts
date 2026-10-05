import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAssetRow } from "@/solutions/types";

const s = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/db", () => ({ db: {} }));
const c = vi.hoisted(() => ({
  attachMedia: vi.fn<(asset: MediaAssetRow) => Promise<void>>(async () => undefined),
  salvageHiringUploads: vi.fn<(now?: Date, limit?: number) => Promise<{ scanned: number; salvaged: number; failed: number; skipped: number }>>(),
  closeExpiredStageRuns: vi.fn<(now?: Date, limit?: number) => Promise<{ scanned: number; closed: number }>>(),
}));
vi.mock("./server/candidate", () => c);

import { hiringModule } from "./module";

const ctx = {} as Parameters<typeof hiringModule.candidate.loadState>[0];

beforeEach(() => {
  s.calls = [];
  c.attachMedia.mockClear();
  c.salvageHiringUploads.mockReset().mockImplementation(async () => {
    s.calls.push("salvage");
    return { scanned: 0, salvaged: 0, failed: 0, skipped: 0 };
  });
  c.closeExpiredStageRuns.mockReset().mockImplementation(async () => {
    s.calls.push("close");
    return { scanned: 1, closed: 1 };
  });
});

describe("hiring module before the candidate flow exists", () => {
  it("adds nothing to Today yet and has no proctoring", async () => {
    expect(await hiringModule.today("o", "u", "tr")).toEqual([]);
    expect(await hiringModule.proctorPolicy("a")).toBeNull();
    expect(await hiringModule.attempts.openSegment("t")).toBeNull();
  });

  it("refuses every candidate call loudly instead of guessing", async () => {
    await expect(hiringModule.candidate.loadState(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.candidate.title(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.candidate.heartbeat(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.candidate.consentText(ctx)).rejects.toThrow(/not live/);
    await expect(hiringModule.attempts.terminate("t")).rejects.toThrow(/not live/);
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
});
