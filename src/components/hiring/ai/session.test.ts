import { describe, expect, it } from "vitest";
import type { CompetencySuggestion, HiringDraft, StageSuggestion } from "@/solutions/hiring/ai/draft";
import { parseSession, sessionKey, staleKeys, withGeneration, type AiSession, type Generation } from "./session";

/** The AI screen's proposals kept per opening and draft version in sessionStorage (fix round 1, Important 4). */
const OPENING = "33333333-3333-4333-8333-333333333333";
const STAGE_ID = "77777777-7777-4777-8777-777777777777";
const COMP_ID = "66666666-6666-4666-8666-666666666666";

const stage = (over: Partial<StageSuggestion> = {}): StageSuggestion => ({
  key: "s1",
  nameTr: "Araştırma",
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  purpose: "",
  durationSeconds: 480,
  quote: "kullanıcı araştırmasını yönetecek",
  activities: [
    {
      key: "a1",
      type: "VIDEO",
      promptTr: "Bir bulguyu anlat.",
      promptEn: "",
      purpose: "",
      expectedBehaviours: [],
      redFlags: [],
      example1: "",
      example3: "Orta",
      example5: "",
      competencyKeys: ["comm"],
      thinkSeconds: 60,
      answerSeconds: 120,
      quote: "bulguları sade bir dille",
    },
  ],
  ...over,
});
const competency: CompetencySuggestion = {
  key: "data",
  libraryId: "",
  nameTr: "Veriyle karar",
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  anchor1Tr: "a",
  anchor1En: "",
  anchor3Tr: "b",
  anchor3En: "",
  anchor5Tr: "c",
  anchor5En: "",
  quote: "Veriyle karar verirsin",
};
const draft: HiringDraft = { stages: [stage()], competencies: [competency] };
const generation = (id: string, over: Partial<Generation> = {}): Generation => ({
  generationId: id,
  draft,
  jobAd: "İlan metni",
  budgetWarning: false,
  acceptedStages: {},
  acceptedCompetencies: {},
  removed: {},
  stageEdits: {},
  competencyEdits: {},
  ...over,
});
const session = (over: Partial<AiSession> = {}): AiSession => ({
  openingId: OPENING,
  versionNumber: 2,
  jobAd: null,
  generations: [generation("g1", { acceptedStages: { s1: STAGE_ID }, acceptedCompetencies: { data: { id: COMP_ID, created: true } }, removed: { "s:s2": true }, stageEdits: { s1: stage({ nameTr: "Düzenlendi" }) }, competencyEdits: { data: { ...competency, nameTr: "Yeni ad" } } })],
  current: 0,
  ...over,
});

describe("AI screen session", () => {
  it("is keyed by opening and draft version", () => {
    expect(sessionKey(OPENING, 2)).toBe(`kademe.hiring.ai.${OPENING}.v2`);
  });

  it("reads back what it wrote: cards, accepted marks, removals, edits and a pasted ad", () => {
    const s = session({ jobAd: "Yapıştırılan başka bir ilan" });
    expect(parseSession(JSON.stringify(s), OPENING, 2)).toEqual(s);
  });

  it("keeps a pasted ad before any proposal was made (minor 10)", () => {
    const adOnly = session({ jobAd: "Yapıştırılan ilan", generations: [], current: 0 });
    expect(parseSession(JSON.stringify(adOnly), OPENING, 2)).toEqual(adOnly);
    expect(withGeneration(adOnly, OPENING, 2, generation("g1"))).toMatchObject({ jobAd: "Yapıştırılan ilan", current: 0 });
  });

  it("discards another opening's or another version's entry, garbage and nothing", () => {
    expect(parseSession(JSON.stringify(session()), OPENING, 3)).toBeNull();
    expect(parseSession(JSON.stringify(session({ openingId: "x" })), OPENING, 2)).toBeNull();
    expect(parseSession("{not json", OPENING, 2)).toBeNull();
    expect(parseSession(null, OPENING, 2)).toBeNull();
  });

  it("re-checks the stored proposal with the strict schema: an edited-in choice question or a bad id is refused", () => {
    const choice = session({ generations: [generation("g1", { draft: { ...draft, stages: [stage({ activities: [{ ...stage().activities[0], type: "SINGLE_CHOICE" as never }] })] } })] });
    expect(parseSession(JSON.stringify(choice), OPENING, 2)).toBeNull();
    const badEdit = session({ generations: [generation("g1", { stageEdits: { s1: { ...stage(), durationSeconds: "x" as never } } })] });
    expect(parseSession(JSON.stringify(badEdit), OPENING, 2)).toBeNull();
    const badId = session({ generations: [generation("g1", { acceptedStages: { s1: "not-an-id" } })] });
    expect(parseSession(JSON.stringify(badId), OPENING, 2)).toBeNull();
    const badCurrent = session({ current: 5 });
    expect(parseSession(JSON.stringify(badCurrent), OPENING, 2)).toBeNull();
  });

  it("keeps the previous proposal restorable after a new one, at most two", () => {
    const first = withGeneration(null, OPENING, 2, generation("g1"));
    expect(first.generations.map((g) => g.generationId)).toEqual(["g1"]);
    const second = withGeneration(first, OPENING, 2, generation("g2"));
    expect(second.generations.map((g) => g.generationId)).toEqual(["g1", "g2"]);
    expect(second.current).toBe(1);
    const third = withGeneration({ ...second, current: 0 }, OPENING, 2, generation("g3"));
    expect(third.generations.map((g) => g.generationId)).toEqual(["g1", "g3"]);
    expect(third.current).toBe(1);
  });

  it("names the entries to drop: other versions of this opening, or all of them off draft mode", () => {
    const keys = [sessionKey(OPENING, 1), sessionKey(OPENING, 2), sessionKey("other", 1), "kademe.builder.unsaved.x"];
    expect(staleKeys(keys, OPENING, sessionKey(OPENING, 2))).toEqual([sessionKey(OPENING, 1)]);
    expect(staleKeys(keys, OPENING, null)).toEqual([sessionKey(OPENING, 1), sessionKey(OPENING, 2)]);
  });
});
