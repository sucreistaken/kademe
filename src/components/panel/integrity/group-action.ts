"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assessments, attempts, auditLogs, proctorEvents } from "@/db/schema";
import { isProctorEventType } from "@/lib/proctor/taxonomy";
import { recomputeIntegrity } from "@/server/proctoring";
import { requireUser } from "@/server/session";

/**
 * Confirm or dismiss every still-open event of one flag type in one attempt.
 * Events the teacher already ruled on are left alone, so a group bulk action
 * never overwrites an earlier single decision. Org and solution scoped like
 * `decideFlag`; one audit row per click carries the type and the row count.
 */
export async function decideFlagGroup(formData: FormData) {
  const user = await requireUser("integrity:decide");
  const assessmentId = String(formData.get("assessmentId"));
  const type = String(formData.get("type"));
  const status = String(formData.get("status"));
  const back = `/exam/students/${assessmentId}?tab=integrity`;
  if (!isProctorEventType(type) || !["CONFIRMED", "DISMISSED"].includes(status)) redirect(back);
  const [row] = await db
    .select({ attemptId: attempts.id })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(and(eq(assessments.id, assessmentId), eq(assessments.orgId, user.orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  if (!row) redirect("/exam/students");
  const changed = await db
    .update(proctorEvents)
    .set({ teacherStatus: status as "CONFIRMED" | "DISMISSED", decidedBy: user.id, decidedAt: new Date() })
    .where(and(eq(proctorEvents.attemptId, row.attemptId), eq(proctorEvents.type, type), sql`${proctorEvents.teacherStatus} = 'OPEN'`))
    .returning({ id: proctorEvents.id });
  if (changed.length > 0) {
    await db.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: `integrity.flag_group_${status.toLowerCase()}`,
      subjectType: "attempt",
      subjectId: row.attemptId,
      meta: { type, events: changed.length },
    });
    await recomputeIntegrity(row.attemptId);
  }
  revalidatePath(back);
  redirect(back);
}
