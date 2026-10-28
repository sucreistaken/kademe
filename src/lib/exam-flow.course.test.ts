import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { items } from "@/db/schema";
import { courseBlueprint } from "@/lib/exam/course/config";
import { COURSE_TESTS, courseSections } from "@/lib/exam/course/catalog";
import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import { defaultBlueprint } from "@/lib/exam/blueprint";
import type { ExamMode } from "@/lib/exam/types";

/**
 * startSection and loadState for a course test, and the bank's pool queries,
 * over a stand-in database: every awaited chain resolves the next queued
 * result, every call is recorded (src/server/create/test-fake-db.ts). The SQL
 * itself is not run; the tests pin which rows are asked for (the where
 * clauses are rendered) and what is written.
 */
const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));

const ATTEMPT = { id: "att1", assessmentId: "a1", startedAt: null, deviceCheckedAt: new Date("2026-10-28T08:00:00Z"), completedAt: null, terminatedAt: null };
const consent = vi.hoisted(() => ({ given: true }));
vi.mock("@/lib/candidate-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/candidate-context")>()),
  currentAttempt: async () => ({ attempt: ATTEMPT, finished: false }),
  hasConsented: async () => consent.given,
}));

const exposure = vi.hoisted(() => ({
  seen: new Map<string, Set<string>>(),
  seenByCalls: 0,
  courseCalls: [] as unknown[][],
}));
vi.mock("@/server/exam-exposure", () => ({
  seenBy: async () => {
    exposure.seenByCalls += 1;
    return { itemIds: new Set(), stimulusIds: new Set() };
  },
  courseFormsSeenBy: async (...args: unknown[]) => {
    exposure.courseCalls.push(args);
    return exposure.seen;
  },
}));

import { formatsOf, loadPool, loadState, startSection, type ExamCandidateContext } from "./exam-flow";

type Plan = { id: string; courseOrder: number | null; orderInStimulus: number; audioKey: string | null };
const item = (id: string, courseOrder: number | null, over: Partial<Plan> = {}): Plan => ({ id, courseOrder, orderInStimulus: 0, audioKey: null, ...over });

/** An invitation to a course test; `form: undefined` leaves the snapshot's form unset, as an old or hand-made invitation has it. */
function ctxOf(over: { key?: CourseKey; form?: CourseForm | null; section?: string; mode?: ExamMode; noCourse?: boolean; positionAt?: number } = {}): ExamCandidateContext {
  const key = over.key ?? "B1.1";
  const config = over.mode && over.mode !== "COURSE_TEST" ? defaultBlueprint(over.mode) : courseBlueprint(key);
  if (config.course) config.course.form = over.form === undefined ? null : over.form;
  if (over.noCourse) delete config.course;
  return {
    link: { id: "link1", status: "NOT_STARTED", expiresAt: new Date("2026-11-30T00:00:00Z"), notBefore: null, firstSeenIp: null },
    assessment: { id: "a1", orgId: "o1", solution: "LANGUAGE_EXAM", blueprintId: "bp1", examName: COURSE_TESTS[key].germanName, mode: over.mode ?? "COURSE_TEST", claimedLevel: null, config },
    candidate: { id: "c1", fullName: "Ayşe Yılmaz", email: "Ayse@Ornek.com", phone: null, location: null },
    orgName: "Campus German",
    locale: "en",
  } as unknown as ExamCandidateContext;
}

/** The where clauses of the recorded queries, rendered to SQL with their parameters. */
function wheres(): Array<{ sql: string; params: unknown[] }> {
  return fake.calls.filter(([m]) => m === "where").map(([, a]) => new PgDialect().sqlToQuery(a[0] as SQL));
}
const written = (table: "values" | "set") => fake.calls.filter(([m]) => m === table).map(([, a]) => a[0] as Record<string, unknown>);

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  consent.given = true;
  exposure.seen = new Map();
  exposure.seenByCalls = 0;
  exposure.courseCalls = [];
});

