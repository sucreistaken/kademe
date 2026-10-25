import { describe, expect, it } from "vitest";
import type { ResultLevel } from "../types";
import { BLIND_RATINGS, contestedFixtureIds } from "./blind-ratings";
import { CALIBRATION_FIXTURES } from "./fixtures";
import { levelDistance, meetsGoals, summarize, type FixtureResult, type RunOutcome } from "./metrics";

const run = (level: ResultLevel | null, over: Partial<RunOutcome> = {}): RunOutcome => ({
  status: level ? "PROPOSED" : "ERROR",
  level,
  overall: level,
  rawLevel: level,
  criteria: {},
  flags: [],
  rawFlags: [],
  ...over,
});

const fixture = (id: string, target: ResultLevel, taskLevel: FixtureResult["taskLevel"], runs: RunOutcome[], flags: FixtureResult["fixture"]["flags"] = { must: [] }): FixtureResult => ({
  fixture: { id, task: "t", kind: "LEVEL", target, flags },
  taskLevel,
  runs,
});

describe("levelDistance", () => {
  it("is signed: positive when the proposal is above the target", () => {
    expect(levelDistance("B2", "B1")).toBe(1);
    expect(levelDistance("A0", "A2")).toBe(-2);
    expect(levelDistance("B1", "B1")).toBe(0);
  });
});

describe("summarize", () => {
  const results: FixtureResult[] = [
    fixture("a", "B1", "B1", [run("B1"), run("B1"), run("B2")]),
    fixture("b", "A2", "A2", [run("B1"), run("B1"), run("B1")]),
    fixture("c", "A0", "A1", [run("A0"), run("A1"), run("A0")]),
    fixture("d", "C1", "C1", [run("A1"), run("A1"), run("A1")]),
  ];
  const s = summarize(results);

  it("counts exact agreement and agreement within one level over all runs", () => {
    // exact: a 2, b 0, c 2, d 0 of 12; within one: a 3, b 3, c 3, d 0 of 12.
    expect(s.exact).toBeCloseTo(4 / 12, 5);
    expect(s.withinOne).toBeCloseTo(9 / 12, 5);
    expect(s.runs).toBe(12);
  });

  it("gives the mean signed bias per target level", () => {
    expect(s.bias.B1).toEqual({ mean: 0.33, runs: 3 });
    expect(s.bias.A2).toEqual({ mean: 1, runs: 3 });
    expect(s.bias.C1).toEqual({ mean: -4, runs: 3 });
  });

  it("measures how often repeated runs disagree, pairwise and as all-equal fixtures", () => {
    // a: 1 of 3 pairs equal; b: 3 of 3; c: 1 of 3; d: 3 of 3.
    expect(s.pairwise).toBeCloseTo(8 / 12, 5);
    expect(s.unanimous).toBeCloseTo(2 / 4, 5);
  });

  it("lists A0 fixtures that were proposed above A0 in any run", () => {
    expect(s.a0Fixtures).toBe(1);
    expect(s.a0Misses).toEqual(["c"]);
  });

  it("lists the runs two or more levels away, and runs without a level", () => {
    expect(s.farMisses.map((m) => m.id)).toEqual(["d"]);
    const none = summarize([fixture("e", "B1", "B1", [run("B1"), run(null)])]);
    expect(none.farMisses.map((m) => m.id)).toEqual(["e"]);
    expect(none.errors).toBe(1);
    expect(none.graded).toBe(1);
    expect(none.exact).toBeCloseTo(0.5, 5);
  });

  it("counts proposals above the cap, final and raw", () => {
    const capped = summarize([fixture("f", "A2", "A1", [run("A2", { rawLevel: "B1" }), run("B1")])]);
    expect(capped.aboveCap).toBe(1);
    expect(capped.rawAboveCap).toBe(2);
  });

  it("computes flag precision and recall against must and may", () => {
    const flagged = summarize([
      fixture("g", "A0", "A1", [run("A0", { flags: ["NOT_GERMAN", "OFF_TOPIC"] }), run("A0", { flags: ["NOT_GERMAN", "TOO_SHORT"] })], { must: ["NOT_GERMAN"], may: ["OFF_TOPIC"] }),
      fixture("h", "B1", "B1", [run("B1", { flags: ["OFF_TOPIC"] }), run("B1")], { must: [] }),
      fixture("i", "B1", "B1", [run("B1"), run("B1", { flags: ["OFF_TOPIC"] })], { must: ["OFF_TOPIC"] }),
    ]);
    // NOT_GERMAN: 2 of 2 found. OFF_TOPIC: asked by i (1 found, 1 missed), allowed on g, one false positive on h.
    expect(flagged.flags.NOT_GERMAN).toMatchObject({ tp: 2, fp: 0, fn: 0, precision: 1, recall: 1 });
    expect(flagged.flags.OFF_TOPIC).toMatchObject({ tp: 1, fp: 1, fn: 1 });
    expect(flagged.flags.TOO_SHORT).toMatchObject({ tp: 0, fp: 1, fn: 0, precision: 0, recall: null });
  });

  it("counts the diagnostic flags and unparseable answers", () => {
    const d = summarize([fixture("j", "B1", "B1", [run("B1", { flags: ["LEVEL_CAPPED", "A0_RAISED"] }), run(null, { status: "UNPARSEABLE" })])]);
    expect(d.diagnostics).toEqual({ LEVEL_CAPPED: 1, A0_RAISED: 1, EVIDENCE_UNVERIFIED: 0 });
    expect(d.unparseable).toBe(1);
  });

  it("reports the agreement without the contested fixtures", () => {
    const calm = summarize(results, new Set(["a", "b", "c"]));
    expect(calm.uncontested?.fixtures).toBe(1);
    expect(calm.uncontested?.exact).toBe(0);
    expect(summarize(results).uncontested).toBeNull();
  });
});

