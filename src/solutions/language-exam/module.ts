import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { examAssessments, itemResponses, sectionRuns } from "@/db/schema";
import type { CandidateContext } from "@/lib/candidate-context";
import {
  closeSectionRun,
  currentSection,
  finishAttempt,
  loadExamContext,
  loadState,
  type ExamCandidateContext,
} from "@/lib/exam-flow";
import { reopenGradingForMedia } from "@/lib/exam-results";
import type { SolutionModule } from "@/solutions/types";
import { languageExamManifest } from "./manifest";
import { examToday } from "./today";

async function requireExam(ctx: CandidateContext): Promise<ExamCandidateContext> {
  const exam = await loadExamContext(ctx);
  if (!exam) throw new Error(`assessment ${ctx.assessment.id} has no exam terms`);
  return exam;
}

/**
 * The language exam as the core sees it. Each method is the code that used to
 * sit in a core route or in proctoring.ts, moved here unchanged in behaviour.
 */
export const languageExamModule: SolutionModule = {
  ...languageExamManifest,
  today: examToday,

  async proctorPolicy(assessmentId) {
    const [row] = await db
      .select({ config: examAssessments.blueprintSnapshot })
      .from(examAssessments)
      .where(eq(examAssessments.assessmentId, assessmentId))
      .limit(1);
    // The exam always returns its frozen policy, preset OFF included: core code
    // checks `preset` exactly as before. Null only for a missing exam row.
    return row?.config.proctoring ?? null;
  },

  candidate: {
    async loadState(ctx) {
      return loadState(await requireExam(ctx));
    },
    async title(ctx) {
      return (await requireExam(ctx)).assessment.examName;
    },
    async heartbeat(ctx) {
      const current = await currentSection(await requireExam(ctx));
      const run = current?.run;
      if (run?.startedAt && !run.submittedAt) {
        await db.update(sectionRuns).set({ lastHeartbeatAt: new Date() }).where(eq(sectionRuns.id, run.id));
      }
      return { deadlineAt: run?.deadlineAt ?? null };
    },
  },

  attempts: {
    async openSegment(attemptId) {
      const [run] = await db
        .select({ id: sectionRuns.id })
        .from(sectionRuns)
        .where(and(eq(sectionRuns.attemptId, attemptId), isNotNull(sectionRuns.startedAt), isNull(sectionRuns.submittedAt)))
        .limit(1);
      return run ? { kind: "section_run", runId: run.id } : null;
    },
    async terminate(attemptId) {
      const runs = await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId));
      for (const r of runs.filter((x) => x.startedAt && !x.submittedAt)) await closeSectionRun(r.id, "SUBMIT");
      await finishAttempt(attemptId);
    },
    async onMediaComplete(asset) {
      if (!asset.itemResponseId) return;
      const [response] = await db.select().from(itemResponses).where(eq(itemResponses.id, asset.itemResponseId));
      if (!response) return;
      // The newest take is the answer. It supersedes a typed alternative.
      const answer = { ...(response.answer ?? {}), mediaAssetId: asset.id };
      delete answer.usedTextAlternative;
      await db.update(itemResponses).set({ answer, updatedAt: new Date() }).where(eq(itemResponses.id, response.id));
      await reopenGradingForMedia(response.id);
    },
  },
};
