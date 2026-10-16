import { describe, expect, it } from "vitest";
import { CTEST_POOL_INSTRUCTION } from "@/lib/exam/ctest-instruction";
import { buildDetail, gapParts, type DetailGrading, type DetailResponse, type DetailSource } from "./detail-model";
import type { ItemSnapshot } from "@/lib/exam/types";
import tr from "@/i18n/messages/screens.tr.json";
import en from "@/i18n/messages/screens.en.json";

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

const ctest = snap({
  type: "GAP_FILL",
  skillTag: "grammar.ctest",
  prompt: "Ich b{{g1}} 24 Jahre a{{g2}} und arb{{g3}} in Kö{{g4}}.",
  content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }] },
  key: { kind: "GAP", answers: { g1: ["in", "bin"], g2: ["lt", "alt"], g3: ["eite", "arbeite"], g4: ["ln", "Köln"] } },
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

const empty: DetailSource = { sections: [], skillLevels: {}, runs: [], responses: [], gradings: [], acceptances: {}, transcripts: {}, nameOf: {} };

describe("gapParts", () => {
  it("shows whole words for typed fills, whole-word fills, wrong fills and empty gaps", () => {
    const parts = gapParts(ctest, { gaps: { g1: "in", g2: "alt", g3: "x" } }, []);
    const gaps = parts!.filter((p) => p.kind === "gap");
    expect(gaps.map((g) => g.kind === "gap" && [g.shown, g.correct, g.mark])).toEqual([
      ["bin", "bin", "correct"],
      ["alt", "alt", "correct"],
      ["arbx", "arbeite", "wrong"],
      ["", "Köln", "blank"],
    ]);
    // The kept start of a word is moved into the gap, not left in the text before it.
    // The student saw the pool instruction, so the report shows it too.
    expect(parts![0]).toEqual({ kind: "text", text: `${CTEST_POOL_INSTRUCTION}\n\nIch ` });
  });
  it("counts a teacher-accepted gap as accepted", () => {
    const parts = gapParts(ctest, { gaps: { g1: "inn" } }, ["g1"]);
    const g = parts!.find((p) => p.kind === "gap");
    expect(g && g.kind === "gap" && g.mark).toBe("accepted");
  });
  it("shows a plain gap as typed with every accepted spelling as the key", () => {
    const s = snap({ type: "GAP_FILL", prompt: "Ich {{a}} nach Hause.", content: { kind: "GAP", gaps: [{ id: "a" }] }, key: { kind: "GAP", answers: { a: ["gehe", "geh"] } } });
    const g = gapParts(s, { gaps: { a: "gehen" } }, [])!.find((p) => p.kind === "gap");
    expect(g && g.kind === "gap" && [g.prefix, g.shown, g.correct, g.mark]).toEqual(["", "gehen", "gehe / geh", "wrong"]);
  });
  it("is null for other item types", () => {
    expect(gapParts(snap({ type: "SINGLE_CHOICE", content: { kind: "CHOICE", options: [] }, key: { kind: "CHOICE", correct: [] } }), null, [])).toBeNull();
  });
});

describe("buildDetail objective", () => {
  const choice = snap({
    type: "SINGLE_CHOICE",
    stimulusId: "st1",
    stimulus: { id: "st1", section: "READING", level: "A1", title: "Der Brief", body: "SECRET PASSAGE", audioKey: null, audioDurationMs: null },
    content: { kind: "CHOICE", options: [{ id: "a", text: "Anna" }, { id: "b", text: "Ben" }] },
    key: { kind: "CHOICE", correct: ["a"] },
  });
  const tfng = snap({
    type: "TRUE_FALSE_NG",
    stimulusId: "st1",
    stimulus: choice.stimulus,
    content: { kind: "TFNG", statements: [{ id: "s1", text: "Anna wohnt in Köln." }, { id: "s2", text: "Ben ist alt." }] },
    key: { kind: "TFNG", answers: { s1: "R", s2: "F" } },
  });
  const src: DetailSource = {
    ...empty,
    sections: ["READING"],
    skillLevels: { READING: "B1" },
    runs: [{ id: "r1", section: "READING", navigable: false }],
    responses: [
      resp("a", "r1", 1, choice, { choiceIds: ["b"] }, 0),
      resp("b", "r1", 2, tfng, { tfng: { s1: "R", s2: "R" } }, 0.5),
      { ...resp("c", "r1", 3, choice, null), notReached: true },
    ],
  };
  it("lists questions with their reading title, counts rows and never carries the passage", () => {
    const [sec] = buildDetail(src);
    if (sec.kind !== "OBJECTIVE") throw new Error("objective");
    expect(sec.level).toBe("B1");
    expect([sec.correct, sec.total, sec.hasTfng]).toEqual([1, 3, true]);
    expect(sec.blocks).toHaveLength(1);
    expect(sec.blocks[0].heading).toBe("Der Brief");
    const [q1, q2] = sec.blocks[0].questions;
    expect(q1).toMatchObject({ kind: "CHOICE", given: "Ben", key: "Anna", mark: "wrong" });
    expect(q2).toMatchObject({ kind: "ROWS", variant: "TFNG" });
    expect(q2.kind === "ROWS" && q2.rows.map((r) => [r.given, r.key, r.mark])).toEqual([
      ["R", "R", "correct"],
      ["R", "F", "wrong"],
    ]);
    expect(JSON.stringify(sec)).not.toContain("SECRET PASSAGE");
  });
  it("counts a blank item as asked and a whole accepted short answer as correct", () => {
    const short = snap({ type: "SHORT_TEXT", content: { kind: "SHORT_TEXT", maxChars: 20 }, key: { kind: "SHORT_TEXT", accepted: ["Berlin"] } });
    const [sec] = buildDetail({
      ...src,
      responses: [resp("x", "r1", 1, short, { text: "Berlinn" }, 1), resp("y", "r1", 2, short, null, 0)],
      acceptances: { x: { gapIds: [] } },
    });
    if (sec.kind !== "OBJECTIVE") throw new Error("objective");
    expect(sec.blocks.flatMap((b) => b.questions.map((q) => q.kind === "CHOICE" && q.mark))).toEqual(["accepted", "blank"]);
    expect([sec.correct, sec.total]).toEqual([1, 2]);
  });
  it("counts C-test gaps one by one and numbers the questions", () => {
    const [sec] = buildDetail({
      ...src,
      sections: ["GRAMMAR"],
      runs: [{ id: "g", section: "GRAMMAR", navigable: true }],
      responses: [resp("c1", "g", 1, ctest, { gaps: { g1: "in", g2: "lt" } })],
    });
    if (sec.kind !== "OBJECTIVE") throw new Error("objective");
    expect([sec.correct, sec.total]).toEqual([2, 4]);
    expect(sec.blocks[0].questions[0]).toMatchObject({ kind: "GAP", n: 1, cTest: true });
  });
  it("skips a section with no run", () => {
    expect(buildDetail({ ...src, runs: [] })).toEqual([]);
  });
});

