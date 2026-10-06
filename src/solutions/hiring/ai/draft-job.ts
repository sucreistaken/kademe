import { getAiProvider } from "@/lib/ai";
import { runWithRepair } from "@/lib/ai-repair";
import {
  buildDraftMessages,
  checkDraftBudget,
  HIRING_DRAFT_JSON_SCHEMA,
  normalizeDraft,
  parseDraftAnswer,
  visibleProposals,
  type DraftRequest,
  type HiringDraft,
} from "./draft";

export type DraftOutcome =
  | { status: "OK"; draft: HiringDraft; budgetWarning: string | null }
  | { status: "UNCONFIGURED" }
  | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" };

/**
 * One drafting run (HIRING_DRAFT): prompt, validate, repair once at most. The
 * shared runWithRepair gives every model call its own ai_runs row and marks an
 * unusable answer on that row; this job writes nothing else, and nothing at all
 * when no AI is connected. The screen shows cards and a person accepts them one
 * by one.
 *
 * The first answer is sent back once when it fails the schema, when the
 * candidate could not finish it in time (checkDraftBudget), or when no stage
 * quotes the job ad (no card could be shown). A repaired answer that still runs
 * over the budget or quotes nothing is shown as it is: every card carries its
 * minutes and can be skipped, and the screen says how many were hidden.
 */
export async function generateHiringDraft(
  input: DraftRequest & { orgId: string; userId: string; openingId?: string; inputRef?: string },
): Promise<DraftOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const options = { locales: input.locales, libraryIds: new Set(input.library.map((c) => c.id)) };
  let attempt = 0;
  try {
    const result = await runWithRepair({
      schemaName: "kademe_hiring_draft",
      jsonSchema: HIRING_DRAFT_JSON_SCHEMA,
      messages: buildDraftMessages(input),
      // The opening when there is one; Advanced "create" drafts a position before any opening exists.
      meta: { orgId: input.orgId, purpose: "HIRING_DRAFT", inputRef: input.openingId ?? input.inputRef ?? null, requestedBy: input.userId },
      parse: (text) => {
        attempt += 1;
        const parsed = parseDraftAnswer(text);
        if (!parsed.ok) return parsed;
        const draft = normalizeDraft(parsed.draft, options);
        if (draft.stages.length === 0) return { ok: false, problem: "no stage has a question with text" };
        const budget = checkDraftBudget(draft);
        if (attempt === 1) {
          if (budget) return { ok: false, problem: budget };
          if (visibleProposals(draft, input.jobAd).stages.length === 0) {
            return { ok: false, problem: "No stage quotes the job ad word for word. Copy each quote exactly from the job ad text." };
          }
        }
        return { ok: true, value: { draft, budgetWarning: budget } };
      },
    });
    return result.ok ? { status: "OK", ...result.value } : { status: "FAILED", code: "SCHEMA_FAILED" };
  } catch {
    // callJson has already logged the failed call on its own ai_runs row.
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
}
