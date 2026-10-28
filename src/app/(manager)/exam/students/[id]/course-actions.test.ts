import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { auditLogs, examResultRevisions, examResults, responseGradingRevisions, responseGradings } from "@/db/schema";
import { SPEAKING_CRITERIA, WRITING_CRITERIA, type CourseRubricProposal } from "@/lib/exam/course/types";

/**
 * The course test's grading actions: confirm the AI's rubric points, set the
 * teacher's own, tick the common errors, and decide PASS or FAIL. The fake
 * database holds one invitation in the user's organisation; a query finds it
 * unless its WHERE clause filters on another solution, as Postgres would answer.
 */
type Solution = "LANGUAGE_EXAM" | "HIRING";
type Write = { kind: "update" | "insert"; table: unknown; values: Record<string, unknown> };
const store = {
  solution: "LANGUAGE_EXAM" as Solution,
  mode: "COURSE_TEST" as string,
  section: "WRITING" as string,
  ended: true,
  final: false,
  grading: {} as Record<string, unknown>,
  result: {} as Record<string, unknown>,
};
const writes: Write[] = [];
const calls = vi.fn();
const dialect = new PgDialect();

const matches = (where: SQL): boolean => {
  const { sql, params } = dialect.sqlToQuery(where);
  const filter = /"assessments"\."solution" = \$(\d+)/.exec(sql);
  return !filter || params[Number(filter[1]) - 1] === store.solution;
};

const row = () => ({
  grading: store.grading,
  section: store.section,
  attemptId: "t1",
  assessmentId: "a1",
  mode: store.mode,
  ended: store.ended,
  final: store.final,
  result: store.result,
  attempt: { id: "t1", completedAt: new Date("2026-10-28T10:00:00Z"), terminatedAt: null },
});

vi.mock("@/db", () => ({
  db: {
    select: () => {
      let where: SQL | undefined;
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: SQL) => {
          where = condition;
          return chain;
        },
        then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(where && matches(where) ? [row()] : []).then(resolve, reject),
      };
      return chain;
    },
    update: (table: unknown) => writeChain("update", table),
    insert: (table: unknown) => writeChain("insert", table),
  },
}));
function writeChain(kind: "update" | "insert", table: unknown) {
  let values: Record<string, unknown> = {};
  const chain = {
    set: (v: Record<string, unknown>) => ((values = v), chain),
    values: (v: Record<string, unknown>) => ((values = v), chain),
    where: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      writes.push({ kind, table, values });
      return Promise.resolve([]).then(resolve, reject);
    },
  };
  return chain;
}

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/server/session", () => ({
  requireUser: async (permission?: string) => {
    calls("requireUser", permission);
    return { id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" };
  },
}));
vi.mock("@/lib/exam-results", () => ({
  recomputeResult: async (...args: unknown[]) => calls("recomputeResult", ...args),
  finalizeResult: async () => ({ ok: true }),
}));

import { confirmCourseGrading, overrideCourseOutcome, setCourseCommonErrors, setCourseGradingPoints } from "./course-actions";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) data.append(k, one);
  return data;
};

const writingProposal = (points: [number, number, number] = [3, 2, 1], commonErrors: CourseRubricProposal["commonErrors"] = ["SPELLING"]): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "WRITING",
  criteria: WRITING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 3, rationale: "ok" })),
  commonErrors,
  advice: "Nebensätze üben.",
});
const speakingProposal = (points: Array<number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section: "SPEAKING",
  criteria: SPEAKING_CRITERIA.map((id, i) => ({ id, points: points[i], max: 4, rationale: "ok" })),
  advice: "Mehr Verbindungswörter.",
});

const grading = (over: Record<string, unknown> = {}) => ({ id: "g1", status: "AI_PROPOSED", courseProposal: writingProposal(), coursePoints: null, ...over });
const on = (table: unknown, kind: Write["kind"]) => writes.filter((w) => w.table === table && w.kind === kind);

