import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LibraryRead from "@/server/library";
import type * as LibraryWrite from "@/server/library-write";
import type { CreatorCtx } from "@/solutions/types";
import type * as DraftJob from "../ai/draft-job";
import { templateCompetency } from "../templates/competencies";
import { TEMPLATES } from "../templates/index";

vi.mock("@/db", () => ({ db: {} }));
const m = vi.hoisted(() => ({
  activeCompetencyOptions: vi.fn<typeof LibraryRead.activeCompetencyOptions>(),
  createPosition: vi.fn<typeof LibraryWrite.createPosition>(),
  savePosition: vi.fn<typeof LibraryWrite.savePosition>(),
  findOrCreateCompetency: vi.fn<typeof LibraryWrite.findOrCreateCompetency>(),
  generateHiringDraft: vi.fn<typeof DraftJob.generateHiringDraft>(),
}));
const forward = vi.hoisted(() => (name: string) => (...a: unknown[]) => (m[name as keyof typeof m] as (...x: unknown[]) => unknown)(...a));
vi.mock("@/server/library", () => ({ activeCompetencyOptions: forward("activeCompetencyOptions") }));
vi.mock("@/server/library-write", () => ({
  createPosition: forward("createPosition"),
  savePosition: forward("savePosition"),
  findOrCreateCompetency: forward("findOrCreateCompetency"),
}));
vi.mock("../ai/draft-job", () => ({ generateHiringDraft: forward("generateHiringDraft") }));

import { evenWeights, weightTotal } from "./position-weights";
import { positionCreator, validatePositionParams, type PositionDraft } from "./position";

const ctx: CreatorCtx = { orgId: "o1", userId: "u1", role: "MANAGER", locale: "tr", draftId: "d1" };
const TEMPLATE = TEMPLATES[0];
const AD = "Ekibimize müşteri sorularını telefonda ve e-postada sakin bir dille çözecek biri arıyoruz. Kayıtları düzenli tutmalısın.";
const suggestion = (key: string, libraryId: string, quote: string) => ({
  key,
  libraryId,
  nameTr: `Yetkinlik ${key}`,
  nameEn: "",
  descriptionTr: "",
  descriptionEn: "",
  anchor1Tr: "zayıf",
  anchor1En: "",
  anchor3Tr: "orta",
  anchor3En: "",
  anchor5Tr: "güçlü",
  anchor5En: "",
  quote,
});

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.activeCompetencyOptions.mockResolvedValue([]);
});

describe("weights", () => {
  it("splits 100 evenly, the remainder to the first rows", () => {
    expect(evenWeights(3)).toEqual([34, 33, 33]);
    expect(evenWeights(1)).toEqual([100]);
    expect(weightTotal(evenWeights(8))).toBe(100);
    expect(evenWeights(0)).toEqual([]);
  });
});

describe("validatePositionParams", () => {
  it("asks for the name first", () => {
    expect(validatePositionParams({}, "tr")).toEqual({ ok: false, questions: [{ id: "name", text: "Pozisyonun adı ne?", choices: [] }] });
  });

  it("asks for a job ad when the name is not a ready template", () => {
    expect(validatePositionParams({ name: "Kuantum Muhasebecisi", jobAd: "kısa" }, "tr")).toEqual({
      ok: false,
      questions: [{ id: "jobAd", text: "Kısa bir görev tanımı ya da ilan metni yazar mısın? En az 40 karakter.", choices: [] }],
    });
  });

  it("needs no job ad for a ready template, in either language", () => {
    expect(validatePositionParams({ name: TEMPLATE.name.tr, jobAd: "", team: "" }, "tr")).toEqual({ ok: true, params: { name: TEMPLATE.name.tr, jobAd: null, team: null } });
    expect(validatePositionParams({ name: TEMPLATE.name.en }, "en").ok).toBe(true);
  });
});

