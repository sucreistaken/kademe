import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, items, stimuli } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/authorize";
import { planImport, scriptSpeakers, titleFromBody, IMPORT_SECTIONS, IMPORT_TYPES, type ImportSettings, type RowIssue, type RowOverride, type SheetRow } from "@/lib/exam/bank-sheet";
import { difficultyFor, withinOf } from "@/lib/exam/difficulty";
import { itemProblems, type ItemProblem } from "@/lib/exam/validate";
import type { SaveItemInput } from "@/components/panel/item-editor-model";

/**
 * The bank's writes that are more than a status flip: a spreadsheet import,
 * the item editor's save and the bulk approval. Every rule the screens show is
 * checked here again, on the rows as the server reads them.
 */

const defaultSkill = (section: string) => `${section.toLowerCase()}.teacher`;

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult = { created: number; failed: Array<{ line: number; issues: RowIssue[] }>; itemIds: string[] };

/**
 * Writes the valid rows of a question file as DRAFT items of origin TEACHER,
 * each with the numeric difficulty of its level and Kolay / Orta / Zor, and
 * one stimulus per shared text. One transaction: a file lands whole or not.
 */
export async function importSheetRows(user: Pick<SessionUser, "id" | "orgId">, rows: SheetRow[], defaults: ImportSettings, overrides: Record<number, RowOverride>): Promise<ImportResult> {
  const plan = planImport(rows, defaults, overrides);
  const failed = plan.rows.filter((r) => r.issues.length > 0).map((r) => ({ line: r.line, issues: r.issues }));
  if (plan.items.length === 0) return { created: 0, failed, itemIds: [] };

  const itemIds = await db.transaction(async (tx) => {
    const stimulusIds = new Map<string, string>();
    for (const text of plan.texts) {
      const [s] = await tx
        .insert(stimuli)
        .values({
          orgId: user.orgId,
          section: text.section,
          level: text.level,
          title: text.title,
          body: text.body,
          speakers: text.speakers && text.speakers.length ? text.speakers : null,
          origin: "TEACHER",
          createdBy: user.id,
        })
        .returning({ id: stimuli.id });
      stimulusIds.set(text.key, s.id);
    }
    const order = new Map<string, number>();
    const values = plan.items.map((it) => {
      const stimulusId = it.textKey ? (stimulusIds.get(it.textKey) ?? null) : null;
      const n = stimulusId ? (order.get(stimulusId) ?? 0) + 1 : 0;
      if (stimulusId) order.set(stimulusId, n);
      return {
        orgId: user.orgId,
        section: it.section,
        level: it.level,
        difficulty: difficultyFor(it.level, it.within),
        type: it.type,
        skillTag: it.skillTag ?? defaultSkill(it.section),
        stimulusId,
        orderInStimulus: n,
        prompt: it.prompt,
        content: it.content,
        answerKey: it.key,
        rubric: null,
        explanation: it.explanation,
        status: "DRAFT" as const,
        origin: "TEACHER" as const,
        createdBy: user.id,
      };
    });
    const written = await tx.insert(items).values(values).returning({ id: items.id });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "bank.import",
      subjectType: "item",
      meta: { created: written.length, failed: failed.length, texts: plan.texts.length },
    });
    return written.map((w) => w.id);
  });
  return { created: itemIds.length, failed, itemIds };
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export type SaveResult =
  | { ok: true; id: string; status: "DRAFT" | "APPROVED" | "REJECTED" | "RETIRED" }
  | { ok: false; code: "NOT_FOUND" | "LOCKED" | "NO_RIGHT" | "NEEDS_TEXT" | "SPEAKERS" | "TYPE" }
  | { ok: false; code: "INVALID"; problems: ItemProblem[] };

/**
 * Creates or edits one item. An edit keeps the item's status (decision,
 * 2026-10-14): an approved item stays approved, so saving never pulls a
 * question out of the exams that use it, and the person saving must be one
 * who may approve, since what they save goes live as it is. Section and type
 * stay; the shared text is not edited here (other items read it too).
 */
