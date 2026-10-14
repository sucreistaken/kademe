import { describe, expect, it } from "vitest";
import { INITIAL_WARMUP, warmupReduce } from "./warmup-state";

describe("warm-up offer state", () => {
  it("starts with the offer", () => {
    expect(INITIAL_WARMUP).toEqual({ phase: "offer" });
  });

  it("Dene opens the first step, Geç hides the offer", () => {
    expect(warmupReduce(INITIAL_WARMUP, { type: "try" })).toEqual({ phase: "practice", step: 0 });
    expect(warmupReduce(INITIAL_WARMUP, { type: "skip" })).toEqual({ phase: "skipped" });
  });

  it("walks the steps and ends in done", () => {
    let s = warmupReduce(INITIAL_WARMUP, { type: "try" });
    s = warmupReduce(s, { type: "next", total: 2 });
    expect(s).toEqual({ phase: "practice", step: 1 });
    s = warmupReduce(s, { type: "next", total: 2 });
    expect(s).toEqual({ phase: "done" });
  });

  it("leaving ends the practice without the offer coming back", () => {
    const s = warmupReduce({ phase: "practice", step: 0 }, { type: "leave" });
    expect(s).toEqual({ phase: "skipped" });
    expect(warmupReduce(s, { type: "try" })).toEqual({ phase: "skipped" });
  });

  it("ignores actions that do not fit the phase", () => {
    expect(warmupReduce({ phase: "done" }, { type: "try" })).toEqual({ phase: "done" });
    expect(warmupReduce(INITIAL_WARMUP, { type: "next", total: 1 })).toEqual(INITIAL_WARMUP);
    expect(warmupReduce({ phase: "done" }, { type: "skip" })).toEqual({ phase: "done" });
  });
});
