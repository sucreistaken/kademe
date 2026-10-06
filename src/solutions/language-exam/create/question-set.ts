import { createElement } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, items, stimuli } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { ALLOWED_TYPES, generationSpecSchema, STIMULUS_SECTIONS, type GenerationSpec } from "@/lib/exam/item-generation";
import { CEFR_LEVELS, ITEM_TYPES, SECTIONS, type Cefr, type ItemType, type Section } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { generateItems } from "@/server/item-generation-job";
import type { ApplyResult, CreateQuestion, Creator, CreatorCtx, CreatorValidation } from "@/solutions/types";
import { ensureStimulusAudio } from "./audio";
import { SECTION_LABEL } from "./exam-config";
import { itemPreview, type ReviewItem } from "./item-preview";

/**
 * QUESTION_SET (spec 5.4): new draft questions for the bank. The one creator
 * whose draft writes rows: generateItems writes DRAFT items with origin AI,
 * which never reach an exam until approved. Apply approves what was kept and
 * rejects what was removed; discarding rejects every item the draft created.
 */

export const MAX_SET_TOTAL = 20;
export const MAX_BATCH = 10;
export const DEFAULT_SET_COUNT = 5;

export type QuestionSpec = { section: Section; level: Cefr; itemType: ItemType; count: number; topic: string | null };
export type QuestionSetParams = { specs: QuestionSpec[] };
export type QuestionSetDraft = { specs: QuestionSpec[]; itemIds: string[]; droppedByCheck: number; failedBatches: number };

const text = (tr: string, en: string) => ({ tr, en });
const INVALID = { ok: false as const, code: "INVALID" as const };

const rawSpec = z.object({
  section: z.enum([...SECTIONS, ""] as const).catch(""),
  level: z.enum([...CEFR_LEVELS, ""] as const).catch(""),
  itemType: z.enum([...ITEM_TYPES, ""] as const).catch(""),
  count: z.number().int().catch(0),
  topic: z.string().catch(""),
});
const rawParams = z.object({ specs: z.array(rawSpec).max(5).catch([]) });

const Q = {
  section: text("Hangi bölüm için?", "Which section?"),
  level: text("Hangi seviye?", "Which level?"),
  count: text("Kaç soru olsun?", "How many questions?"),
  tooMany: text("Tek seferde en fazla 20 soru hazırlayabilirim. Toplam kaç soru olsun?", "I can prepare at most 20 questions at once. How many in total?"),
};
const COUNT_CHOICES = ["5", "10", "20"];

/** Counts scaled down to `max` in total, at least one each, trimmed from the largest. */
export function fitTotal(counts: number[], max: number): number[] {
  const total = counts.reduce((a, n) => a + n, 0);
  if (total <= max) return counts;
  const scaled = counts.map((n) => Math.max(1, Math.floor((n * max) / total)));
  while (scaled.reduce((a, n) => a + n, 0) > max) scaled[scaled.indexOf(Math.max(...scaled))] -= 1;
  return scaled;
}

export function validateQuestionSet(raw: unknown, locale: Locale, opts: { useDefaults: boolean }): CreatorValidation<QuestionSetParams> {
  const r = rawParams.safeParse(raw).data ?? { specs: [] };
  const specs = r.specs.length ? r.specs : [rawSpec.parse({})];
  const questions: CreateQuestion[] = [];
  if (specs.some((s) => !s.section)) questions.push({ id: "section", text: Q.section[locale], choices: SECTIONS.map((s) => SECTION_LABEL[s][locale]) });
  if (specs.some((s) => !s.level)) questions.push({ id: "level", text: Q.level[locale], choices: [...CEFR_LEVELS] });
  const counts = specs.map((s) => (s.count > 0 ? s.count : opts.useDefaults ? DEFAULT_SET_COUNT : 0));
  if (counts.some((n) => n === 0)) questions.push({ id: "count", text: Q.count[locale], choices: COUNT_CHOICES });
  else if (!opts.useDefaults && counts.reduce((a, n) => a + n, 0) > MAX_SET_TOTAL) questions.push({ id: "count", text: Q.tooMany[locale], choices: COUNT_CHOICES });
  if (questions.length) return { ok: false, questions };
  const fitted = fitTotal(counts, MAX_SET_TOTAL);
  return {
    ok: true,
    params: {
      specs: specs.map((s, i) => {
        const section = s.section as Section;
        const allowed = ALLOWED_TYPES[section];
        return {
          section,
          level: s.level as Cefr,
          itemType: s.itemType && allowed.includes(s.itemType) ? s.itemType : allowed[0],
          count: fitted[i],
          topic: s.topic.trim().slice(0, 200) || null,
        };
      }),
    },
  };
}

