import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import { letteredTargets, makePresentation, matchingTargets, toCandidateItem } from "./safe";
import { C_TEST_SKILL_TAG, type ItemSnapshot } from "./types";

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
    rubric: { contentPoints: ["MODEL_ANSWER_MARKER: 1. Familienname: Costa"], register: "REGISTER_MARKER" },
    explanation: "EXPLANATION_MARKER",
    points: 7,
  } as ItemSnapshot);

  it.each(["WRITING_PROMPT", "SPEAKING_PROMPT"] as const)("%s carries no rubric, key, level, difficulty, points or explanation", (type) => {
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
      "points",
      "skillTag",
      "item-secret-id",
      "\"key\"",
    ]) {
      expect(json, secret).not.toContain(secret);
    }
    expect(Object.keys(item).sort()).toEqual(["answer", "content", "prompt", "section", "sequence", "stimulus", "type"]);
  });

  it("gives only the length or the times as content", () => {
    expect(toCandidateItem(productive("WRITING_PROMPT"), {}, null, 1, { maxPlays: 2 }).content).toEqual({ kind: "WRITING", minWords: 40, maxWords: 80 });
    expect(toCandidateItem(productive("SPEAKING_PROMPT"), {}, null, 1, { maxPlays: 2 }).content).toEqual({
      kind: "SPEAKING",
      thinkSeconds: 30,
      answerSeconds: 60,
      maxTakes: 2,
    });
  });
});
