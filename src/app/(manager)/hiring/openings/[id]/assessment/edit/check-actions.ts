"use server";

import { aiLimitReached } from "@/lib/ai-limit";
import { hasText } from "@/lib/library/anchors";
import { isUuid } from "@/server/settings";
import { runQuestionCheck } from "@/solutions/hiring/ai/question-check-job";
import { orderedActivities, orderedStages } from "@/solutions/hiring/rules/content";
import { workingState } from "@/solutions/hiring/server/working";
import { editableOpening } from "../../access";
import type { CheckResult } from "./check-result";

/**
 * "AI ile kontrol et" (HIRING-UX 3.9, 5.5 bar): suggestions about the draft's
 * saved questions; nothing is written but the ai_runs rows of the calls. The
 * right to edit this opening comes first (editableOpening: organisation-scoped
 * load, role, CLOSED), so a viewer who cannot change the questions cannot
 * spend AI requests on them. Only a draft is checked: a live version cannot
 * be changed, so advice on it would lead nowhere (NO_DRAFT). The AI is asked
 * only under the limit and only when a question has text; the notes are
 * written in the version's language, not the viewer's.
 */
export async function checkQuestionsAction(openingId: string): Promise<CheckResult> {
  if (typeof openingId !== "string" || !isUuid(openingId)) return { ok: false, code: "INVALID" };
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const { user } = gate;
  const state = await workingState(user.orgId, openingId);
  const content = state.content;
  if (!state.draft || !content || content.id !== state.draft.id) return { ok: false, code: "NO_DRAFT" };
  const checked = orderedStages(content).flatMap((s) =>
    orderedActivities(s)
      .filter((a) => hasText(a.prompt))
      .map((a) => ({ id: a.id, prompt: { tr: a.prompt.tr, en: a.prompt.en } })),
  );
  const at = new Date().toISOString();
  if (checked.length === 0) return { ok: true, findings: [], checked, at };
  if (await aiLimitReached(user.orgId, user.id, "QUESTION_CHECK")) return { ok: false, code: "RATE_LIMITED" };
  const outcome = await runQuestionCheck({ orgId: user.orgId, userId: user.id, openingId, activities: checked, teamLocale: content.defaultLocale });
  if (outcome.status === "OK") return { ok: true, findings: outcome.findings, checked, at };
  return { ok: false, code: outcome.status === "UNCONFIGURED" ? "UNCONFIGURED" : outcome.code };
}
