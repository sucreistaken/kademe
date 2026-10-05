"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { managerLocale } from "@/i18n/manager-locale";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { formatInviteDeadline } from "@/solutions/hiring/rules/invitation";
import { extendHiringLink, markRequestHandled, newHiringLink } from "@/solutions/hiring/server/invitations";
import { editableOpening, runningOpening } from "../access";

export type NewLinkResult =
  | { ok: true; url: string; expires: string; name: string; message: { subject: string; body: string } }
  | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" | "FORBIDDEN" | "FAILED" };

/** The notices "7 gün uzat" comes back with when the link was not extended (page.tsx reads them). */
export type ExtendNotice = "closed" | "forbidden" | "notfound" | "completed" | "started" | "failed";
/** The notices "Tamam" comes back with when the request was not closed. */
export type RequestNotice = "closed" | "forbidden" | "notfound" | "failed";

const page = (openingId: string) => `/hiring/openings/${encodeURIComponent(openingId)}/candidates`;

const GATE_NOTICE = { NOT_FOUND: "notfound", CLOSED: "closed", FORBIDDEN: "forbidden" } as const;

/**
 * "Yeni link üret": the old link stops at once; the new one is shown once
 * (HIRING-UX 5.12). It cannot be undone (ruling C9, like publish): the page
 * says so next to the button. The last day reads as in the ready message, the
 * end of the day in the organisation's zone (Task 17 ruling 4); a new link
 * after the opening's deadline is allowed (Task 7 ruling). The gate is the
 * right to run the opening, not its status: on a CLOSED opening newHiringLink
 * still gives a started candidate a link and refuses one who has not started
 * (CLOSED; Task 18 fix round 1). A failure answers FAILED, never the raw
 * error.
 */
export async function newLinkAction(openingId: string, assessmentId: string): Promise<NewLinkResult> {
  if (typeof openingId !== "string" || typeof assessmentId !== "string") return { ok: false, code: "NOT_FOUND" };
  const gate = await runningOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  try {
    const outcome = await newHiringLink({ id: gate.user.id, orgId: gate.user.orgId }, openingId, assessmentId);
    if (!outcome.ok) return outcome;
    revalidatePath(page(openingId));
    const locale = await managerLocale();
    return {
      ok: true,
      url: outcome.url,
      expires: formatInviteDeadline(orgDay(outcome.expiresAt), locale, zoneLabel(locale)),
      name: outcome.name,
      message: outcome.message,
    };
  } catch (error) {
    console.error("[hiring] new link failed", error);
    return { ok: false, code: "FAILED" };
  }
}

/**
 * "7 gün uzat" (ruling C8): the opening's own extend, through its edit right
 * (owner or manager, opening not CLOSED), on the invitation's newest link.
 * Comes back to the tab with "?extended=1" or the reason it did not.
 */
export async function extendHiringLinkAction(formData: FormData): Promise<void> {
  const openingId = String(formData.get("openingId") ?? "");
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const gate = await editableOpening(openingId);
  if (!gate.ok) redirect(`${page(openingId)}?extend=${GATE_NOTICE[gate.code]}`);
  let notice: string;
  try {
    const outcome = await extendHiringLink({ id: gate.user.id, orgId: gate.user.orgId }, openingId, assessmentId);
    notice = outcome.ok ? "extended=1" : `extend=${outcome.code === "NOT_FOUND" ? "notfound" : outcome.code.toLowerCase()}`;
  } catch (error) {
    console.error("[hiring] extend failed", error);
    notice = "extend=failed";
  }
  revalidatePath(page(openingId));
  redirect(`${page(openingId)}?${notice}`);
}

/** "Tamam" on a candidate's request (candidate_requests only; data rights rows have no "Tamam"). */
export async function markRequestAction(formData: FormData): Promise<void> {
  const openingId = String(formData.get("openingId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const gate = await editableOpening(openingId);
  if (!gate.ok) redirect(`${page(openingId)}?request=${GATE_NOTICE[gate.code]}`);
  let notice: string;
  try {
    notice = (await markRequestHandled({ id: gate.user.id, orgId: gate.user.orgId }, openingId, requestId)) ? "handled=1" : "request=notfound";
  } catch (error) {
    console.error("[hiring] closing a request failed", error);
    notice = "request=failed";
  }
  revalidatePath(page(openingId));
  redirect(`${page(openingId)}?${notice}`);
}
