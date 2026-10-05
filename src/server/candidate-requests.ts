import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { candidateRequests } from "@/db/schema";

/** Separates this lock's keys from any other advisory lock (pg_advisory_xact_lock(int, int)). */
const REQUEST_LOCK_CLASS = 0x52455155; // "REQU"

/**
 * Files a candidate's request (accommodation, new link) in the invitation's
 * organisation (ruling C7), once: while a request of the same kind of the same
 * invitation is open, a second one is not inserted (ledger, Task 3 carry), and
 * the candidate gets the same "received" answer either way. Two requests sent
 * at once are ordered by a transaction advisory lock on (invitation, kind), so
 * the second sees the first. `message` must fit the table's 2000-character
 * CHECK (the routes bound it). Pass the caller's transaction as `x` to file
 * the request together with the caller's own writes (the lock is then held
 * until that transaction ends); without it the call runs its own.
 */
export async function fileCandidateRequest(
  input: {
    orgId: string;
    assessmentId: string;
    kind: "ACCOMMODATION" | "NEW_LINK";
    message: string | null;
  },
  x?: Executor,
): Promise<{ filed: boolean }> {
  const run = async (tx: Executor) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${REQUEST_LOCK_CLASS}, hashtext(${input.assessmentId}::text || ':' || ${input.kind}::text))`,
    );
    const [open] = await tx
      .select({ id: candidateRequests.id })
      .from(candidateRequests)
      .where(
        and(
          eq(candidateRequests.orgId, input.orgId),
          eq(candidateRequests.assessmentId, input.assessmentId),
          eq(candidateRequests.kind, input.kind),
          isNull(candidateRequests.handledAt),
        ),
      )
      .limit(1);
    if (open) return { filed: false };
    await tx.insert(candidateRequests).values({ orgId: input.orgId, assessmentId: input.assessmentId, kind: input.kind, message: input.message });
    return { filed: true };
  };
  return x ? run(x) : db.transaction(run);
}
