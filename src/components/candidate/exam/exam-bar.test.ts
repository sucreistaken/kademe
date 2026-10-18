import { describe, expect, it } from "vitest";
import { nextButtonKind, partCounter } from "./exam-bar";

describe("nextButtonKind", () => {
  it("says next while a page follows and finish on the last one", () => {
    expect(nextButtonKind(5)).toBe("next");
    expect(nextButtonKind(0)).toBe("next");
    expect(nextButtonKind(null)).toBe("finish");
  });
});

describe("partCounter", () => {
  it("counts a question of several parts", () => {
    expect(partCounter({ filled: 1, total: 4 })).toEqual({ filled: 1, total: 4 });
    expect(partCounter({ filled: 0, total: 3 })).toEqual({ filled: 0, total: 3 });
    expect(partCounter({ filled: 4, total: 4 })).toEqual({ filled: 4, total: 4 });
  });

  it("stays out of the way for a single-part or unknown question", () => {
    expect(partCounter({ filled: 1, total: 1 })).toBeNull();
    expect(partCounter({ filled: 0, total: 0 })).toBeNull();
    expect(partCounter(undefined)).toBeNull();
    expect(partCounter(null)).toBeNull();
  });

  it("keeps the numbers inside the range", () => {
    expect(partCounter({ filled: 9, total: 4 })).toEqual({ filled: 4, total: 4 });
    expect(partCounter({ filled: -1, total: 4 })).toEqual({ filled: 0, total: 4 });
  });
});
