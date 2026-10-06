"use server";

import { revalidatePath } from "next/cache";
import { CREATION_REQUEST_MAX, type CreationRound, type CreationStatus } from "@/db/schema";
import { managerLocale } from "@/i18n/manager-locale";
import { aiLimitReached } from "@/lib/ai-limit";
import type { SessionUser } from "@/lib/auth";
import { authorize } from "@/lib/authorize";
import { auditDraft, insertDraft, loadOwnDraft, updateDraft, type CreationDraftRow } from "@/server/create/drafts";
import { routeRequest } from "@/server/create/router";
import { requireUser } from "@/server/session";
import { creatorByKind, creatorsFor } from "@/solutions/registry.server";
import type { CreateActionResult, CreateRefusal, Creator, CreatorCtx } from "@/solutions/types";

/**
 * The Advanced box (spec 2026-10-06-advanced-ai-create-design 5.5). Every
 * action: the session's user, the creator's capability, the AI limit before
 * any AI call, the draft's ownership (organisation and user), an audit row.
 * AI work runs inline; the page's maxDuration covers it.
 */

const CHANGE_MAX = 500;
const refuse = (code: CreateRefusal): CreateActionResult => ({ ok: false, code });
const done = (draftId: string, status: CreationStatus, href?: string): CreateActionResult => ({ ok: true, draftId, status, ...(href ? { href } : {}) });

async function own(user: SessionUser, draftId: unknown): Promise<CreationDraftRow | null> {
  return typeof draftId === "string" ? loadOwnDraft(user.orgId, user.id, draftId) : null;
}

async function ctxOf(user: SessionUser, draftId: string): Promise<CreatorCtx> {
  return { orgId: user.orgId, userId: user.id, role: user.role, locale: await managerLocale(), draftId };
}

/** The creator's draft step, under its own AI limit, recorded on the row either way. */
async function buildDraft(user: SessionUser, creator: Creator, ctx: CreatorCtx, params: unknown, summary: string, rounds: CreationRound[]): Promise<CreateActionResult> {
  const base = { kind: creator.kind, summary: summary || null, rounds };
  if (creator.aiPurpose && (await aiLimitReached(user.orgId, user.id, creator.aiPurpose))) {
    await updateDraft(user.orgId, ctx.draftId, { ...base, status: "FAILED", failure: "RATE_LIMITED" });
    return done(ctx.draftId, "FAILED");
  }
  const result = await creator.draft(ctx, params);
  if (!result.ok) {
    await updateDraft(user.orgId, ctx.draftId, { ...base, params, status: "FAILED", failure: result.code });
    await auditDraft(user.orgId, user.id, "create.draft", ctx.draftId, { kind: creator.kind, ok: false, code: result.code });
    return done(ctx.draftId, "FAILED");
  }
  await updateDraft(user.orgId, ctx.draftId, { ...base, params, draft: result.draft, status: "DRAFTED", failure: null });
  await auditDraft(user.orgId, user.id, "create.draft", ctx.draftId, { kind: creator.kind, ok: true });
  return done(ctx.draftId, "DRAFTED");
}

