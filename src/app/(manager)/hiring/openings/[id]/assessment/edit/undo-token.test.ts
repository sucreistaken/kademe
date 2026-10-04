import { describe, expect, it } from "vitest";
import { signUndo, verifyUndo } from "./undo-token";

const SECRET = "test-secret";
const base = { orgId: "o1", openingId: "op1", versionId: "v2", kind: "activity" as const, stageId: "s1", index: 2, payload: '{"a":1}' };

describe("undo tokens", () => {
  it("accepts exactly what the server handed out, within its lifetime", () => {
    const token = signUndo(base, { secret: SECRET, now: 1_000 });
    expect(verifyUndo(base, token, { secret: SECRET, now: 1_000 + 60_000 })).toBe(true);
  });

  it.each([
    ["a changed payload", { payload: '{"a":2}' }],
    ["another place", { index: 0 }],
    ["another stage", { stageId: "s2" }],
    ["another opening", { openingId: "op2" }],
    ["another draft version (v2's ticket in v3)", { versionId: "v3" }],
    ["another organisation", { orgId: "o2" }],
    ["the other kind", { kind: "stage" as const }],
  ])("refuses %s", (_label, change) => {
    const token = signUndo(base, { secret: SECRET, now: 1_000 });
    expect(verifyUndo({ ...base, ...change }, token, { secret: SECRET, now: 2_000 })).toBe(false);
  });

  it("refuses an expired token, a forged one and garbage", () => {
    const token = signUndo(base, { secret: SECRET, now: 1_000 });
    expect(verifyUndo(base, token, { secret: SECRET, now: 1_000 + 11 * 60_000 })).toBe(false);
    expect(verifyUndo(base, token, { secret: "other", now: 2_000 })).toBe(false);
    expect(verifyUndo(base, "", { secret: SECRET, now: 2_000 })).toBe(false);
    expect(verifyUndo(base, "abc.def", { secret: SECRET, now: 2_000 })).toBe(false);
    expect(verifyUndo(base, `${Number.MAX_SAFE_INTEGER}.${token.split(".")[1]}`, { secret: SECRET, now: 2_000 })).toBe(false);
  });
});
