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

describe("0006_hiring_immutability", () => {
  const sql = read("0006_hiring_immutability");

  it.each([
    ["hiring_versions", "BEFORE UPDATE OR DELETE"],
    ["hiring_stages", "BEFORE INSERT OR UPDATE OR DELETE"],
    ["hiring_activities", "BEFORE INSERT OR UPDATE OR DELETE"],
    ["hiring_activity_competencies", "BEFORE INSERT OR UPDATE OR DELETE"],
  ])("guards %s", (table, when) => {
    expect(sql).toMatch(new RegExp(`CREATE TRIGGER \\w+ ${when} ON "${table}" FOR EACH ROW`));
  });

  it("refuses with a check violation, never by silently skipping the row", () => {
    expect(sql).toContain("ERRCODE = '23514'");
    expect(sql).not.toMatch(/RETURN NULL/);
  });

  it("checks both the old and the new parent, so rows cannot be moved into a published version", () => {
    expect(sql.match(/TG_OP <> 'INSERT'/g)?.length).toBe(3);
    expect(sql.match(/TG_OP <> 'DELETE'/g)?.length).toBe(3);
  });

  it("leaves weight sets writable after publishing", () => {
    expect(sql).not.toMatch(/ON "hiring_weight/);
  });

  it("sends one statement per chunk (the migrator prepares each chunk)", () => {
    for (const chunk of sql.split("--> statement-breakpoint")) {
      const outside = chunk.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/--.*$/gm, "");
      expect((outside.match(/;/g) ?? []).length, chunk.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });
});

describe("0007_hiring_schema_guards", () => {
  const sql = read("0007_hiring_schema_guards");
  const at = (needle: string) => {
    const i = sql.indexOf(needle);
    expect(i, needle).toBeGreaterThanOrEqual(0);
    return i;
  };

  it("names the mapping's activity foreign key explicitly, within Postgres' 63 characters", () => {
    expect(sql).toContain(
      `ALTER TABLE "hiring_activity_competencies" ADD CONSTRAINT "hiring_activity_competencies_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."hiring_activities"("id") ON DELETE cascade`,
    );
    for (const [, name] of sql.matchAll(/ADD CONSTRAINT "(\w+)"/g)) expect(name.length, name).toBeLessThanOrEqual(63);
  });

  it("ties a version to an opening of the same organisation, after the unique target it needs", () => {
    const index = `ALTER TABLE "hiring_openings" ADD CONSTRAINT "hiring_openings_id_org" UNIQUE("id","org_id");`;
    const fk = `ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_versions_opening_org_fk" FOREIGN KEY ("opening_id","org_id") REFERENCES "public"."hiring_openings"("id","org_id") ON DELETE cascade`;
    expect(at(index)).toBeLessThan(at(fk));
  });

  it("replaces exactly the two single-column foreign keys, and drops nothing else", () => {
    const drops = [...sql.matchAll(/ALTER TABLE "(\w+)" DROP CONSTRAINT "(\w+)"/g)].map((m) => `${m[1]}.${m[2]}`).sort();
    expect(drops).toEqual([
      "hiring_activity_competencies.hiring_activity_competencies_activity_id_hiring_activities_id_fk",
      "hiring_versions.hiring_versions_opening_id_hiring_openings_id_fk",
    ]);
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE|INDEX)/);
  });

  it.each([
    ["hiring_stages", "hiring_stage_grace", `"hiring_stages"."grace_seconds" >= 0`],
    ["hiring_stages", "hiring_stage_order", `"hiring_stages"."order_index" >= 0`],
    ["hiring_activities", "hiring_activity_answer", `"hiring_activities"."answer_seconds" IS NULL OR "hiring_activities"."answer_seconds" > 0`],
    ["hiring_activities", "hiring_activity_order", `"hiring_activities"."order_index" >= 0`],
    ["hiring_versions", "hiring_version_number_positive", `"hiring_versions"."version_number" >= 1`],
    [
      "hiring_versions",
      "hiring_published_has_publisher",
      `"hiring_versions"."status" <> 'PUBLISHED' OR ("hiring_versions"."published_at" IS NOT NULL AND "hiring_versions"."published_by" IS NOT NULL)`,
    ],
    // locale_set is a jsonb array of strings: `?` is membership, default_locale is the locale enum.
    ["hiring_versions", "hiring_default_locale_in_set", `"hiring_versions"."locale_set" ? "hiring_versions"."default_locale"::text`],
  ])("%s keeps %s", (table, name, expression) => {
    expect(sql).toContain(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expression});`);
  });

  it("changes no row, so the 0006 freeze triggers have nothing to fire on", () => {
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im);
  });
});

describe("0008_hiring_immutability_locks", () => {
  const sql = read("0008_hiring_immutability_locks");

  it.each([
    "hiring_block_published_version",
    "hiring_block_published_stage",
    "hiring_block_published_activity",
    "hiring_block_published_mapping",
  ])("replaces %s in place (the 0006 triggers keep calling it)", (fn) => {
    expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger AS $$`);
  });

  it("locks the parent version in every lookup, so a publish and a child edit cannot interleave", () => {
    const lookups = [...sql.matchAll(/SELECT [^;]*INTO v_status [^;]*;/g)].map((m) => m[0]);
    expect(lookups).toHaveLength(6);
    expect(lookups.filter((l) => / FROM hiring_versions WHERE id = (OLD|NEW)\.version_id FOR SHARE;$/.test(l))).toHaveLength(2);
    expect(lookups.filter((l) => /JOIN hiring_versions v ON v\.id = s\.version_id WHERE [^;]* FOR SHARE OF v;$/.test(l))).toHaveLength(4);
  });

  it("names the refusal hiring_version_frozen in every RAISE, with SQLSTATE 23514", () => {
    const raises = [...sql.matchAll(/RAISE EXCEPTION [^;]*;/g)].map((m) => m[0]);
    expect(raises).toHaveLength(7);
    for (const r of raises) expect(r, r).toMatch(/USING ERRCODE = '23514', CONSTRAINT = 'hiring_version_frozen';$/);
    expect(sql).not.toMatch(/RETURN NULL/);
  });

  it("sends one statement per chunk (the migrator prepares each chunk)", () => {
    for (const chunk of sql.split("--> statement-breakpoint")) {
      const outside = chunk.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/--.*$/gm, "");
      expect((outside.match(/;/g) ?? []).length, chunk.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });
});