/** One router call for this draft and what follows from its outcome (spec 5.2). */
async function route(user: SessionUser, row: CreationDraftRow, rounds: CreationRound[], creators: readonly Creator[]): Promise<CreateActionResult> {
  const ctx = await ctxOf(user, row.id);
  const outcome = await routeRequest({ orgId: user.orgId, userId: user.id, draftId: row.id, request: row.request, rounds, locale: ctx.locale, creators });
  await auditDraft(user.orgId, user.id, "create.route", row.id, { outcome: outcome.status, ...("kind" in outcome ? { kind: outcome.kind } : {}) });
  switch (outcome.status) {
    case "AI_UNAVAILABLE":
    case "FAILED":
      await updateDraft(user.orgId, row.id, { status: "FAILED", failure: outcome.status, rounds });
      return done(row.id, "FAILED");
    case "UNSUPPORTED":
      await updateDraft(user.orgId, row.id, { status: "FAILED", failure: "UNSUPPORTED", summary: outcome.summary || null, rounds });
      return done(row.id, "FAILED");
    case "STUCK":
      await updateDraft(user.orgId, row.id, {
        status: "FAILED",
        failure: "STUCK",
        kind: outcome.kind,
        summary: outcome.summary || null,
        rounds: [...rounds, { questions: outcome.missing, answers: {} }],
      });
      return done(row.id, "FAILED");
    case "ASKING":
      await updateDraft(user.orgId, row.id, {
        status: "ASKING",
        kind: outcome.kind,
        summary: outcome.summary || null,
        rounds: [...rounds, { questions: outcome.questions, answers: {} }],
      });
      return done(row.id, "ASKING");
    case "READY": {
      const creator = creators.find((c) => c.kind === outcome.kind);
      if (!creator) return refuse("FORBIDDEN");
      return buildDraft(user, creator, ctx, outcome.params, outcome.summary, rounds);
    }
  }
}

export async function startCreate(text: string): Promise<CreateActionResult> {
  const user = await requireUser();
  const creators = creatorsFor(user);
  if (creators.length === 0) return refuse("FORBIDDEN");
  const request = typeof text === "string" ? text.trim() : "";
  if (!request || request.length > CREATION_REQUEST_MAX) return refuse("INVALID");
  if (await aiLimitReached(user.orgId, user.id, "CREATE_ROUTER")) return refuse("RATE_LIMITED");
  const row = await insertDraft({ orgId: user.orgId, userId: user.id, request });
  const result = await route(user, row, [], creators);
  revalidatePath("/advanced");
  return result;
}

export async function answerQuestions(draftId: string, answers: Record<string, string>): Promise<CreateActionResult> {
  const user = await requireUser();
  const creators = creatorsFor(user);
  if (creators.length === 0) return refuse("FORBIDDEN");
  const row = await own(user, draftId);
  if (!row) return refuse("NOT_FOUND");
  const last = row.rounds.at(-1);
  if (row.status !== "ASKING" || !last || last.questions.length === 0) return refuse("STATE");
  const given: Record<string, unknown> = answers && typeof answers === "object" ? answers : {};
  // Only the asked ids are kept; anything else the browser sends is dropped.
  const filled = Object.fromEntries(last.questions.map((q) => [q.id, String(given[q.id] ?? "").trim().slice(0, CREATION_REQUEST_MAX)]));
  if (await aiLimitReached(user.orgId, user.id, "CREATE_ROUTER")) return refuse("RATE_LIMITED");
  const result = await route(user, row, [...row.rounds.slice(0, -1), { ...last, answers: filled }], creators);
  revalidatePath("/advanced");
  return result;
}

export async function reviseDraft(draftId: string, change: string): Promise<CreateActionResult> {
  const user = await requireUser();
  const row = await own(user, draftId);
  if (!row) return refuse("NOT_FOUND");
  if (row.status !== "DRAFTED" || !row.kind) return refuse("STATE");
  const creator = creatorByKind(row.kind);
  if (!creator) return refuse("STATE");
  authorize(user, creator.capability);
  const text = typeof change === "string" ? change.trim() : "";
  if (!text || text.length > CHANGE_MAX) return refuse("INVALID");
  if (await aiLimitReached(user.orgId, user.id, "CREATE_ROUTER")) return refuse("RATE_LIMITED");
  const ctx = await ctxOf(user, row.id);
  const rounds: CreationRound[] = [...row.rounds, { questions: [], answers: {}, change: text }];
  const outcome = await routeRequest({ orgId: user.orgId, userId: user.id, draftId: row.id, request: row.request, rounds, locale: ctx.locale, creators: [creator], fixedKind: creator.kind });
  await auditDraft(user.orgId, user.id, "create.route", row.id, { outcome: outcome.status, kind: creator.kind, revision: true });
  if (outcome.status === "AI_UNAVAILABLE") return refuse("AI_UNAVAILABLE");
  if (outcome.status !== "READY") return refuse("FAILED");
  if (creator.aiPurpose && (await aiLimitReached(user.orgId, user.id, creator.aiPurpose))) return refuse("RATE_LIMITED");
  const next = await creator.draft(ctx, outcome.params);
  if (!next.ok) return refuse(next.code);
  await updateDraft(user.orgId, row.id, { params: outcome.params, draft: next.draft, summary: outcome.summary || row.summary, rounds });
  await auditDraft(user.orgId, user.id, "create.draft", row.id, { kind: creator.kind, ok: true, revision: true });
  // Only now is the old draft replaced; what it wrote is undone (QUESTION_SET rejects its items).
  if (creator.discard) await creator.discard(ctx, row.draft);
  revalidatePath("/advanced");
  return done(row.id, "DRAFTED");
}

