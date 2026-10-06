import { describe, expect, it } from "vitest";
import { placementOf, sublevelOf } from "./placement";

describe("sublevelOf", () => {
  it("splits each band at its centre", () => {
    expect(sublevelOf(-2.9)).toBe("A1.1");
    expect(sublevelOf(-2.5)).toBe("A1.2");
    expect(sublevelOf(-2.01)).toBe("A1.2");
    expect(sublevelOf(-2)).toBe("A2.1");
    expect(sublevelOf(-1.51)).toBe("A2.1");
    expect(sublevelOf(-1.5)).toBe("A2.2");
    expect(sublevelOf(-1)).toBe("B1.1");
    expect(sublevelOf(-0.2)).toBe("B1.2");
    expect(sublevelOf(0)).toBe("B2.1");
    expect(sublevelOf(0.99)).toBe("B2.2");
    expect(sublevelOf(1)).toBe("C1.1");
    expect(sublevelOf(1.5)).toBe("C1.2");
  });

  it("floors below the scale at A1.1", () => {
    expect(sublevelOf(-5)).toBe("A1.1");
  });

  it("does not split C2", () => {
    expect(sublevelOf(2)).toBe("C2");
    expect(sublevelOf(2.4)).toBe("C2");
    expect(sublevelOf(4)).toBe("C2");
  });
});

describe("placementOf", () => {
  it("is null without an objective posterior", () => {
    expect(placementOf(null, [])).toBe(null);
  });

  it("is clear away from the cuts with a tight posterior", () => {
    expect(placementOf({ mean: -0.6, sd: 0.4 }, [])).toEqual({
      sublevel: "B1.1",
      borderline: false,
      reasons: [],
      recommended: null,
    });
  });

  it("flags a mean within 0.25 of a cut and recommends the lower level", () => {
    const below = placementOf({ mean: -0.2, sd: 0.4 }, [])!;
    expect(below.borderline).toBe(true);
    expect(below.reasons).toEqual(["NEAR_CUT"]);
    expect(below.recommended).toBe("B1");
    const above = placementOf({ mean: 0.2, sd: 0.4 }, [])!;
    expect(above.sublevel).toBe("B2.1");
    expect(above.reasons).toEqual(["NEAR_CUT"]);
    expect(above.recommended).toBe("B1");
  });

  it("does not flag a mean 0.3 from the nearest cut", () => {
    expect(placementOf({ mean: 0.3, sd: 0.4 }, [])!.borderline).toBe(false);
    expect(placementOf({ mean: -0.3, sd: 0.4 }, [])!.borderline).toBe(false);
  });

  it("flags a wide posterior", () => {
    const lowerHalf = placementOf({ mean: 0.3, sd: 0.65 }, [])!;
    expect(lowerHalf.reasons).toEqual(["HIGH_UNCERTAINTY"]);
    expect(lowerHalf.recommended).toBe("B1");
    const upperHalf = placementOf({ mean: 0.7, sd: 0.65 }, [])!;
    expect(upperHalf.recommended).toBe("B2");
    expect(placementOf({ mean: 0.7, sd: 0.6 }, [])!.borderline).toBe(false);
  });

  it("flags a productive skill a band or more away and recommends the lower of the two", () => {
    const lower = placementOf({ mean: 0.5, sd: 0.4 }, [{ section: "SPEAKING", level: "B1" }])!;
    expect(lower.borderline).toBe(true);
    expect(lower.reasons).toEqual(["PRODUCTIVE_GAP:SPEAKING"]);
    expect(lower.recommended).toBe("B1");
    const higher = placementOf({ mean: 0.5, sd: 0.4 }, [{ section: "WRITING", level: "C1" }])!;
    expect(higher.reasons).toEqual(["PRODUCTIVE_GAP:WRITING"]);
    expect(higher.recommended).toBe("B2");
    expect(placementOf({ mean: 0.5, sd: 0.4 }, [{ section: "WRITING", level: "B2" }])!.borderline).toBe(false);
  });

  it("lists every trigger and takes the lowest candidate", () => {
    const p = placementOf({ mean: 0.1, sd: 0.7 }, [
      { section: "WRITING", level: "A2" },
      { section: "SPEAKING", level: "B2" },
    ])!;
    expect(p.reasons).toEqual(["NEAR_CUT", "HIGH_UNCERTAINTY", "PRODUCTIVE_GAP:WRITING"]);
    expect(p.recommended).toBe("A2");
  });

  it("uses the C1/C2 cut near the top and leaves C2 unsplit", () => {
    const p = placementOf({ mean: 2.1, sd: 0.4 }, [])!;
    expect(p.sublevel).toBe("C2");
    expect(p.recommended).toBe("C1");
  });
});
