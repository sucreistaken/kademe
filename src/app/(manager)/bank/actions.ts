"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, items, stimuli } from "@/db/schema";
import { recordAiRun } from "@/lib/ai-runs";
import { generationSpecSchema, STIMULUS_SECTIONS } from "@/lib/exam/item-generation";
import { validateItem } from "@/lib/exam/validate";
import { synthesize } from "@/lib/tts";
import { generateItems } from "@/server/item-generation-job";
import { requireUser } from "@/server/session";

async function ownItem(id: string, orgId: string) {
  const [row] = await db
    .select({ item: items, stimulus: stimuli })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.id, id), eq(items.orgId, orgId)));
  return row ?? null;
}

export type GenerateState = { ok: true; created: number; firstId: string | null } | { ok: false; error: string } | null;

export async function generate(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const user = await requireUser("bank:write");
  const section = String(formData.get("section"));
  const spec = generationSpecSchema.safeParse({
    section,
    level: formData.get("level"),
    itemType: formData.get("itemType"),
    count: Number(formData.get("count") ?? 3),
    topic: String(formData.get("topic") ?? "").trim() || undefined,
    withStimulus: STIMULUS_SECTIONS.includes(section as never),
  });
  if (!spec.success) return { ok: false, error: spec.error.issues[0]?.message ?? "invalid" };
  try {
    const r = await generateItems(user.orgId, user.id, spec.data);
    if (!r.ok) return { ok: false, error: r.error.slice(0, 200) };
    await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: "bank.generate", subjectType: "item", meta: { ...spec.data, created: r.created } });
    revalidatePath("/bank");
    return { ok: true, created: r.created, firstId: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "failed" };
  }
}

export async function setItemStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "APPROVED" | "REJECTED" | "RETIRED" | "DRAFT";
  const user = await requireUser(status === "APPROVED" ? "bank:approve" : "bank:write");
  const row = await ownItem(id, user.orgId);
  if (!row) redirect("/bank");
  if (status === "APPROVED") {
    const problems = validateItem({ type: row.item.type, prompt: row.item.prompt, content: row.item.content, key: row.item.answerKey, rubric: row.item.rubric });
    if (problems.length) redirect(`/bank/${id}?error=invalid`);
    if (row.item.section === "LISTENING" && !row.stimulus?.audioKey) redirect(`/bank/${id}?error=audio`);
  }
  await db
    .update(items)
    .set({ status, reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(items.id, id));
  await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: `bank.${status.toLowerCase()}`, subjectType: "item", subjectId: id });
  revalidatePath("/bank");
  redirect(`/bank/${id}`);
}

export async function savePrompt(formData: FormData) {
  const user = await requireUser("bank:write");
  const id = String(formData.get("id"));
  const prompt = String(formData.get("prompt") ?? "").trim();
  const row = await ownItem(id, user.orgId);
  if (!row || prompt.length < 3) redirect(`/bank/${id}`);
  // Editing an approved item sends it back to review.
  await db.update(items).set({ prompt, status: "DRAFT", updatedAt: new Date() }).where(eq(items.id, id));
  await db.insert(auditLogs).values({ orgId: user.orgId, actorId: user.id, action: "bank.edit", subjectType: "item", subjectId: id });
  redirect(`/bank/${id}`);
}

export async function makeAudio(formData: FormData) {
  const user = await requireUser("bank:write");
  const id = String(formData.get("id"));
  const row = await ownItem(id, user.orgId);
  if (!row?.stimulus) redirect(`/bank/${id}`);
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
    redirect(`/bank/${id}?error=tts&reason=${encodeURIComponent(reason.slice(0, 80))}`);
  }
  redirect(`/bank/${id}`);
}