export function toBatches(specs: readonly QuestionSpec[]): GenerationSpec[] {
  return specs.flatMap((s) => {
    const out: GenerationSpec[] = [];
    for (let left = s.count; left > 0; left -= MAX_BATCH) {
      out.push(
        generationSpecSchema.parse({
          section: s.section,
          level: s.level,
          itemType: s.itemType,
          count: Math.min(MAX_BATCH, left),
          ...(s.topic ? { topic: s.topic } : {}),
          withStimulus: STIMULUS_SECTIONS.includes(s.section),
        }),
      );
    }
    return out;
  });
}

export const questionEditsSchema = z.object({ approve: z.array(z.string()).max(40), reject: z.array(z.string()).max(40) });

async function setStatus(ctx: CreatorCtx, id: string, status: "APPROVED" | "REJECTED") {
  const now = new Date();
  await db
    .update(items)
    .set({ status, reviewedBy: ctx.userId, reviewedAt: now, updatedAt: now })
    .where(and(eq(items.id, id), eq(items.orgId, ctx.orgId), eq(items.status, "DRAFT")));
  await db.insert(auditLogs).values({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: `bank.${status.toLowerCase()}`,
    subjectType: "item",
    subjectId: id,
    meta: { via: "advanced", draftId: ctx.draftId },
  });
}

const S = (description: string) => ({ type: "string", description });

const ROUTER_GUIDE = `Generates new draft questions for the question bank; a person approves each one before any exam uses it.
- specs: one entry per section and level asked for; at most 20 questions in total.
  - section (required): GRAMMAR (dilbilgisi), READING (okuma), LISTENING (dinleme), WRITING (yazma), SPEAKING (konuşma); "" when not given.
  - level (required): A1, A2, B1, B2, C1 or C2; "" when not given.
  - itemType: "" unless the request names a question type: SINGLE_CHOICE, TRUE_FALSE_NG, MATCHING, GAP_FILL, WRITING_PROMPT or SPEAKING_PROMPT.
  - count: the number of questions asked for; 0 when not given.
  - topic: the topic when given ("iş hayatı"); "" otherwise.
Use QUESTION_SET only for new questions; an exam with sections and minutes is EXAM.`;