describe("0009_hiring_locale_set_array", () => {
  const sql = read("0009_hiring_locale_set_array");

  it("keeps locale_set a JSON array (a bare string would pass the `?` membership check)", () => {
    expect(sql).toContain(
      `ALTER TABLE "hiring_versions" ADD CONSTRAINT "hiring_locale_set_is_array" CHECK (jsonb_typeof("hiring_versions"."locale_set") = 'array');`,
    );
  });

  it("only adds that check", () => {
    expect(sql).not.toMatch(/DROP |INSERT |UPDATE |DELETE /);
  });
});

describe("0010_hiring_candidate_flow", () => {
  const sql = read("0010_hiring_candidate_flow");

  it.each(["hiring_assessments", "hiring_assignments", "hiring_stage_runs", "hiring_responses", "hiring_survey_responses", "candidate_requests"])("creates %s", (table) => {
    expect(sql).toContain(`CREATE TABLE "${table}"`);
  });

  it("gives every consent text a solution, the exam's for every existing row", () => {
    expect(sql).toMatch(/ALTER TABLE "consent_texts" ADD COLUMN "solution" "solution" DEFAULT 'LANGUAGE_EXAM' NOT NULL;/);
  });

  it("turns the finish survey on by default", () => {
    expect(sql).toMatch(/ALTER TABLE "hiring_openings" ADD COLUMN "finish_survey_enabled" boolean DEFAULT true NOT NULL;/);
  });

  it("ties an invitation to a HIRING invitation and to one version of one opening of its organisation", () => {
    expect(sql).toMatch(/CONSTRAINT "hiring_assessment_is_hiring" CHECK \("hiring_assessments"\."solution" = 'HIRING'\)/);
    expect(sql).toMatch(/CONSTRAINT "hiring_extra_time_pct" CHECK \("hiring_assessments"\."extra_time_pct" IN \(0, 25, 50\)\)/);
    expect(sql).toMatch(/"hiring_assessments_assessment_fk" FOREIGN KEY \("assessment_id","solution"\) REFERENCES "public"\."assessments"\("id","solution"\) ON DELETE cascade/);
    expect(sql).toMatch(/"hiring_assessments_opening_fk" FOREIGN KEY \("opening_id","org_id"\) REFERENCES "public"\."hiring_openings"\("id","org_id"\)/);
    expect(sql).toMatch(/"hiring_assessments_version_fk" FOREIGN KEY \("version_id","opening_id","org_id"\) REFERENCES "public"\."hiring_versions"\("id","opening_id","org_id"\)/);
  });

  it("creates the version UNIQUE before the foreign key that needs it", () => {
    const unique = sql.indexOf(`ADD CONSTRAINT "hiring_versions_id_opening_org" UNIQUE("id","opening_id","org_id")`);
    const fk = sql.indexOf(`"hiring_assessments_version_fk" FOREIGN KEY`);
    expect(unique).toBeGreaterThanOrEqual(0);
    expect(fk).toBeGreaterThan(unique);
  });

  it("keeps one run per stage and attempt and one response per question and run", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_stage_run_per_attempt" ON "hiring_stage_runs" USING btree \("attempt_id","stage_id"\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "hiring_response_per_activity" ON "hiring_responses" USING btree \("stage_run_id","activity_id"\)/);
  });

  it("keeps assignments when a user would be deleted (users are disabled, never deleted)", () => {
    expect(sql).toMatch(/"hiring_assignments_user_id_users_id_fk" FOREIGN KEY \("user_id"\) REFERENCES "public"\."users"\("id"\) ON DELETE restrict/);
  });

  it("keeps a response when its media is purged, and ranges in the database", () => {
    expect(sql).toMatch(/"hiring_responses_media_asset_id_media_assets_id_fk" FOREIGN KEY \("media_asset_id"\) REFERENCES "public"\."media_assets"\("id"\) ON DELETE set null/);
    expect(sql).toMatch(/CONSTRAINT "hiring_survey_rating" CHECK \("hiring_survey_responses"\."rating" BETWEEN 1 AND 5\)/);
    expect(sql).toMatch(/CONSTRAINT "hiring_response_auto_score" CHECK/);
  });

  it("names every constraint within Postgres' 63 characters", () => {
    const names = [...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(5);
    for (const name of names) expect(name.length, name).toBeLessThanOrEqual(63);
  });

  it("only adds, and never touches a frozen hiring version", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE|CONSTRAINT|INDEX)/);
    // drizzle writes ON UPDATE no action on every foreign key, so only a statement that starts with a DML verb counts.
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im);
    expect(sql).not.toMatch(/ALTER TABLE "hiring_(stages|activities|activity_competencies)"/);
  });

  it("gives core candidate requests an organisation, a closed kind, a RESTRICT handler and cascade with the invitation", () => {
    expect(sql).toMatch(/CREATE TABLE "candidate_requests" \(\s*"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\) NOT NULL,\s*"org_id" uuid NOT NULL,\s*"assessment_id" uuid NOT NULL,\s*"kind" text NOT NULL,/);
    expect(sql).toMatch(/CONSTRAINT "candidate_request_kind" CHECK \("candidate_requests"\."kind" IN \('ACCOMMODATION', 'NEW_LINK'\)\)/);
    expect(sql).toMatch(/"candidate_requests_org_id_organizations_id_fk" FOREIGN KEY \("org_id"\) REFERENCES "public"\."organizations"\("id"\) ON DELETE cascade/);
    expect(sql).toMatch(/"candidate_requests_assessment_id_assessments_id_fk" FOREIGN KEY \("assessment_id"\) REFERENCES "public"\."assessments"\("id"\) ON DELETE cascade/);
    expect(sql).toMatch(/"candidate_requests_handled_by_users_id_fk" FOREIGN KEY \("handled_by"\) REFERENCES "public"\."users"\("id"\) ON DELETE restrict/);
    expect(sql).toMatch(/CREATE INDEX "candidate_requests_org_created_idx" ON "candidate_requests" USING btree \("org_id","created_at"\)/);
    expect(sql).toMatch(/CREATE INDEX "candidate_requests_assessment_idx" ON "candidate_requests" USING btree \("assessment_id"\)/);
  });
});

