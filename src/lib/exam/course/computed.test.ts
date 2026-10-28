import { describe, expect, it } from "vitest";
import type { ItemSnapshot } from "../types";
import { defaultCourseRules } from "./catalog";
import { buildCourseComputed, type CourseComputedInput, type CourseGradingRow, type CourseResponseView, type CourseRunView } from "./computed";
import type { CourseRubricProposal } from "./types";

const base = { id: "i", level: "B1", difficulty: 0, stimulusId: null, orderInStimulus: 0, rubric: null, points: 1, stimulus: null, skillTag: "x" } as const;

const choice = { ...base, section: "READING", type: "SINGLE_CHOICE", prompt: "Q", content: { kind: "CHOICE", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] }, key: { kind: "CHOICE", correct: ["a"] } } as ItemSnapshot;
const tfng = {
  ...base,
  section: "READING",
  type: "TRUE_FALSE_NG",
  prompt: "Text",
  content: { kind: "TFNG", statements: [{ id: "s1", text: "a" }, { id: "s2", text: "b" }, { id: "s3", text: "c" }] },
  key: { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "R" } },
} as ItemSnapshot;
const gaps = {
  ...base,
  section: "GRAMMAR",
  type: "GAP_FILL",
  prompt: "Ich mö{{g1}} gern und arb{{g2}} viel.",
  skillTag: "grammar.open",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
  key: { kind: "GAP", answers: { g1: ["chte"], g2: ["eite"] } },
} as ItemSnapshot;
const short = { ...base, section: "GRAMMAR", type: "SHORT_TEXT", prompt: "Q", content: { kind: "SHORT_TEXT", maxChars: 30 }, key: { kind: "SHORT_TEXT", accepted: ["Berlin"] } } as ItemSnapshot;
const writingTask = { ...base, section: "WRITING", type: "WRITING_PROMPT", prompt: "Schreiben Sie.", content: { kind: "WRITING", minWords: 60, maxWords: 80 }, key: { kind: "NONE" } } as ItemSnapshot;
const speakingTask = { ...base, section: "SPEAKING", type: "SPEAKING_PROMPT", prompt: "Sprechen Sie.", content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 }, key: { kind: "NONE" } } as ItemSnapshot;

const run = (section: CourseRunView["section"], over: Partial<CourseRunView> = {}): CourseRunView => ({ id: `run-${section}`, section, submittedAt: new Date("2026-10-28T10:00:00Z"), completion: "COMPLETE", ...over });
const response = (id: string, section: string, itemSnapshot: ItemSnapshot, answer: CourseResponseView["answer"], score: number | null, sequence = 1): CourseResponseView => ({
  id,
  sectionRunId: `run-${section}`,
  sequence,
  itemSnapshot,
  answer,
  score,
});

const proposal = (section: "WRITING" | "SPEAKING", points: Record<string, number | null>): CourseRubricProposal => ({
  kind: "COURSE_RUBRIC",
  section,
  criteria: Object.entries(points).map(([id, p]) => ({ id: id as never, points: p, max: section === "WRITING" ? 3 : 4, rationale: "x" })),
  advice: "x",
});
const WRITING_PROPOSAL = proposal("WRITING", { INHALT: 3, WORTSCHATZ: 2, GRAMMATIK: 2 });
const SPEAKING_PROPOSAL = proposal("SPEAKING", { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 3, KOHAERENZ: 3 });

const proposed = (itemResponseId: string, p: CourseRubricProposal): CourseGradingRow => ({ itemResponseId, status: "AI_PROPOSED", courseProposal: p, coursePoints: null });

