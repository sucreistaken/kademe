import type { AiMessage } from "@/lib/ai";
import { buildRepairMessages } from "@/lib/ai-json";
import { callJson, markAiRunError, type CallMeta } from "@/lib/ai-runs";

export type ParsedAnswer<T> = { ok: true; value: T } | { ok: false; problem: string };

/**
 * The shared shape of a JSON proposal call: ask, validate, and if the answer is
 * unusable send it back once with the reason. Every model call leaves its own
 * ai_runs row (callJson); an unusable answer marks that row, it never adds one.
 * A thrown call has already been logged by callJson and is passed on.
 */
export async function runWithRepair<T>(input: {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  messages: AiMessage[];
  meta: CallMeta;
  parse: (text: string) => ParsedAnswer<T>;
  options?: { maxTokens?: number };
}): Promise<{ ok: true; value: T; runId: string } | { ok: false; problem: string }> {
  const { schemaName, jsonSchema, messages, meta, parse, options } = input;
  const first = await callJson(schemaName, jsonSchema, messages, meta, options);
  const parsed = parse(first.response.text);
  if (parsed.ok) return { ok: true, value: parsed.value, runId: first.runId };
  await markAiRunError(first.runId, `invalid answer: ${parsed.problem}`);

  const second = await callJson(schemaName, jsonSchema, buildRepairMessages(messages, first.response.text, parsed.problem), meta, options);
  const repaired = parse(second.response.text);
  if (repaired.ok) return { ok: true, value: repaired.value, runId: second.runId };
  await markAiRunError(second.runId, `repair still invalid: ${repaired.problem}`);
  return { ok: false, problem: repaired.problem };
}