describe("0011_hiring_tenancy_keys", () => {
  const sql = read("0011_hiring_tenancy_keys");
  const at = (needle: string) => sql.indexOf(needle);

  it("makes the core invitation a composite target of (id, org_id)", () => {
    expect(sql).toContain(`ALTER TABLE "assessments" ADD CONSTRAINT "assessments_id_org_unique" UNIQUE("id","org_id");`);
  });

  it("creates the (id, org_id) UNIQUE before both foreign keys that need it", () => {
    const unique = at(`ADD CONSTRAINT "assessments_id_org_unique" UNIQUE`);
    expect(unique).toBeGreaterThanOrEqual(0);
    expect(at(`"hiring_assessments_org_fk" FOREIGN KEY`)).toBeGreaterThan(unique);
    expect(at(`"candidate_requests_assessment_org_fk" FOREIGN KEY`)).toBeGreaterThan(unique);
  });

  it("ties a hiring invitation to the core invitation's organisation", () => {
    expect(sql).toMatch(
      /"hiring_assessments_org_fk" FOREIGN KEY \("assessment_id","org_id"\) REFERENCES "public"\."assessments"\("id","org_id"\) ON DELETE cascade/,
    );
  });

  it("replaces the single-column request foreign key with the organisation-tied one", () => {
    expect(sql).toContain(`ALTER TABLE "candidate_requests" DROP CONSTRAINT "candidate_requests_assessment_id_assessments_id_fk";`);
    expect(sql).toMatch(
      /"candidate_requests_assessment_org_fk" FOREIGN KEY \("assessment_id","org_id"\) REFERENCES "public"\."assessments"\("id","org_id"\) ON DELETE cascade/,
    );
    expect(at(`DROP CONSTRAINT "candidate_requests_assessment_id_assessments_id_fk"`)).toBeLessThan(at(`"candidate_requests_assessment_org_fk" FOREIGN KEY`));
  });

  it("indexes the foreign keys that deletes and joins walk", () => {
    expect(sql).toContain(`CREATE INDEX "hiring_responses_activity_idx" ON "hiring_responses" USING btree ("activity_id");`);
    expect(sql).toContain(`CREATE INDEX "hiring_stage_runs_stage_idx" ON "hiring_stage_runs" USING btree ("stage_id");`);
    expect(sql).toContain(
      `CREATE INDEX "hiring_stage_runs_carried_from_idx" ON "hiring_stage_runs" USING btree ("carried_from_stage_run_id") WHERE carried_from_stage_run_id IS NOT NULL;`,
    );
  });

  it("bounds candidate-written text and the number of takes in the database", () => {
    expect(sql).toContain(
      `ALTER TABLE "hiring_survey_responses" ADD CONSTRAINT "hiring_survey_comment_length" CHECK (char_length("hiring_survey_responses"."comment") <= 2000);`,
    );
    expect(sql).toContain(
      `ALTER TABLE "candidate_requests" ADD CONSTRAINT "candidate_request_message_length" CHECK (char_length("candidate_requests"."message") <= 2000);`,
    );
    expect(sql).toContain(`ALTER TABLE "hiring_responses" ADD CONSTRAINT "hiring_response_takes_max" CHECK ("hiring_responses"."takes_used" <= 5);`);
  });

  it("names every constraint within Postgres' 63 characters", () => {
    const names = [...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(5);
    for (const name of names) expect(name.length, name).toBeLessThanOrEqual(63);
  });

  it("only adds, apart from swapping the one request foreign key, and writes no rows", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|TYPE|INDEX)/);
    expect([...sql.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map((m) => m[1])).toEqual(["candidate_requests_assessment_id_assessments_id_fk"]);
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im);
    expect(sql).not.toMatch(/ALTER TABLE "hiring_(stages|activities|activity_competencies|versions)"/);
  });

  it("sends one statement per chunk (the migrator prepares each chunk)", () => {
    for (const chunk of sql.split("--> statement-breakpoint")) {
      const outside = chunk.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/--.*$/gm, "");
      expect((outside.match(/;/g) ?? []).length, chunk.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });
});
