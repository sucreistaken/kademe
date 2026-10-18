import { describe, expect, it } from "vitest";
import { edgeFadeMask, nextButtonKind, overflowEdges, partCounter } from "./exam-bar";

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

describe("overflowEdges", () => {
  it("shows no fade when everything fits", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }, false)).toEqual({ left: false, right: false });
  });

  it("fades the far edge at the start and the near edge at the end (left to right)", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: false, right: true });
    expect(overflowEdges({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: true, right: true });
    expect(overflowEdges({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: true, right: false });
  });

  it("mirrors the edges for right-to-left (negative scroll offsets)", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 }, true)).toEqual({ left: true, right: false });
    expect(overflowEdges({ scrollLeft: -300, scrollWidth: 600, clientWidth: 300 }, true)).toEqual({ left: false, right: true });
  });
});

describe("edgeFadeMask", () => {
  it("is absent without overflow and fades only the hidden edges", () => {
    expect(edgeFadeMask({ left: false, right: false })).toBeUndefined();
    expect(edgeFadeMask({ left: false, right: true })?.maskImage).toBe("linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)");
    expect(edgeFadeMask({ left: true, right: false })?.maskImage).toBe("linear-gradient(to right, transparent 0, #000 20px, #000 100%)");
  });
});
