import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A recording stand-in for drizzle: every query's conditions are rendered to SQL
 * with the real dialect, so the tests read what Postgres would be asked (which
 * organisation it names, how it joins, what it orders by) without a database.
 */
type Query = { op: "select" | "insert"; joins: string[]; where: string; params: unknown[]; order: string; limit: number | null; values?: Record<string, unknown>; conflict?: unknown };

const h = vi.hoisted(() => ({
  queries: [] as Array<Record<string, unknown>>,
  /** Rows the next selects resolve with, in call order. */
  selects: [] as unknown[][],
  /** What the insert's returning() resolves with. */
  inserted: [] as unknown[],
}));

vi.mock("@/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const render = (condition: unknown) => dialect.sqlToQuery(condition as never);
  return {
    db: {
      select: () => {
        const q: Query = { op: "select", joins: [], where: "", params: [], order: "", limit: null };
        h.queries.push(q);
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.innerJoin = (_table: unknown, on: unknown) => {
          q.joins.push(render(on).sql);
          return chain;
        };
        chain.where = (condition: unknown) => {
          const r = render(condition);
          q.where = r.sql;
          q.params = r.params;
          return chain;
        };
        chain.orderBy = (order: unknown) => {
          q.order = render(order).sql;
          return chain;
        };
        chain.limit = (n: number) => {
          q.limit = n;
          return chain;
        };
        chain.then = (resolve: (rows: unknown[]) => void) => resolve(h.selects.shift() ?? []);
        return chain;
      },
      insert: () => {
        const q: Query = { op: "insert", joins: [], where: "", params: [], order: "", limit: null };
        h.queries.push(q);
        const chain: Record<string, unknown> = {};
        chain.values = (values: Record<string, unknown>) => {
          q.values = values;
          return chain;
        };
        chain.onConflictDoNothing = (config: unknown) => {
          q.conflict = config;
          return chain;
        };
        chain.returning = async () => h.inserted;
        return chain;
      },
    },
  };
});

import { examFeedback } from "@/db/schema";
import { examFeedbackOf, feedbackOverview, feedbackTotals, hasExamFeedback, OVERVIEW_COMMENTS, saveExamFeedback } from "./exam-feedback";

const queries = () => h.queries as unknown as Query[];
const input = { overall: 4, clarity: null, usability: 5, technicalProblem: false, comment: "ok" };
const ctx = { assessmentId: "a1", orgId: "o1", locale: "de" as const };

beforeEach(() => {
  h.queries = [];
  h.selects = [];
  h.inserted = [];
});

describe("saveExamFeedback", () => {
  it("writes nothing while the exam is not over (no attempt, or an attempt without completedAt)", async () => {
    h.selects = [[]];
    expect(await saveExamFeedback(ctx, input)).toBe("NOT_FINISHED");
    h.selects = [[{ completedAt: null }]];
    expect(await saveExamFeedback(ctx, input)).toBe("NOT_FINISHED");
    expect(queries().filter((q) => q.op === "insert")).toEqual([]);
  });

  it("looks at the invitation's newest attempt only", async () => {
    h.selects = [[{ completedAt: new Date() }]];
    h.inserted = [{ id: "f1" }];
    await saveExamFeedback(ctx, input);
    const read = queries()[0];
    expect(read.where).toContain('"attempts"."assessment_id" = $1');
    expect(read.params).toEqual(["a1"]);
    expect(read.order).toContain('"attempts"."attempt_number" desc');
    expect(read.limit).toBe(1);
  });

  it("stores the answer once, in the invitation's organisation and language, and says SAVED", async () => {
    h.selects = [[{ completedAt: new Date() }]];
    h.inserted = [{ id: "f1" }];
    expect(await saveExamFeedback(ctx, input)).toBe("SAVED");
    const insert = queries().find((q) => q.op === "insert")!;
    expect(insert.values).toEqual({
      assessmentId: "a1",
      orgId: "o1",
      overall: 4,
      clarity: null,
      usability: 5,
      technicalProblem: false,
      comment: "ok",
      locale: "de",
    });
  });

  it("is idempotent: the write names the unique assessment column and a conflict answers ALREADY_ANSWERED", async () => {
    h.selects = [[{ completedAt: new Date() }]];
    h.inserted = [];
    expect(await saveExamFeedback(ctx, { ...input, overall: 1 })).toBe("ALREADY_ANSWERED");
    const insert = queries().find((q) => q.op === "insert")!;
    expect(insert.conflict).toEqual({ target: examFeedback.assessmentId });
  });
});

