import { createElement } from "react";
import { z } from "zod";
import type { I18nText } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { activeCompetencyOptions } from "@/server/library";
import { createPosition, findOrCreateCompetency, savePosition } from "@/server/library-write";
import type { ApplyResult, CreateQuestion, Creator, CreatorValidation } from "@/solutions/types";
import { JOB_AD_MAX_CHARS, JOB_AD_MIN_CHARS, visibleProposals } from "../ai/draft";
import { generateHiringDraft } from "../ai/draft-job";
import { hiringManifest } from "../manifest";
import { templateCompetency } from "../templates/competencies";
import { matchTemplate, TEMPLATES } from "../templates/index";
import { evenWeights, weightTotal } from "./position-weights";

/**
 * POSITION (spec 5.4): a library position with its competency profile. A
 * ready template's name brings its competencies and weights with no AI call;
 * anything else goes through the hiring draft generator, of which only the
 * competencies are kept (stages belong to an opening). Apply writes through
 * the library's own functions; an existing competency is reused, never overwritten.
 */

export type PositionParams = { name: string; jobAd: string | null; team: string | null };
export type PositionAnchors = { "1": I18nText; "3": I18nText; "5": I18nText };
export type PositionCompetency = { key: string; libraryId: string | null; name: I18nText; description: I18nText; anchors: PositionAnchors; weight: number };
export type PositionDraft = { name: string; team: string | null; jobAd: string; source: "TEMPLATE" | "AI"; templateKey: string | null; competencies: PositionCompetency[] };

export const MAX_POSITION_COMPETENCIES = 8;

const text = (tr: string, en: string) => ({ tr, en });
const INVALID = { ok: false as const, code: "INVALID" as const };
const nameKey = (s: string) => s.trim().toLocaleLowerCase("tr");

const rawSchema = z.object({ name: z.string().catch(""), jobAd: z.string().catch(""), team: z.string().catch("") });
const Q = {
  name: text("Pozisyonun adı ne?", "What is the position called?"),
  jobAd: text(
    "Kısa bir görev tanımı ya da ilan metni yazar mısın? En az 40 karakter.",
    "Could you write a short job description or paste the job ad? At least 40 characters.",
  ),
};

export function validatePositionParams(raw: unknown, locale: Locale): CreatorValidation<PositionParams> {
  const r = rawSchema.safeParse(raw).data ?? rawSchema.parse({});
  const name = r.name.trim().slice(0, 160);
  const jobAd = r.jobAd.trim().slice(0, JOB_AD_MAX_CHARS);
  const questions: CreateQuestion[] = [];
  if (!name) questions.push({ id: "name", text: Q.name[locale], choices: [] });
  // A ready template brings its own job ad; anything else needs one for the AI to read.
  else if (!matchTemplate(name) && jobAd.length < JOB_AD_MIN_CHARS) questions.push({ id: "jobAd", text: Q.jobAd[locale], choices: [] });
  if (questions.length) return { ok: false, questions };
  return { ok: true, params: { name, jobAd: jobAd || null, team: r.team.trim().slice(0, 120) || null } };
}

const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });
export const positionEditsSchema = z.object({
  competencies: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        weight: z.number().int().min(0).max(100),
        anchors: z.object({ "1": i18n, "3": i18n, "5": i18n }).optional(),
      }),
    )
    .min(1)
    .max(12),
});

const S = (description: string) => ({ type: "string", description });

const ROUTER_GUIDE = `Builds a position (a role in the organisation's library) with its competency profile. It does not open a hiring round.
- name (required): the role's short name in the request's language; "" when not given. When the role is one of these ready templates, use the template's exact name: ${TEMPLATES.map((t) => `${t.name.tr} / ${t.name.en}`).join("; ")}.
- jobAd: the job ad or task description given in the request or in an answer, copied word for word; "" when none.
- team: the team or department when named; "" otherwise.`;

const OPEN_POSITION = text("Pozisyonu aç", "Open the position");
const PROFILE_NOT_SAVED = text(
  "Pozisyon kaydedildi ama yetkinlik profili kaydedilemedi; pozisyon sayfasından tamamla.",
  "The position was saved but its competency profile was not; finish it on the position page.",
);

