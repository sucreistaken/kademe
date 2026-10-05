import { describe, expect, it } from "vitest";
import type { OpeningFunnel } from "@/solutions/hiring/server/invitations";
import { funnelView } from "./funnel";

const base: OpeningFunnel = { invited: 12, started: 9, completed: 7, medianMinutes: 34, estimateMinutes: 30, survey: { count: 0, average: null, comments: [] } };

describe("the overview's funnel (HIRING-UX 5.4)", () => {
  it("is nothing before the first invitation", () => {
    expect(funnelView({ ...base, invited: 0 }, true)).toBeNull();
  });

  it("counts invited, started, completed and compares the median time with the estimate", () => {
    const view = funnelView(base, true)!;
    expect(view.steps).toEqual([
      { key: "invited", count: 12 },
      { key: "started", count: 9 },
      { key: "completed", count: 7 },
    ]);
    expect(view.time).toEqual({ median: 34, estimate: 30, over: false });
    expect(funnelView({ ...base, medianMinutes: 40 }, true)!.time).toEqual({ median: 40, estimate: 30, over: true });
    expect(funnelView({ ...base, estimateMinutes: null }, true)!.time).toEqual({ median: 34, estimate: null, over: false });
    expect(funnelView({ ...base, medianMinutes: null }, true)!.time).toBeNull();
  });

  // Task 19 ruling 1: the experience carries only the average, the count and unnamed comments as plain text.
  it("shows the experience only from five answers, and says it is off when the survey is off", () => {
    // Fix round 1, I1: no live count while waiting; the next answer must not show up anywhere.
    expect(funnelView(base, true)!.experience).toEqual({ kind: "waiting", needed: 5 });
    const shown = funnelView({ ...base, survey: { count: 6, average: 4.3, comments: ["Net"] } }, true)!;
    expect(shown.experience).toEqual({ kind: "shown", average: 4.3, count: 6, comments: ["Net"] });
    expect(funnelView(base, false)!.experience).toEqual({ kind: "off" });
    // Answers gathered before the survey was switched off still show once there are five.
    expect(funnelView({ ...base, survey: { count: 5, average: 4, comments: [] } }, false)!.experience).toEqual({ kind: "shown", average: 4, count: 5, comments: [] });
  });
});
