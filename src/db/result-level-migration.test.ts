import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { CEFR_LEVELS, RESULT_LEVELS } from "@/lib/exam/types";
import { MIGRATIONS_FOLDER } from "./migration-files";
import { examAssessments, examResults, items, responseGradings, stimuli } from "./schema";

/**
 * 0027 (A0, Pre-A1): result columns move to a new `result_level` enum that has
 * A0; `cefr_level` stays A1 to C2, so no item, task or claimed level can be A0.
 * Every existing value is an A1 to C2 label that `result_level` also has, so the
 * change is a cast and loses nothing.
 */
const sql = readFileSync(path.join(MIGRATIONS_FOLDER, "0027_result_level.sql"), "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const RESULT_COLUMNS = ["exam_results.overall_override", "exam_results.final_overall", "response_gradings.ai_level", "response_gradings.final_level"];

describe("0027_result_level", () => {
  it("creates result_level with A0 below A1 to C2, in order", () => {
    expect(statements[0]).toBe(`CREATE TYPE "public"."result_level" AS ENUM(${RESULT_LEVELS.map((l) => `'${l}'`).join(", ")});`);
    expect(RESULT_LEVELS).toEqual(["A0", ...CEFR_LEVELS]);
  });

  it("moves exactly the four result columns, each by a cast through text", () => {
    const moved = statements.slice(1).map((s) => {
      const m = s.match(/^ALTER TABLE "(\w+)" ALTER COLUMN "(\w+)" SET DATA TYPE "public"\."result_level" USING "(\w+)"::text::"public"\."result_level";$/);
      expect(m, s).not.toBeNull();
      expect(m![3]).toBe(m![2]);
      return `${m![1]}.${m![2]}`;
    });
    expect(moved.sort()).toEqual([...RESULT_COLUMNS].sort());
  });

  it("leaves cefr_level, drops nothing and writes no rows", () => {
    expect(sql).not.toMatch(/ALTER TYPE/);
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im);
    expect(sql).not.toMatch(/"(task_level|claimed_level|level)"/);
  });
});

describe("level columns in the schema", () => {
  const enumOf = (table: PgTable, column: string) => {
    const col = getTableConfig(table).columns.find((c) => c.name === column);
    if (!col) throw new Error(`${column} missing`);
    return (col as unknown as { enumValues?: readonly string[] }).enumValues;
  };

  it("result columns can hold A0", () => {
    for (const [table, column] of [
      [examResults, "overall_override"],
      [examResults, "final_overall"],
      [responseGradings, "ai_level"],
      [responseGradings, "final_level"],
    ] as const) {
      expect(enumOf(table, column), column).toEqual([...RESULT_LEVELS]);
    }
  });

  it("items, stimuli, task levels and claimed levels stay A1 to C2", () => {
    for (const [table, column] of [
      [items, "level"],
      [stimuli, "level"],
      [responseGradings, "task_level"],
      [examAssessments, "claimed_level"],
    ] as const) {
      expect(enumOf(table, column), column).toEqual([...CEFR_LEVELS]);
    }
  });
});
