import { db } from "@/db";
import { aiRuns } from "@/db/schema";
import { getAiProvider, hashPrompt, type AiMessage } from "@/lib/ai";
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  buildDraftMessages,
  buildRepairMessages,
  checkDraftBudget,
  normalizeDraft,
  parseDraftAnswer,
  type DraftRequest,
  type TemplateDraft,
} from "@/lib/template-draft";

/**
 * One template drafting run: prompt, validate, repair once, record everything.
 *
 * Every call to the provider writes a row in `ai_runs`, the failed ones
 * included. The traceability story for this product is "we can show you every
 * model call we made", and a run that produced nothing is exactly the kind a
 * regulator or a manager would ask about.
 *
 * Nothing here writes to the template. The draft is handed back to the screen
 * as a set of suggestions; only an accepted card becomes a stage.
 */

export type DraftOutcome =
  | {
      status: "OK";
      draft: TemplateDraft;
      model: string;
      costUsd: number | null;
      repaired: boolean;
      /** Requests the provider needed, retries of a busy endpoint included. */
      attempts: number;
      /** Set when the draft is still longer than a candidate would finish. */
      budgetWarning: string | null;
      /** Suggestions past the stage cap, dropped before the cards were built. */
      droppedStages: number;
      /**
       * Set when the preferred provider gave up and a slower one answered
       * instead. The screen says so, because the wait goes from seconds to
       * minutes and a manager cannot tell that apart from a hang.
       */
      fellBackTo: string | null;
    }
  | { status: "UNCONFIGURED"; code: "UNCONFIGURED" }
  | {
      status: "FAILED";
      /** What the screen renders, in the manager's own language. */
      code: DraftFailureCode;
      /**
       * The provider's own words, kept for the person debugging rather than
       * the person recruiting. Never the only thing shown.
       */
      detail?: string;
    };

/** Why a draft did not happen. Sentences live in the dictionary, not here. */
export type DraftFailureCode = "PROVIDER_FAILED" | "SCHEMA_FAILED";

export type GenerateInput = DraftRequest & {
  orgId: string;
  requestedBy: string;
  /** Written to `ai_runs.input_ref` so a run can be traced to its position. */
  positionId: string;
};

export async function generateTemplateDraft(
  input: GenerateInput,
): Promise<DraftOutcome> {
  const provider = getAiProvider();
  if (!provider.available) {
    return {
      status: "UNCONFIGURED",
      // A code, so the screen answers in the manager's own language. The
      // variable names stay out of it: the sentence a recruiter reads should
      // not be a list of environment variables.
      code: "UNCONFIGURED",
    };
  }

  const messages = buildDraftMessages(input);

  const first = await callProvider(messages, input);
  if (!first.ok) {
    return { status: "FAILED", code: "PROVIDER_FAILED", detail: first.detail };
  }

  const parsed = parseDraftAnswer(first.text);
  // Two different kinds of unusable answer, one repair attempt for both: an
  // answer that does not match the schema, and one that does but asks a
  // candidate for an hour and three quarters of their evening.
  const problem = parsed.ok
    ? checkDraftBudget(normalizeDraft(parsed.draft, input.locales))
    : parsed.problem;

  if (parsed.ok && !problem) {
    const draft = normalizeDraft(parsed.draft, input.locales);
    return {
      status: "OK",
      draft,
      model: first.model,
      costUsd: first.costUsd,
      repaired: false,
      attempts: first.attempts,
      budgetWarning: null,
      droppedStages: parsed.draft.stages.length - draft.stages.length,
      fellBackTo: first.fellBackTo,
    };
  }

  // One repair attempt, then stop. A second retry costs money and minutes and,
  // in practice, returns the same answer.
  const repairMessages = buildRepairMessages(messages, first.text, problem!);
  const second = await callProvider(repairMessages, input, problem!);
  if (!second.ok) {
    return { status: "FAILED", code: "PROVIDER_FAILED", detail: second.detail };
  }

  const repaired = parseDraftAnswer(second.text);
  if (!repaired.ok) {
    await recordRun(input, {
      model: second.model,
      messages: repairMessages,
      error: `Onarım denemesi de şemaya uymadı: ${repaired.problem}`,
    });
    return {
      status: "FAILED",
      code: "SCHEMA_FAILED",
    };
  }

  const draft = normalizeDraft(repaired.draft, input.locales);
  // A second overrun is shown rather than thrown away. The cards carry their
  // own minutes and can be edited or skipped one by one, and discarding four
  // minutes of waiting to protect the manager from a number they can see would
  // be the worse trade.
  const budgetWarning = checkDraftBudget(draft);
  if (budgetWarning) {
    await recordRun(input, {
      model: second.model,
      messages: repairMessages,
      error: `Onarımdan sonra da süre bütçesi aşıldı: ${budgetWarning}`,
    });
  }

  return {
    status: "OK",
    draft,
    model: second.model,
    costUsd: second.costUsd,
    repaired: true,
    attempts: first.attempts + second.attempts,
    budgetWarning,
    droppedStages: repaired.draft.stages.length - draft.stages.length,
    // The repair call is the one whose answer is on the screen, so it is the
    // one whose provider the manager was actually waiting for.
    fellBackTo: second.fellBackTo,
  };
}