/** Every section run and closed, one writing task, three speaking tasks, all proposed by the AI. */
function scenario(over: Partial<CourseComputedInput> = {}): CourseComputedInput {
  const responses: CourseResponseView[] = [
    response("r-tfng", "READING", tfng, { tfng: { s1: "R", s2: "F", s3: "F" } }, 0.67),
    response("r-choice", "READING", choice, { choiceIds: ["a"] }, 1, 2),
    response("g-gaps", "GRAMMAR", gaps, { gaps: { g1: "chte", g2: "eite" } }, 1),
    response("l-choice", "LISTENING", choice, { choiceIds: ["b"] }, 0),
    response("w1", "WRITING", writingTask, { text: "Sehr geehrte Frau Neumann" }, null),
    response("s1", "SPEAKING", speakingTask, { mediaAssetId: "m1" }, null, 1),
    response("s2", "SPEAKING", speakingTask, { mediaAssetId: "m2" }, null, 2),
    response("s3", "SPEAKING", speakingTask, { mediaAssetId: "m3" }, null, 3),
  ];
  return {
    config: { key: "B1", form: "A", rules: defaultCourseRules("B1") },
    sections: ["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"],
    runs: (["READING", "GRAMMAR", "LISTENING", "WRITING", "SPEAKING"] as const).map((s) => run(s)),
    responses,
    gradings: [proposed("w1", WRITING_PROPOSAL), proposed("s1", SPEAKING_PROPOSAL), proposed("s2", SPEAKING_PROPOSAL), proposed("s3", SPEAKING_PROPOSAL)],
    acceptances: {},
    ended: true,
    ...over,
  };
}

const confirmed = (g: CourseGradingRow): CourseGradingRow => ({ ...g, status: "CONFIRMED" });

describe("objective sections", () => {
  it("count the units answered right of every unit of the items in the section", () => {
    const { course } = buildCourseComputed(scenario());
    // tfng: s1 right, s2 right, s3 wrong = 2 of 3; choice right = 1 of 1.
    expect(course?.sections.READING).toEqual({ points: 3, max: 4, pending: false });
    expect(course?.sections.GRAMMAR).toEqual({ points: 2, max: 2, pending: false });
    expect(course?.sections.LISTENING).toEqual({ points: 0, max: 1, pending: false });
  });

  it("count a unit left blank or never reached as 0 of the maximum", () => {
    const s = scenario();
    s.responses = s.responses.map((r) => (r.id === "r-tfng" ? { ...r, answer: null, score: 0 } : r.id === "r-choice" ? { ...r, answer: null, score: 0 } : r));
    expect(buildCourseComputed(s).course?.sections.READING).toEqual({ points: 0, max: 4, pending: false });
  });

  it("count a gap or a short answer the teacher accepted as right", () => {
    const s = scenario();
    s.responses = s.responses.map((r) => (r.id === "g-gaps" ? { ...r, answer: { gaps: { g1: "chte", g2: "arbeite" } }, score: 0.5 } : r));
    s.responses = [...s.responses, response("g-short", "GRAMMAR", short, { text: "Berlín" }, 0, 2)];
    expect(buildCourseComputed(s).course?.sections.GRAMMAR).toEqual({ points: 1, max: 3, pending: false });
    s.acceptances = { "g-gaps": { gapIds: ["g2"] }, "g-short": { gapIds: [] } };
    expect(buildCourseComputed(s).course?.sections.GRAMMAR).toEqual({ points: 3, max: 3, pending: false });
  });

  it("score a section nobody ran as 0 of the catalog's units once the attempt is over, and wait while it runs", () => {
    const s = scenario();
    s.runs = s.runs.filter((r) => r.section !== "LISTENING");
    s.responses = s.responses.filter((r) => r.sectionRunId !== "run-LISTENING");
    // The final B1 test has 10 listening units.
    expect(buildCourseComputed({ ...s, ended: true }).course?.sections.LISTENING).toEqual({ points: 0, max: 10, pending: false });
    expect(buildCourseComputed({ ...s, ended: false }).course?.sections.LISTENING).toEqual({ points: null, max: 10, pending: true });
  });

  it("wait for a section the system skipped, whatever happened to the attempt", () => {
    const s = scenario();
    s.runs = s.runs.map((r) => (r.section === "GRAMMAR" ? { ...r, completion: "SKIPPED" } : r));
    s.responses = s.responses.filter((r) => r.sectionRunId !== "run-GRAMMAR");
    const r = buildCourseComputed(s);
    expect(r.course?.sections.GRAMMAR).toEqual({ points: null, max: 25, pending: true });
    expect(r.status).toBe("AWAITING_GRADING");
    expect(r.course?.outcome).toBeNull();
  });

  it("wait for a section that is still being answered", () => {
    const s = scenario();
    s.runs = s.runs.map((r) => (r.section === "READING" ? { ...r, submittedAt: null, completion: "PENDING" } : r));
    expect(buildCourseComputed({ ...s, ended: false }).course?.sections.READING?.pending).toBe(true);
  });
});