export const positionCreator: Creator<PositionParams, PositionDraft> = {
  kind: "POSITION",
  capability: "library:write",
  aiPurpose: "HIRING_DRAFT",
  label: text("Pozisyon", "Position"),
  routerGuide: ROUTER_GUIDE,
  paramsJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "jobAd", "team"],
    properties: { name: S("the role's name or empty"), jobAd: S("the job ad, word for word, or empty"), team: S("the team or empty") },
  },

  validate: (raw, locale) => validatePositionParams(raw, locale),

  async draft(ctx, params) {
    const options = await activeCompetencyOptions(ctx.orgId);
    const inLibrary = (name: I18nText) => {
      const wanted = [name.tr, name.en].map(nameKey).filter(Boolean);
      return options.find((o) => [o.name.tr, o.name.en].some((n) => wanted.includes(nameKey(n))))?.id ?? null;
    };
    const template = matchTemplate(params.name);
    if (template) {
      const competencies = Object.entries(template.weights).map(([key, weight]) => {
        const seed = templateCompetency(key);
        if (!seed) throw new Error(`template ${template.key} names unknown competency ${key}`);
        return {
          key,
          libraryId: inLibrary(seed.name),
          name: seed.name,
          description: seed.description,
          anchors: { "1": seed.anchors[1], "3": seed.anchors[3], "5": seed.anchors[5] },
          weight,
        };
      });
      return {
        ok: true,
        draft: { name: params.name, team: params.team, jobAd: params.jobAd ?? template.jobAd[ctx.locale], source: "TEMPLATE", templateKey: template.key, competencies },
      };
    }
    const jobAd = params.jobAd ?? "";
    const outcome = await generateHiringDraft({
      orgId: ctx.orgId,
      userId: ctx.userId,
      inputRef: `creation_draft:${ctx.draftId}`,
      positionName: params.name,
      jobAd,
      locales: ctx.locale === "en" ? ["tr", "en"] : ["tr"],
      teamLocale: ctx.locale,
      library: options.map((o) => ({ id: o.id, name: o.name.tr || o.name.en, inProfile: false })),
    });
    if (outcome.status === "UNCONFIGURED") return { ok: false, code: "AI_UNAVAILABLE" };
    if (outcome.status === "FAILED") return { ok: false, code: "FAILED" };
    // A new competency is shown only when its quote is in the ad (the hiring AI page's rule).
    const picked = [...outcome.draft.competencies.filter((c) => c.libraryId), ...visibleProposals(outcome.draft, jobAd).newCompetencies].slice(
      0,
      MAX_POSITION_COMPETENCIES,
    );
    if (picked.length === 0) return { ok: false, code: "FAILED" };
    const weights = evenWeights(picked.length);
    const competencies = picked.map((c, i) => {
      const lib = c.libraryId ? options.find((o) => o.id === c.libraryId) : undefined;
      return {
        key: c.key,
        libraryId: lib?.id ?? null,
        name: lib?.name ?? { tr: c.nameTr, en: c.nameEn },
        description: { tr: c.descriptionTr, en: c.descriptionEn },
        anchors: { "1": { tr: c.anchor1Tr, en: c.anchor1En }, "3": { tr: c.anchor3Tr, en: c.anchor3En }, "5": { tr: c.anchor5Tr, en: c.anchor5En } },
        weight: weights[i],
      };
    });
    return { ok: true, draft: { name: params.name, team: params.team, jobAd, source: "AI", templateKey: null, competencies } };
  },

  async apply(ctx, draft, edits): Promise<ApplyResult> {
    const parsed = positionEditsSchema.safeParse(edits);
    if (!parsed.success) return INVALID;
    const kept: PositionCompetency[] = [];
    for (const e of parsed.data.competencies) {
      const c = draft.competencies.find((x) => x.key === e.key);
      if (!c || kept.some((k) => k.key === e.key)) return INVALID;
      // Only a new competency's anchors are edited here; a library row keeps its own.
      kept.push({ ...c, weight: e.weight, anchors: c.libraryId ? c.anchors : (e.anchors ?? c.anchors) });
    }
    if (weightTotal(kept.map((c) => c.weight)) !== 100) return { ok: false, code: "WEIGHTS" };
    const ids: string[] = [];
    for (const c of kept) {
      if (c.libraryId) {
        ids.push(c.libraryId);
        continue;
      }
      const made = await findOrCreateCompetency(ctx.orgId, ctx.userId, { name: c.name, description: c.description, anchors: c.anchors }, `advanced-create:${ctx.draftId}`);
      if (!made.ok) return INVALID;
      ids.push(made.id);
    }
    const created = await createPosition(ctx.orgId, ctx.userId, { name: draft.name, jobDescription: draft.jobAd, team: draft.team ?? undefined });
    if (!created.ok) return INVALID;
    const saved = await savePosition(ctx.orgId, ctx.userId, created.id, {
      name: draft.name,
      team: draft.team ?? "",
      shortDescription: "",
      jobDescription: draft.jobAd,
      skills: [],
      languages: [],
      profile: kept.map((c, i) => ({ competencyId: ids[i], weight: c.weight, expectedLevel: null })),
    });
    const href = `/library/positions/${created.id}`;
    const action = hiringManifest.positionAction;
    return {
      ok: true,
      href,
      go: false,
      links: [{ label: OPEN_POSITION, href }, ...(action ? [{ label: action.label, href: action.href(created.id) }] : [])],
      notes: saved.ok ? [] : [PROFILE_NOT_SAVED],
      followUps: [],
    };
  },

  async renderReview(input) {
    const { PositionReview } = await import("./position-review");
    return createElement(PositionReview, { draftId: input.ctx.draftId, summary: input.summary, draft: input.draft, locale: input.ctx.locale, actions: input.actions });
  },
};
