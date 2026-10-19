import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import { letteredTargets, makePresentation, matchingTargets, toCandidateItem } from "./safe";
import { C_TEST_SKILL_TAG, CLOZE_SKILL_TAG, WORD_BANK_SKILL_TAG, type ItemSnapshot } from "./types";

const listening: ItemSnapshot = {
  id: "item-secret-id",
  section: "LISTENING",
  level: "B1",
  difficulty: -0.5,
  type: "SINGLE_CHOICE",
  skillTag: "listening.detail",
  stimulusId: "stim-secret-id",
  orderInStimulus: 1,
  prompt: "Wann fährt der Zug ab?",
  content: {
    kind: "CHOICE",
    options: [
      { id: "a", text: "um acht" },
      { id: "b", text: "um neun" },
      { id: "c", text: "um zehn" },
    ],
  },
  key: { kind: "CHOICE", correct: ["b"] },
  rubric: null,
  points: 1,
  stimulus: {
    id: "stim-secret-id",
    section: "LISTENING",
    level: "B1",
    title: "Am Bahnhof",
    body: "Sprecher: Der Zug nach Köln fährt heute um neun Uhr TRANSCRIPT_MARKER.",
    audioKey: "bank/org/audio/x.mp3",
    audioDurationMs: 21000,
  },
};