describe("reads for the school are one organisation's", () => {
  it("hasExamFeedback and examFeedbackOf name both the organisation and the invitation", async () => {
    h.selects = [[{ id: "f1" }]];
    expect(await hasExamFeedback("o1", "a1")).toBe(true);
    h.selects = [[]];
    expect(await examFeedbackOf("o1", "a1")).toBeNull();
    for (const q of queries()) {
      expect(q.where).toContain('"exam_feedback"."org_id" = $');
      expect(q.where).toContain('"exam_feedback"."assessment_id" = $');
      expect(q.params).toEqual(["o1", "a1"]);
    }
  });

  it("the totals count one organisation, join the invitation by (id, org_id) and leave out a removed student", async () => {
    h.selects = [[{ count: 3, overall: "4.5", clarity: "4", usability: null, technicalAnswered: 2, technicalYes: 1 }]];
    const totals = await feedbackTotals("o1");
    const q = queries()[0];
    expect(q.where).toContain('"exam_feedback"."org_id" = $1');
    expect(q.where).toContain('"candidates"."deleted_at" is null');
    expect(q.params).toEqual(["o1"]);
    expect(q.joins[0]).toContain('"assessments"."id" = "exam_feedback"."assessment_id"');
    expect(q.joins[0]).toContain('"assessments"."org_id" = "exam_feedback"."org_id"');
    expect(totals).toEqual({ count: 3, averageOverall: 4.5, averageClarity: 4, averageUsability: null, technicalAnswered: 2, technicalYes: 1 });
  });

  it("an organisation with no answers has an empty overview, not NaN", async () => {
    h.selects = [[{ count: 0, overall: null, clarity: null, usability: null, technicalAnswered: 0, technicalYes: 0 }], []];
    expect(await feedbackOverview("o1")).toEqual({
      count: 0,
      averageOverall: null,
      averageClarity: null,
      averageUsability: null,
      technicalAnswered: 0,
      technicalYes: 0,
      comments: [],
    });
  });

  it("the comments are the newest 20 of that organisation that have text", async () => {
    h.selects = [[{ count: 2, overall: "3", clarity: null, usability: null, technicalAnswered: 0, technicalYes: 0 }], [
      { id: "f2", assessmentId: "a2", name: "Ada", overall: 2, technicalProblem: true, comment: "Ton fiel aus", locale: "de", createdAt: new Date("2026-10-25T10:00:00Z") },
    ]];
    const overview = await feedbackOverview("o1");
    const comments = queries().find((q) => q.limit !== null && q.limit !== 1)!;
    expect(comments.where).toContain('"exam_feedback"."org_id" = $1');
    expect(comments.where).toContain('"exam_feedback"."comment" is not null');
    expect(comments.where).toContain('"candidates"."deleted_at" is null');
    expect(comments.params).toEqual(["o1"]);
    expect(comments.joins[0]).toContain('"assessments"."org_id" = "exam_feedback"."org_id"');
    expect(comments.order).toContain('"exam_feedback"."created_at" desc');
    expect(comments.limit).toBe(OVERVIEW_COMMENTS);
    expect(OVERVIEW_COMMENTS).toBe(20);
    expect(overview.comments.map((c) => c.comment)).toEqual(["Ton fiel aus"]);
  });

  it("every read of the overview carries the organisation id and no query leaves it out", async () => {
    h.selects = [[{ count: 0, overall: null, clarity: null, usability: null, technicalAnswered: 0, technicalYes: 0 }], []];
    await feedbackOverview("org-x");
    const selects = queries().filter((q) => q.op === "select");
    expect(selects.length).toBe(2);
    for (const q of selects) {
      expect(q.params).toContain("org-x");
      expect(q.where).toContain('"exam_feedback"."org_id"');
    }
  });
});
