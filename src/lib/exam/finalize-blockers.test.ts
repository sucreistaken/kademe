import { describe, expect, it } from "vitest";
import { blockerErrorCode, finalizeBlockers, finalizeChecklist, waitingSections } from "./finalize-blockers";
import type { ComputedResult, SkillResult } from "./result";

const skill = (over: Partial<SkillResult>): SkillResult => ({ level: "B1", decider: "ENGINE", pending: false, insufficient: false, ...over });
const computed = (skills: ComputedResult["skills"], over: Partial<ComputedResult> = {}): ComputedResult => ({
  skills,
  overall: "B1",
  pooled: null,
  status: "READY",
  verification: null,
  ...over,
});

describe("finalizeBlockers", () => {
  it("is empty for a result every skill of which is decided", () => {
    expect(finalizeBlockers(computed({ READING: skill({}), WRITING: skill({ decider: "TEACHER" }) }))).toEqual([]);
  });
  it("blocks while the student is still in the exam", () => {
    expect(finalizeBlockers(computed({}), false)).toEqual([{ code: "RUNNING" }]);
  });
  it("blocks with no computed result", () => {
    expect(finalizeBlockers(null)).toEqual([{ code: "NO_RESULT" }]);
  });
  it("lists every skill that still carries an AI level, not only the first", () => {
    const c = computed({ WRITING: skill({ decider: "AI" }), SPEAKING: skill({ decider: "AI" }) }, { status: "AWAITING_REVIEW" });
    expect(finalizeBlockers(c)).toEqual([{ code: "UNDECIDED", sections: ["WRITING", "SPEAKING"] }]);
  });
  it("blocks on a pending grading, and reports the AI skills next to it", () => {
    const c = computed({ WRITING: skill({ level: null, decider: null, pending: true }), SPEAKING: skill({ decider: "AI" }) }, { status: "AWAITING_GRADING", overall: null });
    expect(finalizeBlockers(c)).toEqual([{ code: "GRADING" }, { code: "UNDECIDED", sections: ["SPEAKING"] }]);
  });
  it("blocks when every skill is decided but no overall level exists", () => {
    expect(finalizeBlockers(computed({ READING: skill({}) }, { overall: null }))).toEqual([{ code: "NO_OVERALL" }]);
  });
  it("maps the first blocker to the redirect code", () => {
    expect(blockerErrorCode({ code: "RUNNING" })).toBe("running");
    expect(blockerErrorCode({ code: "GRADING" })).toBe("NOT_READY");
    expect(blockerErrorCode({ code: "NO_OVERALL" })).toBe("NOT_READY");
    expect(blockerErrorCode({ code: "UNDECIDED", sections: ["WRITING"] })).toBe("UNDECIDED");
  });
});

describe("finalizeChecklist", () => {
  const submitted = new Set(["READING", "WRITING", "SPEAKING"]);
  it("marks objective sections done and points a writing section at its first open task", () => {
    const c = computed({ READING: skill({}), WRITING: skill({ decider: "AI" }), SPEAKING: skill({ decider: "TEACHER" }) }, { status: "AWAITING_REVIEW" });
    const r = finalizeChecklist({
      sections: ["READING", "WRITING", "SPEAKING"],
      computed: c,
      submitted,
      tasks: { WRITING: [{ id: "w1", status: "CONFIRMED", decided: true }, { id: "w2", status: "AI_PROPOSED", decided: false }], SPEAKING: [{ id: "s1", status: "CONFIRMED", decided: true }] },
    });
    expect(r.rows.map((x) => [x.section, x.kind, x.state])).toEqual([["READING", "AUTO", "done"], ["WRITING", "TEACHER", "todo"], ["SPEAKING", "TEACHER", "done"]]);
    expect(r.rows[1]).toMatchObject({ open: 1, total: 2, firstOpenResponseId: "w2" });
    expect([r.done, r.total]).toEqual([2, 3]);
  });
  it("lets the teacher act while every open task is still PENDING, and counts the pending ones", () => {
    const c = computed({ WRITING: skill({ level: null, decider: null, pending: true }) }, { status: "AWAITING_GRADING", overall: null });
    const r = finalizeChecklist({ sections: ["WRITING"], computed: c, submitted: new Set(["WRITING"]), tasks: { WRITING: [{ id: "w1", status: "PENDING", decided: false }, { id: "w2", status: "AI_PROPOSED", decided: false }] } });
    expect(r.rows[0]).toMatchObject({ state: "todo", open: 2, aiPending: 1, firstOpenResponseId: "w2" });
    const only = finalizeChecklist({ sections: ["WRITING"], computed: c, submitted: new Set(["WRITING"]), tasks: { WRITING: [{ id: "w1", status: "PENDING", decided: false }] } });
    expect(only.rows[0]).toMatchObject({ state: "todo", open: 1, aiPending: 1, firstOpenResponseId: "w1" });
  });
  it("keeps aiPending only when there is no task to grade yet", () => {
    const c = computed({ WRITING: skill({ level: null, decider: null, pending: true }) }, { status: "AWAITING_GRADING", overall: null });
    const r = finalizeChecklist({ sections: ["WRITING"], computed: c, submitted: new Set(["WRITING"]), tasks: { WRITING: [] } });
    expect(r.rows[0].state).toBe("aiPending");
  });
  it("lists every section waiting for the teacher, and not a running one", () => {
    const c = computed({ WRITING: skill({ level: null, decider: null, pending: true }), SPEAKING: skill({ decider: "AI" }) }, { status: "AWAITING_GRADING", overall: null });
    const r = finalizeChecklist({
      sections: ["WRITING", "SPEAKING", "READING"],
      computed: c,
      submitted: new Set(["WRITING", "SPEAKING"]),
      tasks: { WRITING: [{ id: "w1", status: "PENDING", decided: false }], SPEAKING: [{ id: "s1", status: "AI_PROPOSED", decided: false }, { id: "s2", status: "AI_PROPOSED", decided: false }] },
    });
    expect(waitingSections(r.rows)).toEqual([{ section: "WRITING", open: 1 }, { section: "SPEAKING", open: 2 }]);
    const running = finalizeChecklist({ sections: ["SPEAKING"], computed: c, submitted: new Set(), tasks: { SPEAKING: [{ id: "s1", status: "PENDING", decided: false }] } });
    expect(running.rows[0].state).toBe("running");
    expect(waitingSections(running.rows)).toEqual([]);
  });
  it("counts a section that was not handed in as running", () => {
    const r = finalizeChecklist({ sections: ["READING", "SPEAKING"], computed: null, submitted: new Set(), tasks: {} });
    expect(r.rows.map((x) => x.state)).toEqual(["running", "running"]);
    expect(r.done).toBe(0);
  });
});
