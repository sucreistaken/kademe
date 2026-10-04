"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ForbiddenError } from "@/lib/authorize";
import { canDecide } from "@/solutions/hiring/rules/access";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";
import { saveOpeningRules, setOpeningClosed } from "@/solutions/hiring/server/openings";
import { editableOpening, openingFor } from "../access";
import type { SaveRulesResult } from "./result";

const schema = z.object({
  name: z.string().max(200),
  memberIds: z.array(z.uuid()).max(50),
  decisionMakerId: z.uuid().nullable(),
  backupDecisionMakerId: z.uuid().nullable(),
  minEvaluations: z.number().int(),
  blindMode: z.boolean(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  feedbackDays: z.number().int(),
  candidateContactEmail: z.string().max(200),
});

/**
 * "Kaydet" (HIRING-UX 5.18). The form calls it from the browser, so the right
 * to edit is asked again here with editableOpening (openingFor(id, "edit") as a
 * code: organisation-scoped load, role, CLOSED), and the write uses the
 * session's organisation and user. The rules run again on the server against
 * the organisation's own users (saveOpeningRules); nothing from the browser is
 * trusted.
 */
export async function saveOpeningRulesAction(openingId: string, input: unknown): Promise<SaveRulesResult> {
  if (typeof openingId !== "string") return { ok: false, code: "INVALID" };
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  try {
    const result = await saveOpeningRules(gate.user.orgId, gate.user.id, gate.opening.id, parsed.data);
    // The header (name, deadline) and the overview's "Ekibi ata" row read what was saved.
    if (result.ok) revalidatePath("/hiring/openings/[id]", "layout");
    return result;
  } catch (error) {
    if (error instanceof HiringConflict && error.code === "CLOSED") return { ok: false, code: "CLOSED" };
    if (error instanceof HiringNotFound) return { ok: false, code: "NOT_FOUND" };
    throw error;
  }
}

/** "Alımı kapat": an owner or manager of an open or draft opening; the page then offers the undo. */
export async function closeOpeningAction(formData: FormData) {
  const { user, opening } = await openingFor(String(formData.get("openingId") ?? ""), "edit");
  await setOpeningClosed(user.orgId, user.id, opening.id, true);
  revalidatePath("/hiring/openings", "layout");
  redirect(`/hiring/openings/${opening.id}/settings?closed=1`);
}

/**
 * "Yeniden aç" and the close's undo. A closed opening is read-only for
 * everyone (openingAccess), so this asks only to see it and then for an owner
 * or manager role: a reviewer on the team cannot reopen it.
 */
export async function reopenOpeningAction(formData: FormData) {
  const { user, opening } = await openingFor(String(formData.get("openingId") ?? ""), "view");
  if (!canDecide(user.role)) throw new ForbiddenError("opening:write");
  await setOpeningClosed(user.orgId, user.id, opening.id, false);
  revalidatePath("/hiring/openings", "layout");
  redirect(`/hiring/openings/${opening.id}/settings`);
}
