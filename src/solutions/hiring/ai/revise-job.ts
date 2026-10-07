import { getAiProvider } from "@/lib/ai";
import { runWithRepair } from "@/lib/ai-repair";
import { checkDraftBudget, HIRING_DRAFT_JSON_SCHEMA, normalizeDraft, parseDraftAnswer, type ActivitySuggestion, type CompetencySuggestion, type HiringDraft } from "./draft";
import {
  buildReviseActivityMessages,
  buildReviseAllMessages,
  parseReviseActivityAnswer,
  REVISE_ACTIVITY_JSON_SCHEMA,
  type ActivityRevision,
  type ReviseContext,
} from "./revise";

type Failure = { status: "UNCONFIGURED" } | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" };
export type ReviseAllOutcome = { status: "OK"; draft: HiringDraft; budgetWarning: string | null } | Failure;
export type ReviseActivityOutcome = { status: "OK"; revision: ActivityRevision } | Failure;

type Caller = { orgId: string; userId: string; openingId: string };

/** Library ids the answer may name: the organisation's active ones plus those the draft already measures. */
const idsOf = (input: ReviseContext, extra: Iterable<string>) => new Set([...input.library.map((c) => c.id), ...extra]);

/**
 * "AI'a söyle" on the whole list (HIRING_REVISE): the current draft plus the
 * instruction to a full draft back, validated and normalised like the first
 * draft, repaired once at most (also once when it runs over the time budget;
 * a repaired answer over the budget is kept with the note). Quotes are not
 * required: an instruction may ask for something the ad does not say.
 */
export async function reviseHiringDraft(input: ReviseContext & Caller & { current: HiringDraft }): Promise<ReviseAllOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const options = { locales: input.locales, libraryIds: idsOf(input, input.current.competencies.map((c) => c.libraryId).filter(Boolean)) };
  let attempt = 0;
  try {
    const result = await runWithRepair({
      schemaName: "kademe_hiring_draft",
      jsonSchema: HIRING_DRAFT_JSON_SCHEMA,
      messages: buildReviseAllMessages(input),
      meta: { orgId: input.orgId, purpose: "HIRING_REVISE", inputRef: input.openingId, requestedBy: input.userId },
      parse: (text) => {
        attempt += 1;
        const parsed = parseDraftAnswer(text);
        if (!parsed.ok) return parsed;
        const draft = normalizeDraft(parsed.draft, options);
        if (draft.stages.length === 0) return { ok: false, problem: "no stage has a question with text" };
        const budget = checkDraftBudget(draft);
        if (attempt === 1 && budget) return { ok: false, problem: budget };
        return { ok: true, value: { draft, budgetWarning: budget } };
      },
    });
    return result.ok ? { status: "OK", ...result.value } : { status: "FAILED", code: "SCHEMA_FAILED" };
  } catch {
    // callJson has already logged the failed call on its own ai_runs row.
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
}

/** "AI ile düzelt" on one question (HIRING_REVISE): that question back, normalised; repaired once at most. */
export async function reviseHiringActivity(
  input: ReviseContext & Caller & { stageName: string; activity: ActivitySuggestion; competencies: CompetencySuggestion[] },
): Promise<ReviseActivityOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const options = { locales: input.locales, libraryIds: idsOf(input, input.competencies.map((c) => c.libraryId).filter(Boolean)) };
  try {
    const result = await runWithRepair({
      schemaName: "kademe_hiring_revise_activity",
      jsonSchema: REVISE_ACTIVITY_JSON_SCHEMA,
      messages: buildReviseActivityMessages(input),
      meta: { orgId: input.orgId, purpose: "HIRING_REVISE", inputRef: input.openingId, requestedBy: input.userId },
      parse: (text) => parseReviseActivityAnswer(text, options),
    });
    return result.ok ? { status: "OK", revision: result.value } : { status: "FAILED", code: "SCHEMA_FAILED" };
  } catch {
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
}
