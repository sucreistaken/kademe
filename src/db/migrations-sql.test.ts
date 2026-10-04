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

describe("0002_manager_role", () => {
  const sql = read("0002_manager_role");
  it("renames the value in place instead of recreating the enum", () => {
    expect(sql).toContain(`ALTER TYPE "public"."user_role" RENAME VALUE 'TEACHER' TO 'MANAGER';`);
    expect(sql).not.toMatch(/DROP TYPE/);
    expect(sql).not.toMatch(/SET DATA TYPE/);
  });
});

describe("0003_platform_contract", () => {
  const sql = read("0003_platform_contract");
  it("drops exactly the columns that moved, and nothing else", () => {
    const drops = [...sql.matchAll(/ALTER TABLE "(\w+)" DROP COLUMN "(\w+)"/g)].map((m) => `${m[1]}.${m[2]}`).sort();
    expect(drops).toEqual([
      "assessments.blueprint_id",
      "assessments.blueprint_name",
      "assessments.blueprint_snapshot",
      "assessments.claimed_level",
      "assessments.mode",
      "proctor_events.section_run_id",
    ]);
    expect(sql).not.toMatch(/DROP TABLE/);
  });
});

describe("0004_library", () => {
  const sql = read("0004_library");

  it.each([
    "rating_scales",
    "scale_levels",
    "competencies",
    "competency_anchors",
    "observation_tags",
    "positions",
    "position_competencies",
  ])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it("adds the AI purpose in place instead of recreating the enum", () => {
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'ANCHOR_DRAFT';`);
    expect(sql).not.toMatch(/DROP TYPE/);
  });

  it("only adds: no table, column or type is dropped", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE)/);
  });

  it("keeps one default scale per organisation in the database", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "one_default_scale_per_org" ON "rating_scales" USING btree \("org_id"\) WHERE is_default/);
  });
});
