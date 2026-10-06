import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { callJson } from "@/lib/ai-runs";
import { thetaForLevel } from "@/lib/exam/cefr";
import {
  buildGenerationMessages,
  buildGenerationRepairMessages,
  ITEM_GENERATION_JSON_SCHEMA,
  MAX_FEW_SHOT,
  parseGeneratedBatch,
  type GenerationSpec,
} from "@/lib/exam/item-generation";

/**
 * AI item generation for the bank. The model writes drafts only: every row is
 * DRAFT with origin AI, and nothing reaches an exam until a teacher approves
 * it. A batch that does not parse gets one repair attempt, then gives up; an
 * invented fallback item would be worse than none.
 */
export async function generateItems(orgId: string, userId: string, spec: GenerationSpec) {
  // Imitate what this school already approved, and avoid its topics.
  const examples = await db
    .select({ prompt: items.prompt, content: items.content, key: items.answerKey, rubric: items.rubric })
    .from(items)
    .where(and(eq(items.orgId, orgId), eq(items.section, spec.section), eq(items.level, spec.level), eq(items.type, spec.itemType), eq(items.status, "APPROVED")))
    .orderBy(desc(items.createdAt))
    .limit(MAX_FEW_SHOT);
  const topics = await db
    .select({ topic: stimuli.topic })
    .from(stimuli)
    .where(and(eq(stimuli.orgId, orgId), eq(stimuli.section, spec.section), eq(stimuli.level, spec.level)))
    .limit(20);
  const messages = buildGenerationMessages(spec, examples, topics.map((t) => t.topic).filter(Boolean));
  const meta = { orgId, purpose: "ITEM_GENERATION" as const, requestedBy: userId, inputRef: `${spec.section}/${spec.level}/${spec.itemType}` };

  let attemptMessages = messages;
  let lastError = "";
  for (let round = 0; round < 2; round++) {
    const { response, runId } = await callJson("item_batch", ITEM_GENERATION_JSON_SCHEMA, attemptMessages, meta, { maxTokens: 8000 });
    const parsed = parseGeneratedBatch(response.text, spec);
    if (!parsed.ok) {
      lastError = parsed.error;
      attemptMessages = buildGenerationRepairMessages(messages, response.text, parsed.error);
      continue;
    }
    let stimulusId: string | null = null;
    if (parsed.batch.stimulus) {
      const [s] = await db
        .insert(stimuli)
        .values({
          orgId,
          section: spec.section,
          level: spec.level,
          title: parsed.batch.stimulus.title,
          body: parsed.batch.stimulus.body,
          topic: parsed.batch.stimulus.topic,
          speakers: parsed.batch.stimulus.speakers ?? null,
          origin: "AI",
          aiRunId: runId,
          createdBy: userId,
        })
        .returning({ id: stimuli.id });
      stimulusId = s.id;
    }
    const rows = parsed.batch.items.map((it, i) => ({
      orgId,
      section: spec.section,
      level: spec.level,
      difficulty: thetaForLevel(spec.level, it.within),
      type: spec.itemType,
      skillTag: it.skillTag,
      stimulusId,
      orderInStimulus: stimulusId ? i + 1 : 0,
      prompt: it.prompt,
      content: it.content,
      answerKey: it.key,
      rubric: it.rubric ?? null,
      explanation: it.explanation,
      status: "DRAFT" as const,
      origin: "AI" as const,
      aiRunId: runId,
      createdBy: userId,
    }));
    const written = rows.length ? await db.insert(items).values(rows).returning({ id: items.id }) : [];
    return { ok: true as const, created: written.length, rejected: parsed.itemErrors.length, stimulusId, itemIds: written.map((r) => r.id) };
  }
  return { ok: false as const, error: lastError || "no valid items" };
}