describe("meetsGoals", () => {
  const good = summarize([fixture("a", "B1", "B1", [run("B1"), run("B1"), run("B1")])]);

  it("is met when every goal is", () => {
    expect(meetsGoals(good)).toEqual({ ok: true, misses: [] });
  });

  it("names each goal that is missed", () => {
    const bad = summarize([
      fixture("a", "B1", "B1", [run("B2"), run("B2"), run("B2")]),
      fixture("b", "A0", "A1", [run("A1"), run("A0"), run("A0")]),
      fixture("c", "A1", "A1", [run("A2", { rawLevel: "A2" }), run("A2"), run("A2")]),
    ]);
    const { ok, misses } = meetsGoals(bad);
    expect(ok).toBe(false);
    expect(misses.join(" ")).toContain("exact agreement below 70%");
    expect(misses.join(" ")).toContain("A0 fixture");
    const above = meetsGoals(summarize([fixture("d", "A2", "A1", [run("B1"), run("B1"), run("B1")])]));
    expect(above.misses.join(" ")).toContain("above the task cap");
    const noisy = meetsGoals(summarize([fixture("e", "B1", "B1", [run("B1"), run("B2"), run("A2")])]));
    expect(noisy.misses.join(" ")).toContain("repeated runs agree below 90%");
  });
});

describe("blind ratings", () => {
  it("exist for every fixture and for nothing else", () => {
    expect(Object.keys(BLIND_RATINGS).sort()).toEqual(CALIBRATION_FIXTURES.map((f) => f.id).sort());
  });

  it("agree with the targets on most fixtures and within one level on all but a few", () => {
    const targets = Object.fromEntries(CALIBRATION_FIXTURES.map((f) => [f.id, f.target]));
    const contested = contestedFixtureIds(targets);
    expect(contested.size).toBeLessThan(CALIBRATION_FIXTURES.length * 0.25);
    const far = CALIBRATION_FIXTURES.filter((f) => Math.abs(levelDistance(BLIND_RATINGS[f.id], f.target)) >= 2);
    // Only the off-topic text on the job application: the blind rater would not rate it at all (A0).
    expect(far.map((f) => f.id)).toEqual(["w-b1-markt/off-topic-fluent"]);
  });
});