describe("the writing and speaking sections", () => {
  it("are awaiting review while the AI proposals stand, with the AI's points in the total", () => {
    const r = buildCourseComputed(scenario());
    expect(r.status).toBe("AWAITING_REVIEW");
    expect(r.course?.sections.WRITING).toEqual({ points: 7, max: 9, pending: false });
    // each speaking task is worth 14: floor(mean) = 14.
    expect(r.course?.sections.SPEAKING).toEqual({ points: 14, max: 20, pending: false });
    expect(r.skills.WRITING).toEqual({ level: null, decider: "AI", pending: false, insufficient: false });
    expect(r.skills.SPEAKING).toEqual({ level: null, decider: "AI", pending: false, insufficient: false });
    // A course test has no CEFR level, no verification and no placement.
    expect(r).toMatchObject({ overall: null, pooled: null, verification: null, placement: null });
    expect(r.course?.total).toBe(3 + 2 + 0 + 7 + 14);
  });

  it("are ready once a teacher confirmed every task", () => {
    const s = scenario();
    s.gradings = s.gradings.map(confirmed);
    const r = buildCourseComputed(s);
    expect(r.status).toBe("READY");
    expect(r.skills.WRITING?.decider).toBe("TEACHER");
    expect(r.skills.SPEAKING?.decider).toBe("TEACHER");
  });

  it("stay awaiting review while one speaking task is still only proposed", () => {
    const s = scenario();
    s.gradings = s.gradings.map((g) => (g.itemResponseId === "s3" ? g : confirmed(g)));
    const r = buildCourseComputed(s);
    expect(r.status).toBe("AWAITING_REVIEW");
    expect(r.skills.WRITING?.decider).toBe("TEACHER");
    expect(r.skills.SPEAKING?.decider).toBe("AI");
  });

  it("take the teacher's points over the proposal's", () => {
    const s = scenario();
    s.gradings = s.gradings.map((g) =>
      g.itemResponseId === "w1" ? { ...g, status: "OVERRIDDEN", coursePoints: { points: { INHALT: 1, WORTSCHATZ: 1, GRAMMATIK: 1 } } } : g,
    );
    expect(buildCourseComputed(s).course?.sections.WRITING?.points).toBe(3);
  });

  it("wait for the AI while a grading is pending, and for the teacher after the AI failed", () => {
    const pending = scenario();
    pending.gradings = pending.gradings.map((g) => (g.itemResponseId === "w1" ? { ...g, status: "PENDING", courseProposal: null } : g));
    const a = buildCourseComputed(pending);
    expect(a.status).toBe("AWAITING_GRADING");
    expect(a.skills.WRITING).toMatchObject({ decider: null, pending: true });
    expect(a.course).toMatchObject({ total: null, outcome: null, recommendation: null });
    expect(a.course?.sections.WRITING).toEqual({ points: null, max: 9, pending: true });

    const failed = scenario();
    failed.gradings = failed.gradings.map((g) => (g.itemResponseId === "s2" ? { ...g, status: "AI_FAILED", courseProposal: null } : g));
    const b = buildCourseComputed(failed);
    expect(b.status).toBe("AWAITING_GRADING");
    expect(b.skills.SPEAKING).toMatchObject({ decider: null, pending: true });
  });

  it("wait for a task that has no grading row yet", () => {
    const s = scenario();
    s.gradings = s.gradings.filter((g) => g.itemResponseId !== "s3");
    expect(buildCourseComputed(s).course?.sections.SPEAKING?.pending).toBe(true);
  });

  it("keep a speaking task pending while AUSSPRACHE has no number, even when a teacher confirmed the rest", () => {
    const s = scenario();
    const noPronunciation = proposal("SPEAKING", { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: null, KOHAERENZ: 3 });
    s.gradings = s.gradings.map((g) => (g.itemResponseId === "s1" ? { ...g, courseProposal: noPronunciation } : g));
    const a = buildCourseComputed(s);
    expect(a.course?.sections.SPEAKING).toEqual({ points: null, max: 20, pending: true });
    expect(a.status).toBe("AWAITING_GRADING");

    const confirmedWithout = scenario();
    confirmedWithout.gradings = confirmedWithout.gradings.map((g) => (g.itemResponseId === "s1" ? { ...confirmed(g), courseProposal: noPronunciation } : g));
    expect(buildCourseComputed(confirmedWithout).course?.sections.SPEAKING?.pending).toBe(true);

    // The teacher sets the number: the task is decided and the section scores.
    const set = scenario();
    set.gradings = set.gradings.map((g) =>
      g.itemResponseId === "s1"
        ? { ...g, courseProposal: noPronunciation, status: "OVERRIDDEN", coursePoints: { points: { KOMMUNIKATION: 3, WORTSCHATZ: 3, GRAMMATIK: 2, AUSSPRACHE: 2, KOHAERENZ: 3 } } }
        : g,
    );
    const done = buildCourseComputed(set);
    expect(done.course?.sections.SPEAKING).toEqual({ points: 13, max: 20, pending: false });
    expect(done.status).toBe("AWAITING_REVIEW");
  });

  it("score a rule proposal for an empty answer as 0 and still wait for the teacher", () => {
    const s = scenario();
    const empty: CourseRubricProposal = { ...proposal("WRITING", { INHALT: 0, WORTSCHATZ: 0, GRAMMATIK: 0 }), byRule: "EMPTY" };
    s.gradings = s.gradings.map((g) => (g.itemResponseId === "w1" ? { ...g, courseProposal: empty } : g));
    const r = buildCourseComputed(s);
    expect(r.course?.sections.WRITING).toEqual({ points: 0, max: 9, pending: false });
    expect(r.course?.reasons).toContain("WRITING_CONTENT_ZERO");
    expect(r.status).toBe("AWAITING_REVIEW");
  });

  it("count a section nobody reached as 0 and decided once the attempt is over", () => {
    const s = scenario();
    s.runs = s.runs.filter((r) => r.section !== "SPEAKING");
    s.responses = s.responses.filter((r) => r.sectionRunId !== "run-SPEAKING");
    s.gradings = s.gradings.filter((g) => !g.itemResponseId.startsWith("s"));
    const over = buildCourseComputed({ ...s, ended: true });
    expect(over.course?.sections.SPEAKING).toEqual({ points: 0, max: 20, pending: false });
    expect(over.skills.SPEAKING?.decider).toBe("TEACHER");
    const running = buildCourseComputed({ ...s, ended: false });
    expect(running.course?.sections.SPEAKING?.pending).toBe(true);
    expect(running.status).toBe("AWAITING_GRADING");
  });
});

describe("the verdict", () => {
  it("is computed from the points once nothing is pending, and is not final until a teacher decides", () => {
    const r = buildCourseComputed(scenario());
    // 26 of 36 points (this scenario's items hold 7 objective units): a pass at 24.
    expect(r.course).toMatchObject({ total: 26, max: 36, outcome: "PASS", recommendation: "B2.1" });
    expect(r.status).toBe("AWAITING_REVIEW");
  });

  it("follows a teacher's change at once", () => {
    const s = scenario();
    s.gradings = s.gradings.map((g) =>
      g.itemResponseId === "w1" ? { ...g, status: "OVERRIDDEN", coursePoints: { points: { INHALT: 0, WORTSCHATZ: 1, GRAMMATIK: 1 } } } : g,
    );
    expect(buildCourseComputed(s).course).toMatchObject({ outcome: "FAIL", reasons: expect.arrayContaining(["WRITING_CONTENT_ZERO"]) });
  });
});
