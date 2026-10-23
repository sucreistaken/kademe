import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, itemResponses, sectionRuns } from "@/db/schema";
import type { ExamCandidateContext } from "@/lib/exam-flow";
import { enabledSections } from "./blueprint";
import { BANK_IMAGE_KEY } from "./image-refs";
import { imageForSlot } from "./safe";
import type { ItemSnapshot, Presentation, Section } from "./types";

type ServedRow = { snapshot: ItemSnapshot; presentation: Presentation };

/** The two reads the lookup needs, injectable so the run scoping is testable without a database. */
export type ImageLookupData = {
  /** The runs of the invitation's latest attempt. */
  runsOfLatestAttempt(assessmentId: string): Promise<Array<{ id: string; section: Section }>>;
  /** The served (not "not reached") item of one run at a sequence. */
  servedItem(runId: string, sequence: number): Promise<ServedRow[]>;
};

const dbData: ImageLookupData = {
  async runsOfLatestAttempt(assessmentId) {
    const [attempt] = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.assessmentId, assessmentId)).orderBy(desc(attempts.attemptNumber)).limit(1);
    if (!attempt) return [];
    return db.select({ id: sectionRuns.id, section: sectionRuns.section }).from(sectionRuns).where(eq(sectionRuns.attemptId, attempt.id));
  },
  async servedItem(runId, sequence) {
    return db
      .select({ snapshot: itemResponses.itemSnapshot, presentation: itemResponses.presentation })
      .from(itemResponses)
      .where(and(eq(itemResponses.sectionRunId, runId), eq(itemResponses.sequence, sequence), eq(itemResponses.notReached, false)));
  },
};

/**
 * The storage key of the picture a candidate asks for, or null.
 *
 * An item is named the way the other exam routes name it: section position
 * plus sequence. The sequence is numbered per section run, so it means
 * nothing without the position; the lookup is confined to that one run of the
 * invitation's current attempt. Only an item the server has served counts, so
 * a candidate cannot read ahead by guessing. The slot is the opaque id the
 * browser was given (see `toCandidateItem`) and is resolved through the stored
 * presentation; the key never travels in either direction.
 */
export async function servedImageKey(
  ctx: Pick<ExamCandidateContext, "assessment">,
  position: number,
  sequence: number,
  slot: string,
  data: ImageLookupData = dbData,
): Promise<string | null> {
  const section = enabledSections(ctx.assessment.config)[position - 1]?.section;
  if (!section) return null;
  const run = (await data.runsOfLatestAttempt(ctx.assessment.id)).find((r) => r.section === section);
  if (!run) return null;
  for (const row of await data.servedItem(run.id, sequence)) {
    const key = imageForSlot(row.snapshot, row.presentation, slot)?.storageKey;
    if (key && BANK_IMAGE_KEY.test(key)) return key;
  }
  return null;
}
