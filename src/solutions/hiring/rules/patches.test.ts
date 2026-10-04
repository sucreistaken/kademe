import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  activityPatchSchema,
  defaultsFor,
  emptyActivity,
  HIRING_LIMITS,
  openingRulesSchema,
  stagePatchSchema,
  stagePayloadOf,
  stagePayloadSchema,
  versionLocalesSchema,
} from "./patches";
import { ACTIVITY_TYPES } from "./content";
import { activity, stage } from "./test-fixtures";

describe("hiring patches", () => {
  it("gives each question type its HIRING-UX 5.5 defaults", () => {
    expect(defaultsFor("VIDEO")).toMatchObject({ thinkSeconds: 60, flexibleThink: true, answerSeconds: 120, maxTakes: 2, config: { textAlternativeEnabled: false } });
    expect(defaultsFor("LONG_TEXT")).toMatchObject({ thinkSeconds: 0, answerSeconds: null, config: { minChars: 0, maxChars: 3000 } });
    expect(defaultsFor("SINGLE_CHOICE").config.choices).toHaveLength(2);
    expect(defaultsFor("FILE_UPLOAD").config).toMatchObject({ acceptedMimeTypes: ["application/pdf"] });
  });

  it("refuses values the candidate timer or the database cannot live with", () => {
    expect(activityPatchSchema.safeParse({ maxTakes: 9 }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ answerSeconds: 5 }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ answerExamples: { 2: "x" } }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ config: { unknown: true } }).success).toBe(false);
    expect(activityPatchSchema.safeParse({ prompt: { tr: "Anlat.", en: "" }, maxTakes: 3 }).success).toBe(true);
  });

  it("turns a stage into a payload that validates again (undo and copy use it)", () => {
    const payload = stagePayloadOf(stage("s", [activity("a", { competencyIds: ["00000000-0000-4000-8000-000000000001"] })]));
    expect(stagePayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.activities[0]).not.toHaveProperty("id");
  });

  it("an empty question of every type is a valid payload", () => {
    for (const type of ACTIVITY_TYPES) expect(stagePayloadSchema.shape.activities.element.safeParse(emptyActivity(type)).success, type).toBe(true);
  });
});

describe("opening rules and version locales", () => {
  it("keeps the default locale inside a non-empty locale set without repeats", () => {
    expect(versionLocalesSchema.safeParse({ defaultLocale: "tr", localeSet: ["tr", "en"] }).success).toBe(true);
    expect(versionLocalesSchema.safeParse({ defaultLocale: "en", localeSet: ["tr"] }).success).toBe(false);
    expect(versionLocalesSchema.safeParse({ defaultLocale: "tr", localeSet: [] }).success).toBe(false);
    expect(versionLocalesSchema.safeParse({ defaultLocale: "tr", localeSet: ["tr", "tr"] }).success).toBe(false);
    expect(versionLocalesSchema.safeParse({ defaultLocale: "de", localeSet: ["de"] }).success).toBe(false);
  });

  it("bounds the evaluation count and the feedback promise", () => {
    expect(openingRulesSchema.safeParse({ minEvaluations: 0 }).success).toBe(false);
    expect(openingRulesSchema.safeParse({ feedbackDays: 61 }).success).toBe(false);
    expect(openingRulesSchema.safeParse({ minEvaluations: 5, feedbackDays: 1 }).success).toBe(true);
  });
});

/**
 * Agreement with the database: every value the builder schemas accept must
 * pass the CHECK constraint the migrations created, so a save never ends in a
 * raw 23514. The CHECK expressions are read from the migration SQL itself.
 */
