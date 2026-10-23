import { describe, expect, it } from "vitest";
import { introNeedsMixedPlaysRule, playsAllowed } from "./listening-plays";

describe("playsAllowed", () => {
  it("uses the exam setting when the clip has no limit", () => {
    expect(playsAllowed(2, null)).toBe(2);
    expect(playsAllowed(3, undefined)).toBe(3);
  });
  it("lowers to the clip limit", () => {
    expect(playsAllowed(2, 1)).toBe(1);
    expect(playsAllowed(3, 2)).toBe(2);
  });
  it("never raises above the exam setting", () => {
    expect(playsAllowed(1, 3)).toBe(1);
    expect(playsAllowed(2, 3)).toBe(2);
  });
  it("never goes below 1", () => {
    expect(playsAllowed(2, 0)).toBe(1);
    expect(playsAllowed(0, null)).toBe(1);
    expect(playsAllowed(2, Number.NaN)).toBe(2);
  });
});

describe("introNeedsMixedPlaysRule", () => {
  it("applies only when a clip could play fewer times than the setting", () => {
    expect(introNeedsMixedPlaysRule(1)).toBe(false);
    expect(introNeedsMixedPlaysRule(2)).toBe(true);
    expect(introNeedsMixedPlaysRule(3)).toBe(true);
  });
});
