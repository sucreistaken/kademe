import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiLimit from "@/lib/ai-limit";
import type * as LibraryWrite from "@/server/library-write";
import type * as DraftJob from "@/solutions/hiring/ai/draft-job";
import type * as DraftContext from "@/solutions/hiring/server/draft-context";
import type * as Versions from "@/solutions/hiring/server/versions";
import type * as Working from "@/solutions/hiring/server/working";
import { emptyActivity, type StagePayload } from "@/solutions/hiring/rules/patches";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";

/**
 * The AI screen's actions (HIRING-UX 5.6, Task 17 carries): every action asks
 * for the right to edit this opening first (organisation-scoped load, role,
 * CLOSED) and writes with the session's organisation and user, never ones from
 * the browser; nothing is written without a click, a live opening is never
 * turned into a draft here (C5), an undone AI competency is archived and never
 * deleted (C1), and the AI is asked only under the limit (no call over it).
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "en" }));

const OPENING = "33333333-3333-4333-8333-333333333333";
const POSITION = "55555555-5555-4555-8555-555555555555";
const COMP = "66666666-6666-4666-8666-666666666666";
const STAGE = "77777777-7777-4777-8777-777777777777";
const AD = "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz. Paydaşlara bulguları sade bir dille anlatabilmelisin.";

type Gate = { ok: true; role?: "OWNER" | "MANAGER" | "REVIEWER" } | { ok: false; code: "NOT_FOUND" | "CLOSED" | "FORBIDDEN" };
let gate: Gate = { ok: true };
const editableOpening = vi.fn(async (id: string) =>
  gate.ok
    ? {
        ok: true as const,
        user: { id: "u1", orgId: "o1", email: "", name: "", role: gate.role ?? "OWNER" },
        opening: { id, status: "DRAFT", positionId: POSITION, positionName: "Ürün Tasarımcısı" },
      }
    : gate,
);
vi.mock("../../access", () => ({ editableOpening: (id: string) => editableOpening(id) }));

const m = vi.hoisted(() => ({
  insertStage: vi.fn<typeof Versions.insertStage>(),
  deleteStage: vi.fn<typeof Versions.deleteStage>(),
  ensureDraftVersion: vi.fn<typeof Versions.ensureDraftVersion>(),
  workingState: vi.fn<typeof Working.workingState>(),
  findOrCreateCompetency: vi.fn<typeof LibraryWrite.findOrCreateCompetency>(),
  archiveCompetencyIfUnused: vi.fn<typeof LibraryWrite.archiveCompetencyIfUnused>(),
  setPositionJobAdIfEmpty: vi.fn<typeof LibraryWrite.setPositionJobAdIfEmpty>(),
  aiLimitReached: vi.fn<typeof AiLimit.aiLimitReached>(),
  generateHiringDraft: vi.fn<typeof DraftJob.generateHiringDraft>(),
  draftLibrary: vi.fn<typeof DraftContext.draftLibrary>(),
}));
const forward = vi.hoisted(() => (name: string) => (...a: unknown[]) => (m[name as keyof typeof m] as (...x: unknown[]) => unknown)(...a));
vi.mock("@/solutions/hiring/server/versions", () => ({
  insertStage: forward("insertStage"),
  deleteStage: forward("deleteStage"),
  ensureDraftVersion: forward("ensureDraftVersion"),
}));
vi.mock("@/solutions/hiring/server/working", () => ({ workingState: forward("workingState") }));
vi.mock("@/server/library-write", () => ({
  findOrCreateCompetency: forward("findOrCreateCompetency"),
  archiveCompetencyIfUnused: forward("archiveCompetencyIfUnused"),
  setPositionJobAdIfEmpty: forward("setPositionJobAdIfEmpty"),
}));
vi.mock("@/lib/ai-limit", () => ({ aiLimitReached: forward("aiLimitReached") }));
vi.mock("@/solutions/hiring/ai/draft-job", () => ({ generateHiringDraft: forward("generateHiringDraft") }));
vi.mock("@/solutions/hiring/server/draft-context", () => ({ draftLibrary: forward("draftLibrary") }));

import { acceptCompetencyAction, acceptStageAction, generateDraftAction, removeAcceptedStageAction, undoCompetencyAction } from "./actions";

const text = (s: string) => ({ tr: s, en: "" });
const payload = (over: Partial<StagePayload> = {}): StagePayload => ({
  name: text("Araştırma"),
  description: text(""),
  internalPurpose: null,
  durationSeconds: 480,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: [{ ...emptyActivity("VIDEO"), prompt: text("Bir bulguyu anlat."), competencyIds: [COMP] }],
  ...over,
});
const proposal = { name: text("Veriyle karar"), description: text(""), anchors: { "1": text("a"), "3": text("b"), "5": text("c") } };
const VIA = `hiring-ai:${OPENING}`;

type State = Awaited<ReturnType<typeof Working.workingState>>;
const version = (status: "DRAFT" | "PUBLISHED", number: number) => ({ id: `v${number}`, number, status, publishedAt: null, previewedAt: null });
function stateWith(draft: boolean, localeSet: Array<"tr" | "en"> = ["tr"], defaultLocale: "tr" | "en" = "tr"): State {
  const v = draft ? version("DRAFT", 2) : version("PUBLISHED", 1);
  return {
    list: [v],
    draft: draft ? v : null,
    live: draft ? null : v,
    content: { localeSet, defaultLocale } as unknown as State["content"],
    facts: new Map(),
    problems: [],
  };
}

const anyWrite = () =>
  m.insertStage.mock.calls.length +
  m.deleteStage.mock.calls.length +
  m.ensureDraftVersion.mock.calls.length +
  m.findOrCreateCompetency.mock.calls.length +
  m.archiveCompetencyIfUnused.mock.calls.length +
  m.setPositionJobAdIfEmpty.mock.calls.length +
  m.generateHiringDraft.mock.calls.length;

beforeEach(() => {
  gate = { ok: true };
  editableOpening.mockClear();
  for (const fn of Object.values(m)) fn.mockReset();
  m.insertStage.mockResolvedValue(STAGE);
  m.deleteStage.mockResolvedValue({ payload: payload(), index: 0 });
  m.workingState.mockResolvedValue(stateWith(true));
  m.findOrCreateCompetency.mockResolvedValue({ ok: true, id: COMP, created: true });
  m.archiveCompetencyIfUnused.mockResolvedValue({ ok: true });
  m.setPositionJobAdIfEmpty.mockResolvedValue(undefined);
  m.aiLimitReached.mockResolvedValue(false);
  m.draftLibrary.mockResolvedValue([{ id: COMP, name: "İletişim", inProfile: true }]);
  m.generateHiringDraft.mockResolvedValue({ status: "UNCONFIGURED" });
});

const CALLS = [
  ["generateDraftAction", () => generateDraftAction(OPENING, AD)],
  ["acceptStageAction", () => acceptStageAction(OPENING, payload())],
  ["removeAcceptedStageAction", () => removeAcceptedStageAction(OPENING, STAGE)],
  ["acceptCompetencyAction", () => acceptCompetencyAction(OPENING, proposal)],
  ["undoCompetencyAction", () => undoCompetencyAction(OPENING, COMP)],
] as const;

describe("AI draft actions: access", () => {
  it.each(CALLS)("%s asks for the right to edit this opening and answers its refusal as a code, writing nothing", async (_name, call) => {
    for (const code of ["NOT_FOUND", "CLOSED", "FORBIDDEN"] as const) {
      gate = { ok: false, code };
      await expect(call()).resolves.toEqual({ ok: false, code });
    }
    expect(editableOpening).toHaveBeenCalledWith(OPENING);
    expect(anyWrite()).toBe(0);
    expect(m.aiLimitReached).not.toHaveBeenCalled();
  });

  it("writes with the session's organisation and user, never ones from the browser", async () => {
    await acceptStageAction(OPENING, { ...payload(), orgId: "evil" } as StagePayload);
    expect(m.insertStage).toHaveBeenCalledWith("o1", OPENING, payload());
    await removeAcceptedStageAction(OPENING, STAGE);
    expect(m.deleteStage).toHaveBeenCalledWith("o1", OPENING, STAGE);
    await acceptCompetencyAction(OPENING, proposal);
    expect(m.findOrCreateCompetency).toHaveBeenCalledWith("o1", "u1", proposal, VIA);
    await undoCompetencyAction(OPENING, COMP);
    expect(m.archiveCompetencyIfUnused).toHaveBeenCalledWith("o1", "u1", COMP, VIA);
  });

  it("a malformed request is INVALID before any write", async () => {
    await expect(generateDraftAction(OPENING, 42 as unknown as string)).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(acceptStageAction(OPENING, { ...payload(), durationSeconds: 5 })).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(removeAcceptedStageAction(OPENING, "not-an-id")).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(acceptCompetencyAction(OPENING, { ...proposal, name: text("x".repeat(121)) })).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(acceptCompetencyAction(OPENING, { ...proposal, anchors: { "7": text("x") } } as unknown as typeof proposal)).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(undoCompetencyAction(OPENING, "not-an-id")).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(acceptStageAction(42 as unknown as string, payload())).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(anyWrite()).toBe(0);
  });

  it("the library is changed only by a role that may change it", async () => {
    gate = { ok: true, role: "REVIEWER" };
    await expect(acceptCompetencyAction(OPENING, proposal)).resolves.toEqual({ ok: false, code: "LIBRARY_FORBIDDEN" });
    await expect(undoCompetencyAction(OPENING, COMP)).resolves.toEqual({ ok: false, code: "LIBRARY_FORBIDDEN" });
    expect(anyWrite()).toBe(0);
  });
});

describe("generateDraftAction", () => {
  it("checks the ad's length before anything else is read or asked", async () => {
    await expect(generateDraftAction(OPENING, "kısa")).resolves.toEqual({ ok: false, code: "JOB_AD_TOO_SHORT" });
    await expect(generateDraftAction(OPENING, "x".repeat(20_001))).resolves.toEqual({ ok: false, code: "JOB_AD_TOO_LONG" });
    expect(m.aiLimitReached).not.toHaveBeenCalled();
    expect(anyWrite()).toBe(0);
  });

  it("asks nothing for a live opening without a draft: NO_DRAFT, and no draft is opened here (C5)", async () => {
    m.workingState.mockResolvedValue(stateWith(false));
    await expect(generateDraftAction(OPENING, AD)).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    expect(m.aiLimitReached).not.toHaveBeenCalled();
    expect(anyWrite()).toBe(0);
  });

  it("answers RATE_LIMITED over the AI limit and makes no call, writes nothing", async () => {
    m.aiLimitReached.mockResolvedValueOnce(true);
    await expect(generateDraftAction(OPENING, AD)).resolves.toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(m.aiLimitReached).toHaveBeenCalledWith("o1", "u1", "HIRING_DRAFT");
    expect(anyWrite()).toBe(0);
  });

  it("writes team-only text in the version's default language, whatever the manager's own interface language", async () => {
    // The manager's cookie says English (managerLocale is mocked to "en"); the version is Turkish only.
    m.workingState.mockResolvedValue(stateWith(true, ["tr"], "tr"));
    await generateDraftAction(OPENING, AD);
    expect(m.generateHiringDraft.mock.calls[0][0]).toMatchObject({ locales: ["tr"], teamLocale: "tr" });
  });

  it("asks for a proposal with the org's own library and the version's languages", async () => {
    m.workingState.mockResolvedValue(stateWith(true, ["tr", "en"], "en"));
    const draft = { stages: [], competencies: [] };
    m.generateHiringDraft.mockResolvedValueOnce({ status: "OK", draft, budgetWarning: "Toplam süre 41 dakika" });
    await expect(generateDraftAction(OPENING, `  ${AD}  `)).resolves.toEqual({ ok: true, draft, budgetWarning: "Toplam süre 41 dakika" });
    expect(m.workingState).toHaveBeenCalledWith("o1", OPENING);
    expect(m.draftLibrary).toHaveBeenCalledWith("o1", POSITION);
    expect(m.setPositionJobAdIfEmpty).toHaveBeenCalledWith("o1", "u1", POSITION, `  ${AD}  `);
    expect(m.generateHiringDraft).toHaveBeenCalledWith({
      orgId: "o1",
      userId: "u1",
      openingId: OPENING,
      positionName: "Ürün Tasarımcısı",
      jobAd: AD,
      locales: ["tr", "en"],
      teamLocale: "en",
      library: [{ id: COMP, name: "İletişim", inProfile: true }],
    });
    expect(m.insertStage).not.toHaveBeenCalled();
  });

  it("answers the job's failures as codes", async () => {
    m.generateHiringDraft.mockResolvedValueOnce({ status: "UNCONFIGURED" });
    await expect(generateDraftAction(OPENING, AD)).resolves.toEqual({ ok: false, code: "UNCONFIGURED" });
    m.generateHiringDraft.mockResolvedValueOnce({ status: "FAILED", code: "PROVIDER_FAILED" });
    await expect(generateDraftAction(OPENING, AD)).resolves.toEqual({ ok: false, code: "PROVIDER_FAILED" });
    m.generateHiringDraft.mockResolvedValueOnce({ status: "FAILED", code: "SCHEMA_FAILED" });
    await expect(generateDraftAction(OPENING, AD)).resolves.toEqual({ ok: false, code: "SCHEMA_FAILED" });
  });
});

describe("acceptStageAction", () => {
  it("inserts strictly (no restore option) and never opens a draft itself", async () => {
    await expect(acceptStageAction(OPENING, payload())).resolves.toEqual({ ok: true, stageId: STAGE });
    expect(m.insertStage.mock.calls[0]).toHaveLength(3);
    expect(m.ensureDraftVersion).not.toHaveBeenCalled();
  });

  it("answers NO_DRAFT on a live opening (C5): the draft is opened only by Düzenlemeye başla", async () => {
    m.insertStage.mockRejectedValueOnce(new HiringConflict("NO_DRAFT"));
    await expect(acceptStageAction(OPENING, payload())).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    expect(m.ensureDraftVersion).not.toHaveBeenCalled();
  });

  it("refuses a choice question: the AI never proposes one", async () => {
    const choice = payload({ activities: [{ ...emptyActivity("SINGLE_CHOICE"), prompt: text("Hangisi?") }] });
    await expect(acceptStageAction(OPENING, choice)).resolves.toEqual({ ok: false, code: "INVALID" });
    expect(m.insertStage).not.toHaveBeenCalled();
  });

  it.each([
    [new HiringConflict("COMPETENCY"), "COMPETENCY"],
    [new HiringConflict("CLOSED"), "CLOSED"],
    [new HiringConflict("STAGE_FULL"), "STAGE_FULL"],
    [new HiringConflict("TOO_MANY_COMPETENCIES"), "TOO_MANY_COMPETENCIES"],
    [new HiringConflict("CHOICE_COMPETENCY"), "CHOICE_COMPETENCY"],
    [new HiringNotFound("opening"), "NOT_FOUND"],
    [new HiringInvalid([{ path: "name.tr", message: "too long" }]), "INVALID"],
  ])("answers the draft's refusal %s as a code", async (error, code) => {
    m.insertStage.mockRejectedValueOnce(error);
    await expect(acceptStageAction(OPENING, payload())).resolves.toEqual({ ok: false, code });
  });

  it("lets a real error through", async () => {
    m.insertStage.mockRejectedValueOnce(new Error("connection lost"));
    await expect(acceptStageAction(OPENING, payload())).rejects.toThrow("connection lost");
  });
});

describe("removeAcceptedStageAction", () => {
  it("removes the stage from the draft and answers NO_DRAFT once it is published", async () => {
    await expect(removeAcceptedStageAction(OPENING, STAGE)).resolves.toEqual({ ok: true });
    m.deleteStage.mockRejectedValueOnce(new HiringConflict("NO_DRAFT"));
    await expect(removeAcceptedStageAction(OPENING, STAGE)).resolves.toEqual({ ok: false, code: "NO_DRAFT" });
    m.deleteStage.mockRejectedValueOnce(new HiringNotFound("stage"));
    await expect(removeAcceptedStageAction(OPENING, STAGE)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(m.ensureDraftVersion).not.toHaveBeenCalled();
  });
});

describe("competency cards", () => {
  it("accepts a proposal into the library and says whether it reused one", async () => {
    await expect(acceptCompetencyAction(OPENING, proposal)).resolves.toEqual({ ok: true, id: COMP, created: true });
    m.findOrCreateCompetency.mockResolvedValueOnce({ ok: false, code: "NAME_REQUIRED" });
    await expect(acceptCompetencyAction(OPENING, { ...proposal, name: text(" ") })).resolves.toEqual({ ok: false, code: "NAME_REQUIRED" });
  });

  it("undo archives through archiveCompetencyIfUnused (C1), never a delete, and passes its refusals on", async () => {
    await expect(undoCompetencyAction(OPENING, COMP)).resolves.toEqual({ ok: true });
    m.archiveCompetencyIfUnused.mockResolvedValueOnce({ ok: false, code: "IN_USE" });
    await expect(undoCompetencyAction(OPENING, COMP)).resolves.toEqual({ ok: false, code: "IN_USE" });
    m.archiveCompetencyIfUnused.mockResolvedValueOnce({ ok: false, code: "NOT_CREATED" });
    await expect(undoCompetencyAction(OPENING, COMP)).resolves.toEqual({ ok: false, code: "NOT_CREATED" });
    m.archiveCompetencyIfUnused.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
    await expect(undoCompetencyAction(OPENING, COMP)).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