export const questionSetCreator: Creator<QuestionSetParams, QuestionSetDraft> = {
  kind: "QUESTION_SET",
  capability: "bank:write",
  aiPurpose: "ITEM_GENERATION",
  label: text("Soru seti", "Question set"),
  routerGuide: ROUTER_GUIDE,
  paramsJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["specs"],
    properties: {
      specs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["section", "level", "itemType", "count", "topic"],
          properties: {
            section: S("GRAMMAR, READING, LISTENING, WRITING, SPEAKING or empty"),
            level: S("A1, A2, B1, B2, C1, C2 or empty"),
            itemType: S("an item type or empty"),
            count: { type: "integer", description: "0 when not given" },
            topic: S("the topic or empty"),
          },
        },
      },
    },
  },

  validate: (raw, locale, opts) => validateQuestionSet(raw, locale, opts),

  async draft(ctx, params) {
    const itemIds: string[] = [];
    let droppedByCheck = 0;
    let failedBatches = 0;
    let unavailable = false;
    for (const spec of toBatches(params.specs)) {
      try {
        const r = await generateItems(ctx.orgId, ctx.userId, spec);
        if (r.ok) {
          itemIds.push(...r.itemIds);
          droppedByCheck += r.rejected;
        } else failedBatches += 1;
      } catch (error) {
        // generateItems' call is already logged on its own ai_runs row.
        if (error instanceof Error && error.message === "AI_UNAVAILABLE") {
          unavailable = true;
          break;
        }
        failedBatches += 1;
      }
    }
    if (itemIds.length === 0) return { ok: false, code: unavailable ? "AI_UNAVAILABLE" : "FAILED" };
    return { ok: true, draft: { specs: params.specs, itemIds, droppedByCheck, failedBatches } };
  },

  async apply(ctx, draft, edits): Promise<ApplyResult> {
    const parsed = questionEditsSchema.safeParse(edits);
    if (!parsed.success) return INVALID;
    const { approve, reject } = parsed.data;
    const own = new Set(draft.itemIds);
    if ([...approve, ...reject].some((id) => !own.has(id)) || approve.some((id) => reject.includes(id))) return INVALID;
    const rows = draft.itemIds.length
      ? await db
          .select({
            id: items.id,
            type: items.type,
            prompt: items.prompt,
            content: items.content,
            answerKey: items.answerKey,
            rubric: items.rubric,
            section: items.section,
            stimulusId: items.stimulusId,
            status: items.status,
          })
          .from(items)
          .where(and(eq(items.orgId, ctx.orgId), inArray(items.id, draft.itemIds)))
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    // No role has bank:write without bank:approve today; the branch keeps the rule if one ever does.
    const mayApprove = can({ role: ctx.role }, "bank:approve");
    const audio = new Map<string, boolean>();
    let approved = 0;
    let rejected = 0;
    let invalid = 0;
    let noAudio = 0;
    for (const id of mayApprove ? approve : []) {
      const r = byId.get(id);
      if (!r || r.status !== "DRAFT") continue;
      if (validateItem({ type: r.type, prompt: r.prompt, content: r.content, key: r.answerKey, rubric: r.rubric }).length) {
        invalid += 1;
        continue;
      }
      if (r.section === "LISTENING") {
        if (!r.stimulusId) {
          noAudio += 1;
          continue;
        }
        if (!audio.has(r.stimulusId)) audio.set(r.stimulusId, (await ensureStimulusAudio(ctx.orgId, ctx.userId, r.stimulusId)).ok);
        if (!audio.get(r.stimulusId)) {
          noAudio += 1;
          continue;
        }
      }
      await setStatus(ctx, id, "APPROVED");
      approved += 1;
    }
    for (const id of reject) {
      const r = byId.get(id);
      if (!r || r.status !== "DRAFT") continue;
      await setStatus(ctx, id, "REJECTED");
      rejected += 1;
    }
    const pending = rows.filter((r) => r.status === "DRAFT").length - approved - rejected;
    const notes = [text(`${approved} soru onaylandı, ${rejected} soru reddedildi.`, `${approved} approved, ${rejected} rejected.`)];
    if (pending > 0) notes.push(text(`${pending} soru onay bekliyor; soru bankasında görürsün.`, `${pending} questions wait for approval in the question bank.`));
    if (!mayApprove && approve.length) notes.push(text("Onaylama yetkin yok; tuttuğun sorular onay bekliyor.", "You may not approve; the questions you kept wait for approval."));
    if (noAudio) notes.push(text(`${noAudio} dinleme sorusunun sesi üretilemedi; soru bankasından sesi yeniden üret.`, `Audio failed for ${noAudio} listening questions; make it again from the question bank.`));
    if (invalid) notes.push(text(`${invalid} soru kontrolden geçmedi; soru bankasında düzelt.`, `${invalid} questions failed the check; fix them in the question bank.`));
    return { ok: true, href: "/exam/bank", go: false, links: [{ label: text("Soru bankasını aç", "Open the question bank"), href: "/exam/bank" }], notes, followUps: [] };
  },

  async discard(ctx, draft) {
    if (draft.itemIds.length === 0) return;
    const now = new Date();
    const gone = await db
      .update(items)
      .set({ status: "REJECTED", reviewedBy: ctx.userId, reviewedAt: now, updatedAt: now })
      .where(and(eq(items.orgId, ctx.orgId), inArray(items.id, draft.itemIds), eq(items.status, "DRAFT")))
      .returning({ id: items.id });
    if (gone.length) {
      await db.insert(auditLogs).values({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        action: "bank.rejected",
        subjectType: "item",
        subjectId: null,
        meta: { via: "advanced.discard", draftId: ctx.draftId, count: gone.length },
      });
    }
  },

  async renderReview(input) {
    const { draft, ctx } = input;
    const rows = draft.itemIds.length
      ? await db
          .select({
            id: items.id,
            section: items.section,
            level: items.level,
            type: items.type,
            prompt: items.prompt,
            content: items.content,
            answerKey: items.answerKey,
            status: items.status,
            stimulusTitle: stimuli.title,
            stimulusBody: stimuli.body,
            audioKey: stimuli.audioKey,
          })
          .from(items)
          .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
          .where(and(eq(items.orgId, ctx.orgId), inArray(items.id, draft.itemIds)))
      : [];
    const order = new Map(draft.itemIds.map((id, i) => [id, i]));
    const reviewItems: ReviewItem[] = [...rows]
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((r) => ({
        id: r.id,
        section: r.section,
        level: r.level,
        type: r.type,
        prompt: r.prompt,
        status: r.status,
        stimulusTitle: r.stimulusTitle,
        stimulusBody: r.stimulusBody,
        hasAudio: !!r.audioKey,
        preview: itemPreview(r.content, r.answerKey),
      }));
    const { QuestionSetReview } = await import("./question-set-review");
    return createElement(QuestionSetReview, {
      draftId: ctx.draftId,
      summary: input.summary,
      items: reviewItems,
      droppedByCheck: draft.droppedByCheck,
      failedBatches: draft.failedBatches,
      mayApprove: can({ role: ctx.role }, "bank:approve"),
      actions: input.actions,
    });
  },
};
