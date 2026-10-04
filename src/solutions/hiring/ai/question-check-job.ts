import type { Locale } from "@/i18n/locale";
import { getAiProvider } from "@/lib/ai";
import { runWithRepair } from "@/lib/ai-repair";
import { buildQuestionCheckMessages, parseQuestionCheck, QUESTION_CHECK_JSON_SCHEMA, type CheckedActivity, type Finding } from "./question-check";

export type QuestionCheckOutcome =
  | { status: "OK"; findings: Finding[] }
  | { status: "UNCONFIGURED" }
  | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" };

/**
 * One QUESTION_CHECK run: ask, validate, repair once at most (the shared
 * runWithRepair gives every model call its own ai_runs row and marks an
 * unusable answer on that row). Nothing is asked, and nothing logged, when no
 * AI is connected or there is no question with text. The findings are
 * suggestions for the screen only; this job writes nothing else.
 */
export async function runQuestionCheck(input: {
  orgId: string;
  userId: string;
  openingId: string;
  activities: CheckedActivity[];
  teamLocale: Locale;
}): Promise<QuestionCheckOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  if (input.activities.length === 0) return { status: "OK", findings: [] };
  try {
    const result = await runWithRepair({
      schemaName: "kademe_question_check",
      jsonSchema: QUESTION_CHECK_JSON_SCHEMA,
      messages: buildQuestionCheckMessages(input.activities, input.teamLocale),
      meta: { orgId: input.orgId, purpose: "QUESTION_CHECK", inputRef: input.openingId, requestedBy: input.userId },
      parse: (text) => {
        const parsed = parseQuestionCheck(text, input.activities);
        return parsed.ok ? { ok: true, value: parsed.findings } : parsed;
      },
    });
    return result.ok ? { status: "OK", findings: result.value } : { status: "FAILED", code: "SCHEMA_FAILED" };
  } catch {
    // callJson has already logged the failed call on its own ai_runs row.
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
}
