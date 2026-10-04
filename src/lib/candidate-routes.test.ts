import { describe, expect, it } from "vitest";
import { nextPath } from "./candidate-routes";

describe("nextPath", () => {
  it("follows the page a solution's state names, relative to the token", () => {
    expect(nextPath("tok", { step: "STAGE", path: "/stage/2" })).toBe("/a/tok/stage/2");
    expect(nextPath("t k", { step: "CONSENT", path: "" })).toBe("/a/t%20k");
  });

  it("keeps the exam's own step mapping when the state names no path", () => {
    expect(nextPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(nextPath("tok", { step: "ITEM" })).toBe("/a/tok/exam");
  });
});
