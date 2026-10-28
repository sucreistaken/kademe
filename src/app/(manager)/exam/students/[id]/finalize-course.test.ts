import { beforeEach, describe, expect, it, vi } from "vitest";
import { examResults } from "@/db/schema";

/**
 * Finalizing a course test freezes the teacher's PASS or FAIL as the final
 * outcome even when the engine's computed outcome says otherwise (the override
 * is kept in skill_overrides, see course-actions.ts).
 */
type Write = { table: unknown; values: Record<string, unknown> };
const writes: Write[] = [];
const state = { selects: 0, fresh: {} as Record<string, unknown> };

vi.mock("@/db", () => ({
  db: {
    select: () => {
      // The first read is the action's own lookup of the result; the second is the fresh row after finalizing.
      const n = state.selects++;
      const rows = n === 0 ? [{ result: { id: "r1", status: "AWAITING_REVIEW" }, attempt: { id: "t1", completedAt: new Date("2026-10-28T10:00:00Z"), terminatedAt: null }, assessment: { id: "a1" } }] : [state.fresh];
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    },
    update: (table: unknown) => write(table),
    insert: (table: unknown) => write(table),
  },
}));
function write(table: unknown) {
  let values: Record<string, unknown> = {};
  const chain = {
    set: (v: Record<string, unknown>) => ((values = v), chain),
    values: (v: Record<string, unknown>) => ((values = v), chain),
    where: () => chain,
    then: (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      writes.push({ table, values });
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
vi.mock("@/server/session", () => ({ requireUser: async () => ({ id: "u1", orgId: "o1", email: "m@x", name: "M", role: "MANAGER" }) }));
vi.mock("@/lib/exam-results", () => ({ recomputeResult: async () => undefined, finalizeResult: async () => ({ ok: true }) }));
vi.mock("@/server/proctoring", () => ({ recomputeIntegrity: async () => undefined }));

import { finalize } from "./actions";

const form = () => {
  const data = new FormData();
  data.set("assessmentId", "a1");
  return data;
};
const override = (level: string) => ({ COURSE_OUTCOME: { level, decider: "TEACHER", userId: "u0", reason: "Nachprüfung", at: "2026-10-28T10:00:00.000Z" } });
const outcomeWrites = () => writes.filter((w) => w.table === examResults && "finalOutcome" in w.values);

beforeEach(() => {
  writes.length = 0;
  state.selects = 0;
});

describe("finalize on a course test", () => {
  it("freezes the teacher's FAIL when the engine froze PASS", async () => {
    state.fresh = { id: "r1", computed: { course: { outcome: "PASS" } }, skillOverrides: override("FAIL"), finalOutcome: "PASS" };
    await expect(finalize(form())).rejects.toThrow("REDIRECT /exam/students/a1");
    expect(outcomeWrites().map((w) => w.values.finalOutcome)).toEqual(["FAIL"]);
  });

  it("freezes the teacher's PASS when the engine froze nothing", async () => {
    state.fresh = { id: "r1", computed: { course: { outcome: "FAIL" } }, skillOverrides: override("PASS"), finalOutcome: null };
    await expect(finalize(form())).rejects.toThrow(/^REDIRECT /);
    expect(outcomeWrites().map((w) => w.values.finalOutcome)).toEqual(["PASS"]);
  });

  it("writes nothing more when the engine already applied the decision", async () => {
    state.fresh = { id: "r1", computed: { course: { outcome: "FAIL" } }, skillOverrides: override("FAIL"), finalOutcome: "FAIL" };
    await expect(finalize(form())).rejects.toThrow(/^REDIRECT /);
    expect(outcomeWrites()).toEqual([]);
  });

  it("writes nothing when the teacher decided nothing", async () => {
    state.fresh = { id: "r1", computed: { course: { outcome: "PASS" } }, skillOverrides: {}, finalOutcome: "PASS" };
    await expect(finalize(form())).rejects.toThrow(/^REDIRECT /);
    expect(outcomeWrites()).toEqual([]);
  });

  it("leaves a level exam's result alone", async () => {
    state.fresh = { id: "r1", computed: { overall: "B1" }, skillOverrides: override("FAIL"), finalOutcome: "PASS" };
    await expect(finalize(form())).rejects.toThrow(/^REDIRECT /);
    expect(outcomeWrites()).toEqual([]);
  });
});
