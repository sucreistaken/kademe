import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiRuns } from "@/db/schema";
import type { aiPurpose } from "@/db/schema";
import { getAiProvider, hashPrompt, type AiJsonResponse, type AiMessage } from "@/lib/ai";

/**
 * Every model call goes through here so that every call, successful or not,
 * leaves one `ai_runs` row. That table is the audit trail for an AI system a
 * school uses to place students: which model, what it cost, what went wrong.
 */

/** Every purpose the database accepts; a new one is a migration, not a string. */
export type AiPurpose = (typeof aiPurpose.enumValues)[number];

export async function recordAiRun(input: {
  orgId: string;
  purpose: AiPurpose;
  model: string;
  promptHash?: string | null;
  inputRef?: string | null;
  outputRef?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  requestedBy?: string | null;
  error?: string | null;
}) {
  const [row] = await db
    .insert(aiRuns)
    .values({
      orgId: input.orgId,
      purpose: input.purpose,
      model: input.model,
      promptHash: input.promptHash ?? null,
      inputRef: input.inputRef ?? null,
      outputRef: input.outputRef ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      costUsd: input.costUsd === null || input.costUsd === undefined ? null : String(input.costUsd),
      requestedBy: input.requestedBy ?? null,
      error: input.error ? input.error.slice(0, 2000) : null,
    })
    .returning({ id: aiRuns.id });
  return row.id;
}

/**
 * A model call that answered but whose answer was unusable (it failed the
 * schema or the local checks) is still the same call: its existing row gets the
 * reason, and no second row is written for something that was not a call.
 */
export async function markAiRunError(runId: string, error: string): Promise<void> {
  await db.update(aiRuns).set({ error: error.slice(0, 2000) }).where(eq(aiRuns.id, runId));
}

export type CallMeta = {
  orgId: string;
  purpose: AiPurpose;
  inputRef?: string | null;
  requestedBy?: string | null;
};

/**
 * One JSON call, logged. A thrown error has already been logged; the caller
 * decides whether it is worth a retry.
 */
export async function callJson(
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  messages: AiMessage[],
  meta: CallMeta,
  options: { maxTokens?: number; images?: Array<{ mime: string; base64: string }> } = {},
): Promise<{ response: AiJsonResponse; runId: string }> {
  const provider = getAiProvider();
  const promptHash = hashPrompt(messages);
  if (!provider.available) {
    await recordAiRun({ ...meta, model: provider.model || "none", promptHash, error: "no AI provider configured" });
    throw new Error("AI_UNAVAILABLE");
  }
  try {
    const response = await provider.completeJson({
      messages,
      schemaName,
      jsonSchema,
      maxTokens: options.maxTokens,
      ...(options.images ? { images: options.images } : {}),
    });
    for (const transient of response.transientErrors) {
      await recordAiRun({ ...meta, model: response.model, promptHash, error: `retried: ${transient}` });
    }
    const runId = await recordAiRun({
      ...meta,
      model: response.model,
      promptHash,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd: response.costUsd,
    });
    return { response, runId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordAiRun({ ...meta, model: provider.model, promptHash, error: reason });
    throw error;
  }
}
