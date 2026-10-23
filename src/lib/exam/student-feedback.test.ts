import { describe, expect, it } from "vitest";
import { buildDetail, type DetailResponse, type DetailSource } from "@/components/panel/report/detail-model";
import { buildReport, type ReportSource } from "@/components/panel/report/model";
import type { ItemSnapshot } from "./types";
import {
  approveFeedback,
  approvedFeedback,
  buildFeedbackInput,
  buildFeedbackMessages,
  collapseRepeatedWords,
  feedbackFromForm,
  parseFeedbackAnswer,
  type FeedbackContent,
  type StudentFeedbackStore,
} from "./student-feedback";

const snap = (p: Partial<ItemSnapshot> & Pick<ItemSnapshot, "type" | "content" | "key">): ItemSnapshot => ({
  id: "i",
  section: "GRAMMAR",
  level: "A2",
  difficulty: 0,
  skillTag: "grammar.x",
  stimulusId: null,
  orderInStimulus: 0,
  prompt: "Stem",
  rubric: null,
  points: 1,
  stimulus: null,
  ...p,
});

const choice = (tag: string, prompt: string, texts: [string, string], correct: "a" | "b") =>
  snap({
    type: "SINGLE_CHOICE",
    skillTag: tag,
    prompt,
    content: { kind: "CHOICE", options: [{ id: "a", text: texts[0] }, { id: "b", text: texts[1] }] },
    key: { kind: "CHOICE", correct: [correct] },
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

const writing = snap({
  type: "WRITING_PROMPT",
  section: "WRITING",
  prompt: "Schreiben Sie an Anna SECRET-TASK",
  content: { kind: "WRITING", minWords: 20, maxWords: 80 },
  key: { kind: "NONE" },
});

// A synthetic result: grammar (a C-test and three choices), reading (one matching), writing overridden by a teacher.
const source: DetailSource = {
  sections: ["GRAMMAR", "WRITING"],
  skillLevels: { GRAMMAR: "A2", WRITING: "B1" },
  runs: [
    { id: "g", section: "GRAMMAR", navigable: true },
    { id: "w", section: "WRITING", navigable: false },
  ],
  responses: [
    resp("c1", "g", 1, ctest, { gaps: { g1: "in", g2: "lt", g3: "x", g4: "" } }),
    resp("a1", "g", 2, choice("grammar.akkusativ", "Ich sehe ___ Mann.", ["den", "der"], "a"), { choiceIds: ["b"] }, 0),
    resp("a2", "g", 3, choice("grammar.akkusativ", "Er hat ___ Hund.", ["einen", "ein"], "a"), { choiceIds: ["b"] }, 0),
    resp("a3", "g", 4, choice("grammar.akkusativ", "Wir kaufen ___ Brot.", ["das", "der"], "a"), { choiceIds: ["b"] }, 0),
    resp("a4", "g", 5, choice("konnektor.konzessiv", "___ es regnet, gehen wir raus.", ["Obwohl", "Weil"], "a"), { choiceIds: ["a"] }, 1),
    resp("w1", "w", 1, writing, { text: "Hallo Anna, STUDENT TEXT HERE ..." }),
  ],
  gradings: [
    {
      itemResponseId: "w1",
      status: "OVERRIDDEN",
      finalLevel: "B1",
      finalCriteria: null,
      reason: "Gute Struktur, aber viele Kasusfehler.",
      decidedBy: "u1",
      aiProposal: { criteria: [{ criterion: "RANGE", level: "B2", assessable: true, rationale: "AI RATIONALE" }], summary: "AI SUMMARY" },
    },
  ],
  acceptances: {},
  transcripts: {},
  nameOf: { u1: "Teacher Name" },
};

describe("buildFeedbackInput", () => {
  const input = buildFeedbackInput("B1", buildDetail(source));
  const grammar = input.sections[0];
  if (grammar.kind !== "OBJECTIVE") throw new Error("objective");

  it("keeps the level and x/y per section", () => {
    expect(input.overall).toBe("B1");
    // 2 right gaps + 1 right choice = 3 of 8 units (4 gaps, 4 choices)
    expect([grammar.section, grammar.level, grammar.correct, grammar.total]).toEqual(["GRAMMAR", "A2", 3, 8]);
  });

  it("groups the wrong answers by skill tag, most wrong first, with at most two examples", () => {
    expect(grammar.weak.map((w) => [w.skillTag, w.wrong, w.total])).toEqual([
      ["akkusativ", 3, 3],
      ["ctest", 2, 4],
    ]);
    const akk = grammar.weak[0];
    expect(akk.examples).toHaveLength(2);
    expect(akk.examples[0]).toEqual({ context: "Ich sehe ___ Mann.", student: "der", correct: "den" });
  });

  it("shows C-test gaps as whole words with a little context, counts an empty gap but never gives it as an example", () => {
    const c = grammar.weak.find((w) => w.skillTag === "ctest")!;
    expect([c.wrong, c.total, c.unanswered]).toEqual([2, 4, 1]);
    expect(c.examples).toEqual([{ context: "und ___ in", student: "arbx", correct: "arbeite" }]);
    expect(JSON.stringify(input)).not.toContain("(blank)");
  });

  it("gives a tag that only has blanks no examples, just the unanswered count", () => {
    const blanks: DetailSource = {
      ...source,
      responses: [resp("a1", "g", 1, choice("grammar.akkusativ", "Ich sehe ___ Mann.", ["den", "der"], "a"), { choiceIds: [] }, 0)],
      gradings: [],
    };
    const g = buildFeedbackInput("A2", buildDetail(blanks)).sections[0];
    if (g.kind !== "OBJECTIVE") throw new Error("objective");
    expect(g.weak[0]).toEqual({ skillTag: "akkusativ", label: "Akkusativ", format: false, wrong: 1, total: 1, unanswered: 1, examples: [] });
  });

  it("leaves out a tag with no mistakes", () => {
    expect(grammar.weak.some((w) => w.skillTag === "konnektor.konzessiv")).toBe(false);
  });

  it("marks a task format so the prompt and the report can skip it, and keeps real topics ahead of it", () => {
    const c = grammar.weak.find((w) => w.skillTag === "ctest")!;
    expect([c.format, c.label]).toEqual([true, "C-Test"]);
    expect(grammar.weak.find((w) => w.skillTag === "akkusativ")?.format).toBe(false);
    expect(grammar.weak.map((w) => w.format)).toEqual([false, true]);
  });

  it("gives writing only its level and the teacher's reason", () => {
    expect(input.sections[1]).toEqual({ section: "WRITING", kind: "PRODUCTIVE", level: "B1", teacherReasons: ["Gute Struktur, aber viele Kasusfehler."] });
  });

  it("carries no student text, task text, AI rationale, name or passage", () => {
    const sent = JSON.stringify(buildFeedbackMessages(input, "tr"));
    for (const secret of ["STUDENT TEXT HERE", "SECRET-TASK", "AI RATIONALE", "AI SUMMARY", "Teacher Name"]) expect(sent).not.toContain(secret);
  });

  it("does not turn an unreached or AI-only level into a level", () => {
    const empty = buildFeedbackInput(undefined, buildDetail({ ...source, skillLevels: {} }));
    expect(empty.overall).toBeNull();
    expect(empty.sections.every((s) => s.level === null)).toBe(true);
  });
});

describe("buildFeedbackMessages", () => {
  it("asks for the report language, German kept, no em dash, no scores", () => {
    const [system, user] = buildFeedbackMessages(buildFeedbackInput("B1", buildDetail(source)), "en");
    expect(system.content).toContain("Write in English");
    expect(system.content).toContain("Keep German");
    expect(system.content).toContain("Never use the em dash");
    expect(system.content).toContain("Never mention scores");
    expect(buildFeedbackMessages(buildFeedbackInput("B1", []), "tr")[0].content).toContain("Write in Turkish");
    expect(user.content).toContain("Akkusativ");
    expect(system.content).toContain("\"format\": true");
    expect(JSON.parse(user.content.slice(user.content.indexOf("{"))).overall).toBe("B1");
  });
});

describe("parseFeedbackAnswer", () => {
  const good = {
    strengths: ["Konnektoren gut.", "Okuma iyi."],
    improve: [{ topic: "Akkusativ-Artikel (den/einen)", why: "Eril isimlerde artikel karışıyor.", example: { student: "der", correct: "den" } }],
    nextStep: "Her gün beş cümle yaz.",
  };
  it("accepts a good answer, even in a code fence", () => {
    const r = parseFeedbackAnswer("```json\n" + JSON.stringify(good) + "\n```");
    expect(r).toEqual({ ok: true, content: good });
  });
  it("replaces em dashes and drops an empty example", () => {
    const r = parseFeedbackAnswer(JSON.stringify({ ...good, strengths: ["İyi — devam"], improve: [{ topic: "T", why: "W", example: "" }] }));
    if (!r.ok) throw new Error(r.error);
    expect(r.content.strengths).toEqual(["İyi, devam"]);
    expect(r.content.improve[0]).toEqual({ topic: "T", why: "W" });
    expect(JSON.stringify(r.content)).not.toContain("—");
  });
  it("treats a null, missing or half-empty example as none", () => {
    for (const example of [null, undefined, { student: "", correct: "" }, { student: "der", correct: "" }]) {
      const r = parseFeedbackAnswer(JSON.stringify({ ...good, improve: [{ topic: "T", why: "W", example }] }));
      if (!r.ok) throw new Error(r.error);
      expect(r.content.improve[0]).toEqual({ topic: "T", why: "W" });
    }
  });
  it("keeps an already stored string example as it is", () => {
    const r = parseFeedbackAnswer(JSON.stringify({ ...good, improve: [{ topic: "T", why: "W", example: "der -> den" }] }));
    if (!r.ok) throw new Error(r.error);
    expect(r.content.improve[0].example).toBe("der -> den");
    expect(approvedFeedback({ draft: null, draftedAt: null, draftRunId: null, approved: r.content, approvedBy: "u", approvedAt: "x", edited: false, locale: "tr" })?.improve[0].example).toBe("der -> den");
  });
  it("collapses repeated words in the text fields but leaves the example parts as written", () => {
    const r = parseFeedbackAnswer(JSON.stringify({ ...good, strengths: ["Die die Struktur"], improve: [{ topic: "T", why: "Bu ifade ifadelerinin yanlış", example: { student: "die die", correct: "die" } }] }));
    if (!r.ok) throw new Error(r.error);
    expect(r.content.strengths).toEqual(["Die Struktur"]);
    expect(r.content.improve[0]).toEqual({ topic: "T", why: "Bu ifadelerinin yanlış", example: { student: "die die", correct: "die" } });
  });
  it("cuts a list that is too long instead of rejecting it", () => {
    const r = parseFeedbackAnswer(JSON.stringify({ ...good, strengths: ["a", "b", "c", "d"], improve: Array(6).fill(good.improve[0]) }));
    if (!r.ok) throw new Error(r.error);
    expect([r.content.strengths.length, r.content.improve.length]).toEqual([3, 4]);
  });
  it("rejects a missing next step, an empty topic, a too long field and non-JSON", () => {
    expect(parseFeedbackAnswer(JSON.stringify({ ...good, nextStep: "" })).ok).toBe(false);
    expect(parseFeedbackAnswer(JSON.stringify({ ...good, improve: [{ topic: " ", why: "w" }] })).ok).toBe(false);
    expect(parseFeedbackAnswer(JSON.stringify({ ...good, nextStep: "x".repeat(400) })).ok).toBe(false);
    expect(parseFeedbackAnswer(JSON.stringify({ strengths: [] })).ok).toBe(false);
    expect(parseFeedbackAnswer("not json").ok).toBe(false);
  });
});

describe("collapseRepeatedWords", () => {
  it("drops an immediate repeat, ignoring case", () => {
    expect(collapseRepeatedWords("die die Kasus")).toBe("die Kasus");
    expect(collapseRepeatedWords("Der der Mann")).toBe("Der Mann");
  });
  it("keeps the longer word when the second extends the first", () => {
    expect(collapseRepeatedWords("bu ifade ifadelerinin hatası")).toBe("bu ifadelerinin hatası");
  });
  it("leaves deliberate and short-word repeats alone", () => {
    expect(collapseRepeatedWords("was ist, ist gut")).toBe("was ist, ist gut");
    expect(collapseRepeatedWords("in intensiv geübt")).toBe("in intensiv geübt");
    expect(collapseRepeatedWords("")).toBe("");
  });
});

describe("feedbackFromForm and approval", () => {
  const draft: FeedbackContent = { strengths: ["A"], improve: [{ topic: "T", why: "W" }], nextStep: "N" };
  const store: StudentFeedbackStore = { draft, draftedAt: "2026-10-16T10:00:00.000Z", draftRunId: "run1", approved: null, approvedBy: null, approvedAt: null, edited: false, locale: "tr" };
  const form = (o: Record<string, string>) => (name: string) => o[name] ?? "";

  it("drops empty rows and keeps the teacher's wording", () => {
    const r = feedbackFromForm(form({ strength0: " A ", strength1: "", topic0: "T", why0: "W2", exampleStudent0: "", exampleCorrect0: "", nextStep: "N" }));
    expect(r).toEqual({ ok: true, content: { strengths: ["A"], improve: [{ topic: "T", why: "W2" }], nextStep: "N" } });
  });
  it("reads the two example inputs as a pair", () => {
    const r = feedbackFromForm(form({ topic0: "T", why0: "W", exampleStudent0: " der ", exampleCorrect0: "den", nextStep: "N" }));
    expect(r).toEqual({ ok: true, content: { strengths: [], improve: [{ topic: "T", why: "W", example: { student: "der", correct: "den" } }], nextStep: "N" } });
  });
  it("refuses an empty next step or a half-filled topic", () => {
    expect(feedbackFromForm(form({ strength0: "A", nextStep: "" })).ok).toBe(false);
    expect(feedbackFromForm(form({ topic0: "T", nextStep: "N" })).ok).toBe(false);
  });
  it("marks an approval as edited only when the teacher changed the draft", () => {
    const now = new Date("2026-10-16T11:00:00Z");
    expect(approveFeedback(store, draft, "u1", now, "tr").edited).toBe(false);
    const changed = approveFeedback(store, { ...draft, nextStep: "N2" }, "u1", now, "tr");
    expect(changed).toMatchObject({ edited: true, draft: null, approvedBy: "u1", approvedAt: now.toISOString(), approved: { nextStep: "N2" } });
  });
});

describe("an unapproved draft never reaches the report", () => {
  const draft: FeedbackContent = { strengths: ["DRAFT ONLY"], improve: [], nextStep: "DRAFT NEXT" };
  const store: StudentFeedbackStore = { draft, draftedAt: "x", draftRunId: null, approved: null, approvedBy: null, approvedAt: null, edited: false, locale: "tr" };
  const report: ReportSource = {
    status: "FINAL",
    schoolName: "S",
    studentName: "Ayşe",
    examName: "E",
    examDate: null,
    sections: ["GRAMMAR"],
    finalOverall: "B1",
    skillLevels: { GRAMMAR: "B1" },
    mode: "PLACEMENT",
    placement: null,
    teacherName: null,
    finalizedAt: null,
    attemptId: "a1",
  };
  const model = (feedback: StudentFeedbackStore | null | undefined) => {
    const r = buildReport({ ...report, feedback }, "secret");
    if (!r.ok) throw new Error("expected ok");
    return r.model;
  };

  it("has no feedback without a store, or with only a draft", () => {
    expect(model(undefined).feedback).toBeNull();
    expect(model(null).feedback).toBeNull();
    expect(model(store).feedback).toBeNull();
    expect(JSON.stringify(model(store))).not.toContain("DRAFT");
  });
  it("needs the approval marks, not just an approved field", () => {
    expect(approvedFeedback({ ...store, approved: draft })).toBeNull();
    expect(approvedFeedback({ ...store, approved: draft, approvedBy: "u1" })).toBeNull();
  });
  it("shows the approved text, and a draft written after it does not replace it", () => {
    const approved: FeedbackContent = { strengths: ["APPROVED"], improve: [], nextStep: "APPROVED NEXT" };
    const redrafted = { ...store, approved, approvedBy: "u1", approvedAt: "2026-10-16T11:00:00.000Z" };
    const m = model(redrafted);
    expect(m.feedback).toEqual(approved);
    expect(JSON.stringify(m)).not.toContain("DRAFT");
  });
  it("still refuses a result that is not final, feedback or not", () => {
    expect(buildReport({ ...report, status: "READY", feedback: { ...store, approved: draft, approvedBy: "u1", approvedAt: "x" } }, "s").ok).toBe(false);
  });
  it("ignores a stored approved text that does not pass the checks", () => {
    const bad = { ...store, approved: { strengths: [], improve: [], nextStep: "" } as FeedbackContent, approvedBy: "u1", approvedAt: "x" };
    expect(model(bad).feedback).toBeNull();
  });
});

describe("buildFeedbackInput by gap topic", () => {
  const text = (topics: Record<string, string> | undefined) =>
    snap({
      type: "GAP_FILL",
      skillTag: "grammar.cloze",
      prompt: "Ich gebe {{g1}} Mann {{g2}} Buch, weil {{g3}} regnet.",
      content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] },
      key: { kind: "GAP", answers: { g1: ["dem"], g2: ["ein"], g3: ["es"] }, ...(topics ? { topics } : {}) },
    });
  const run = (item: ItemSnapshot): ReturnType<typeof buildFeedbackInput>["sections"][number] => {
    const src: DetailSource = {
      sections: ["GRAMMAR"],
      skillLevels: { GRAMMAR: "A2" },
      runs: [{ id: "g", section: "GRAMMAR", navigable: true }],
      responses: [resp("t1", "g", 1, item, { gaps: { g1: "den", g2: "", g3: "es" } })],
      gradings: [],
      acceptances: {},
      transcripts: {},
      nameOf: {},
    };
    return buildFeedbackInput("A2", buildDetail(src)).sections[0];
  };

  it("groups every gap by its own topic, with the German label", () => {
    const g = run(text({ g1: "dativ", g2: "akkusativ", g3: "konnektor" }));
    if (g.kind !== "OBJECTIVE") throw new Error("objective");
    expect(g.weak.map((w) => [w.skillTag, w.label, w.format, w.wrong, w.total, w.unanswered])).toEqual([
      ["akkusativ", "Akkusativ", false, 1, 1, 1],
      ["dativ", "Dativ", false, 1, 1, 0],
    ]);
  });

  it("falls back to the item's tag for a gap without a topic and for an old snapshot without key.topics", () => {
    const old = run(text(undefined));
    if (old.kind !== "OBJECTIVE") throw new Error("objective");
    expect(old.weak.map((w) => [w.skillTag, w.format, w.wrong, w.total])).toEqual([["cloze", true, 2, 3]]);
    const partial = run(text({ g1: "dativ" }));
    if (partial.kind !== "OBJECTIVE") throw new Error("objective");
    expect(partial.weak.map((w) => [w.skillTag, w.wrong, w.total])).toEqual([
      ["dativ", 1, 1],
      ["cloze", 1, 2],
    ]);
  });
});
