import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, examAssessments, itemResponses, sectionRuns } from "@/db/schema";
import { eap, observationOf, replay, replayResponseOf, type Observation } from "@/lib/exam/adaptive";
import { adaptiveConfigFor } from "@/lib/exam/blueprint";
import { isObjectiveSection } from "@/lib/exam/types";

/**
 * Re-derives a closed objective section's ability estimate from the scores now
 * stored on its item responses, after a teacher changed one of them. It
 * mirrors the estimate block of `closeSectionRun` in exam-flow.ts (final
 * posterior, the INSUFFICIENT adjustment, the per-item trajectory of a
 * navigable section) so the same scores always give the same level. Keep the
 * two in step if that block changes. Nothing else on the run is touched, and
 * `stopReason` stays as the engine set it.
 */
export async function reestimateRun(runId: string): Promise<void> {
  const [run] = await db.select().from(sectionRuns).where(eq(sectionRuns.id, runId));
  if (!run || !isObjectiveSection(run.section)) return;
  const [ctx] = await db
    .select({ exam: examAssessments })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, run.attemptId));
  const s = ctx?.exam.blueprintSnapshot.sections.find((x) => x.section === run.section);
  if (!ctx || !s) return;

  const all = await db.select().from(itemResponses).where(eq(itemResponses.sectionRunId, runId));
  const acfg = adaptiveConfigFor(s, ctx.exam.mode, ctx.exam.claimedLevel);
  const prior = { mean: acfg.priorMean, sd: acfg.priorSd };
  const state = replay(
    acfg,
    all.map(replayResponseOf),
  );
  let thetaMean = state.posterior.mean;
  let thetaSd = state.posterior.sd;

  const answered = all.filter((r) => r.answeredAt).length;
  if (s.adaptive && answered < s.minItems) {
    // Items never reached count as wrong, as at the end of the section.
    const observations = all.filter((r) => r.score !== null).map((r) => observationOf(r.itemSnapshot, r.score as number));
    for (let i = 0; i < s.minItems - answered; i++) observations.push({ b: state.posterior.mean, score: 0 });
    const post = eap(observations, prior);
    thetaMean = post.mean;
    thetaSd = post.sd;
  }
  await db.update(sectionRuns).set({ thetaMean, thetaSd }).where(eq(sectionRuns.id, runId));

  if (run.navigable) {
    const observations: Observation[] = [];
    for (const r of [...all].sort((a, b) => a.sequence - b.sequence)) {
      if (r.score === null) continue;
      observations.push(observationOf(r.itemSnapshot, r.score));
      const post = eap(observations, prior);
      await db.update(itemResponses).set({ thetaAfter: post.mean, seAfter: post.sd }).where(eq(itemResponses.id, r.id));
    }
  }
}
