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

describe("0005_hiring_openings", () => {
  const sql = read("0005_hiring_openings");

  it.each([
    "hiring_openings",
    "hiring_opening_members",
    "hiring_versions",
    "hiring_stages",
    "hiring_activities",
    "hiring_activity_competencies",
    "hiring_weight_sets",
    "hiring_weights",
  ])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it.each([
    "hiring_opening_status",
    "hiring_version_status",
    "hiring_proctor_level",
    "hiring_activity_type",
    "hiring_stage_timeout",
    "hiring_member_role",
  ])("creates the enum %s", (name) => {
    expect(sql).toContain(`CREATE TYPE "public"."${name}"`);
  });

  it("adds the two hiring AI purposes in place, and no purpose that scores or ranks", () => {
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'HIRING_DRAFT';`);
    expect(sql).toContain(`ALTER TYPE "public"."ai_purpose" ADD VALUE 'QUESTION_CHECK';`);
    expect(sql).not.toMatch(/ADD VALUE '[A-Z_]*(SCOR|RANK|DECI|EMOTION|PERSONAL)[A-Z_]*'/);
  });

  it("keeps the database rules of spec 2.2", () => {
    expect(sql).toMatch(/CONSTRAINT "hiring_at_most_two_competencies" CHECK \("hiring_activity_competencies"\."order_index" IN \(0, 1\)\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_activity_competency_slot"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "one_draft_per_opening" ON "hiring_versions" USING btree \("opening_id"\) WHERE status = 'DRAFT'/);
    expect(sql).toMatch(/CONSTRAINT "hiring_published_has_scorecard"/);
  });

  it("pins the other unique indexes and CHECKs", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_version_number" ON "hiring_versions" USING btree \("opening_id","version_number"\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "one_active_weight_set" ON "hiring_weight_sets" USING btree \("version_id"\) WHERE is_active/);
    for (const name of [
      "hiring_min_evaluations",
      "hiring_feedback_days",
      "hiring_stage_duration",
      "hiring_activity_takes",
      "hiring_activity_think",
      "hiring_weight_percentage",
    ]) {
      expect(sql, name).toContain(`CONSTRAINT "${name}" CHECK`);
    }
  });

  it("restricts every foreign key that a frozen row or the library depends on", () => {
    const fk = (table: string, column: string, target: string) =>
      new RegExp(
        `ALTER TABLE "${table}" ADD CONSTRAINT "[a-z0-9_]+" FOREIGN KEY \\("${column}"\\) REFERENCES "public"\\."${target}"\\("id"\\) ON DELETE restrict`,
      );
    // Users are disabled, never deleted; a SET NULL on a published version would be an UPDATE the freeze trigger refuses.
    expect(sql).toMatch(fk("hiring_versions", "published_by", "users"));
    expect(sql).toMatch(fk("hiring_versions", "consent_text_id", "consent_texts"));
    expect(sql).toMatch(fk("hiring_openings", "position_id", "positions"));
    expect(sql).toMatch(fk("hiring_activity_competencies", "competency_id", "competencies"));
    expect(sql).toMatch(fk("hiring_weights", "competency_id", "competencies"));
    expect(sql).not.toMatch(/"published_by"\) REFERENCES[^;]*ON DELETE set null/);
  });

  it("only adds", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE)/);
  });
});
