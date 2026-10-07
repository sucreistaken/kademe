import { getAiProvider } from "@/lib/ai";
import { runWithRepair } from "@/lib/ai-repair";
import { briefIsDue, buildRoleBriefMessages, parseRoleBriefAnswer, ROLE_BRIEF_JSON_SCHEMA, type RoleBriefRequest, type RoleBriefResult } from "./role-brief";

export type RoleBriefOutcome =
  | { status: "OK"; result: RoleBriefResult }
  | { status: "UNCONFIGURED" }
  | { status: "FAILED"; code: "PROVIDER_FAILED" | "SCHEMA_FAILED" };

/**
 * One "Rolü anlat" turn (HIRING_ROLE_BRIEF): prompt, validate, repair once at
 * most (runWithRepair: every model call its own ai_runs row). The first answer
 * is held to the strict job ad length; the repaired one to the lenient range.
 * Writes nothing else; nothing at all when no AI is connected.
 */
export async function generateRoleBrief(input: RoleBriefRequest & { orgId: string; userId: string }): Promise<RoleBriefOutcome> {
  if (!getAiProvider().available) return { status: "UNCONFIGURED" };
  const briefDue = briefIsDue(input.rounds);
  let attempt = 0;
  try {
    const result = await runWithRepair({
      schemaName: "kademe_hiring_role_brief",
      jsonSchema: ROLE_BRIEF_JSON_SCHEMA,
      messages: buildRoleBriefMessages(input),
      meta: { orgId: input.orgId, purpose: "HIRING_ROLE_BRIEF", inputRef: null, requestedBy: input.userId },
      parse: (text) => {
        attempt += 1;
        const parsed = parseRoleBriefAnswer(text, { briefDue, strict: attempt === 1 });
        return parsed.ok ? { ok: true, value: parsed.result } : parsed;
      },
    });
    return result.ok ? { status: "OK", result: result.value } : { status: "FAILED", code: "SCHEMA_FAILED" };
  } catch {
    // callJson has already logged the failed call on its own ai_runs row.
    return { status: "FAILED", code: "PROVIDER_FAILED" };
  }
}
