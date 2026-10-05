"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assessmentLinks, assessments, auditLogs } from "@/db/schema";
import { safeBack, withQuery } from "@/lib/redirect";
import { requireUser } from "@/server/session";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gives a not-yet-opened exam link seven more days (Today's "7 gün uzat").
 * Only an exam invitation of the session's organisation: hiring links get
 * their own extend on the opening (ruling C8), so a hiring link id here is
 * treated like an unknown one (Task 17 fix round 1).
 */
export async function extendLink(formData: FormData) {
  const user = await requireUser("student:invite");
  const linkId = String(formData.get("linkId") ?? "");
  const back = safeBack(formData.get("back"));
  const [row] = await db
    .select({ link: assessmentLinks })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .where(and(eq(assessmentLinks.id, linkId), eq(assessments.orgId, user.orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  if (!row) redirect(back);
  const next = new Date(Math.max(Date.now(), row.link.expiresAt.getTime()) + 7 * DAY_MS);
  await db
    .update(assessmentLinks)
    .set({ expiresAt: next, status: row.link.status === "EXPIRED" ? "NOT_STARTED" : row.link.status })
    .where(eq(assessmentLinks.id, linkId));
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "link.extend",
    subjectType: "assessment_link",
    subjectId: linkId,
    meta: { from: row.link.expiresAt.toISOString(), to: next.toISOString() },
  });
  revalidatePath(back);
  redirect(withQuery(back, { extended: "1" }));
}
