import { getAiProvider } from "@/lib/ai";
import { buildRepairMessages } from "@/lib/ai-json";
import { callJson, recordAiRun } from "@/lib/ai-runs";
import { ANCHOR_DRAFT_JSON_SCHEMA, buildAnchorMessages, parseAnchorAnswer, type AnchorDraftRequest, type AnchorProposal } from "@/lib/library/anchor-draft";

export type AnchorDraftOutcome = { status: "OK"; anchors: AnchorProposal } | { status: "UNCONFIGURED" } | { status: "FAILED" };

/** One proposal, one repair attempt at most; every call leaves an ai_runs row (callJson). Writes nothing else. */
export async function draftAnchors(orgId: string, userId: string, competencyId: string, request: AnchorDraftRequest): Promise<AnchorDraftOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const meta = { orgId, purpose: "ANCHOR_DRAFT" as const, inputRef: competencyId, requestedBy: userId };
  const messages = buildAnchorMessages(request);
  try {
    const first = await callJson("kademe_anchor_draft", ANCHOR_DRAFT_JSON_SCHEMA, messages, meta);
    const parsed = parseAnchorAnswer(first.response.text);
    if (parsed.ok) return { status: "OK", anchors: parsed.anchors };
    const second = await callJson(
      "kademe_anchor_draft",
      ANCHOR_DRAFT_JSON_SCHEMA,
      buildRepairMessages(messages, first.response.text, parsed.problem),
      meta,
    );
    const repaired = parseAnchorAnswer(second.response.text);
    if (repaired.ok) return { status: "OK", anchors: repaired.anchors };
    await recordAiRun({ ...meta, model: second.response.model, error: `repair still invalid: ${repaired.problem}` });
    return { status: "FAILED" };
  } catch {
    return { status: "FAILED" };
  }
}