describe("startSection: a course test serves the invitation's form", () => {
  it("plans the form's items of the section by course order, nothing drawn and nothing avoided", async () => {
    // The first awaited read is the section runs (none yet), the second the form's items, in the order the database returns them.
    fake.results = [[], [item("c", 3), item("a", 1), item("d", 4), item("b", 2)]];
    expect(await startSection(ctxOf({ key: "B1.1", form: "A" }), 1)).toEqual({ ok: true });
    const run = written("values").find((v) => v.section === "READING")!;
    expect(run.itemPlan).toEqual(["a", "b", "c", "d"]);
    expect(run.taskLevels).toBeNull();
    expect(run.navigable).toBe(true);
    expect(run.deadlineAt).toBeInstanceOf(Date);
    expect((run.deadlineAt as Date).getTime() - (run.startedAt as Date).getTime()).toBe(courseSections("B1.1")[0].minutes * 60_000);
    // No random draw, no exposure lookup, no bank pool: the one query for items is the form's.
    expect(exposure.seenByCalls).toBe(0);
    expect(exposure.courseCalls).toEqual([]);
    const forms = wheres().filter((w) => w.sql.includes('"items"."course_form" = $'));
    expect(forms).toHaveLength(1);
    expect(forms[0].params).toEqual(expect.arrayContaining(["o1", "READING", "APPROVED", "B1.1:A"]));
  });

  it("serves form B when the invitation says B, and the same plan on every call", async () => {
    for (let k = 0; k < 3; k++) {
      fake.calls = [];
      fake.results = [[], [item("y", 2), item("x", 1)]];
      await startSection(ctxOf({ key: "A2", form: "B" }), 1);
      expect(written("values").find((v) => v.section === "READING")!.itemPlan).toEqual(["x", "y"]);
      expect(wheres().find((w) => w.sql.includes('"items"."course_form" = $'))!.params).toContain("A2:B");
    }
  });

  it("asks writing and speaking at the course's own level, one level per task, and records speaking one way", async () => {
    // Speaking is the fifth section: queue the four finished runs the walk goes through.
    const done = (section: string) => ({ section, submittedAt: new Date("2026-10-28T09:00:00Z"), startedAt: new Date("2026-10-28T08:00:00Z") });
    fake.results = [[done("READING"), done("GRAMMAR"), done("LISTENING"), done("WRITING")], [item("proposal", 3), item("intro", 1), item("card", 2)]];
    await startSection(ctxOf({ key: "B2", form: "A" }), 5);
    const run = written("values").find((v) => v.section === "SPEAKING")!;
    expect(run.itemPlan).toEqual(["intro", "card", "proposal"]);
    expect(run.taskLevels).toEqual(["B2", "B2", "B2"]);
    expect(run.navigable).toBe(false);
    expect((run.deadlineAt as Date).getTime() - (run.startedAt as Date).getTime()).toBe(15 * 60_000);
  });

  it("gives a Zwischentest two speaking tasks and a writing section one task at the course's level", async () => {
    const done = (section: string) => ({ section, submittedAt: new Date("2026-10-28T09:00:00Z"), startedAt: new Date("2026-10-28T08:00:00Z") });
    fake.results = [[done("READING"), done("GRAMMAR"), done("LISTENING")], [item("email", 1)]];
    await startSection(ctxOf({ key: "A1.1", form: "A" }), 4);
    const run = written("values").find((v) => v.section === "WRITING")!;
    expect(run).toMatchObject({ itemPlan: ["email"], taskLevels: ["A1"], navigable: true });
  });

  it("leaves a listening item out when its clip has no audio", async () => {
    const done = (section: string) => ({ section, submittedAt: new Date("2026-10-28T09:00:00Z"), startedAt: new Date("2026-10-28T08:00:00Z") });
    fake.results = [[done("READING"), done("GRAMMAR")], [item("heard", 1, { audioKey: "a.mp3" }), item("silent", 2), item("heard-2", 3, { audioKey: "b.mp3" })]];
    await startSection(ctxOf({ key: "B1", form: "A" }), 3);
    expect(written("values").find((v) => v.section === "LISTENING")!.itemPlan).toEqual(["heard", "heard-2"]);
  });

  it("skips a section the form has no items in, as it skips an empty bank", async () => {
    fake.results = [[], []];
    expect(await startSection(ctxOf({ key: "B1.1", form: "A" }), 1)).toEqual({ ok: true });
    expect(written("values").find((v) => v.section === "READING")).toMatchObject({ completion: "SKIPPED", stopReason: "BANK_EMPTY" });
  });

  it("serves nothing when the exam does not say which course it is", async () => {
    fake.results = [[], []];
    expect(await startSection(ctxOf({ form: "A", noCourse: true }), 1)).toEqual({ ok: true });
    expect(written("values").find((v) => v.section === "READING")).toMatchObject({ completion: "SKIPPED", stopReason: "BANK_EMPTY" });
    expect(fake.calls.some(([m, a]) => m === "from" && a[0] === items)).toBe(false);
  });

  it("refuses a section that is not the current one or an exam that was not entered, like every exam", async () => {
    expect(await startSection(ctxOf({ form: "A" }), 3)).toEqual({ ok: false, code: "SECTION_MISMATCH" });
    consent.given = false;
    expect(await startSection(ctxOf({ form: "A" }), 1)).toEqual({ ok: false, code: "NOT_READY" });
  });
});

