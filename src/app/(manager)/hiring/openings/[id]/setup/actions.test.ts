import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiLimit from "@/lib/ai-limit";
import type * as Library from "@/server/library";
import type * as LibraryWrite from "@/server/library-write";
import type * as DraftJob from "@/solutions/hiring/ai/draft-job";
import type * as ReviseJob from "@/solutions/hiring/ai/revise-job";
import type * as DraftContext from "@/solutions/hiring/server/draft-context";
import type * as Versions from "@/solutions/hiring/server/versions";
import type * as Working from "@/solutions/hiring/server/working";
import type { ActivitySuggestion, CompetencySuggestion, HiringDraft } from "@/solutions/hiring/ai/draft";
import type { ContentActivity, ContentStage } from "@/solutions/hiring/rules/content";
import { emptyActivity, stagePayloadOf } from "@/solutions/hiring/rules/patches";
import { HiringConflict } from "@/solutions/hiring/server/errors";
import { packReviseUndo } from "./revise-undo";

/**
 * Step 2 of the wizard (HIRING-UX 5.20): every action asks for the right to
 * edit this opening first and writes with the session's organisation and user;
 * the first draft is applied once (never on a draft that has stages); the AI is
 * asked only under its own limit; a revision answers an undo token that only
 * this draft accepts back.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/db", () => ({ db: {} }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const POSITION = "55555555-5555-4555-8555-555555555555";
const COMM = "66666666-6666-4666-8666-666666666666";
const NEW_ID = "77777777-7777-4777-8777-777777777777";
const ACT = "88888888-8888-4888-8888-888888888888";
const CHOICE = "99999999-9999-4999-8999-999999999999";
const AD = "Sürücü kursumuzda B sınıfı direksiyon derslerini verecek, sabırlı ve deneyimli bir sürüş eğitmeni arıyoruz.";

type Gate = { ok: true; role?: "OWNER" | "MANAGER" | "REVIEWER" } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
vi.mock("../access", () => ({
  editableOpening: async (id: string) =>
    gate.ok
      ? {
          ok: true as const,
          user: { id: "u1", orgId: "o1", email: "", name: "", role: gate.role ?? "OWNER" },
          opening: { id, status: "DRAFT", positionId: POSITION, positionName: "Sürüş eğitmeni" },
        }
      : gate,
}));

const m = vi.hoisted(() => ({
  replaceDraftStages: vi.fn<typeof Versions.replaceDraftStages>(),
  updateActivity: vi.fn<typeof Versions.updateActivity>(),
  setActivityCompetencies: vi.fn<typeof Versions.setActivityCompetencies>(),
  workingState: vi.fn<typeof Working.workingState>(),
  loadPosition: vi.fn<typeof Library.loadPosition>(),
  findOrCreateCompetency: vi.fn<typeof LibraryWrite.findOrCreateCompetency>(),
  aiLimitReached: vi.fn<typeof AiLimit.aiLimitReached>(),
  generateHiringDraft: vi.fn<typeof DraftJob.generateHiringDraft>(),
  reviseHiringDraft: vi.fn<typeof ReviseJob.reviseHiringDraft>(),
  reviseHiringActivity: vi.fn<typeof ReviseJob.reviseHiringActivity>(),
  draftLibrary: vi.fn<typeof DraftContext.draftLibrary>(),
  draftId: vi.fn<(orgId: string, openingId: string) => Promise<string>>(),
}));
const forward = vi.hoisted(() => (name: string) => (...a: unknown[]) => (m[name as keyof typeof m] as (...x: unknown[]) => unknown)(...a));
vi.mock("@/solutions/hiring/server/versions", () => ({
  replaceDraftStages: forward("replaceDraftStages"),
  updateActivity: forward("updateActivity"),
  setActivityCompetencies: forward("setActivityCompetencies"),
}));
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: forward("workingState") }));
vi.mock("@/server/library", () => ({ loadPosition: forward("loadPosition") }));
vi.mock("@/server/library-write", () => ({ findOrCreateCompetency: forward("findOrCreateCompetency") }));
vi.mock("@/lib/ai-limit", () => ({ aiLimitReached: forward("aiLimitReached") }));
vi.mock("@/solutions/hiring/ai/draft-job", () => ({ generateHiringDraft: forward("generateHiringDraft") }));
vi.mock("@/solutions/hiring/ai/revise-job", () => ({ reviseHiringDraft: forward("reviseHiringDraft"), reviseHiringActivity: forward("reviseHiringActivity") }));
vi.mock("@/solutions/hiring/server/draft-context", () => ({ draftLibrary: forward("draftLibrary") }));
vi.mock("../assessment/edit/stage-ticket", () => ({ draftId: forward("draftId") }));

import { generateAndApplyDraftAction, reviseAssessmentAction, undoReviseAction } from "./actions";

const t = (tr: string) => ({ tr, en: "" });
const contentActivity = (id: string, over: Partial<ContentActivity> = {}): ContentActivity => ({
  id,
  orderIndex: 0,
  ...emptyActivity("VIDEO"),
  prompt: t("Bir dersi nasıl planlarsın?"),
  competencyIds: [COMM],
  ...over,
});
const contentStage = (activities: ContentActivity[]): ContentStage => ({
  id: "st1",
  orderIndex: 0,
  name: t("Ders"),
  description: t(""),
  internalPurpose: null,
  durationSeconds: 600,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities,
});

type State = Awaited<ReturnType<typeof Working.workingState>>;
function stateWith(draft: boolean, stages: ContentStage[] = []): State {
  const v = { id: draft ? "v2" : "v1", number: draft ? 2 : 1, status: draft ? ("DRAFT" as const) : ("PUBLISHED" as const), publishedAt: null, previewedAt: null, updatedAt: new Date(0) };
  return {
    list: [v],
    draft: draft ? v : null,
    live: draft ? null : v,
    content: { id: v.id, number: v.number, status: v.status, localeSet: ["tr"], defaultLocale: "tr", weightsEnabled: false, draftWeights: null, previewedAt: null, stages },
    facts: new Map([[COMM, { id: COMM, name: t("İletişim"), description: t(""), archived: false, anchors: {}, tags: [] }]]),
    problems: [],
  };
}

const suggestion = (over: Partial<ActivitySuggestion> = {}): ActivitySuggestion => ({
  key: "a1",
  type: "VIDEO",
  promptTr: "Trafik kurallarını bir öğrenciye nasıl anlatırsın?",
  promptEn: "",
  purpose: "",
  expectedBehaviours: [],
  redFlags: [],
  example1: "",
  example3: "",
  example5: "",
  competencyKeys: ["c1", "n1"],
  thinkSeconds: 60,
  answerSeconds: 120,
  quote: "",
  ...over,
});
const comp = (key: string, libraryId: string, name: string): CompetencySuggestion => ({
  key,
  libraryId,
  nameTr: name,
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  anchor1Tr: "a",
  anchor1En: "",
  anchor3Tr: "b",
  anchor3En: "",
  anchor5Tr: "c",
  anchor5En: "",
  quote: "",
});
const draft: HiringDraft = {
  stages: [
    { key: "s1", nameTr: "Anlatım", nameEn: "", descriptionTr: "", descriptionEn: "", purpose: "", durationSeconds: 600, quote: "", activities: [suggestion()] },
    { key: "s2", nameTr: "Plan", nameEn: "", descriptionTr: "", descriptionEn: "", purpose: "", durationSeconds: 480, quote: "", activities: [suggestion({ key: "a2", competencyKeys: ["c1"] })] },
  ],
  competencies: [comp("c1", COMM, "İletişim"), comp("n1", "", "Sabır")],
};

const aiCalls = () => m.generateHiringDraft.mock.calls.length + m.reviseHiringDraft.mock.calls.length + m.reviseHiringActivity.mock.calls.length;
const writes = () =>
  m.replaceDraftStages.mock.calls.length + m.updateActivity.mock.calls.length + m.setActivityCompetencies.mock.calls.length + m.findOrCreateCompetency.mock.calls.length;

beforeEach(() => {
  gate = { ok: true };
  for (const fn of Object.values(m)) fn.mockReset();
  m.workingState.mockResolvedValue(stateWith(true));
  m.loadPosition.mockResolvedValue({ jobDescription: AD } as Awaited<ReturnType<typeof Library.loadPosition>>);
  m.findOrCreateCompetency.mockResolvedValue({ ok: true, id: NEW_ID, created: true });
  m.aiLimitReached.mockResolvedValue(false);
  m.draftLibrary.mockResolvedValue([{ id: COMM, name: "İletişim", inProfile: true }]);
  m.generateHiringDraft.mockResolvedValue({ status: "OK", draft, budgetWarning: null });
  m.reviseHiringDraft.mockResolvedValue({ status: "OK", draft, budgetWarning: null });
  m.replaceDraftStages.mockImplementation(async (_o, _op, payloads) => ({ applied: true, previous: [], stageIds: payloads.map((_, i) => `s${i}`), versionId: "v2" }));
  m.updateActivity.mockResolvedValue(undefined);
  m.setActivityCompetencies.mockResolvedValue(undefined);
  m.draftId.mockResolvedValue("v2");
});

describe("step 2 actions: access", () => {
  const CALLS = [
    ["generateAndApplyDraftAction", () => generateAndApplyDraftAction(OPENING)],
    ["reviseAssessmentAction", () => reviseAssessmentAction(OPENING, { instruction: "Daha kısa yap", target: { kind: "all" } })],
    ["undoReviseAction", () => undoReviseAction(OPENING, "x.1.2")],
  ] as const;

  it.each(CALLS)("%s refuses without the right to edit, and asks no AI and writes nothing", async (_name, call) => {
    for (const code of ["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const) {
      gate = { ok: false, code };
      expect(await call()).toEqual({ ok: false, code });
    }
    expect(aiCalls()).toBe(0);
    expect(writes()).toBe(0);
  });
});

describe("generateAndApplyDraftAction", () => {
  it("generates from the position's ad and writes every stage, new competencies first, in one replace that only fills an empty draft", async () => {
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: true, applied: true, stages: 2, budgetWarning: null });
    expect(m.aiLimitReached).toHaveBeenCalledWith("o1", "u1", "HIRING_DRAFT");
    expect(m.generateHiringDraft.mock.calls[0][0]).toMatchObject({ orgId: "o1", userId: "u1", openingId: OPENING, jobAd: AD, positionName: "Sürüş eğitmeni" });
    expect(m.findOrCreateCompetency).toHaveBeenCalledTimes(1);
    expect(m.findOrCreateCompetency.mock.calls[0][2].name.tr).toBe("Sabır");
    expect(m.findOrCreateCompetency.mock.calls[0][3]).toBe(`hiring-ai:${OPENING}`);
    const [orgId, openingId, payloads, options] = m.replaceDraftStages.mock.calls[0];
    expect([orgId, openingId, options]).toEqual(["o1", OPENING, { onlyIfEmpty: true }]);
    expect(payloads[0].activities[0].competencyIds).toEqual([COMM, NEW_ID]);
  });

  it("is idempotent: a draft with stages asks no AI and writes nothing", async () => {
    m.workingState.mockResolvedValue(stateWith(true, [contentStage([contentActivity(ACT)])]));
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: true, applied: false });
    expect(aiCalls() + writes()).toBe(0);
    expect(m.aiLimitReached).not.toHaveBeenCalled();
  });

  it("answers applied: false when another tab filled the draft meanwhile", async () => {
    m.replaceDraftStages.mockResolvedValue({ applied: false, previous: [], stageIds: [], versionId: "v2" });
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: true, applied: false });
  });

  it.each([
    ["NO_DRAFT on a live opening", () => m.workingState.mockResolvedValue(stateWith(false)), "NO_DRAFT"],
    ["JOB_AD_TOO_SHORT for a position without an ad", () => m.loadPosition.mockResolvedValue({ jobDescription: "kısa" } as never), "JOB_AD_TOO_SHORT"],
    ["RATE_LIMITED over the limit", () => m.aiLimitReached.mockResolvedValue(true), "RATE_LIMITED"],
  ] as const)("refuses %s before any AI call", async (_label, arrange, code) => {
    arrange();
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: false, code });
    expect(aiCalls() + writes()).toBe(0);
  });

  it("passes the model's refusals on and writes nothing", async () => {
    m.generateHiringDraft.mockResolvedValueOnce({ status: "UNCONFIGURED" });
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: false, code: "UNCONFIGURED" });
    m.generateHiringDraft.mockResolvedValueOnce({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: false, code: "SCHEMA_FAILED" });
    expect(writes()).toBe(0);
  });

  it("creates no competency without the library right; the question keeps its library link only", async () => {
    gate = { ok: true, role: "REVIEWER" };
    await generateAndApplyDraftAction(OPENING);
    expect(m.findOrCreateCompetency).not.toHaveBeenCalled();
    expect(m.replaceDraftStages.mock.calls[0][2][0].activities[0].competencyIds).toEqual([COMM]);
  });

  it("answers a draft refusal as its code", async () => {
    m.replaceDraftStages.mockRejectedValueOnce(new HiringConflict("COMPETENCY"));
    expect(await generateAndApplyDraftAction(OPENING)).toEqual({ ok: false, code: "COMPETENCY" });
  });
});

describe("reviseAssessmentAction", () => {
  beforeEach(() => {
    m.workingState.mockResolvedValue(stateWith(true, [contentStage([contentActivity(ACT), contentActivity(CHOICE, { ...emptyActivity("SINGLE_CHOICE"), orderIndex: 1, competencyIds: [] })])]));
  });

  it("refuses a malformed request before the gate", async () => {
    expect(await reviseAssessmentAction(OPENING, { instruction: "", target: { kind: "all" } })).toEqual({ ok: false, code: "INVALID" });
    expect(await reviseAssessmentAction(OPENING, { instruction: "x".repeat(501), target: { kind: "all" } })).toEqual({ ok: false, code: "INVALID" });
    expect(aiCalls() + writes()).toBe(0);
  });

  it("whole list: sends the current draft and the instruction, replaces the stages, and answers an undo token of the old ones", async () => {
    const previous = [stagePayloadOf(contentStage([]))];
    m.replaceDraftStages.mockResolvedValueOnce({ applied: true, previous, stageIds: ["a", "b"], versionId: "v2" });
    const result = await reviseAssessmentAction(OPENING, { instruction: "Trafik kuralları sorusu ekle", target: { kind: "all" } });
    expect(result).toMatchObject({ ok: true, target: "all", stages: 2, budgetWarning: null });
    expect(m.aiLimitReached).toHaveBeenCalledWith("o1", "u1", "HIRING_REVISE");
    const sent = m.reviseHiringDraft.mock.calls[0][0];
    expect(sent.instruction).toBe("Trafik kuralları sorusu ekle");
    expect(sent.jobAd).toBe(AD);
    expect(sent.current.stages[0].activities.map((a) => a.key)).toEqual(["s1q1"]);
    expect(m.replaceDraftStages.mock.calls[0][3]).toBeUndefined();
    if (!result.ok || result.target !== "all") return;
    m.replaceDraftStages.mockClear();
    expect(await undoReviseAction(OPENING, result.undoToken)).toEqual({ ok: true });
    expect(m.replaceDraftStages.mock.calls[0]).toEqual(["o1", OPENING, previous, { restore: true }]);
  });

  it("one question: updates it in place, sets its links when they changed, and its undo restores the stored question", async () => {
    m.reviseHiringActivity.mockResolvedValue({
      status: "OK",
      revision: { activity: suggestion({ key: "q1", promptTr: "Daha kolay soru", competencyKeys: ["c1", "n1"] }), competencies: [comp("c1", COMM, "İletişim"), comp("n1", "", "Sabır")] },
    });
    const result = await reviseAssessmentAction(OPENING, { instruction: "Daha kolay yap", target: { kind: "activity", activityId: ACT } });
    expect(result).toMatchObject({ ok: true, target: "activity", activityId: ACT });
    expect(m.reviseHiringActivity.mock.calls[0][0]).toMatchObject({ stageName: "Ders", instruction: "Daha kolay yap", activity: { promptTr: "Bir dersi nasıl planlarsın?" } });
    expect(m.updateActivity.mock.calls[0][2]).toBe(ACT);
    expect(m.updateActivity.mock.calls[0][3]).toMatchObject({ prompt: { tr: "Daha kolay soru", en: "" } });
    expect(m.setActivityCompetencies.mock.calls[0]).toEqual(["o1", OPENING, ACT, [COMM, NEW_ID]]);
    if (!result.ok || result.target !== "activity") return;
    m.updateActivity.mockClear();
    m.setActivityCompetencies.mockClear();
    expect(await undoReviseAction(OPENING, result.undoToken)).toEqual({ ok: true });
    expect(m.updateActivity.mock.calls[0][3]).toMatchObject({ prompt: { tr: "Bir dersi nasıl planlarsın?", en: "" }, maxTakes: 2 });
    expect(m.setActivityCompetencies.mock.calls[0]).toEqual(["o1", OPENING, ACT, [COMM]]);
  });

  it("refuses a choice question, an unknown question and a live opening before any AI call", async () => {
    expect(await reviseAssessmentAction(OPENING, { instruction: "x", target: { kind: "activity", activityId: CHOICE } })).toEqual({ ok: false, code: "CHOICE_QUESTION" });
    expect(await reviseAssessmentAction(OPENING, { instruction: "x", target: { kind: "activity", activityId: NEW_ID } })).toEqual({ ok: false, code: "NOT_FOUND" });
    m.workingState.mockResolvedValue(stateWith(false));
    expect(await reviseAssessmentAction(OPENING, { instruction: "x", target: { kind: "all" } })).toEqual({ ok: false, code: "NO_DRAFT" });
    m.workingState.mockResolvedValue(stateWith(true));
    m.aiLimitReached.mockResolvedValue(true);
    expect(await reviseAssessmentAction(OPENING, { instruction: "x", target: { kind: "all" } })).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(aiCalls() + writes()).toBe(0);
  });
});

describe("undoReviseAction", () => {
  it("refuses a token of another draft, a forged one, and a draft that is gone", async () => {
    const other = packReviseUndo({ orgId: "o1", openingId: OPENING, versionId: "v1" }, { kind: "all", stages: [] });
    expect(await undoReviseAction(OPENING, other)).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    const foreign = packReviseUndo({ orgId: "o2", openingId: OPENING, versionId: "v2" }, { kind: "all", stages: [] });
    expect(await undoReviseAction(OPENING, foreign)).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(await undoReviseAction(OPENING, "garbage")).toEqual({ ok: false, code: "UNDO_EXPIRED" });
    expect(writes()).toBe(0);
    m.draftId.mockRejectedValueOnce(new HiringConflict("NO_DRAFT"));
    expect(await undoReviseAction(OPENING, other)).toEqual({ ok: false, code: "NO_DRAFT" });
  });
});
