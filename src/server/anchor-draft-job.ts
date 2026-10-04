import { getAiProvider } from "@/lib/ai";
import { runWithRepair } from "@/lib/ai-repair";
import { ANCHOR_DRAFT_JSON_SCHEMA, buildAnchorMessages, parseAnchorAnswer, type AnchorDraftRequest, type AnchorProposal } from "@/lib/library/anchor-draft";

export type AnchorDraftOutcome = { status: "OK"; anchors: AnchorProposal } | { status: "UNCONFIGURED" } | { status: "FAILED" };

/**
 * One proposal, one repair attempt at most (runWithRepair). Every model call
 * leaves its own ai_runs row; an unusable answer marks that row. Writes nothing else.
 */
export async function draftAnchors(orgId: string, userId: string, competencyId: string, request: AnchorDraftRequest): Promise<AnchorDraftOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  try {
    const result = await runWithRepair({
      schemaName: "kademe_anchor_draft",
      jsonSchema: ANCHOR_DRAFT_JSON_SCHEMA,
      messages: buildAnchorMessages(request),
      meta: { orgId, purpose: "ANCHOR_DRAFT", inputRef: competencyId, requestedBy: userId },
      parse: (text) => {
        const parsed = parseAnchorAnswer(text);
        return parsed.ok ? { ok: true, value: parsed.anchors } : parsed;
      },
    });
    return result.ok ? { status: "OK", anchors: result.value } : { status: "FAILED" };
  } catch {
    return { status: "FAILED" };
  }
}
