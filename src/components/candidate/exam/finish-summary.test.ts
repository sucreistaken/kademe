import { describe, expect, it } from "vitest";
import { finishSummaryParts } from "./finish-summary";

describe("finishSummaryParts", () => {
  it("names all three kinds when each has questions, in a fixed order", () => {
    expect(finishSummaryParts({ empty: 3, partial: 2, flagged: 1 })).toEqual([
      { part: "empty", count: 3 },
      { part: "partial", count: 2 },
      { part: "flagged", count: 1 },
    ]);
  });

  it("leaves out the kinds that are zero", () => {
    expect(finishSummaryParts({ empty: 0, partial: 2, flagged: 0 })).toEqual([{ part: "partial", count: 2 }]);
    expect(finishSummaryParts({ empty: 4, partial: 0, flagged: 1 }).map((p) => p.part)).toEqual(["empty", "flagged"]);
  });

  it("returns nothing when every question is answered", () => {
    expect(finishSummaryParts({ empty: 0, partial: 0, flagged: 0 })).toEqual([]);
  });
});