describe("what the student receives", () => {
  it("carries no key, difficulty, ids, audio key or transcript", () => {
    const pres = makePresentation(listening, mulberry32(1));
    const json = JSON.stringify(toCandidateItem(listening, pres, null, 3, { maxPlays: 2 }));
    for (const secret of ["correct", "difficulty", "item-secret-id", "stim-secret-id", "TRANSCRIPT_MARKER", "bank/org", "listening.detail", "skillTag", "key"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("shows options in the stored shuffled order, and plays left", () => {
    const item = toCandidateItem(listening, { order: ["c", "a", "b"] }, null, 1, { maxPlays: 2, playsUsed: 1 });
    expect(item.content.kind === "CHOICE" && item.content.options.map((o) => o.id)).toEqual(["c", "a", "b"]);
    expect(item.stimulus).toEqual({ kind: "LISTENING", title: "Am Bahnhof", durationMs: 21000, playsLeft: 1, maxPlays: 2 });
  });

  it("returns only the student's own answer fields", () => {
    const item = toCandidateItem(listening, {}, { choiceIds: ["a"], mediaAssetId: "m1" } as never, 1, { maxPlays: 2 });
    expect(item.answer).toEqual({ choiceIds: ["a"] });
  });

  it("gives a reading passage in full", () => {
    const reading: ItemSnapshot = {
      ...listening,
      section: "READING",
      stimulus: { ...listening.stimulus!, section: "READING", body: "Ein kurzer Text." },
    };
    expect(toCandidateItem(reading, {}, null, 1, { maxPlays: 2 }).stimulus).toEqual({
      kind: "READING",
      title: "Am Bahnhof",
      text: "Ein kurzer Text.",
    });
  });
});

describe("C-test gaps", () => {
  const gap = (skillTag: string): ItemSnapshot => ({
    ...listening,
    section: "GRAMMAR",
    type: "GAP_FILL",
    skillTag,
    stimulusId: null,
    stimulus: null,
    prompt: "Ich b{{g1}} hier.",
    content: { kind: "GAP", gaps: [{ id: "g1" }] },
    key: { kind: "GAP", answers: { g1: ["in", "bin"] } },
  });

  it("marks a C-test's gaps as attached to the word stem, without the skill tag", () => {
    const c = toCandidateItem(gap(C_TEST_SKILL_TAG), {}, null, 1, { maxPlays: 2 });
    expect(c.content).toEqual({
      kind: "GAP",
      attached: true,
      gaps: [{ id: "g1", choices: null }],
      pool: expect.any(Array),
    });
    expect(JSON.stringify(c)).not.toContain(C_TEST_SKILL_TAG);
  });

  it("sends a word-part pool that holds the missing part but not the whole word, same on every reload", () => {
    const p = makePresentation(gap(C_TEST_SKILL_TAG), mulberry32(3));
    const a = toCandidateItem(gap(C_TEST_SKILL_TAG), p, null, 1, { maxPlays: 2 });
    const b = toCandidateItem(gap(C_TEST_SKILL_TAG), p, null, 1, { maxPlays: 2 });
    expect(a.content).toEqual(b.content);
    const pool = (a.content as { pool: string[] }).pool;
    expect(pool).toContain("in");
    expect(pool).not.toContain("bin");
    expect(pool).toHaveLength(2);
    expect(JSON.stringify(a)).not.toContain("answers");
  });

  it("gives an ordinary gap item no pool", () => {
    const p = makePresentation(gap("grammar.dativ"), mulberry32(3));
    expect(p.poolSeed).toBeUndefined();
  });

  it("tells the student when only Richtig and Falsch are offered", () => {
    const tfng = (twoWay?: boolean): ItemSnapshot => ({
      ...listening,
      type: "TRUE_FALSE_NG",
      content: { kind: "TFNG", statements: [{ id: "s1", text: "Der Zug fährt um neun." }], ...(twoWay ? { twoWay } : {}) },
      key: { kind: "TFNG", answers: { s1: "R" } },
    });
    expect(toCandidateItem(tfng(true), {}, null, 1, { maxPlays: 2 }).content).toMatchObject({ kind: "TFNG", twoWay: true });
    expect(toCandidateItem(tfng(), {}, null, 1, { maxPlays: 2 }).content).not.toHaveProperty("twoWay");
  });

  it("leaves an ordinary gap item as it was", () => {
    const c = toCandidateItem(gap("grammar.dativ"), {}, null, 1, { maxPlays: 2 });
    expect(c.content).toEqual({ kind: "GAP", gaps: [{ id: "g1", choices: null }] });
  });
});

describe("presentation", () => {
  it("shuffles every option exactly once", () => {
    const p = makePresentation(listening, mulberry32(9));
    expect([...p.order!].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("matching target letters", () => {
  const list = (...texts: string[]) => texts.map((text, i) => ({ id: `r${i + 1}`, text }));

  it("uses a target's own letter, in letter order, with one leftover as 0", () => {
    const out = letteredTargets(list("Anzeige C", "Anzeige A", "Keine Anzeige passt", "Anzeige B"));
    expect(out?.map((t) => [t.id, t.badge, t.label])).toEqual([
      ["r2", "A", "Anzeige A"],
      ["r4", "B", "Anzeige B"],
      ["r1", "C", "Anzeige C"],
      ["r3", "0", "Keine Anzeige passt"],
    ]);
  });

  it("reads a letter prefix and shows the rest", () => {
    const out = letteredTargets(list("A: Miriam Kessler", "B: Tobias Hahn", "keine der Personen"));
    expect(out?.map((t) => [t.badge, t.label])).toEqual([
      ["A", "Miriam Kessler"],
      ["B", "Tobias Hahn"],
      ["0", "keine der Personen"],
    ]);
  });

  it("does not letter a list of sentences, names or categories", () => {
    expect(letteredTargets(list("Deshalb fahren viele mit dem Rad.", "Das spart Zeit."))).toBe(null);
    expect(letteredTargets(list("Selin K.", "Jonas M.", "Amira H."))).toBe(null);
    expect(letteredTargets(list("Frau Demir", "Herr Lorenz", "beide", "keiner von beiden"))).toBe(null);
    // Two leftovers or a repeated letter is not a lettered list either.
    expect(letteredTargets(list("Text A", "Text B", "keiner", "beide"))).toBe(null);
    expect(letteredTargets(list("Text A", "Abschnitt A"))).toBe(null);
  });

  it("letters any other list A, B, C in the order shown", () => {
    expect(matchingTargets(list("beide", "Frau Demir", "keiner von beiden")).map((t) => t.badge)).toEqual(["A", "B", "C"]);
  });
});

describe("aliased ids", () => {
  it("hides the bank's option ids and maps them back", async () => {
    const { unalias } = await import("./safe");
    const pres = makePresentation(listening, mulberry32(4));
    const item = toCandidateItem(listening, pres, { choiceIds: ["b"] }, 1, { maxPlays: 2 });
    const ids = item.content.kind === "CHOICE" ? item.content.options.map((o) => o.id) : [];
    expect(ids.some((id) => ["a", "b", "c"].includes(id))).toBe(false);
    expect(item.answer?.choiceIds?.[0]).toBe(pres.alias!.b);
    expect(unalias(pres, pres.alias!.c)).toBe("c");
    expect(unalias(pres, "zzz")).toBe(null);
  });
});

describe("writing and speaking payloads", () => {
  const productive = (type: "WRITING_PROMPT" | "SPEAKING_PROMPT"): ItemSnapshot => ({
    ...listening,
    section: type === "WRITING_PROMPT" ? "WRITING" : "SPEAKING",
    type,
    skillTag: type === "WRITING_PROMPT" ? "writing.email" : "speaking.request",
    stimulusId: null,
    stimulus: null,
    prompt: "Schreiben Sie eine Nachricht.",
    content:
      type === "WRITING_PROMPT"
        ? { kind: "WRITING", minWords: 40, maxWords: 80 }
        : { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 2 },
    key: { kind: "NONE" },
    rubric: {
      contentPoints: ["MODEL_ANSWER_MARKER: 1. Familienname: Costa"],
      register: "REGISTER_MARKER",
      studentPoints: ["Familienname", "einen Grund nennen"],
    },
    explanation: "EXPLANATION_MARKER",
    points: 7,
  } as ItemSnapshot);

  it.each(["WRITING_PROMPT", "SPEAKING_PROMPT"] as const)("%s carries the student points but no other rubric field, key, level, difficulty, points or explanation", (type) => {
    const snap = productive(type);
    const item = toCandidateItem(snap, {}, null, 4, { maxPlays: 2 });
    const json = JSON.stringify(item);
    for (const secret of [
      "rubric",
      "contentPoints",
      "register",
      "MODEL_ANSWER_MARKER",
      "REGISTER_MARKER",
      "EXPLANATION_MARKER",
      "explanation",
      "level",
      "difficulty",
      "\"points\"",
      "skillTag",
      "item-secret-id",
      "\"key\"",
    ]) {
      expect(json, secret).not.toContain(secret);
    }
    expect(Object.keys(item).sort()).toEqual(["answer", "content", "prompt", "section", "sequence", "stimulus", "type"]);
    expect(item.content).toMatchObject({ studentPoints: ["Familienname", "einen Grund nennen"] });
  });

  it("sends no student points when the rubric has none, or only blank ones", () => {
    for (const rubric of [null, { contentPoints: ["x"] }, { contentPoints: ["x"], studentPoints: [] }, { contentPoints: ["x"], studentPoints: ["  "] }]) {
      for (const type of ["WRITING_PROMPT", "SPEAKING_PROMPT"] as const) {
        const item = toCandidateItem({ ...productive(type), rubric }, {}, null, 1, { maxPlays: 2 });
        expect(item.content, JSON.stringify(rubric)).not.toHaveProperty("studentPoints");
      }
    }
  });

  it("never reads student points from a rubric on any other item type", () => {
    const item = toCandidateItem({ ...listening, rubric: { contentPoints: ["x"], studentPoints: ["LEAK"] } }, {}, null, 1, { maxPlays: 2 });
    expect(JSON.stringify(item)).not.toContain("LEAK");
  });

  it("gives only the length or the times and the student points as content", () => {
    const studentPoints = ["Familienname", "einen Grund nennen"];
    expect(toCandidateItem(productive("WRITING_PROMPT"), {}, null, 1, { maxPlays: 2 }).content).toEqual({ kind: "WRITING", minWords: 40, maxWords: 80, studentPoints });
    expect(toCandidateItem(productive("SPEAKING_PROMPT"), {}, null, 1, { maxPlays: 2 }).content).toEqual({
      kind: "SPEAKING",
      thinkSeconds: 30,
      answerSeconds: 60,
      maxTakes: 2,
      studentPoints,
    });
  });
});

describe("MC cloze and word-bank texts (spec 2026-10-18)", () => {
  const text = (skillTag: string, withChoices: boolean): ItemSnapshot => ({
    ...listening,
    id: "text-secret-id",
    section: "GRAMMAR",
    level: "C1",
    difficulty: 1.37,
    type: "GAP_FILL",
    skillTag,
    stimulusId: null,
    stimulus: null,
    prompt: "Wir {{g1}} morgen {{g2}} Hamburg und {{g3}} dort Freunde.",
    content: {
      kind: "GAP",
      gaps: withChoices
        ? [
            { id: "g1", choices: ["fahren", "fährt", "fuhr", "gefahren"] },
            { id: "g2", choices: ["nach", "in", "zu", "bei"] },
            { id: "g3", choices: ["besuchen", "besucht", "besuchte", "besuche"] },
          ]
        : [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
    },
    key: {
      kind: "GAP",
      answers: { g1: ["fahren"], g2: ["nach"], g3: ["besuchen"] },
      ...(withChoices ? {} : { distractors: ["fährt", "zu", "besucht", "gestern"] }),
    },
  });
  const cloze = text(CLOZE_SKILL_TAG, true);
  const bank = text(WORD_BANK_SKILL_TAG, false);

  it("cloze: a rendering flag, the four choices of every gap shuffled once per student, no pool", () => {
    const p = makePresentation(cloze, mulberry32(4));
    expect(p.poolSeed).toBeUndefined();
    expect(Object.keys(p.choiceOrder!)).toEqual(["g1", "g2", "g3"]);
    const c = toCandidateItem(cloze, p, null, 1, { maxPlays: 2 });
    expect(c.content).toMatchObject({ kind: "GAP", cloze: true });
    expect(c.content).not.toHaveProperty("pool");
    expect(c.content).not.toHaveProperty("attached");
    const gaps = (c.content as { gaps: Array<{ id: string; choices: string[] }> }).gaps;
    expect(gaps.map((g) => [...g.choices].sort())).toEqual([
      ["fahren", "fährt", "fuhr", "gefahren"].sort(),
      ["bei", "in", "nach", "zu"],
      ["besuche", "besuchen", "besucht", "besuchte"],
    ]);
    // Over many students the key is not always in one place.
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => toCandidateItem(cloze, makePresentation(cloze, mulberry32(i + 1)), null, 1, { maxPlays: 2 })).map((x) => (x.content as { gaps: Array<{ choices: string[] }> }).gaps[0].choices[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("word bank: a pool of whole words, the answers plus the distractors, no stems and no attached flag", () => {
    const p = makePresentation(bank, mulberry32(4));
    expect(typeof p.poolSeed).toBe("number");
    const c = toCandidateItem(bank, p, null, 1, { maxPlays: 2 });
    expect(c.content).not.toHaveProperty("attached");
    expect(c.content).not.toHaveProperty("cloze");
    expect((c.content as { gaps: unknown }).gaps).toEqual([
      { id: "g1", choices: null },
      { id: "g2", choices: null },
      { id: "g3", choices: null },
    ]);
    const pool = (c.content as { pool: string[] }).pool;
    expect([...pool].sort()).toEqual(["besuchen", "besucht", "fahren", "fährt", "gestern", "nach", "zu"]);
  });

  it("word bank: the same pool on every reload, a different order for other students", () => {
    const p = makePresentation(bank, mulberry32(9));
    const a = toCandidateItem(bank, p, null, 1, { maxPlays: 2 });
    const b = toCandidateItem(bank, JSON.parse(JSON.stringify(p)), null, 1, { maxPlays: 2 });
    expect(a.content).toEqual(b.content);
    const orders = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify((toCandidateItem(bank, makePresentation(bank, mulberry32(i + 100)), null, 1, { maxPlays: 2 }).content as { pool: string[] }).pool)));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("word bank: two gaps with the same answer give that word twice", () => {
    const twice: ItemSnapshot = { ...bank, key: { kind: "GAP", answers: { g1: ["der"], g2: ["der"], g3: ["die"] }, distractors: ["das", "den", "dem"] } };
    const pool = (toCandidateItem(twice, makePresentation(twice, mulberry32(2)), null, 1, { maxPlays: 2 }).content as { pool: string[] }).pool;
    expect(pool.filter((w) => w === "der")).toHaveLength(2);
  });

  it("leaks no key, skill tag, level, difficulty or id for either kind", () => {
    for (const item of [cloze, bank]) {
      const c = toCandidateItem(item, makePresentation(item, mulberry32(3)), null, 1, { maxPlays: 2 });
      expect(Object.keys(c).sort()).toEqual(["answer", "content", "prompt", "section", "sequence", "stimulus", "type"]);
      const json = JSON.stringify(c);
      for (const secret of [item.skillTag, "grammar.", "C1", "1.37", "text-secret-id", "answers", "distractors", "difficulty", "skillTag", "level", "key"]) {
        expect(json, secret).not.toContain(secret);
      }
    }
  });
});