describe("buildDetail productive", () => {
  const w = snap({ type: "WRITING_PROMPT", section: "WRITING", prompt: "Schreiben Sie eine E-Mail.", content: { kind: "WRITING", minWords: 20, maxWords: 80 }, key: { kind: "NONE" } });
  const sp = snap({ type: "SPEAKING_PROMPT", section: "SPEAKING", prompt: "Erzählen Sie.", content: { kind: "SPEAKING", thinkSeconds: 5, answerSeconds: 60, maxTakes: 1 }, key: { kind: "NONE" } });
  const proposal = { criteria: [{ criterion: "RANGE", level: "B1", assessable: true, rationale: "Gute Vielfalt." }], summary: "Solid." };
  const g = (over: Partial<DetailGrading>): DetailGrading => ({ itemResponseId: "w1", status: "CONFIRMED", finalLevel: "B1", finalCriteria: null, reason: null, decidedBy: "u1", aiProposal: proposal, ...over });
  const base: DetailSource = {
    ...empty,
    sections: ["WRITING", "SPEAKING"],
    skillLevels: { WRITING: "B1", SPEAKING: "A2" },
    runs: [{ id: "rw", section: "WRITING", navigable: true }, { id: "rs", section: "SPEAKING", navigable: false }],
    responses: [resp("w1", "rw", 1, w, { text: "Liebe Anna, wie geht es dir?" }), resp("s1", "rs", 1, sp, { mediaAssetId: "m1" })],
    transcripts: { m1: "Ich heisse Ben." },
    nameOf: { u1: "Hoca" },
  };
  it("shows the confirmed proposal as the teacher's, with the writing text", () => {
    const [wr] = buildDetail({ ...base, gradings: [g({})] });
    if (wr.kind !== "PRODUCTIVE") throw new Error("productive");
    expect(wr.tasks[0]).toMatchObject({ text: "Liebe Anna, wie geht es dir?", words: 6, level: "B1", decidedBy: "Hoca", summary: "Solid.", teacherNote: null });
    expect(wr.tasks[0].criteria).toEqual([{ criterion: "RANGE", level: "B1", note: "Gute Vielfalt." }]);
  });
  it("drops the AI wording when the teacher changed the level, keeping the reason and own criterion levels", () => {
    const [wr] = buildDetail({ ...base, gradings: [g({ status: "OVERRIDDEN", finalLevel: "A2", reason: "Too many errors", finalCriteria: { RANGE: "A2" } })] });
    if (wr.kind !== "PRODUCTIVE") throw new Error("productive");
    expect(wr.tasks[0]).toMatchObject({ level: "A2", teacherNote: "Too many errors", summary: null });
    expect(wr.tasks[0].criteria).toEqual([{ criterion: "RANGE", level: "A2", note: null }]);
    expect(JSON.stringify(wr)).not.toContain("Gute Vielfalt");
  });
  it("carries no AI level for an undecided grading and no transcript when none exists", () => {
    const [wr, spk] = buildDetail({ ...base, transcripts: {}, gradings: [g({ status: "AI_PROPOSED", finalLevel: null })] });
    if (wr.kind !== "PRODUCTIVE" || spk.kind !== "PRODUCTIVE") throw new Error("productive");
    expect(wr.tasks[0]).toMatchObject({ level: null, criteria: [], summary: null });
    expect(spk.tasks[0]).toMatchObject({ transcript: null, text: null });
  });
  it("shows the transcript of a speaking answer", () => {
    const [, spk] = buildDetail(base);
    if (spk.kind !== "PRODUCTIVE") throw new Error("productive");
    expect(spk.tasks[0].transcript).toBe("Ich heisse Ben.");
  });
});

describe("detail copy", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(en.resultReport).sort()).toEqual(Object.keys(tr.resultReport).sort());
  });
});
