import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Job from "@/server/item-generation-job";
import type { CreatorCtx } from "@/solutions/types";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));
const generateItems = vi.fn<typeof Job.generateItems>();
vi.mock("@/server/item-generation-job", () => ({ generateItems: (...a: Parameters<typeof Job.generateItems>) => generateItems(...a) }));
const ensureStimulusAudio = vi.fn<(orgId: string, userId: string, stimulusId: string) => Promise<{ ok: true } | { ok: false; reason: string }>>();
vi.mock("./audio", () => ({ ensureStimulusAudio: (...a: [string, string, string]) => ensureStimulusAudio(...a) }));

import { fitTotal, questionSetCreator, toBatches, validateQuestionSet, type QuestionSetDraft } from "./question-set";

const ctx: CreatorCtx = { orgId: "o1", userId: "u1", role: "MANAGER", locale: "tr", draftId: "d1" };
const spec = (over: Record<string, unknown> = {}) => ({ section: "READING", level: "B2", itemType: "", count: 12, topic: "iş hayatı", ...over });
const choice = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "SINGLE_CHOICE",
  prompt: "Ich ___ müde.",
  content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] },
  answerKey: { kind: "CHOICE", correct: ["a"] },
  rubric: null,
  section: "GRAMMAR",
  stimulusId: null,
  status: "DRAFT",
  ...over,
});
const ok = (ids: string[]) => ({ ok: true as const, created: ids.length, rejected: 0, stimulusId: null, itemIds: ids });
const setStatuses = () => fake.calls.filter(([op]) => op === "set").map(([, a]) => (a[0] as { status: string }).status);
const auditActions = () => fake.calls.filter(([op]) => op === "values").map(([, a]) => (a[0] as { action: string }).action);

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  generateItems.mockReset();
  ensureStimulusAudio.mockReset();
});

describe("validateQuestionSet", () => {
  it("asks for section, level and count when nothing is given", () => {
    const v = validateQuestionSet({}, "tr", { useDefaults: false });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.questions.map((q) => q.id)).toEqual(["section", "level", "count"]);
    expect(v.questions[0].choices).toEqual(["Dilbilgisi", "Okuma", "Dinleme", "Yazma", "Konuşma"]);
  });

  it("defaults the count after the rounds but never the section or level", () => {
    const v = validateQuestionSet({ specs: [spec({ section: "", count: 0 })] }, "tr", { useDefaults: true });
    expect(v.ok === false && v.questions.map((q) => q.id)).toEqual(["section"]);
    expect(validateQuestionSet({ specs: [spec({ count: 0 })] }, "tr", { useDefaults: true })).toMatchObject({ ok: true, params: { specs: [{ count: 5 }] } });
  });

  it("fills the item type from the section and keeps the topic", () => {
    expect(validateQuestionSet({ specs: [spec()] }, "tr", { useDefaults: false })).toEqual({
      ok: true,
      params: { specs: [{ section: "READING", level: "B2", itemType: "SINGLE_CHOICE", count: 12, topic: "iş hayatı" }] },
    });
    expect(validateQuestionSet({ specs: [spec({ itemType: "GAP_FILL" })] }, "tr", { useDefaults: false })).toMatchObject({ ok: true, params: { specs: [{ itemType: "SINGLE_CHOICE" }] } });
  });

  it("asks again above 20 questions, and fits them to 20 once the rounds are used", () => {
    const many = { specs: [spec({ count: 15 }), spec({ section: "LISTENING", count: 15 })] };
    const v = validateQuestionSet(many, "en", { useDefaults: false });
    expect(v.ok === false && v.questions[0]).toEqual({ id: "count", text: "I can prepare at most 20 questions at once. How many in total?", choices: ["5", "10", "20"] });
    const fitted = validateQuestionSet(many, "en", { useDefaults: true });
    expect(fitted.ok && fitted.params.specs.map((s) => s.count)).toEqual([10, 10]);
    expect(fitTotal([19, 1, 1], 20).reduce((a, n) => a + n, 0)).toBe(20);
  });

  it("accepts the exam's gap follow-up as it is", () => {
    expect(validateQuestionSet({ specs: [{ section: "LISTENING", level: "B1", itemType: "", count: 4, topic: "" }] }, "tr", { useDefaults: true })).toEqual({
      ok: true,
      params: { specs: [{ section: "LISTENING", level: "B1", itemType: "SINGLE_CHOICE", count: 4, topic: null }] },
    });
  });
});

