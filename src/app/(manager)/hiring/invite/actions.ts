"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/authorize";
import { shortDate } from "@/lib/format";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import { requireUser } from "@/server/session";
import { openingAccess } from "@/solutions/hiring/rules/access";
import { formatInviteDeadline, parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { createHiringInvitation, type InviteRefusal } from "@/solutions/hiring/server/invitations";
import { loadOpening } from "@/solutions/hiring/server/openings";

export type InviteOneResult =
  | { ok: true; url: string; name: string; expires: string; message: { subject: string; body: string } }
  | { ok: false; code: InviteRefusal | "FORBIDDEN" | "FAILED"; existing?: { invitedAt: string } };

export type InviteManyRow = { line: number; fullName: string; email: string; result: InviteOneResult };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const oneSchema = z.object({
  openingId: z.uuid(),
  fullName: z.string().max(120),
  email: z.string().max(160),
  locale: z.enum(["tr", "en"]),
  deadline: day,
  allowDuplicate: z.boolean().optional(),
});
const manySchema = z.object({ openingId: z.uuid(), text: z.string().max(20_000), locale: z.enum(["tr", "en"]), deadline: day });

type Refused = { ok: false; code: InviteRefusal | "FORBIDDEN" };

/**
 * Who may invite here, checked once before any row: someone who runs openings
 * (opening:write), on an opening of their organisation (the org id is in the
 * read) that is not closed and whose own deadline is not behind today, with a
 * chosen last day that is not in the past (Task 6 carry). Days are the
 * organisation's. createHiringInvitation checks all of it again inside its
 * transaction.
 */
async function gate(openingId: string, deadline: string | null): Promise<Refused | { ok: true; user: { id: string; orgId: string } }> {
  const user = await requireUser();
  if (!can(user, "opening:write")) return { ok: false, code: "FORBIDDEN" };
  const opening = await loadOpening(user.orgId, openingId);
  if (!opening) return { ok: false, code: "NOT_FOUND" };
  if (opening.status === "CLOSED") return { ok: false, code: "CLOSED" };
  const access = openingAccess(user, { decisionMakerId: opening.decisionMakerId, backupDecisionMakerId: opening.backupDecisionMakerId, memberIds: opening.memberIds, status: opening.status });
  if (!access.edit) return { ok: false, code: "FORBIDDEN" };
  const today = orgDay();
  if (opening.deadlineAt && orgDay(opening.deadlineAt) < today) return { ok: false, code: "OPENING_DEADLINE_PASSED" };
  if (deadline !== null && deadline < today) return { ok: false, code: "DEADLINE_PAST" };
  return { ok: true, user: { id: user.id, orgId: user.orgId } };
}

/** The last day the way the candidate's message states it (formatInviteDeadline), in the manager's language. */
const lastDay = (expiresAt: Date, locale: Locale) => formatInviteDeadline(orgDay(expiresAt), locale, zoneLabel(locale));

async function inviteOne(user: { id: string; orgId: string }, input: z.infer<typeof oneSchema>, locale: Locale): Promise<InviteOneResult> {
  try {
    const result = await createHiringInvitation(
      { id: user.id, orgId: user.orgId },
      { openingId: input.openingId, fullName: input.fullName, email: input.email, locale: input.locale, deadline: input.deadline, allowDuplicate: input.allowDuplicate ?? false },
    );
    if (!result.ok) return { ok: false, code: result.code, ...(result.existing ? { existing: { invitedAt: shortDate(result.existing.invitedAt, locale) } } : {}) };
    return { ok: true, url: result.url, name: input.fullName.replace(/\s+/g, " ").trim(), expires: lastDay(result.expiresAt, locale), message: result.message };
  } catch (error) {
    // The manager reads "Davet oluşturulamadı"; the cause stays in the server log.
    console.error("[hiring] invite failed", error);
    return { ok: false, code: "FAILED" };
  }
}

/** HIRING-UX 5.11 "Davet linkini oluştur": one candidate; the link is returned once and never stored. */
export async function inviteCandidateAction(input: unknown): Promise<InviteOneResult> {
  const parsed = oneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "FAILED" };
  const gated = await gate(parsed.data.openingId, parsed.data.deadline);
  if (!gated.ok) return gated;
  const result = await inviteOne(gated.user, parsed.data, await managerLocale());
  if (result.ok) revalidatePath(`/hiring/openings/${parsed.data.openingId}`, "layout");
  return result;
}

/**
 * "Birden fazla aday": each valid row is its own invitation, one after the
 * other, so one row's refusal or failure never stops the next; marked rows
 * (no name, bad or repeated e-mail) are never sent, the form shows them. A
 * pasted list never asks for a duplicate: an e-mail already invited to the
 * opening comes back DUPLICATE with its first day (the advisory lock in
 * createHiringInvitation holds against a concurrent invitation too). A refusal
 * of the whole list (role, opening, day) or malformed input is one result on
 * line 0.
 */
export async function inviteManyAction(input: unknown): Promise<{ results: InviteManyRow[] }> {
  const parsed = manySchema.safeParse(input);
  if (!parsed.success) return { results: [{ line: 0, fullName: "", email: "", result: { ok: false, code: "FAILED" } }] };
  const gated = await gate(parsed.data.openingId, parsed.data.deadline);
  if (!gated.ok) return { results: [{ line: 0, fullName: "", email: "", result: gated }] };
  const locale = await managerLocale();
  const results: InviteManyRow[] = [];
  for (const row of parseInviteRows(parsed.data.text).rows.filter((r) => r.problem === null)) {
    const result = await inviteOne(gated.user, { openingId: parsed.data.openingId, fullName: row.fullName, email: row.email, locale: parsed.data.locale, deadline: parsed.data.deadline, allowDuplicate: false }, locale);
    results.push({ line: row.line, fullName: row.fullName, email: row.email, result });
  }
  if (results.some((r) => r.result.ok)) revalidatePath(`/hiring/openings/${parsed.data.openingId}`, "layout");
  return { results };
}