beforeEach(() => {
  writes.length = 0;
  calls.mockClear();
  Object.assign(store, { solution: "LANGUAGE_EXAM", mode: "COURSE_TEST", section: "WRITING", ended: true, final: false, grading: grading(), result: { id: "r1", status: "AWAITING_REVIEW", skillOverrides: {}, computed: { course: { outcome: "PASS" } } } });
});

const redirects = (run: () => Promise<void>) => run().then(() => "no redirect", (e: Error) => e.message);

describe("confirmCourseGrading", () => {
  it("copies the AI's points and boxes into course_points as CONFIRMED by the teacher, with a revision, an audit row and a recompute", async () => {
    await expect(confirmCourseGrading(form({ gradingId: "g1", tab: "WRITING" }))).rejects.toThrow("REDIRECT /exam/students/a1?tab=WRITING");
    expect(calls).toHaveBeenCalledWith("requireUser", "result:grade");
    const [update] = on(responseGradings, "update");
    expect(update.values).toMatchObject({
      status: "CONFIRMED",
      coursePoints: { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, commonErrors: ["SPELLING"] },
      decider: "TEACHER",
      decidedBy: "u1",
      reason: null,
    });
    const [revision] = on(responseGradingRevisions, "insert");
    expect(revision.values).toMatchObject({
      gradingId: "g1",
      before: { status: "AI_PROPOSED", total: 6 },
      after: { status: "CONFIRMED", total: 6, points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 } },
      reason: "AI proposal confirmed",
      changedBy: "u1",
    });
    expect(on(auditLogs, "insert")[0].values).toMatchObject({ orgId: "o1", actorId: "u1", action: "grading.course_confirm", subjectType: "response_grading", subjectId: "g1" });
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("takes the boxes the form sent instead of the AI's", async () => {
    await expect(confirmCourseGrading(form({ gradingId: "g1", commonErrorsSent: "1", commonErrors: ["CASE", "POINTS_MISSING"] }))).rejects.toThrow(/^REDIRECT /);
    expect(on(responseGradings, "update")[0].values).toMatchObject({ coursePoints: { commonErrors: ["POINTS_MISSING", "CASE"] } });
  });

  it("an unticked form with the marker means no box is ticked", async () => {
    await expect(confirmCourseGrading(form({ gradingId: "g1", commonErrorsSent: "1" }))).rejects.toThrow(/^REDIRECT /);
    expect(on(responseGradings, "update")[0].values).toMatchObject({ coursePoints: { commonErrors: [] } });
  });

  it("refuses a box the sheet does not have", async () => {
    expect(await redirects(() => confirmCourseGrading(form({ gradingId: "g1", commonErrorsSent: "1", commonErrors: "MADE_UP" })))).toMatch(/error=errors/);
    expect(writes).toEqual([]);
  });

  it("is a change, not a confirmation, when the form moves a point the AI judged", async () => {
    expect(await redirects(() => confirmCourseGrading(form({ gradingId: "g1", tab: "WRITING", "points.INHALT": "2" })))).toBe("REDIRECT /exam/students/a1?tab=WRITING&error=changed");
    expect(writes).toEqual([]);
  });

  it("needs the teacher's value for AUSSPRACHE when the AI could not judge it, and records that the teacher set it", async () => {
    Object.assign(store, { section: "SPEAKING", grading: grading({ courseProposal: speakingProposal([3, 3, 2, null, 3]), coursePoints: null }) });
    expect(await redirects(() => confirmCourseGrading(form({ gradingId: "g1", tab: "SPEAKING" })))).toMatch(/error=open/);
    expect(writes).toEqual([]);
    await expect(confirmCourseGrading(form({ gradingId: "g1", tab: "SPEAKING", "points.AUSSPRACHE": "3" }))).rejects.toThrow(/^REDIRECT \/exam\/students\/a1\?tab=SPEAKING$/);
    expect(on(responseGradings, "update")[0].values).toMatchObject({
      status: "CONFIRMED",
      coursePoints: { points: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 3 } },
    });
    expect(on(responseGradingRevisions, "insert")[0].values).toMatchObject({ reason: "AI proposal confirmed; set by teacher: AUSSPRACHE" });
    // A speaking grading keeps no common-error boxes.
    expect(on(responseGradings, "update")[0].values.coursePoints).not.toHaveProperty("commonErrors");
  });

  it.each([
    ["a grading that is not waiting for confirmation", { grading: grading({ status: "CONFIRMED" }) }],
    ["a grading with no proposal", { grading: grading({ courseProposal: null }) }],
    ["a final result", { final: true }],
    ["an exam that is still running", { ended: false }],
    ["a level exam's grading", { mode: "PLACEMENT" }],
    ["a grading that is not writing or speaking", { section: "READING" }],
  ])("changes nothing for %s", async (_name, patch) => {
    Object.assign(store, patch);
    expect(await redirects(() => confirmCourseGrading(form({ gradingId: "g1" })))).toMatch(/^REDIRECT /);
    expect(writes).toEqual([]);
    expect(calls).not.toHaveBeenCalledWith("recomputeResult", expect.anything());
  });

  it("changes nothing on a hiring invitation in the same organisation", async () => {
    store.solution = "HIRING";
    expect(await redirects(() => confirmCourseGrading(form({ gradingId: "g1" })))).toBe("REDIRECT /exam/students");
    expect(writes).toEqual([]);
  });
});

