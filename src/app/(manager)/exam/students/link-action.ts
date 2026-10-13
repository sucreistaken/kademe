"use server";

import { isUuid } from "@/server/settings";
import { inviteLink } from "@/server/invite";
import { requireUser } from "@/server/session";

export type StudentLinkResult = { ok: true; url: string } | { ok: false; code: "NOT_FOUND" | "USED" | "EXPIRED" | "NOT_RECOVERABLE" | "FAILED" };

/**
 * "Linki kopyala" on a student's row: the invitation's live link again, on
 * demand. The list page never carries links in its markup; the link travels
 * only in this answer, only to someone who may invite students, and every
 * reveal is in the audit log.
 */
export async function studentLinkAction(assessmentId: string): Promise<StudentLinkResult> {
  const user = await requireUser("student:invite");
  if (typeof assessmentId !== "string" || !isUuid(assessmentId)) return { ok: false, code: "NOT_FOUND" };
  try {
    const r = await inviteLink({ orgId: user.orgId, assessmentId, actorId: user.id });
    return r.ok ? { ok: true, url: r.url } : r;
  } catch {
    return { ok: false, code: "FAILED" };
  }
}