export async function saveBankItem(user: SessionUser, input: SaveItemInput): Promise<SaveResult> {
  const candidate = { type: input.type, prompt: input.prompt, content: input.content, key: input.key, rubric: input.rubric };
  const problems = itemProblems(candidate);
  if (problems.length) return { ok: false, code: "INVALID", problems };
  const explanation = input.explanation.trim() || null;
  const now = new Date();

  if (input.id) {
    const [row] = await db
      .select({ id: items.id, type: items.type, section: items.section, level: items.level, difficulty: items.difficulty, status: items.status, skillTag: items.skillTag })
      .from(items)
      .where(and(eq(items.id, input.id), eq(items.orgId, user.orgId)));
    if (!row) return { ok: false, code: "NOT_FOUND" };
    // The stored skill tag adds the cloze and word-bank rules; the browser never sets it.
    const textProblems = itemProblems({ ...candidate, skillTag: row.skillTag });
    if (textProblems.length) return { ok: false, code: "INVALID", problems: textProblems };
    if (row.type !== input.type || row.section !== input.section) return { ok: false, code: "LOCKED" };
    if (row.status === "APPROVED" && !can(user, "bank:approve")) return { ok: false, code: "NO_RIGHT" };
    // A calibrated value survives a save that leaves level and word alone.
    const sameBand = row.level === input.level && withinOf(row.level, row.difficulty) === input.within;
    await db
      .update(items)
      .set({
        prompt: input.prompt,
        content: input.content,
        answerKey: input.key,
        rubric: input.rubric,
        explanation,
        level: input.level,
        difficulty: sameBand ? row.difficulty : difficultyFor(input.level, input.within),
        updatedAt: now,
        // Saving an approved item is approving what was saved.
        ...(row.status === "APPROVED" ? { reviewedBy: user.id, reviewedAt: now } : {}),
      })
      .where(and(eq(items.id, row.id), eq(items.orgId, user.orgId)));
    await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: "bank.edit", subjectType: "item", subjectId: row.id, meta: { status: row.status } });
    return { ok: true, id: row.id, status: row.status };
  }

  if (!(IMPORT_TYPES as readonly string[]).includes(input.type) || !(IMPORT_SECTIONS as readonly string[]).includes(input.section)) return { ok: false, code: "TYPE" };
  const text = input.text && input.text.body.trim() && input.section !== "GRAMMAR" ? input.text : null;
  if (input.section === "LISTENING" && !text) return { ok: false, code: "NEEDS_TEXT" };
  let speakers: Array<{ label: string; voice: "A" | "B" }> | null = null;
  if (text && input.section === "LISTENING") {
    const s = scriptSpeakers(text.body);
    if (s.tooMany) return { ok: false, code: "SPEAKERS" };
    speakers = s.speakers.length ? s.speakers : null;
  }
  const id = await db.transaction(async (tx) => {
    let stimulusId: string | null = null;
    if (text) {
      const [s] = await tx
        .insert(stimuli)
        .values({
          orgId: user.orgId,
          section: input.section,
          level: input.level,
          title: (text.title.trim() || titleFromBody(text.body)).slice(0, 200),
          body: text.body.trim(),
          speakers,
          origin: "TEACHER",
          createdBy: user.id,
        })
        .returning({ id: stimuli.id });
      stimulusId = s.id;
    }
    const [it] = await tx
      .insert(items)
      .values({
        orgId: user.orgId,
        section: input.section,
        level: input.level,
        difficulty: difficultyFor(input.level, input.within),
        type: input.type,
        skillTag: defaultSkill(input.section),
        stimulusId,
        orderInStimulus: stimulusId ? 1 : 0,
        prompt: input.prompt,
        content: input.content,
        answerKey: input.key,
        rubric: input.rubric,
        explanation,
        status: "DRAFT",
        origin: "TEACHER",
        createdBy: user.id,
      })
      .returning({ id: items.id });
    await tx.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: "bank.create", subjectType: "item", subjectId: it.id });
    return it.id;
  });
  return { ok: true, id, status: "DRAFT" };
}

// ---------------------------------------------------------------------------
// Bulk approval
// ---------------------------------------------------------------------------

export type BulkApproveResult = { approved: number; invalid: number; noAudio: number; skipped: number };

/** The most items one bulk approval takes: one page of the list and then some. */
export const MAX_BULK = 200;

/**
 * Approves the chosen items one by one with the single approval's rules: the
 * structural check, and a listening item only with its audio. Items already
 * approved, of another organisation or unknown are skipped.
 */
export async function bulkApproveItems(user: Pick<SessionUser, "id" | "orgId">, ids: string[]): Promise<BulkApproveResult> {
  const unique = [...new Set(ids)].slice(0, MAX_BULK);
  const result: BulkApproveResult = { approved: 0, invalid: 0, noAudio: 0, skipped: ids.length - unique.length };
  if (unique.length === 0) return result;
  const rows = await db
    .select({
      id: items.id,
      type: items.type,
      section: items.section,
      prompt: items.prompt,
      content: items.content,
      answerKey: items.answerKey,
      rubric: items.rubric,
      skillTag: items.skillTag,
      status: items.status,
      audioKey: stimuli.audioKey,
    })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.orgId, user.orgId), inArray(items.id, unique)));
  const ok: string[] = [];
  for (const id of unique) {
    const r = rows.find((x) => x.id === id);
    if (!r || r.status === "APPROVED") {
      result.skipped += 1;
      continue;
    }
    if (itemProblems({ type: r.type, prompt: r.prompt, content: r.content, key: r.answerKey, rubric: r.rubric, skillTag: r.skillTag }).length) {
      result.invalid += 1;
      continue;
    }
    if (r.section === "LISTENING" && !r.audioKey) {
      result.noAudio += 1;
      continue;
    }
    ok.push(id);
  }
  if (ok.length) {
    const now = new Date();
    await db
      .update(items)
      .set({ status: "APPROVED", reviewedBy: user.id, reviewedAt: now, updatedAt: now })
      .where(and(eq(items.orgId, user.orgId), inArray(items.id, ok)));
    await db.insert(auditLogs).values(ok.map((id) => ({ orgId: user.orgId, actorId: user.id, action: "bank.approved", subjectType: "item", subjectId: id, meta: { via: "bulk" } })));
  }
  result.approved = ok.length;
  return result;
}
