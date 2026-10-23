import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, itemResponses, sectionRuns } from "@/db/schema";
import type { ExamCandidateContext } from "@/lib/exam-flow";
import { BANK_IMAGE_KEY } from "./image-refs";
import { imageForSlot } from "./safe";

/**
 * The storage key of the picture a candidate asks for, or null.
 *
 * Only a row the server has served in the invitation's current attempt counts
 * (a planned item that was never reached does not), so a candidate cannot read
 * ahead by guessing sequence numbers. The slot is the opaque id the browser
 * was given (see `toCandidateItem`); it is resolved through the stored
 * presentation, so the key never travels in either direction.
 */
export async function servedImageKey(ctx: ExamCandidateContext, sequence: number, slot: string): Promise<string | null> {
  const [attempt] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(eq(attempts.assessmentId, ctx.assessment.id))
    .orderBy(desc(attempts.attemptNumber))
    .limit(1);
  if (!attempt) return null;
  const rows = await db
    .select({ snapshot: itemResponses.itemSnapshot, presentation: itemResponses.presentation })
    .from(itemResponses)
    .innerJoin(sectionRuns, eq(sectionRuns.id, itemResponses.sectionRunId))
    .where(and(eq(sectionRuns.attemptId, attempt.id), eq(itemResponses.sequence, sequence), eq(itemResponses.notReached, false)));
  for (const row of rows) {
    const key = imageForSlot(row.snapshot, row.presentation, slot)?.storageKey;
    if (key && BANK_IMAGE_KEY.test(key)) return key;
  }
  return null;
}
