"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, items, stimuli } from "@/db/schema";
import { saveItemSchema } from "@/components/panel/item-editor-model";
import { recordAiRun } from "@/lib/ai-runs";
import { can } from "@/lib/authorize";
import { IMPORT_SECTIONS, MAX_CELL, MAX_IMPORT_ROWS, SHEET_COLUMNS } from "@/lib/exam/bank-sheet";
import { isWithin, WITHINS } from "@/lib/exam/difficulty";
import { generationSpecSchema, STIMULUS_SECTIONS } from "@/lib/exam/item-generation";
import { CEFR_LEVELS } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { synthesize } from "@/lib/tts";
import { bulkApproveItems, importSheetRows, MAX_BULK, saveBankItem, type BulkApproveResult, type SaveResult } from "./bank-items";
import { bankItem } from "./bank-scope";
import { generateItems } from "@/server/item-generation-job";
import { requireUser } from "@/server/session";

async function ownItem(id: string, orgId: string) {
  const [row] = await db
    .select({ item: items, stimulus: stimuli })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.id, id), bankItem(orgId)));
  return row ?? null;
}

const uuid = z.uuid();

/** After any write: the list (its counts and tabs) and the item's own page. */
function refreshBank(id?: string) {
  revalidatePath("/exam/bank");
  if (id) revalidatePath(`/exam/bank/${id}`);
}

export type GenerateState = { ok: true; created: number; rejected: number } | { ok: false; error: string } | null;

export async function generate(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const user = await requireUser("bank:write");
  const section = String(formData.get("section"));
  const within = String(formData.get("within") ?? "");
  const spec = generationSpecSchema.safeParse({
    section,
    level: formData.get("level"),
    itemType: formData.get("itemType"),
    count: Number(formData.get("count") ?? 3),
    topic: String(formData.get("topic") ?? "").trim() || undefined,
    withStimulus: STIMULUS_SECTIONS.includes(section as never),
    ...(isWithin(within) ? { within } : {}),
  });
  if (!spec.success) return { ok: false, error: spec.error.issues[0]?.message ?? "invalid" };
  try {
    const r = await generateItems(user.orgId, user.id, spec.data);
    if (!r.ok) return { ok: false, error: r.error.slice(0, 200) };
    await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: "bank.generate", subjectType: "item", meta: { ...spec.data, created: r.created, rejected: r.rejected } });
    refreshBank();
    return { ok: true, created: r.created, rejected: r.rejected };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "failed" };
  }
}

const STATUSES = ["APPROVED", "REJECTED", "RETIRED", "DRAFT"] as const;
type Status = (typeof STATUSES)[number];

export async function setItemStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const raw = String(formData.get("status"));
  if (!uuid.safeParse(id).success) redirect("/exam/bank");
  // Only the four statuses a person sets; anything else is a hand-made request.
  if (!(STATUSES as readonly string[]).includes(raw)) redirect(`/exam/bank/${id}`);
  const status = raw as Status;
  const user = await requireUser(status === "APPROVED" ? "bank:approve" : "bank:write");
  const row = await ownItem(id, user.orgId);
  if (!row) redirect("/exam/bank");
  if (status === "APPROVED") {
    const problems = validateItem({ type: row.item.type, prompt: row.item.prompt, content: row.item.content, key: row.item.answerKey, rubric: row.item.rubric, skillTag: row.item.skillTag });
    if (problems.length) redirect(`/exam/bank/${id}?error=invalid`);
    if (row.item.section === "LISTENING" && !row.stimulus?.audioKey) redirect(`/exam/bank/${id}?error=audio`);
  }
  await db
    .update(items)
    .set({ status, reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(items.id, id), bankItem(user.orgId)));
  await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: `bank.${status.toLowerCase()}`, subjectType: "item", subjectId: id });
  refreshBank(id);
  redirect(`/exam/bank/${id}`);
}

export async function makeAudio(formData: FormData) {
  const user = await requireUser("bank:write");
  const id = String(formData.get("id"));
  if (!uuid.safeParse(id).success) redirect("/exam/bank");
  const row = await ownItem(id, user.orgId);
  if (!row?.stimulus) redirect(`/exam/bank/${id}`);
  try {
    const audio = await synthesize(row.stimulus.body, row.stimulus.speakers ?? []);
    await db
      .update(stimuli)
      .set({ audioKey: audio.key, audioMime: audio.mime, audioDurationMs: audio.durationMs })
      .where(eq(stimuli.id, row.stimulus.id));
    if (!audio.cached)
      await recordAiRun({ orgId: user.orgId, purpose: "TTS", model: audio.model, requestedBy: user.id, inputRef: `stimulus:${row.stimulus.id}`, outputRef: audio.key });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 120) : "failed";
    await recordAiRun({ orgId: user.orgId, purpose: "TTS", model: "gemini-tts", requestedBy: user.id, inputRef: `stimulus:${row.stimulus.id}`, error: reason });
    redirect(`/exam/bank/${id}?error=tts&reason=${encodeURIComponent(reason.slice(0, 80))}`);
  }
  refreshBank(id);
  redirect(`/exam/bank/${id}`);
}

// ---------------------------------------------------------------------------
// The editor, the upload wizard and the bulk approval
// ---------------------------------------------------------------------------

export type SaveItemResult = SaveResult | { ok: false; code: "BAD_INPUT" };

export async function saveItemAction(input: unknown): Promise<SaveItemResult> {
  const user = await requireUser("bank:write");
  const parsed = saveItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "BAD_INPUT" };
  const res = await saveBankItem(user, parsed.data);
  if (res.ok) refreshBank(res.id);
  return res;
}

const settingsSchema = z.object({ section: z.enum(IMPORT_SECTIONS), level: z.enum(CEFR_LEVELS), within: z.enum(WITHINS) });
const importSchema = z.object({
  rows: z
    .array(
      z.object({
        line: z.number().int().min(1).max(1_000_000),
        cells: z.partialRecord(z.enum(SHEET_COLUMNS), z.string().max(MAX_CELL)),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
  defaults: settingsSchema,
  overrides: z.record(z.string().regex(/^\d+$/), settingsSchema.partial()),
});

export type ImportActionResult = { ok: true; created: number; failedLines: number[] } | { ok: false; code: "BAD_INPUT" | "FAILED" };

export async function importBankFileAction(input: unknown): Promise<ImportActionResult> {
  const user = await requireUser("bank:write");
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "BAD_INPUT" };
  const { rows, defaults } = parsed.data;
  const overrides = Object.fromEntries(Object.entries(parsed.data.overrides).map(([line, o]) => [Number(line), o]));
  try {
    const r = await importSheetRows(user, rows, defaults, overrides);
    refreshBank();
    return { ok: true, created: r.created, failedLines: r.failed.map((f) => f.line) };
  } catch {
    return { ok: false, code: "FAILED" };
  }
}

export type BulkApproveState = { ok: true; result: BulkApproveResult } | { ok: false; code: "NO_RIGHT" | "BAD_INPUT" | "FAILED" };

export async function bulkApproveAction(ids: unknown): Promise<BulkApproveState> {
  const user = await requireUser("bank:write");
  if (!can(user, "bank:approve")) return { ok: false, code: "NO_RIGHT" };
  const parsed = z.array(z.uuid()).min(1).max(MAX_BULK).safeParse(ids);
  if (!parsed.success) return { ok: false, code: "BAD_INPUT" };
  try {
    const result = await bulkApproveItems(user, parsed.data);
    refreshBank();
    return { ok: true, result };
  } catch {
    return { ok: false, code: "FAILED" };
  }
}
