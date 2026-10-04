import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { hiringModule } from "./module";

const ctx = {} as Parameters<typeof hiringModule.candidate.loadState>[0];

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