describe("setCourseGradingPoints", () => {
  const points = { gradingId: "g1", tab: "WRITING", "points.INHALT": "2", "points.WORTSCHATZ": "2", "points.GRAMMATIK": "3", reason: "Leitpunkt 3 fehlt" };

  it("stores the teacher's points as OVERRIDDEN with the reason, a revision and a recompute", async () => {
    await expect(setCourseGradingPoints(form(points))).rejects.toThrow("REDIRECT /exam/students/a1?tab=WRITING");
    expect(calls).toHaveBeenCalledWith("requireUser", "result:grade");
    expect(on(responseGradings, "update")[0].values).toMatchObject({
      status: "OVERRIDDEN",
      coursePoints: { points: { INHALT: 2, WORTSCHATZ: 2, GRAMMATIK: 3 }, commonErrors: ["SPELLING"] },
      decider: "TEACHER",
      decidedBy: "u1",
      reason: "Leitpunkt 3 fehlt",
    });
    expect(on(responseGradingRevisions, "insert")[0].values).toMatchObject({
      before: { status: "AI_PROPOSED", total: 6 },
      after: { status: "OVERRIDDEN", total: 7 },
      reason: "Leitpunkt 3 fehlt",
      changedBy: "u1",
    });
    expect(on(auditLogs, "insert")[0].values).toMatchObject({ action: "grading.course_override", meta: { total: 7, fromTotal: 6, reason: "Leitpunkt 3 fehlt" } });
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("requires a reason of at least three characters", async () => {
    for (const reason of ["", "  ", "ab"]) {
      expect(await redirects(() => setCourseGradingPoints(form({ ...points, reason })))).toBe("REDIRECT /exam/students/a1?tab=WRITING&error=reason");
    }
    expect(writes).toEqual([]);
  });

  it("refuses points that are not the section's: above the maximum, half points, a missing or a foreign criterion", async () => {
    const refused: Array<Record<string, string>> = [{ "points.INHALT": "4" }, { "points.INHALT": "1.5" }, { "points.INHALT": "-1" }, { "points.AUSSPRACHE": "2" }, { "points.GRAMMATIK": "" }];
    for (const bad of refused) {
      expect(await redirects(() => setCourseGradingPoints(form({ ...points, ...bad })))).toMatch(/error=points/);
    }
    expect(writes).toEqual([]);
  });

  it("grades a speaking task on five criteria to 4, and a criterion above 4 is refused", async () => {
    Object.assign(store, { section: "SPEAKING", grading: grading({ status: "AI_FAILED", courseProposal: null }) });
    const five = { gradingId: "g1", tab: "SPEAKING", reason: "ohne KI bewertet", ...Object.fromEntries(SPEAKING_CRITERIA.map((c) => [`points.${c}`, "4"])) };
    expect(await redirects(() => setCourseGradingPoints(form({ ...five, "points.KOHAERENZ": "5" })))).toMatch(/error=points/);
    await expect(setCourseGradingPoints(form(five))).rejects.toThrow(/^REDIRECT /);
    expect(on(responseGradings, "update")[0].values).toMatchObject({ status: "OVERRIDDEN", coursePoints: { points: { AUSSPRACHE: 4, KOHAERENZ: 4 } } });
    expect(on(responseGradingRevisions, "insert")[0].values).toMatchObject({ after: { total: 20 } });
  });

  it("changes a grading that was confirmed before, keeping the boxes the teacher had ticked", async () => {
    Object.assign(store, { grading: grading({ status: "CONFIRMED", coursePoints: { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, commonErrors: ["CASE"] } }) });
    await expect(setCourseGradingPoints(form(points))).rejects.toThrow(/^REDIRECT /);
    expect(on(responseGradings, "update")[0].values).toMatchObject({ coursePoints: { commonErrors: ["CASE"] } });
  });

  it.each([
    ["a final result", { final: true }],
    ["an exam that is still running", { ended: false }],
    ["a level exam's grading", { mode: "LEVEL_VERIFICATION" }],
  ])("changes nothing for %s", async (_name, patch) => {
    Object.assign(store, patch);
    expect(await redirects(() => setCourseGradingPoints(form(points)))).toMatch(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("changes nothing on a hiring invitation in the same organisation", async () => {
    store.solution = "HIRING";
    expect(await redirects(() => setCourseGradingPoints(form(points)))).toBe("REDIRECT /exam/students");
    expect(writes).toEqual([]);
  });
});

describe("setCourseCommonErrors", () => {
  const decided = { points: { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 1 }, commonErrors: ["CASE" as const] };

  it("replaces the boxes on a decided writing grading and leaves its points and status alone", async () => {
    Object.assign(store, { grading: grading({ status: "CONFIRMED", coursePoints: decided }) });
    await expect(setCourseCommonErrors(form({ gradingId: "g1", tab: "WRITING", commonErrors: ["SPELLING", "TOO_SHORT"] }))).rejects.toThrow("REDIRECT /exam/students/a1?tab=WRITING");
    expect(calls).toHaveBeenCalledWith("requireUser", "result:grade");
    const [update] = on(responseGradings, "update");
    expect(update.values).toMatchObject({ coursePoints: { points: decided.points, commonErrors: ["TOO_SHORT", "SPELLING"] } });
    expect(update.values).not.toHaveProperty("status");
    expect(on(responseGradingRevisions, "insert")[0].values).toMatchObject({ before: { commonErrors: ["CASE"] }, after: { commonErrors: ["TOO_SHORT", "SPELLING"] }, changedBy: "u1" });
    expect(on(auditLogs, "insert")[0].values).toMatchObject({ action: "grading.course_common_errors" });
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("can clear every box", async () => {
    Object.assign(store, { grading: grading({ status: "OVERRIDDEN", coursePoints: decided }) });
    await expect(setCourseCommonErrors(form({ gradingId: "g1" }))).rejects.toThrow(/^REDIRECT /);
    expect(on(responseGradings, "update")[0].values).toMatchObject({ coursePoints: { commonErrors: [] } });
  });

  it("waits for a decision: the boxes of an undecided grading travel with its confirm or change", async () => {
    expect(await redirects(() => setCourseCommonErrors(form({ gradingId: "g1", tab: "WRITING", commonErrors: "CASE" })))).toBe("REDIRECT /exam/students/a1?tab=WRITING&error=undecided");
    expect(writes).toEqual([]);
  });

  it("refuses an unknown box, and a speaking task has none", async () => {
    Object.assign(store, { grading: grading({ status: "CONFIRMED", coursePoints: decided }) });
    expect(await redirects(() => setCourseCommonErrors(form({ gradingId: "g1", commonErrors: "MADE_UP" })))).toMatch(/error=errors/);
    store.section = "SPEAKING";
    expect(await redirects(() => setCourseCommonErrors(form({ gradingId: "g1", commonErrors: "CASE" })))).toMatch(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("changes nothing for a final result", async () => {
    Object.assign(store, { final: true, grading: grading({ status: "CONFIRMED", coursePoints: decided }) });
    expect(await redirects(() => setCourseCommonErrors(form({ gradingId: "g1", commonErrors: "CASE" })))).toMatch(/^REDIRECT /);
    expect(writes).toEqual([]);
  });
});

describe("overrideCourseOutcome", () => {
  it("stores the teacher's FAIL with the others' overrides, a revision of the outcome and an audit row, then recomputes", async () => {
    store.result = { id: "r1", status: "AWAITING_REVIEW", skillOverrides: { SPEAKING: { level: "B1", decider: "TEACHER", userId: "u0", reason: "x", at: "t" } }, computed: { course: { outcome: "PASS" } } };
    await expect(overrideCourseOutcome(form({ assessmentId: "a1", outcome: "FAIL", reason: "Anwesenheit zu gering" }))).rejects.toThrow("REDIRECT /exam/students/a1");
    expect(calls).toHaveBeenCalledWith("requireUser", "result:finalize");
    const [update] = on(examResults, "update");
    const overrides = update.values.skillOverrides as Record<string, Record<string, unknown>>;
    expect(overrides.SPEAKING).toMatchObject({ level: "B1" });
    expect(overrides.COURSE_OUTCOME).toMatchObject({ level: "FAIL", decider: "TEACHER", userId: "u1", reason: "Anwesenheit zu gering" });
    expect(on(examResultRevisions, "insert")[0].values).toMatchObject({ resultId: "r1", field: "course_outcome", before: "PASS", after: "FAIL", reason: "Anwesenheit zu gering", changedBy: "u1" });
    expect(on(auditLogs, "insert")[0].values).toMatchObject({ action: "result.override_course_outcome", subjectType: "exam_result", subjectId: "r1", meta: { from: "PASS", to: "FAIL" } });
    expect(calls).toHaveBeenCalledWith("recomputeResult", "t1");
  });

  it("records the earlier decision as the revision's before when it is changed again", async () => {
    store.result = { id: "r1", status: "AWAITING_REVIEW", skillOverrides: { COURSE_OUTCOME: { level: "FAIL", decider: "TEACHER", userId: "u0", reason: "x", at: "t" } }, computed: { course: { outcome: "PASS" } } };
    await expect(overrideCourseOutcome(form({ assessmentId: "a1", outcome: "PASS", reason: "Nachprüfung bestanden" }))).rejects.toThrow(/^REDIRECT /);
    expect(on(examResultRevisions, "insert")[0].values).toMatchObject({ before: "FAIL", after: "PASS" });
  });

  it("wants PASS or FAIL and a reason of three characters", async () => {
    for (const fields of [{ outcome: "MAYBE", reason: "gute Gründe" }, { outcome: "PASS", reason: "" }, { outcome: "PASS", reason: "ja" }, { outcome: "INCONCLUSIVE", reason: "gute Gründe" }]) {
      expect(await redirects(() => overrideCourseOutcome(form({ assessmentId: "a1", ...fields })))).toBe("REDIRECT /exam/students/a1?error=reason");
    }
    expect(writes).toEqual([]);
  });

  it.each([
    ["a final result", { result: { id: "r1", status: "FINAL", skillOverrides: {}, computed: null } }],
    ["a level exam", { mode: "PLACEMENT" }],
    ["an attempt with no result", { result: null }],
  ])("changes nothing for %s", async (_name, patch) => {
    Object.assign(store, patch);
    expect(await redirects(() => overrideCourseOutcome(form({ assessmentId: "a1", outcome: "PASS", reason: "gute Gründe" })))).toMatch(/^REDIRECT /);
    expect(writes).toEqual([]);
  });

  it("changes nothing on a hiring invitation in the same organisation", async () => {
    store.solution = "HIRING";
    expect(await redirects(() => overrideCourseOutcome(form({ assessmentId: "a1", outcome: "PASS", reason: "gute Gründe" })))).toBe("REDIRECT /exam/students");
    expect(writes).toEqual([]);
  });
});