describe("positionCreator.draft", () => {
  it("uses a ready template without an AI call and marks what the library has", async () => {
    const [firstKey] = Object.keys(TEMPLATE.weights);
    m.activeCompetencyOptions.mockResolvedValue([{ id: "lib-1", name: templateCompetency(firstKey)!.name }]);
    const r = await positionCreator.draft(ctx, { name: TEMPLATE.name.tr, jobAd: null, team: "Destek" });
    expect(m.generateHiringDraft).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ source: "TEMPLATE", templateKey: TEMPLATE.key, jobAd: TEMPLATE.jobAd.tr, team: "Destek" });
    expect(r.draft.competencies.map((c) => c.key)).toEqual(Object.keys(TEMPLATE.weights));
    expect(weightTotal(r.draft.competencies.map((c) => c.weight))).toBe(100);
    expect(r.draft.competencies[0].libraryId).toBe("lib-1");
    expect(r.draft.competencies[0].anchors["3"]).toEqual(templateCompetency(firstKey)!.anchors[3]);
  });

  it("maps a missing provider to AI_UNAVAILABLE and a failed run to FAILED", async () => {
    m.generateHiringDraft.mockResolvedValueOnce({ status: "UNCONFIGURED" });
    expect(await positionCreator.draft(ctx, { name: "Kuantum Muhasebecisi", jobAd: AD, team: null })).toEqual({ ok: false, code: "AI_UNAVAILABLE" });
    m.generateHiringDraft.mockResolvedValueOnce({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(await positionCreator.draft(ctx, { name: "Kuantum Muhasebecisi", jobAd: AD, team: null })).toEqual({ ok: false, code: "FAILED" });
  });

  it("drafts competencies from the job ad, drops the stages and new ones it cannot quote, and splits the weights", async () => {
    m.activeCompetencyOptions.mockResolvedValue([{ id: "lib-1", name: { tr: "İletişim", en: "Communication" } }]);
    m.generateHiringDraft.mockResolvedValueOnce({
      status: "OK",
      budgetWarning: null,
      draft: {
        stages: [],
        competencies: [
          suggestion("comm", "lib-1", ""),
          suggestion("calm", "", "müşteri sorularını telefonda ve e-postada sakin bir dille çözecek"),
          suggestion("magic", "", "bu cümle ilanda yok"),
        ],
      },
    });
    const r = await positionCreator.draft(ctx, { name: "Kuantum Muhasebecisi", jobAd: AD, team: null });
    const call = m.generateHiringDraft.mock.calls[0][0];
    expect(call).toMatchObject({ orgId: "o1", userId: "u1", inputRef: "creation_draft:d1", positionName: "Kuantum Muhasebecisi", jobAd: AD, locales: ["tr"], teamLocale: "tr" });
    expect(call).not.toHaveProperty("openingId");
    expect(call.library).toEqual([{ id: "lib-1", name: "İletişim", inProfile: false }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.source).toBe("AI");
    expect(r.draft.competencies.map((c) => [c.key, c.libraryId, c.weight])).toEqual([
      ["comm", "lib-1", 50],
      ["calm", null, 50],
    ]);
    expect(r.draft.competencies[0].name).toEqual({ tr: "İletişim", en: "Communication" });
    expect(r.draft.competencies[1].anchors["1"]).toEqual({ tr: "zayıf", en: "" });
  });
});

describe("positionCreator.apply", () => {
  const draft: PositionDraft = {
    name: "Müşteri Destek Uzmanı",
    team: "Destek",
    jobAd: AD,
    source: "AI",
    templateKey: null,
    competencies: [
      { key: "comm", libraryId: "lib-1", name: { tr: "İletişim", en: "" }, description: { tr: "", en: "" }, anchors: { "1": { tr: "a", en: "" }, "3": { tr: "b", en: "" }, "5": { tr: "c", en: "" } }, weight: 50 },
      { key: "calm", libraryId: null, name: { tr: "Sakinlik", en: "" }, description: { tr: "", en: "" }, anchors: { "1": { tr: "x", en: "" }, "3": { tr: "y", en: "" }, "5": { tr: "z", en: "" } }, weight: 50 },
    ],
  };
  const edits = (over: Array<Record<string, unknown>> = []) => ({
    competencies: over.length ? over : [{ key: "comm", weight: 60 }, { key: "calm", weight: 40, anchors: { "1": { tr: "x2", en: "" }, "3": { tr: "y", en: "" }, "5": { tr: "z", en: "" } } }],
  });

  it("refuses weights that do not add to 100 and unknown competencies, writing nothing", async () => {
    expect(await positionCreator.apply(ctx, draft, edits([{ key: "comm", weight: 50 }, { key: "calm", weight: 40 }]))).toEqual({ ok: false, code: "WEIGHTS" });
    expect(await positionCreator.apply(ctx, draft, edits([{ key: "nope", weight: 100 }]))).toEqual({ ok: false, code: "INVALID" });
    expect(await positionCreator.apply(ctx, draft, { competencies: [] })).toEqual({ ok: false, code: "INVALID" });
    expect(m.createPosition).not.toHaveBeenCalled();
    expect(m.findOrCreateCompetency).not.toHaveBeenCalled();
  });

  it("reuses the library row, creates the new one with its edited anchors, then the position and its profile", async () => {
    m.findOrCreateCompetency.mockResolvedValueOnce({ ok: true, id: "new-1", created: true });
    m.createPosition.mockResolvedValueOnce({ ok: true, id: "p1" });
    m.savePosition.mockResolvedValueOnce({ ok: true, position: {} as never });
    const r = await positionCreator.apply(ctx, draft, edits());
    expect(m.findOrCreateCompetency).toHaveBeenCalledTimes(1);
    expect(m.findOrCreateCompetency).toHaveBeenCalledWith(
      "o1",
      "u1",
      { name: { tr: "Sakinlik", en: "" }, description: { tr: "", en: "" }, anchors: { "1": { tr: "x2", en: "" }, "3": { tr: "y", en: "" }, "5": { tr: "z", en: "" } } },
      "advanced-create:d1",
    );
    expect(m.createPosition).toHaveBeenCalledWith("o1", "u1", { name: "Müşteri Destek Uzmanı", jobDescription: AD, team: "Destek" });
    expect(m.savePosition.mock.calls[0][3].profile).toEqual([
      { competencyId: "lib-1", weight: 60, expectedLevel: null },
      { competencyId: "new-1", weight: 40, expectedLevel: null },
    ]);
    expect(r).toEqual({
      ok: true,
      href: "/library/positions/p1",
      go: false,
      links: [
        { label: { tr: "Pozisyonu aç", en: "Open the position" }, href: "/library/positions/p1" },
        { label: { tr: "Bu pozisyon için alım aç", en: "Open a role for this position" }, href: "/hiring/openings/new?position=p1" },
      ],
      notes: [],
      followUps: [],
    });
  });

  it("still links the created position when its profile could not be saved", async () => {
    m.findOrCreateCompetency.mockResolvedValueOnce({ ok: true, id: "new-1", created: true });
    m.createPosition.mockResolvedValueOnce({ ok: true, id: "p2" });
    m.savePosition.mockResolvedValueOnce({ ok: false, code: "COMPETENCY" });
    const r = await positionCreator.apply(ctx, draft, edits());
    expect(r).toMatchObject({ ok: true, href: "/library/positions/p2" });
    expect(r.ok && r.notes.length).toBe(1);
  });
});
