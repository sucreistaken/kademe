import type { AiMessage } from "@/lib/ai";

/**
 * Packaging tolerance for model answers, shared by every AI purpose: a code
 * fence is unwrapped and an answer that narrates around its JSON is cut back to
 * the outermost object. Nothing about the content is forgiven here; callers
 * validate with zod and reject what does not match.
 */
export function parseModelJson(text: string): { ok: true; value: unknown } | { ok: false; problem: string } {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim() : trimmed;
  try {
    return { ok: true, value: JSON.parse(unfenced) };
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return { ok: false, problem: "no JSON object in the answer" };
    try {
      return { ok: true, value: JSON.parse(unfenced.slice(start, end + 1)) };
    } catch (error) {
      return { ok: false, problem: `JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

/**
 * The product never prints an em dash (RULES.md); a model sometimes does. One
 * between words becomes a comma; one that opens or closes the text is dropped,
 * so no stray ", " is left at either end.
 */
export function withoutEmDash(text: string): string {
  return text
    .replace(/^\s*\u2014\s*/, "")
    .replace(/\s*\u2014\s*$/, "")
    .replace(/\s*\u2014\s*/g, ", ");
}

/** The single repair attempt: the broken answer goes back with the reason it was rejected. */
export function buildRepairMessages(original: AiMessage[], brokenAnswer: string, problem: string): AiMessage[] {
  return [
    ...original,
    { role: "assistant", content: brokenAnswer.slice(0, 20_000) },
    {
      role: "user",
      content: [
        "This answer did not match the schema and could not be used:",
        problem.slice(0, 1500),
        "",
        "Give the same proposal again as one JSON object that matches the schema exactly.",
        "Return only JSON, no explanation, no code fence.",
      ].join("\n"),
    },
  ];
}