export async function applyDraft(draftId: string, edits: unknown): Promise<CreateActionResult> {
  const user = await requireUser();
  const row = await own(user, draftId);
  if (!row) return refuse("NOT_FOUND");
  if (row.status !== "DRAFTED" || !row.kind) return refuse("STATE");
  const creator = creatorByKind(row.kind);
  if (!creator) return refuse("STATE");
  authorize(user, creator.capability);
  const result = await creator.apply(await ctxOf(user, row.id), row.draft, edits);
  if (!result.ok) return refuse(result.code);
  const outcome = { href: result.href, go: result.go, links: result.links, notes: result.notes, followUps: result.followUps };
  await updateDraft(user.orgId, row.id, { status: "APPLIED", resultHref: outcome.href, result: outcome });
  await auditDraft(user.orgId, user.id, "create.apply", row.id, { kind: creator.kind, href: outcome.href });
  revalidatePath("/advanced");
  return done(row.id, "APPLIED", outcome.go ? outcome.href : undefined);
}

export async function discardDraft(draftId: string): Promise<CreateActionResult> {
  const user = await requireUser();
  const row = await own(user, draftId);
  if (!row) return refuse("NOT_FOUND");
  if (row.status === "APPLIED" || row.status === "DISCARDED") return refuse("STATE");
  if (row.status === "DRAFTED" && row.kind) {
    const creator = creatorByKind(row.kind);
    if (creator?.discard) {
      authorize(user, creator.capability);
      await creator.discard(await ctxOf(user, row.id), row.draft);
    }
  }
  await updateDraft(user.orgId, row.id, { status: "DISCARDED" });
  await auditDraft(user.orgId, user.id, "create.discard", row.id, { kind: row.kind });
  revalidatePath("/advanced");
  return done(row.id, "DISCARDED", "/advanced");
}

/** "Eksik soruları üret" on an applied EXAM: a new draft with the gap prefilled, no router call (spec 5.4). */
export async function startFollowUp(draftId: string, index: number): Promise<CreateActionResult> {
  const user = await requireUser();
  const row = await own(user, draftId);
  if (!row) return refuse("NOT_FOUND");
  const follow = row.status === "APPLIED" && Number.isInteger(index) ? row.result?.followUps[index] : undefined;
  if (!follow) return refuse("STATE");
  const creator = creatorByKind(follow.kind);
  if (!creator) return refuse("STATE");
  authorize(user, creator.capability);
  const locale = await managerLocale();
  const checked = creator.validate(follow.params, locale, { useDefaults: true });
  if (!checked.ok) return refuse("INVALID");
  const next = await insertDraft({ orgId: user.orgId, userId: user.id, request: follow.label[locale] });
  await auditDraft(user.orgId, user.id, "create.route", next.id, { outcome: "FOLLOW_UP", kind: creator.kind, from: row.id });
  const result = await buildDraft(user, creator, await ctxOf(user, next.id), checked.params, follow.label[locale], []);
  revalidatePath("/advanced");
  return result.ok ? { ...result, href: `/advanced?draft=${next.id}` } : result;
}
