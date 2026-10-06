import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankCount } from "@/lib/exam/blueprint";
import { CEFR_LEVELS, SECTIONS } from "@/lib/exam/types";
import type { CreatorCtx } from "@/solutions/types";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));
const counts = vi.hoisted(() => ({ value: [] as BankCount[] }));
vi.mock("@/server/panel", () => ({ bankCounts: async () => counts.value }));

import { examCreator, MAX_FOLLOW_UPS, validateExamParams, type ExamParams } from "./exam";

const FULL: BankCount[] = SECTIONS.flatMap((section) => CEFR_LEVELS.map((level) => ({ section, level, items: 200, stimuli: 50, cTests: 5 })));
const ctx: CreatorCtx = { orgId: "o1", userId: "u1", role: "MANAGER", locale: "tr", draftId: "d1" };
const params = (over: Partial<ExamParams> = {}): ExamParams => ({
  mode: "PLACEMENT",
  claimedLevel: null,
  targetMinutes: 40,
  skills: [],
  emphasis: null,
  speakingRequired: null,
  name: null,
  ...over,
});
const valuesOf = () => fake.calls.filter(([op]) => op === "values").map(([, a]) => a[0] as Record<string, unknown>);

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  counts.value = FULL;
});

describe("validateExamParams", () => {
  it("asks what the exam is for when the mode is missing, also when defaults are allowed", () => {
    const v = validateExamParams({}, "tr");
    expect(v).toEqual({ ok: false, questions: [{ id: "mode", text: "Sınav ne için olacak?", choices: ["Yeni öğrenciyi yerleştirmek", "Beyan edilen seviyeyi kontrol etmek"] }] });
    expect(examCreator.validate({ mode: "" }, "en", { useDefaults: true }).ok).toBe(false);
  });

  it("reads the router's empty values as not given and clamps the minutes", () => {
    expect(validateExamParams({ mode: "PLACEMENT", claimedLevel: "B1", targetMinutes: 0, skills: ["READING", "READING"], emphasis: "", speakingRequired: "", name: " " }, "tr")).toEqual({
      ok: true,
      params: { mode: "PLACEMENT", claimedLevel: null, targetMinutes: null, skills: ["READING"], emphasis: null, speakingRequired: null, name: null },
    });
    const v = validateExamParams({ mode: "LEVEL_VERIFICATION", claimedLevel: "B1", targetMinutes: 500, skills: [], emphasis: "READING", speakingRequired: "yes", name: "B1 kontrol" }, "tr");
    expect(v).toEqual({ ok: true, params: { mode: "LEVEL_VERIFICATION", claimedLevel: "B1", targetMinutes: 120, skills: [], emphasis: "READING", speakingRequired: true, name: "B1 kontrol" } });
  });

  it("treats garbage as empty", () => {
    expect(validateExamParams("nonsense", "tr").ok).toBe(false);
    expect(validateExamParams({ mode: "PLACEMENT", skills: "all" }, "tr")).toMatchObject({ ok: true, params: { skills: [] } });
  });
});

describe("examCreator.draft", () => {
  it("drafts the nearest template with a generated name and full coverage", async () => {
    const r = await examCreator.draft(ctx, params());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ name: "Yerleştirme sınavı, 40 dk", mode: "PLACEMENT", templateKey: "placement", coverageOk: true, gaps: [] });
  });

  it("reports the gaps against a thin bank", async () => {
    counts.value = [];
    const r = await examCreator.draft(ctx, params());
    expect(r.ok && r.draft.coverageOk).toBe(false);
    expect(r.ok && r.draft.gaps.length).toBeGreaterThan(0);
  });
});

describe("examCreator.apply", () => {
  const drafted = async () => {
    const r = await examCreator.draft(ctx, params({ claimedLevel: null }));
    if (!r.ok) throw new Error("draft failed");
    return r.draft;
  };
  const edits = (draft: Awaited<ReturnType<typeof drafted>>) => ({
    name: "B1 giriş",
    sections: draft.config.sections.map((s) => ({ section: s.section, enabled: s.enabled, durationMinutes: s.durationMinutes })),
  });

  it("refuses edits that are not an exam", async () => {
    const draft = await drafted();
    expect(await examCreator.apply(ctx, draft, { name: "" })).toEqual({ ok: false, code: "INVALID" });
    expect(await examCreator.apply(ctx, draft, { name: "X", sections: edits(draft).sections.map((s) => ({ ...s, enabled: false })) })).toEqual({ ok: false, code: "INVALID" });
    expect(fake.calls).toEqual([]);
  });

  it("publishes a covered exam and goes to the invite form with it chosen", async () => {
    const draft = await drafted();
    fake.results = [[{ id: "bp-1" }]];
    const r = await examCreator.apply(ctx, draft, edits(draft));
    expect(r).toMatchObject({ ok: true, href: "/exam/students/new?exam=bp-1", go: true, followUps: [] });
    const [blueprint, audits] = valuesOf();
    expect(blueprint).toMatchObject({ orgId: "o1", name: "B1 giriş", mode: "PLACEMENT", status: "PUBLISHED", createdBy: "u1" });
    expect(blueprint.publishedAt).toBeInstanceOf(Date);
    expect((audits as unknown as Array<{ action: string }>).map((a) => a.action)).toEqual(["blueprint.create", "blueprint.publish"]);
  });

  it("passes a verification claim on to the invite form", async () => {
    const r0 = await examCreator.draft(ctx, params({ mode: "LEVEL_VERIFICATION", claimedLevel: "B2" }));
    if (!r0.ok) throw new Error("draft failed");
    fake.results = [[{ id: "bp-2" }]];
    const r = await examCreator.apply(ctx, r0.draft, edits(r0.draft));
    expect(r).toMatchObject({ ok: true, href: "/exam/students/new?exam=bp-2&claimed=B2" });
  });

  it("saves an uncovered exam as a draft and offers question sets for the gaps", async () => {
    const draft = await drafted();
    counts.value = [];
    fake.results = [[{ id: "bp-3" }]];
    const r = await examCreator.apply(ctx, draft, edits(draft));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ href: "/exam/exams/bp-3", go: false });
    expect(valuesOf()[0]).toMatchObject({ status: "DRAFT", publishedAt: null });
    expect(r.followUps.length).toBeGreaterThan(0);
    expect(r.followUps.length).toBeLessThanOrEqual(MAX_FOLLOW_UPS);
    for (const f of r.followUps) {
      expect(f.kind).toBe("QUESTION_SET");
      expect(f.params).toEqual({ specs: [expect.objectContaining({ itemType: "", topic: "" })] });
    }
    expect(r.notes.length).toBeGreaterThan(0);
  });
});