type CallResult =
  | {
      ok: true;
      text: string;
      model: string;
      costUsd: number | null;
      attempts: number;
      fellBackTo: string | null;
    }
  | { ok: false; detail: string };

/**
 * One provider call plus its `ai_runs` row. `previousProblem` is set on the
 * repair call, so the log says why a second call happened at all.
 */
async function callProvider(
  messages: AiMessage[],
  input: GenerateInput,
  previousProblem?: string,
): Promise<CallResult> {
  const provider = getAiProvider();
  try {
    const answer = await provider.completeJson({
      messages,
      schemaName: "kademe_template_draft",
      jsonSchema: TEMPLATE_DRAFT_JSON_SCHEMA,
    });

    // A retried request is still a request that was made. Each one gets its own
    // row, or the log would quietly under-report how often the endpoint is busy.
    for (const transient of answer.transientErrors) {
      await recordRun(input, {
        model: answer.model,
        messages,
        error: `Geçici hata, yeniden denendi: ${transient}`,
      });
    }

    await recordRun(input, {
      model: answer.model,
      messages,
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
      costUsd: answer.costUsd,
      error: previousProblem
        ? `Önceki cevap kullanılamadı, onarım denendi: ${previousProblem}`
        : null,
    });

    return {
      ok: true,
      text: answer.text,
      model: answer.model,
      costUsd: answer.costUsd,
      attempts: answer.attempts,
      fellBackTo: answer.fellBackTo,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordRun(input, {
      model: provider.model,
      messages,
      error: reason,
    });
    // The provider's text either way. The screen puts a sentence in front of
    // it; this is the part a developer needs and a recruiter ignores.
    return { ok: false, detail: reason.slice(0, 300) };
  }
}

async function recordRun(
  input: GenerateInput,
  run: {
    model: string;
    messages: AiMessage[];
    inputTokens?: number | null;
    outputTokens?: number | null;
    costUsd?: number | null;
    error?: string | null;
  },
) {
  await db.insert(aiRuns).values({
    orgId: input.orgId,
    purpose: "TEMPLATE_DRAFT",
    model: run.model,
    // The prompt carries the job ad, so only its hash is kept: the column
    // exists to prove two runs used the same prompt, not to archive it.
    promptHash: hashPrompt(run.messages),
    inputRef: input.positionId,
    inputTokens: run.inputTokens ?? null,
    outputTokens: run.outputTokens ?? null,
    costUsd: run.costUsd === null || run.costUsd === undefined ? null : String(run.costUsd),
    requestedBy: input.requestedBy,
    error: run.error ? run.error.slice(0, 2000) : null,
  });
}
