import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { stagePatchSchema } from "../rules/patches";
import { FROZEN_CONSTRAINT, frozenAsConflict, HiringConflict, HiringInvalid, HiringNotFound, isFrozenRefusal, parseOrInvalid } from "./errors";

/** The shape postgres.js gives a refused statement. */
const pgError = (code: string, constraint_name?: string) => Object.assign(new Error("refused"), { code, constraint_name });

describe("hiring errors", () => {
  it("carry a stable code the pages switch on", () => {
    expect(new HiringNotFound("stage")).toMatchObject({ code: "NOT_FOUND", what: "stage" });
    expect(new HiringConflict("NO_DRAFT")).toMatchObject({ code: "NO_DRAFT" });
  });

  it("a write refused by the freeze triggers is recognised, also when drizzle wraps it", () => {
    const raw = pgError("23514", FROZEN_CONSTRAINT);
    expect(isFrozenRefusal(raw)).toBe(true);
    expect(isFrozenRefusal(new DrizzleQueryError("insert into hiring_stages", [], raw))).toBe(true);
    expect(isFrozenRefusal(pgError("23514", "hiring_stage_duration"))).toBe(false);
    expect(isFrozenRefusal(pgError("23505", FROZEN_CONSTRAINT))).toBe(false);
    expect(isFrozenRefusal(new Error("x"))).toBe(false);
    expect(isFrozenRefusal(null)).toBe(false);
  });

  it("maps that refusal to NO_DRAFT and lets every other error through unchanged", async () => {
    await expect(frozenAsConflict(() => Promise.reject(new DrizzleQueryError("q", [], pgError("23514", FROZEN_CONSTRAINT))))).rejects.toMatchObject({
      name: "HiringConflict",
      code: "NO_DRAFT",
    });
    const other = pgError("23514", "hiring_stage_duration");
    await expect(frozenAsConflict(() => Promise.reject(other))).rejects.toBe(other);
    await expect(frozenAsConflict(async () => 7)).resolves.toBe(7);
  });

  it("turns a schema refusal into a typed INVALID error with the field paths", () => {
    expect(parseOrInvalid(stagePatchSchema, { durationSeconds: 600 })).toEqual({ durationSeconds: 600 });
    try {
      parseOrInvalid(stagePatchSchema, { durationSeconds: 30, name: { tr: 1 } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HiringInvalid);
      const invalid = error as HiringInvalid;
      expect(invalid.code).toBe("INVALID");
      expect(invalid.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["durationSeconds", "name.tr"]));
    }
  });
});
