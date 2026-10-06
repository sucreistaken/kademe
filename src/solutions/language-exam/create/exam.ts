import { createElement } from "react";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, examBlueprints } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { bankCoverage, estimatedMinutes, type BlueprintConfig } from "@/lib/exam/blueprint";
import type { ExamTemplateKey } from "@/lib/exam/templates";
import { CEFR_LEVELS, SECTIONS, type Cefr, type ExamMode } from "@/lib/exam/types";
import { bankCounts } from "@/server/panel";
import type { ApplyResult, Creator, CreatorValidation } from "@/solutions/types";
import {
  applyExamEdits,
  buildExamConfig,
  coverageGaps,
  defaultExamName,
  examEditsSchema,
  SECTION_LABEL,
  type CoverageGap,
  type ExamShape,
} from "./exam-config";

/**
 * EXAM (spec 5.4): an exam from one sentence. No AI beyond the router: the
 * config comes from the nearest ready template (exam-config.ts). Apply
 * publishes when the bank covers it (the editor's and the invite form's rule,
 * claim null) and otherwise saves a draft with one follow-up per gap.
 */

export type ExamParams = ExamShape & { claimedLevel: Cefr | null; name: string | null };
export type ExamDraft = {
  name: string;
  mode: ExamMode;
  claimedLevel: Cefr | null;
  templateKey: ExamTemplateKey;
  config: BlueprintConfig;
  coverageOk: boolean;
  gaps: CoverageGap[];
};

export const MAX_FOLLOW_UPS = 6;

const text = (tr: string, en: string) => ({ tr, en });
const INVALID = { ok: false as const, code: "INVALID" as const };

const rawSchema = z.object({
  mode: z.enum(["PLACEMENT", "LEVEL_VERIFICATION", ""] as const).catch(""),
  claimedLevel: z.enum([...CEFR_LEVELS, ""] as const).catch(""),
  targetMinutes: z.number().int().catch(0),
  skills: z.array(z.enum(SECTIONS)).catch([]),
  emphasis: z.enum([...SECTIONS, ""] as const).catch(""),
  speakingRequired: z.enum(["yes", "no", ""] as const).catch(""),
  name: z.string().catch(""),
});

const MODE_QUESTION = {
  tr: { text: "Sınav ne için olacak?", choices: ["Yeni öğrenciyi yerleştirmek", "Beyan edilen seviyeyi kontrol etmek"] },
  en: { text: "What is the exam for?", choices: ["Placing a new student", "Checking a claimed level"] },
};

export function validateExamParams(raw: unknown, locale: Locale): CreatorValidation<ExamParams> {
  const r = rawSchema.safeParse(raw).data ?? rawSchema.parse({});
  // The mode has no safe default: placing a student and checking a claim are different exams.
  if (!r.mode) return { ok: false, questions: [{ id: "mode", ...MODE_QUESTION[locale] }] };
  return {
    ok: true,
    params: {
      mode: r.mode,
      claimedLevel: r.mode === "LEVEL_VERIFICATION" && r.claimedLevel ? r.claimedLevel : null,
      targetMinutes: r.targetMinutes > 0 ? Math.min(120, Math.max(10, r.targetMinutes)) : null,
      skills: [...new Set(r.skills)],
      emphasis: r.emphasis || null,
      speakingRequired: r.speakingRequired === "" ? null : r.speakingRequired === "yes",
      name: r.name.trim().slice(0, 120) || null,
    },
  };
}

const STR = (description: string) => ({ type: "string", description });

const ROUTER_GUIDE = `Builds a German exam (a blueprint) from three ready templates.
- mode (required): PLACEMENT places a new student at a level ("yerleştirme", "seviye tespiti"); LEVEL_VERIFICATION checks a level the student claims ("seviye kontrolü", "doğrulama", "gerçekten B1 mi"). "" when the request does not say which.
- claimedLevel: A1, A2, B1, B2, C1 or C2, only for LEVEL_VERIFICATION when the request names the level to check; "" otherwise. A level in a placement request ("B1 yerleştirme") is not a claim: leave "".
- targetMinutes: the total duration asked for, 10 to 120; 0 when not given.
- skills: the sections the request names: GRAMMAR (dilbilgisi), READING (okuma), LISTENING (dinleme), WRITING (yazma), SPEAKING (konuşma); [] when none are named.
- emphasis: the one section the request stresses ("okuma ağırlıklı" is READING); "" otherwise.
- speakingRequired: "yes" or "no" only when the request says whether speaking is in; "" otherwise.
- name: only when the request gives the exam a name; "" otherwise.
Use EXAM for an exam with sections and minutes; new questions for the bank are QUESTION_SET.`;

