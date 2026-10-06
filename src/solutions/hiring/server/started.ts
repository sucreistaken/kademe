import { and, eq, isNotNull, or } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { attempts, hiringStageRuns } from "@/db/schema";

/**
 * The candidate has begun: an attempt of the invitation started, or one of its
 * stages did. One definition for the two places that ask: a new link on a
 * closed opening (invitations.ts) and the link-problem card (candidate.ts).
 */
export async function hasStarted(x: Executor, assessmentId: string): Promise<boolean> {
  const [started] = await x
    .select({ id: attempts.id })
    .from(attempts)
    .leftJoin(hiringStageRuns, eq(hiringStageRuns.attemptId, attempts.id))
    .where(and(eq(attempts.assessmentId, assessmentId), or(isNotNull(attempts.startedAt), isNotNull(hiringStageRuns.startedAt))))
    .limit(1);
  return !!started;
}
