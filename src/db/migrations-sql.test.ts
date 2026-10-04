import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "./migration-files";

/**
 * Migrations that move data are written by hand. These checks keep the parts
 * that protect existing rows from being lost in a later "regenerate".
 */
const read = (tag: string) => readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

describe("0001_platform_expand", () => {
  const sql = read("0001_platform_expand");
  const at = (needle: string) => {
    const i = sql.indexOf(needle);
    expect(i, needle).toBeGreaterThanOrEqual(0);
    return i;
  };

  it("copies the exam terms before anything else changes", () => {
    expect(at('INSERT INTO "exam_assessments"')).toBeLessThan(
      at('ALTER TABLE "assessments" DROP CONSTRAINT "claimed_for_verification"'),
    );
  });

  it.each([
    [
      'ALTER TABLE "assessments" ADD COLUMN "solution" "solution";',
      `UPDATE "assessments" SET "solution" = 'LANGUAGE_EXAM';`,
      'ALTER TABLE "assessments" ALTER COLUMN "solution" SET NOT NULL;',
    ],
    [
      'ALTER TABLE "attempts" ADD COLUMN "solution" "solution";',
      'UPDATE "attempts" AS t SET "solution" = a."solution"',
      'ALTER TABLE "attempts" ALTER COLUMN "solution" SET NOT NULL;',
    ],
    [
      'ALTER TABLE "media_assets" ADD COLUMN "attempt_id" uuid;',
      'UPDATE "media_assets" AS m SET "attempt_id" = r."attempt_id"',
      'ALTER TABLE "media_assets" ALTER COLUMN "attempt_id" SET NOT NULL;',
    ],
  ])("adds %s nullable, backfills, then requires it", (add, fill, require) => {
    expect(at(add)).toBeLessThan(at(fill));
    expect(at(fill)).toBeLessThan(at(require));
  });

  it("never adds a required column in one step", () => {
    expect(sql).not.toMatch(/ADD COLUMN "(solution|attempt_id)" [^;]*NOT NULL/);
  });

  it("stops instead of guessing when a recording has no attempt", () => {
    expect(sql).toContain("RAISE EXCEPTION");
  });

  it("carries the proctoring segment over", () => {
    expect(sql).toContain(`SET "segment_kind" = 'section_run', "segment_run_id" = "section_run_id"`);
  });

  it("keeps one attempt per exam invitation in the database", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "one_attempt_per_exam_assessment" ON "attempts" USING btree \("assessment_id"\) WHERE solution = 'LANGUAGE_EXAM'/,
    );
    expect(sql).toMatch(/CREATE UNIQUE INDEX "attempt_number_per_assessment"/);
  });

  it("drops no table and no column", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN)/);
  });
});