const INVITE = text("Öğrenci davet et", "Invite a student");
const OPEN_EXAM = text("Sınavı aç", "Open the exam");
const COVERAGE_NOTE = text(
  "Soru bankasında yeterli onaylı soru yok, sınav taslak olarak kaydedildi. Eksik soruları üretip onayladıktan sonra sınav sayfasından yayınla.",
  "The question bank lacks approved questions, so the exam was saved as a draft. Generate and approve the missing questions, then publish it from the exam page.",
);
const C_TEST_NOTE = text("Açılış C-testini AI üretmez; soru bankasından ekle.", "AI does not write the opening C-test; add one in the question bank.");
const gapLabel = (g: CoverageGap) =>
  text(`Eksik soruları üret: ${g.level} ${SECTION_LABEL[g.section].tr}`, `Generate the missing questions: ${g.level} ${SECTION_LABEL[g.section].en}`);

export const examCreator: Creator<ExamParams, ExamDraft> = {
  kind: "EXAM",
  capability: "blueprint:write",
  aiPurpose: null,
  label: text("Sınav", "Exam"),
  routerGuide: ROUTER_GUIDE,
  paramsJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "claimedLevel", "targetMinutes", "skills", "emphasis", "speakingRequired", "name"],
    properties: {
      mode: STR("PLACEMENT, LEVEL_VERIFICATION or empty"),
      claimedLevel: STR("A1, A2, B1, B2, C1, C2 or empty"),
      targetMinutes: { type: "integer", description: "10 to 120, 0 when not given" },
      skills: { type: "array", items: { type: "string", enum: [...SECTIONS] } },
      emphasis: STR("GRAMMAR, READING, LISTENING, WRITING, SPEAKING or empty"),
      speakingRequired: STR("yes, no or empty"),
      name: STR("the exam's name or empty"),
    },
  },

  validate: (raw, locale) => validateExamParams(raw, locale),

  async draft(ctx, params) {
    const { template, config } = buildExamConfig(params);
    const coverage = bankCoverage(await bankCounts(ctx.orgId), config, params.mode, null);
    return {
      ok: true,
      draft: {
        name: params.name ?? defaultExamName(template.name[ctx.locale], estimatedMinutes(config), ctx.locale),
        mode: params.mode,
        claimedLevel: params.claimedLevel,
        templateKey: template.key,
        config,
        coverageOk: coverage.ok,
        gaps: coverageGaps(coverage.rows),
      },
    };
  },

  async apply(ctx, draft, edits): Promise<ApplyResult> {
    const parsed = examEditsSchema.safeParse(edits);
    if (!parsed.success) return INVALID;
    const config = applyExamEdits(draft.config, parsed.data);
    if (!config) return INVALID;
    // Checked again now: the bank may have changed since the draft.
    const coverage = bankCoverage(await bankCounts(ctx.orgId), config, draft.mode, null);
    const now = new Date();
    const [row] = await db
      .insert(examBlueprints)
      .values({
        orgId: ctx.orgId,
        name: parsed.data.name,
        description: "",
        mode: draft.mode,
        status: coverage.ok ? "PUBLISHED" : "DRAFT",
        config,
        createdBy: ctx.userId,
        publishedAt: coverage.ok ? now : null,
      })
      .returning({ id: examBlueprints.id });
    const meta = { mode: draft.mode, template: draft.templateKey, via: "advanced", draftId: ctx.draftId };
    await db.insert(auditLogs).values([
      { orgId: ctx.orgId, actorId: ctx.userId, action: "blueprint.create", subjectType: "exam_blueprint", subjectId: row.id, meta },
      ...(coverage.ok ? [{ orgId: ctx.orgId, actorId: ctx.userId, action: "blueprint.publish", subjectType: "exam_blueprint", subjectId: row.id, meta }] : []),
    ]);
    const examHref = `/exam/exams/${row.id}`;
    if (coverage.ok) {
      const invite = `/exam/students/new?exam=${row.id}${draft.claimedLevel ? `&claimed=${draft.claimedLevel}` : ""}`;
      return { ok: true, href: invite, go: true, links: [{ label: INVITE, href: invite }, { label: OPEN_EXAM, href: examHref }], notes: [], followUps: [] };
    }
    const gaps = coverageGaps(coverage.rows);
    const followUps = gaps
      .filter((g) => !g.cTest)
      .slice(0, MAX_FOLLOW_UPS)
      .map((g) => ({
        label: gapLabel(g),
        kind: "QUESTION_SET" as const,
        params: { specs: [{ section: g.section, level: g.level, itemType: "", count: Math.min(10, g.missing), topic: "" }] },
      }));
    const notes = [COVERAGE_NOTE, ...(gaps.some((g) => g.cTest) ? [C_TEST_NOTE] : [])];
    return { ok: true, href: examHref, go: false, links: [{ label: OPEN_EXAM, href: examHref }], notes, followUps };
  },

  async renderReview(input) {
    const { ExamReview } = await import("./exam-review");
    return createElement(ExamReview, { draftId: input.ctx.draftId, summary: input.summary, draft: input.draft, actions: input.actions });
  },
};
