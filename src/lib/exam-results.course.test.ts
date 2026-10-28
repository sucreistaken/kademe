import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A course test through `recomputeResult` and `finalizeResult`: the database is
 * mocked, so this checks what the two functions read and write, not SQL. The
 * numbers themselves are tested in `exam/course/*.test.ts`.
 */

const h = vi.hoisted(() => ({
  /** Rows each awaited statement answers, in order. */
  results: [] as unknown[][],
  inserts: [] as Array<Record<string, unknown>>,
  conflictSets: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/db", () => {
  const statement = () => {
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "onConflictDoNothing", "returning", "orderBy"]) chain[name] = () => chain;
    chain.values = (values: Record<string, unknown>) => {
      h.inserts.push(values);
      return chain;
    };
    chain.onConflictDoUpdate = (config: { set: Record<string, unknown> }) => {
      h.conflictSets.push(config.set);
      return chain;
    };
    chain.set = (values: Record<string, unknown>) => {
      h.updates.push(values);
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(h.results.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { db: { select: statement, insert: statement, update: statement } };
});
vi.mock("@/lib/ai-runs", () => ({ callJson: vi.fn() }));
vi.mock("@/lib/queue", () => ({ enqueueGrading: vi.fn() }));

import { finalizeResult, recomputeResult } from "./exam-results";
import { INTERIM_RULES } from "./exam/course/catalog";
import { courseOutcomeOverrideEntry, COURSE_OUTCOME_OVERRIDE_KEY } from "./exam/course/decisions";
import type { ComputedResult } from "./exam/result";

const section = (name: string) => ({ section: name, enabled: true, durationMinutes: 10, adaptive: false });
const config = {
  sections: ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"].map(section),
  course: { key: "B1.1", form: "A", rules: INTERIM_RULES },
  autoRelease: false,
};
const attempt = (over: Record<string, unknown> = {}) => ({ id: "att-1", assessmentId: "as-1", completedAt: new Date("2026-10-28T10:00:00Z"), terminatedAt: null, ...over });
const head = (over: { attempt?: Record<string, unknown>; mode?: string } = {}) => [{ attempt: attempt(over.attempt), exam: { mode: over.mode ?? "COURSE_TEST", blueprintSnapshot: config } }];

const run = (name: string) => ({ id: `run-${name}`, section: name, submittedAt: new Date("2026-10-28T09:50:00Z"), completion: "COMPLETE" });
const choice = {
  id: "i",
  section: "READING",
  level: "B1",
  difficulty: 0,
  type: "SINGLE_CHOICE",
  skillTag: "x",
  stimulusId: null,
  orderInStimulus: 0,
  prompt: "Q",
  content: { kind: "CHOICE", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
  key: { kind: "CHOICE", correct: ["a"] },
  rubric: null,
  points: 1,
  stimulus: null,
};
const writing = { ...choice, section: "WRITING", type: "WRITING_PROMPT", content: { kind: "WRITING", minWords: 60, maxWords: 80 }, key: { kind: "NONE" } };
const speaking = { ...choice, section: "SPEAKING", type: "SPEAKING_PROMPT", content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 }, key: { kind: "NONE" } };
const response = (id: string, name: string, itemSnapshot: unknown, answer: unknown, score: number | null, sequence = 1) => ({ id, sectionRunId: `run-${name}`, sequence, itemSnapshot, answer, score });

const SECTION_NAMES = ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"];
const runs = SECTION_NAMES.map(run);
const responses = [
  response("r1", "READING", choice, { choiceIds: ["a"] }, 1),
  response("g1", "GRAMMAR", { ...choice, section: "GRAMMAR" }, { choiceIds: ["a"] }, 1),
  response("l1", "LISTENING", { ...choice, section: "LISTENING" }, { choiceIds: ["b"] }, 0),
  response("w1", "WRITING", writing, { text: "Sehr geehrte Frau Neumann" }, null),
  response("s1", "SPEAKING", speaking, { mediaAssetId: "m1" }, null),
  response("s2", "SPEAKING", speaking, { mediaAssetId: "m2" }, null, 2),
];
const criteria = (ids: string[], points: number, max: number) => ids.map((id) => ({ id, points, max, rationale: "x" }));
const proposal = (section: "WRITING" | "SPEAKING", points: number) => ({
  kind: "COURSE_RUBRIC",
  section,
  criteria: criteria(section === "WRITING" ? ["INHALT", "WORTSCHATZ", "GRAMMATIK"] : ["KOMMUNIKATION", "WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "KOHAERENZ"], points, section === "WRITING" ? 3 : 4),
  advice: "x",
});
const grading = (itemResponseId: string, status: string, section: "WRITING" | "SPEAKING", points: number, coursePoints: unknown = null) => ({
  itemResponseId,
  status,
  courseProposal: status === "PENDING" || status === "AI_FAILED" ? null : proposal(section, points),
  coursePoints,
});

/** What `recomputeResult` reads, in order: the attempt, the owner, runs, responses, gradings, acceptances, the stored result. */
function queue(over: { head?: unknown[]; gradings?: unknown[]; stored?: unknown[] } = {}) {
  h.results = [over.head ?? head(), [{ orgId: "org-1" }], runs, responses, over.gradings ?? [], [], over.stored ?? []];
}

beforeEach(() => {
  h.results = [];
  h.inserts = [];
  h.conflictSets = [];
  h.updates = [];
});

describe("recomputeResult for a course test", () => {
  it("writes raw points and the verdict, with no skill levels, and waits for the teacher", async () => {
    queue({ gradings: [grading("w1", "AI_PROPOSED", "WRITING", 2), grading("s1", "AI_PROPOSED", "SPEAKING", 3), grading("s2", "AI_PROPOSED", "SPEAKING", 3)] });
    await recomputeResult("att-1");
    expect(h.inserts).toHaveLength(1);
    const written = h.inserts[0] as { attemptId: string; status: string; computed: ComputedResult };
    expect(written).toMatchObject({ attemptId: "att-1", status: "AWAITING_REVIEW" });
    // 1 + 1 + 0 objective units of 3, writing 6 of 9, speaking 15 of 20 (the mean of two tasks of 15): 23 of 32, a pass at 20.
    expect(written.computed.course).toMatchObject({ key: "B1.1", form: "A", total: 23, max: 32, outcome: "PASS", recommendation: "B1.2" });
    expect(written.computed).toMatchObject({ overall: null, verification: null, placement: null, pooled: null, status: "AWAITING_REVIEW" });
    expect(written.computed.skills.WRITING).toMatchObject({ level: null, decider: "AI" });
    // The same values go to the update branch of the upsert.
    expect(h.conflictSets[0]).toMatchObject({ status: "AWAITING_REVIEW", computed: written.computed });
    // It never finalizes by itself.
    expect(h.updates).toEqual([]);
  });

  it("is awaiting grading while the AI has not answered, and in progress while the student is still in the exam", async () => {
    queue({ gradings: [grading("w1", "PENDING", "WRITING", 0), grading("s1", "AI_PROPOSED", "SPEAKING", 3), grading("s2", "AI_PROPOSED", "SPEAKING", 3)] });
    await recomputeResult("att-1");
    expect(h.inserts[0]).toMatchObject({ status: "AWAITING_GRADING" });
    expect((h.inserts[0] as { computed: ComputedResult }).computed.course?.outcome).toBeNull();

    h.inserts = [];
    queue({ head: head({ attempt: { completedAt: null } }), gradings: [] });
    await recomputeResult("att-1");
    expect(h.inserts[0]).toMatchObject({ status: "IN_PROGRESS" });
  });

  it("leaves a failed AI grading to the teacher: awaiting review, not awaiting grading, but no points yet", async () => {
    queue({ gradings: [grading("w1", "AI_FAILED", "WRITING", 0), grading("s1", "AI_PROPOSED", "SPEAKING", 3), grading("s2", "AI_PROPOSED", "SPEAKING", 3)] });
    await recomputeResult("att-1");
    const written = h.inserts[0] as { status: string; computed: ComputedResult };
    expect(written.status).toBe("AWAITING_REVIEW");
    expect(written.computed.status).toBe("AWAITING_GRADING");
    expect(written.computed.course?.sections.WRITING?.pending).toBe(true);
  });

  it("keeps a result that is already final final", async () => {
    queue({ gradings: [grading("w1", "CONFIRMED", "WRITING", 2), grading("s1", "CONFIRMED", "SPEAKING", 3), grading("s2", "CONFIRMED", "SPEAKING", 3)], stored: [{ status: "FINAL" }] });
    await recomputeResult("att-1");
    expect(h.inserts[0]).toMatchObject({ status: "FINAL" });
    expect((h.inserts[0] as { computed: ComputedResult }).computed.status).toBe("READY");
  });
});

describe("finalizeResult for a course test", () => {
  const computed = (over: Partial<ComputedResult> = {}, course: Partial<NonNullable<ComputedResult["course"]>> = {}): ComputedResult => ({
    skills: { WRITING: { level: null, decider: "TEACHER", pending: false, insufficient: false }, SPEAKING: { level: null, decider: "TEACHER", pending: false, insufficient: false } },
    overall: null,
    pooled: null,
    status: "READY",
    verification: null,
    placement: null,
    course: {
      key: "B1",
      form: "A",
      sections: { READING: { points: 8, max: 10, pending: false } },
      total: 8,
      max: 10,
      pct: 80,
      outcome: "FAIL",
      reasons: ["WRITING_CONTENT_ZERO"],
      recommendation: "B1.2",
      focus: "WRITING",
      ...course,
    },
    ...over,
  });
  /** finalizeResult reads: the result, the exam config, the attempt; then the update answers. */
  const queueFinal = (stored: Record<string, unknown>) => {
    h.results = [[stored], [{ config }], [{ id: "att-1", integrityOutcome: null, integritySummary: null, terminatedAt: null }], [{ id: "res-1" }]];
  };

  it("freezes the points' verdict as the final outcome, with no level", async () => {
    queueFinal({ computed: computed(), finalizedAt: null, skillOverrides: {} });
    expect(await finalizeResult("att-1", "teacher-1", null)).toEqual({ ok: true });
    expect(h.updates[0]).toMatchObject({ status: "FINAL", finalOverall: null, finalSkills: {}, finalOutcome: "FAIL", finalizedBy: "teacher-1" });
  });

  it("freezes the teacher's override instead of the points' verdict", async () => {
    const entry = courseOutcomeOverrideEntry({ outcome: "PASS", reason: "Oral part retaken", userId: "teacher-1" });
    queueFinal({ computed: computed(), finalizedAt: null, skillOverrides: { [COURSE_OUTCOME_OVERRIDE_KEY]: entry } });
    expect(await finalizeResult("att-1", "teacher-1", null)).toEqual({ ok: true });
    expect(h.updates[0]).toMatchObject({ finalOutcome: "PASS" });
  });

  it("refuses while a writing or speaking task is only proposed", async () => {
    const open = computed({ status: "AWAITING_REVIEW", skills: { WRITING: { level: null, decider: "AI", pending: false, insufficient: false } } });
    queueFinal({ computed: open, finalizedAt: null, skillOverrides: {} });
    expect(await finalizeResult("att-1", "teacher-1", null)).toEqual({ ok: false, code: "UNDECIDED" });
    expect(h.updates).toEqual([]);
  });

  it("refuses while a section has no points", async () => {
    const waiting = computed({ status: "AWAITING_GRADING" }, { outcome: null, total: null, recommendation: null });
    queueFinal({ computed: waiting, finalizedAt: null, skillOverrides: {} });
    expect(await finalizeResult("att-1", "teacher-1", null)).toEqual({ ok: false, code: "NOT_READY" });
  });

  it("refuses a second time", async () => {
    queueFinal({ computed: computed(), finalizedAt: new Date(), skillOverrides: {} });
    expect(await finalizeResult("att-1", "teacher-1", null)).toEqual({ ok: false, code: "ALREADY_FINAL" });
  });
});