describe("schemas agree with the database CHECKs", () => {
  const folder = path.resolve(process.cwd(), "drizzle/migrations");
  const sql = readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(path.join(folder, f), "utf8"))
    .join("\n");

  /** The CHECK expression of a named constraint, exactly as migrated. */
  function checkOf(name: string): string {
    const match = new RegExp(`CONSTRAINT "${name}" CHECK \\((.*)\\)[;,]?(?:--> statement-breakpoint)?$`, "m").exec(sql);
    expect(match, name).not.toBeNull();
    return match![1];
  }

  /** Evaluates the three shapes of range CHECK the hiring tables use. */
  function dbAccepts(expression: string, value: number | null): boolean {
    let m = /^"\w+"\."\w+" BETWEEN (\d+) AND (\d+)$/.exec(expression);
    if (m) return value !== null && value >= Number(m[1]) && value <= Number(m[2]);
    m = /^"\w+"\."\w+" >= (\d+)$/.exec(expression);
    if (m) return value !== null && value >= Number(m[1]);
    m = /^"\w+"\."(\w+)" IS NULL OR "\w+"\."\1" > (\d+)$/.exec(expression);
    if (m) return value === null || value > Number(m[2]);
    throw new Error(`unknown CHECK shape: ${expression}`);
  }

  const cases = [
    { constraint: "hiring_stage_duration", limit: HIRING_LIMITS.stageDurationSeconds, accepts: (v: number) => stagePatchSchema.safeParse({ durationSeconds: v }).success },
    { constraint: "hiring_stage_grace", limit: HIRING_LIMITS.stageGraceSeconds, accepts: (v: number) => stagePatchSchema.safeParse({ graceSeconds: v }).success },
    { constraint: "hiring_activity_think", limit: HIRING_LIMITS.thinkSeconds, accepts: (v: number) => activityPatchSchema.safeParse({ thinkSeconds: v }).success },
    { constraint: "hiring_activity_answer", limit: HIRING_LIMITS.answerSeconds, accepts: (v: number) => activityPatchSchema.safeParse({ answerSeconds: v }).success },
    { constraint: "hiring_activity_takes", limit: HIRING_LIMITS.maxTakes, accepts: (v: number) => activityPatchSchema.safeParse({ maxTakes: v }).success },
    { constraint: "hiring_min_evaluations", limit: HIRING_LIMITS.minEvaluations, accepts: (v: number) => openingRulesSchema.safeParse({ minEvaluations: v }).success },
    { constraint: "hiring_feedback_days", limit: HIRING_LIMITS.feedbackDays, accepts: (v: number) => openingRulesSchema.safeParse({ feedbackDays: v }).success },
  ];

  it.each(cases)("$constraint: the schema accepts its whole range and the database accepts all of it", ({ constraint, limit, accepts }) => {
    const expression = checkOf(constraint);
    expect(accepts(limit.min)).toBe(true);
    expect(accepts(limit.max)).toBe(true);
    expect(accepts(limit.min - 1)).toBe(false);
    expect(accepts(limit.max + 1)).toBe(false);
    expect(accepts(limit.min + 0.5)).toBe(false);
    // An integer range: both ends inside the CHECK means every value between is too.
    expect(dbAccepts(expression, limit.min)).toBe(true);
    expect(dbAccepts(expression, limit.max)).toBe(true);
  });

  it("an answer time may be empty, which the database allows", () => {
    expect(dbAccepts(checkOf("hiring_activity_answer"), null)).toBe(true);
    expect(activityPatchSchema.safeParse({ answerSeconds: null }).success).toBe(true);
  });

  it("the order CHECKs are what the server's 0..n-1 renumbering relies on", () => {
    expect(dbAccepts(checkOf("hiring_stage_order"), 0)).toBe(true);
    expect(dbAccepts(checkOf("hiring_activity_order"), 0)).toBe(true);
    expect(dbAccepts(checkOf("hiring_stage_order"), -1)).toBe(false);
  });

  it("the locale CHECKs are the rule versionLocalesSchema enforces", () => {
    expect(checkOf("hiring_default_locale_in_set")).toBe('"hiring_versions"."locale_set" ? "hiring_versions"."default_locale"::text');
    expect(checkOf("hiring_locale_set_is_array")).toBe(`jsonb_typeof("hiring_versions"."locale_set") = 'array'`);
  });

  it("a question measures at most as many competencies as the database has slots", () => {
    expect(checkOf("hiring_at_most_two_competencies")).toBe('"hiring_activity_competencies"."order_index" IN (0, 1)');
    expect(stagePayloadSchema.shape.activities.element.shape.competencyIds.safeParse(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"]).success).toBe(false);
  });
});
