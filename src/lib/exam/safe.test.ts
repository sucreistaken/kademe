import { describe, expect, it } from "vitest";
import { mulberry32 } from "./adaptive";
import { makePresentation, toCandidateItem } from "./safe";
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
    expect(c.content).toEqual({ kind: "GAP", attached: true, gaps: [{ id: "g1", choices: null }] });
    expect(JSON.stringify(c)).not.toContain(C_TEST_SKILL_TAG);
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