describe("toBatches", () => {
  it("splits into batches of at most 10 with the section's stimulus rule", () => {
    const batches = toBatches([
      { section: "READING", level: "B2", itemType: "SINGLE_CHOICE", count: 12, topic: "iş" },
      { section: "WRITING", level: "B1", itemType: "WRITING_PROMPT", count: 3, topic: null },
    ]);
    expect(batches.map((b) => [b.section, b.count, b.withStimulus, b.topic])).toEqual([
      ["READING", 10, true, "iş"],
      ["READING", 2, true, "iş"],
      ["WRITING", 3, false, undefined],
    ]);
  });
});

describe("questionSetCreator.draft", () => {
  const params = { specs: [{ section: "READING" as const, level: "B2" as const, itemType: "SINGLE_CHOICE" as const, count: 12, topic: null }] };

  it("collects the ids of every batch and counts a failed one", async () => {
    generateItems.mockResolvedValueOnce({ ...ok(["i1", "i2"]), rejected: 1 }).mockResolvedValueOnce({ ok: false, error: "no valid items" });
    expect(await questionSetCreator.draft(ctx, params)).toEqual({ ok: true, draft: { specs: params.specs, itemIds: ["i1", "i2"], droppedByCheck: 1, failedBatches: 1 } });
    expect(generateItems.mock.calls.map(([org, user, s]) => [org, user, s.count])).toEqual([["o1", "u1", 10], ["o1", "u1", 2]]);
  });

  it("answers AI_UNAVAILABLE when no provider is configured", async () => {
    generateItems.mockRejectedValue(new Error("AI_UNAVAILABLE"));
    expect(await questionSetCreator.draft(ctx, params)).toEqual({ ok: false, code: "AI_UNAVAILABLE" });
    expect(generateItems).toHaveBeenCalledTimes(1);
  });

  it("answers FAILED when no batch produced an item", async () => {
    generateItems.mockResolvedValue({ ok: false, error: "bad" });
    expect(await questionSetCreator.draft(ctx, params)).toEqual({ ok: false, code: "FAILED" });
  });
});

describe("questionSetCreator.apply", () => {
  const draft: QuestionSetDraft = { specs: [], itemIds: ["i1", "i2", "i3", "i4"], droppedByCheck: 0, failedBatches: 0 };

  it("refuses ids that are not this draft's, and an id both kept and rejected", async () => {
    expect(await questionSetCreator.apply(ctx, draft, { approve: ["x"], reject: [] })).toEqual({ ok: false, code: "INVALID" });
    expect(await questionSetCreator.apply(ctx, draft, { approve: ["i1"], reject: ["i1"] })).toEqual({ ok: false, code: "INVALID" });
    expect(fake.calls).toEqual([]);
  });

  it("approves valid items, makes listening audio first, rejects the removed ones and keeps the rest pending", async () => {
    fake.results = [
      [
        choice("i1"),
        choice("i2"),
        choice("i3", { section: "LISTENING", stimulusId: "s1" }),
        choice("i4", { content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }] } }),
      ],
    ];
    ensureStimulusAudio.mockResolvedValue({ ok: false, reason: "quota" });
    const r = await questionSetCreator.apply(ctx, draft, { approve: ["i1", "i3", "i4"], reject: ["i2"] });
    expect(ensureStimulusAudio).toHaveBeenCalledWith("o1", "u1", "s1");
    expect(setStatuses()).toEqual(["APPROVED", "REJECTED"]);
    expect(auditActions()).toEqual(["bank.approved", "bank.rejected"]);
    expect(r).toMatchObject({ ok: true, href: "/exam/bank", go: false, followUps: [] });
    expect(r.ok && r.notes.map((n) => n.tr)).toEqual([
      "1 soru onaylandı, 1 soru reddedildi.",
      "2 soru onay bekliyor; soru bankasında görürsün.",
      "1 dinleme sorusunun sesi üretilemedi; soru bankasından sesi yeniden üret.",
      "1 soru kontrolden geçmedi; soru bankasında düzelt.",
    ]);
  });
});

describe("questionSetCreator.discard", () => {
  it("rejects every item the draft created that is still a draft", async () => {
    fake.results = [[{ id: "i1" }, { id: "i2" }]];
    await questionSetCreator.discard!(ctx, { specs: [], itemIds: ["i1", "i2", "i3"], droppedByCheck: 0, failedBatches: 0 });
    expect(setStatuses()).toEqual(["REJECTED"]);
    expect(fake.calls.filter(([op]) => op === "values").map(([, a]) => a[0])).toEqual([
      { orgId: "o1", actorId: "u1", action: "bank.rejected", subjectType: "item", subjectId: null, meta: { via: "advanced.discard", draftId: "d1", count: 2 } },
    ]);
  });

  it("writes nothing for a draft without items", async () => {
    await questionSetCreator.discard!(ctx, { specs: [], itemIds: [], droppedByCheck: 0, failedBatches: 0 });
    expect(fake.calls).toEqual([]);
  });
});