describe("startSection: an invitation without a form", () => {
  const written1 = () => written("set").find((s) => "blueprintSnapshot" in s)!;

  it("serves the form its student has not seen and keeps that choice for the next section and a reload", async () => {
    exposure.seen = new Map([["ayse@ornek.com", new Set(["A"])]]);
    // runs, the write-back (returns the stored snapshot), the form's items.
    fake.results = [[], [{ snapshot: { course: { key: "B1.1", form: "B" } } }], [item("only", 1)]];
    await startSection(ctxOf({ key: "B1.1", form: null }), 1);
    expect(exposure.courseCalls).toEqual([["o1", ["ayse@ornek.com"], "B1.1", "a1"]]);
    expect(wheres().find((w) => w.sql.includes('"items"."course_form" = $'))!.params).toContain("B1.1:B");
    // Written once into the snapshot, and only while it is still unset.
    expect(written1()).toBeDefined();
    const guard = wheres().find((w) => w.sql.includes("#>> '{course,form}' is null"))!;
    expect(guard.params).toContain("a1");
    const set = new PgDialect().sqlToQuery(written1().blueprintSnapshot as SQL);
    expect(set.sql).toContain("jsonb_set");
    expect(set.sql).toContain("'{course,form}'");
    expect(set.params).toEqual(['"B"']);
  });

  it("serves A when the student sat none or both forms", async () => {
    for (const sat of [new Set<string>(), new Set(["A", "B"])]) {
      fake.calls = [];
      exposure.seen = new Map([["ayse@ornek.com", sat]]);
      fake.results = [[], [{ snapshot: { course: { key: "B1.1", form: "A" } } }], [item("only", 1)]];
      await startSection(ctxOf({ key: "B1.1", form: null }), 1);
      expect(wheres().find((w) => w.sql.includes('"items"."course_form" = $'))!.params).toContain("B1.1:A");
    }
  });

  it("serves B when the student sat A, even if the write-back finds the form already set to B by another request", async () => {
    exposure.seen = new Map();
    // The guarded update matched no row (another request set the form first); the re-read returns the winner's form.
    fake.results = [[], [], [{ snapshot: { course: { key: "B1.1", form: "B" } } }], [item("only", 1)]];
    await startSection(ctxOf({ key: "B1.1", form: null }), 1);
    expect(wheres().find((w) => w.sql.includes('"items"."course_form" = $'))!.params).toContain("B1.1:B");
  });

  it("writes nothing back when the snapshot already names the form", async () => {
    fake.results = [[], [item("only", 1)]];
    await startSection(ctxOf({ key: "B1.1", form: "B" }), 1);
    expect(written("set").some((s) => "blueprintSnapshot" in s)).toBe(false);
    expect(exposure.courseCalls).toEqual([]);
  });
});

describe("the bank's queries leave course items out", () => {
  it("loadPool asks for items and texts without a course form", async () => {
    fake.results = [[]];
    await loadPool("o1", "READING");
    const [w] = wheres();
    expect(w.sql).toContain('"items"."course_form" is null');
    expect(w.sql).toContain('"stimuli"."course_form" is null');
    expect(w.params).toEqual(expect.arrayContaining(["o1", "READING", "APPROVED"]));
  });

  it("formatsOf asks for items without a course form", async () => {
    fake.results = [[]];
    await formatsOf("o1", "GRAMMAR");
    expect(wheres()[0].sql).toContain('"items"."course_form" is null');
  });

  it("a placement or level check section still draws from that pool, not from a form", async () => {
    // First read: the section runs; then the pool, the formats and the provisional-level runs.
    fake.results = [[]];
    const ctx = ctxOf({ mode: "PLACEMENT" });
    await startSection(ctx, 1);
    expect(exposure.seenByCalls).toBe(1);
    expect(wheres().some((w) => w.sql.includes('"items"."course_form" = $'))).toBe(false);
    expect(wheres().some((w) => w.sql.includes('"items"."course_form" is null'))).toBe(true);
  });
});

describe("loadState: what the student is told before the first section", () => {
  it("counts a course section in the catalog's scored units and the speaking and writing sections in tasks", async () => {
    consent.given = false;
    const fin = await loadState(ctxOf({ key: "B1", form: "A" }));
    expect(fin.step).toBe("CONSENT");
    expect(fin.mode).toBe("COURSE_TEST");
    expect(fin.claimedLevel).toBeNull();
    expect(fin.examName).toBe("Abschlusstest B1");
    expect(fin.sections.map((s) => [s.section, s.minutes, s.itemsLabel])).toEqual([
      ["READING", 20, "10"],
      ["GRAMMAR", 20, "25"],
      ["LISTENING", 15, "10"],
      ["WRITING", 25, "1"],
      ["SPEAKING", 15, "3"],
    ]);
    expect(fin.estimatedMinutes).toBe(95);
    expect(fin.sections.map((s) => [s.navigable, s.textOnly, s.textKinds.length])).toEqual([
      [true, false, 0],
      [true, false, 0],
      [true, false, 0],
      [true, false, 0],
      [false, false, 0],
    ]);
    const interim = await loadState(ctxOf({ key: "A2.1", form: "B" }));
    expect(interim.examName).toBe("Zwischentest A2.1");
    expect(interim.sections.map((s) => s.itemsLabel)).toEqual(["6", "15", "6", "1", "2"]);
  });

  it("shows the German name whatever language the exam was published in", async () => {
    consent.given = false;
    for (const stored of ["Kurs sonu sınavı B1", "End-of-course test B1", "Abschlusstest B1"]) {
      const ctx = ctxOf({ key: "B1", form: "A" });
      ctx.assessment.examName = stored;
      expect((await loadState(ctx)).examName).toBe("Abschlusstest B1");
    }
  });
});
