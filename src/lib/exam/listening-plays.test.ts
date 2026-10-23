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
  it("shows for placement, whose levels reach B2 and above", () => {
    expect(introNeedsMixedPlaysRule(2, "PLACEMENT", null)).toBe(true);
    expect(introNeedsMixedPlaysRule(3, "PLACEMENT", "A1")).toBe(true);
  });
  it("stays off when the section only draws A1-B1 clips", () => {
    expect(introNeedsMixedPlaysRule(2, "LEVEL_VERIFICATION", "A2")).toBe(false);
    expect(introNeedsMixedPlaysRule(2, "LEVEL_VERIFICATION", "A1")).toBe(false);
  });
  it("shows when the claimed level reaches B2", () => {
    expect(introNeedsMixedPlaysRule(2, "LEVEL_VERIFICATION", "B2")).toBe(true);
    expect(introNeedsMixedPlaysRule(2, "LEVEL_VERIFICATION", "B1")).toBe(true);
  });
  it("stays off when the exam setting is 1", () => {
    expect(introNeedsMixedPlaysRule(1, "PLACEMENT", null)).toBe(false);
    expect(introNeedsMixedPlaysRule(1, "LEVEL_VERIFICATION", "C1")).toBe(false);
  });
});
