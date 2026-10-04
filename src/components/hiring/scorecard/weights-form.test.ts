import { describe, expect, it } from "vitest";
import { readWeights } from "./weights-form";

/**
 * The weights form reads what is typed the way the rules will (Task 10
 * weightsProblem), so the disabled save states the same problem the server
 * would answer, and the total shown never contradicts the sentence.
 */
describe("readWeights", () => {
  const used = ["c1", "c2"];

  it("whole numbers adding up to 100 are ready to save", () => {
    expect(readWeights({ c1: "75", c2: "25" }, used)).toEqual({ weights: { c1: 75, c2: 25 }, total: 100, problem: null });
    expect(readWeights({ c1: " 100 ", c2: "0" }, used)).toEqual({ weights: { c1: 100, c2: 0 }, total: 100, problem: null });
  });

  it("states the gap of a wrong total", () => {
    expect(readWeights({ c1: "70", c2: "25" }, used).problem).toEqual({ code: "NOT_100", total: 95, gap: 5 });
    expect(readWeights({ c1: "70", c2: "40" }, used).problem).toEqual({ code: "NOT_100", total: 110, gap: 10 });
  });

  it("a measured competency without a weight (added after weights were saved) is MISSING, named, before any total", () => {
    const read = readWeights({ c1: "60", c2: "40" }, ["c1", "c2", "c3"]);
    expect(read.problem).toEqual({ code: "MISSING", competencyId: "c3" });
    expect(read.total).toBe(100);
    expect(readWeights({ c1: "", c2: "100" }, used).problem).toEqual({ code: "MISSING", competencyId: "c1" });
  });

  it("a value that is not a whole 0-100 is NOT_WHOLE, named, and left out of the total shown", () => {
    for (const bad of ["70.5", "-5", "101", "1e2", "abc", "0x10"]) {
      const read = readWeights({ c1: bad, c2: "30" }, used);
      expect(read.problem, bad).toEqual({ code: "NOT_WHOLE", competencyId: "c1" });
      expect(read.total, bad).toBe(30);
      expect(read.weights, bad).toEqual({ c2: 30 });
    }
  });

  it("only measured competencies count", () => {
    expect(readWeights({ c1: "100", gone: "50" }, ["c1"])).toEqual({ weights: { c1: 100 }, total: 100, problem: null });
  });
});
