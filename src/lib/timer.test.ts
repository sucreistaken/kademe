import { describe, it, expect } from "vitest";
import {
  computeDeadline,
  remainingMs,
  acceptsWrite,
  isLate,
  videoPhase,
  isMediaOverlong,
  formatCountdown,
  SUBMIT_SLACK_MS,
} from "./timer";

const t0 = new Date("2026-09-08T10:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("stage deadline", () => {
  it("is start plus duration plus grace", () => {
    expect(computeDeadline(t0, 300, 30).toISOString()).toBe(
      "2026-09-08T10:05:30.000Z",
    );
  });

  it("does not move when the page is refreshed", () => {
    // A refresh re-reads the stored startedAt, it never recomputes from "now".
    const deadline = computeDeadline(t0, 300, 0);
    const afterRefresh = computeDeadline(t0, 300, 0);
    expect(afterRefresh.getTime()).toBe(deadline.getTime());
  });

  it("counts wall time, so a closed tab buys nothing", () => {
    const deadline = computeDeadline(t0, 300, 0);
    // Candidate leaves for four minutes and comes back.
    expect(remainingMs(deadline, at(240_000))).toBe(60_000);
  });

  it("never reports negative time", () => {
    const deadline = computeDeadline(t0, 60, 0);
    expect(remainingMs(deadline, at(999_000))).toBe(0);
  });
});

describe("write acceptance", () => {
  const deadline = computeDeadline(t0, 60, 0);

  it("accepts a submit that arrives within the latency slack", () => {
    expect(acceptsWrite(deadline, "AUTO_SUBMIT", at(60_000 + 4_000))).toBe(true);
  });

  it("rejects a write after the slack has passed", () => {
    expect(
      acceptsWrite(deadline, "AUTO_SUBMIT", at(60_000 + SUBMIT_SLACK_MS + 1)),
    ).toBe(false);
  });

  it("keeps accepting under ALLOW_LATE but flags it", () => {
    const now = at(600_000);
    expect(acceptsWrite(deadline, "ALLOW_LATE", now)).toBe(true);
    expect(isLate(deadline, now)).toBe(true);
  });
});

describe("video phases", () => {
  it("thinks first, then records, then stops", () => {
    expect(videoPhase(t0, 30, 180, at(0))).toBe("THINKING");
    expect(videoPhase(t0, 30, 180, at(29_000))).toBe("THINKING");
    expect(videoPhase(t0, 30, 180, at(31_000))).toBe("RECORDING");
    expect(videoPhase(t0, 30, 180, at(30_000 + 180_000 + 1))).toBe("DONE");
  });

  it("lets the candidate skip the thinking time", () => {
    const early = at(5_000);
    expect(videoPhase(t0, 30, 180, at(6_000), early)).toBe("RECORDING");
  });

  it("rejects a recording longer than the allowed answer time", () => {
    expect(isMediaOverlong(180_000, 180)).toBe(false);
    // 10 percent absorbs encoder overshoot, beyond that it is refused.
    expect(isMediaOverlong(197_000, 180)).toBe(false);
    expect(isMediaOverlong(220_000, 180)).toBe(true);
  });
});

describe("countdown formatting", () => {
  it("pads seconds so the layout never shifts", () => {
    expect(formatCountdown(127_000)).toBe("2:07");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
