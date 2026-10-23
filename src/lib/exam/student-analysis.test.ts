import { describe, expect, it } from "vitest";
import type { DetailResponse } from "@/components/panel/report/detail-model";
import type { ItemSnapshot } from "@/lib/exam/types";
import { buildStudentAnalysis, type AnalysisSource } from "./student-analysis";

const snap = (p: Partial<ItemSnapshot> & Pick<ItemSnapshot, "type" | "content" | "key">): ItemSnapshot => ({
  id: "i",
  section: "GRAMMAR",
  level: "A1",
  difficulty: 0,
  skillTag: "x",
  stimulusId: null,
  orderInStimulus: 0,
  prompt: "Stem",
  rubric: null,
  points: 1,
  stimulus: null,
  ...p,
});

const resp = (id: string, run: string, seq: number, s: ItemSnapshot, answer: DetailResponse["answer"], score: number | null = null): DetailResponse => ({
  id,
  sectionRunId: run,
  sequence: seq,
  itemSnapshot: s,
  answer,
  score,
  notReached: false,
});

const cloze = snap({
  type: "GAP_FILL",
  skillTag: "grammar.cloze",
  prompt: "SECRETPROMPT Ich gehe {{g1}} Hause, gebe es {{g2}} Freund und sehe {{g3}} Mann.",
  content: { kind: "GAP", gaps: [{ id: "g1", choices: ["nach", "zu", "in", "bei"] }, { id: "g2", choices: ["dem", "den", "der", "die"] }, { id: "g3", choices: ["den", "dem", "der", "des"] }] },
  key: { kind: "GAP", answers: { g1: ["nach"], g2: ["dem"], g3: ["den"] }, topics: { g1: "praposition", g2: "dativ", g3: "akkusativ" } },
});

const src = (over: Partial<AnalysisSource> = {}): AnalysisSource => ({
  sections: ["GRAMMAR", "WRITING"],
  runs: [
    { id: "r1", section: "GRAMMAR", navigable: false },
    { id: "r2", section: "WRITING", navigable: false },
  ],
  responses: [resp("a", "r1", 1, cloze, { gaps: { g1: "nach", g2: "den", g3: "" } })],
  acceptances: {},
  ...over,
});

describe("buildStudentAnalysis", () => {
  it("counts right, wrong and blank gaps and lists missed topics most missed first", () => {
    const a = buildStudentAnalysis(src(), "en");
    expect(a.sections[0]).toEqual({ section: "GRAMMAR", right: 1, wrong: 1, blank: 1 });
    expect(a.missedTopics.map((t) => [t.topic, t.missed, t.asked])).toEqual(
      expect.arrayContaining([["dativ", 1, 1], ["akkusativ", 1, 1]]),
    );
    expect(a.missedTopics.every((t) => t.label && t.missed >= 1)).toBe(true);
    expect(a.strongTopics).toEqual([]);
  });

  it("marks writing and speaking as assessed by the teacher without counts", () => {
    const a = buildStudentAnalysis(src(), "en");
    expect(a.sections[1]).toEqual({ section: "WRITING", right: 0, wrong: 0, blank: 0, teacherAssessed: true });
  });

  it("counts a teacher-accepted gap as right", () => {
    const a = buildStudentAnalysis(src({ acceptances: { a: { gapIds: ["g2"] } } }), "en");
    expect(a.sections[0]).toMatchObject({ right: 2, wrong: 0, blank: 1 });
  });

  it("calls a topic strong only with at least two units, all right", () => {
    const twice = snap({ ...cloze, key: { kind: "GAP", answers: { g1: ["nach"], g2: ["dem"], g3: ["den"] }, topics: { g1: "dativ", g2: "dativ", g3: "dativ" } } });
    const a = buildStudentAnalysis(src({ responses: [resp("a", "r1", 1, twice, { gaps: { g1: "nach", g2: "dem", g3: "den" } })] }), "de");
    expect(a.strongTopics.map((t) => [t.topic, t.asked])).toEqual([["dativ", 3]]);
    expect(a.missedTopics).toEqual([]);
    const one = buildStudentAnalysis(src({ responses: [resp("a", "r1", 1, cloze, { gaps: { g1: "nach", g2: "dem", g3: "den" } })] }), "de");
    expect(one.strongTopics).toEqual([]);
  });

  it("drops format topics from both topic lists but keeps them in the section counts", () => {
    const ctest = snap({
      type: "GAP_FILL",
      skillTag: "grammar.ctest",
      prompt: "Ich b{{g1}} 24 Jahre a{{g2}}.",
      content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
      key: { kind: "GAP", answers: { g1: ["in", "bin"], g2: ["lt", "alt"] } },
    });
    const a = buildStudentAnalysis(src({ responses: [resp("a", "r1", 1, ctest, { gaps: { g1: "in", g2: "x" } })] }), "en");
    expect(a.sections[0]).toMatchObject({ right: 1, wrong: 1, blank: 0 });
    expect(a.missedTopics).toEqual([]);
    expect(a.strongTopics).toEqual([]);
  });

  it("never carries prompt text, options or keys", () => {
    const a = buildStudentAnalysis(src({ responses: [resp("a", "r1", 1, cloze, { gaps: { g1: "zu", g2: "den", g3: "" } })] }), "en");
    const json = JSON.stringify(a);
    for (const leak of ["SECRETPROMPT", "Hause", "nach", "bei", "choices", "answers"]) expect(json).not.toContain(leak);
  });
});
