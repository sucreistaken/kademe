import { describe, it, expect } from "vitest";
import { shouldTerminate, type TerminationEvent } from "./termination";
import { policyFromPreset } from "./policy";

const on = (screenShareGoneSeconds = 60, fullscreenExitMax = 3) => {
  const p = policyFromPreset("STRICT");
  p.termination = { enabled: true, screenShareGoneSeconds, fullscreenExitMax };
  return p;
};

const share = (startedAt: number, endedAt: number | null): TerminationEvent => ({
  type: "SCREEN_SHARE_STOPPED",
  startedAt,
  endedAt,
});
const exit = (startedAt: number): TerminationEvent => ({
  type: "FULLSCREEN_EXIT",
  startedAt,
  endedAt: startedAt + 1000,
});

describe("shouldTerminate", () => {
  it("never terminates when the policy has it disabled", () => {
    const p = policyFromPreset("STRICT");
    const events = [share(0, null), exit(1), exit(2), exit(3), exit(4), exit(5), exit(6)];
    expect(shouldTerminate(events, p, 10_000_000)).toEqual({ terminate: false, reason: null });
  });

  it("terminates on an open share gap older than the limit", () => {
    const events = [share(0, null)];
    expect(shouldTerminate(events, on(), 60_000).terminate).toBe(false);
    expect(shouldTerminate(events, on(), 60_001)).toEqual({
      terminate: true,
      reason: "SCREEN_SHARE_GONE",
    });
  });

  it("terminates on a closed share gap that lasted longer than the limit", () => {
    expect(shouldTerminate([share(0, 61_000)], on(), 500_000).reason).toBe("SCREEN_SHARE_GONE");
    expect(shouldTerminate([share(0, 30_000)], on(), 500_000).terminate).toBe(false);
  });

  it("does not add short share gaps together", () => {
    const events = [share(0, 40_000), share(100_000, 140_000)];
    expect(shouldTerminate(events, on(), 500_000).terminate).toBe(false);
  });

  it("terminates when fullscreen exits exceed the maximum", () => {
    const three = [exit(1), exit(2), exit(3)];
    expect(shouldTerminate(three, on(60, 3), 10).terminate).toBe(false);
    expect(shouldTerminate([...three, exit(4)], on(60, 3), 10)).toEqual({
      terminate: true,
      reason: "FULLSCREEN_EXITS",
    });
  });

  it("reports the share reason first when both apply", () => {
    const events = [share(0, null), exit(1), exit(2), exit(3), exit(4)];
    expect(shouldTerminate(events, on(60, 3), 120_000).reason).toBe("SCREEN_SHARE_GONE");
  });

  it("ignores model signals", () => {
    const events: TerminationEvent[] = [
      { type: "PHONE_DETECTED", startedAt: 0, endedAt: null },
      { type: "NO_FACE", startedAt: 0, endedAt: null },
    ];
    expect(shouldTerminate(events, on(), 10_000_000).terminate).toBe(false);
  });
});
