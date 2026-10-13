import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { closeSectionRun, currentSection, loadState } from "@/lib/exam-flow";
import { canFinish } from "@/lib/exam/navigation";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

/**
 * Ends the current section. Whatever is saved counts, planned items not
 * reached score zero, and the next section's introduction follows. A
 * navigable section ends only from its review step; a tab that is not on it
 * is behind the exam and is told so.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<{ sectionPosition?: number }>(request);
    const current = await currentSection(ctx);
    if (!current) return conflict(ctx, "NO_SECTION");
    if (current.position !== body?.sectionPosition) return conflict(ctx, "SECTION_MISMATCH");
    if (!current.run?.startedAt) return conflict(ctx, "SECTION_NOT_STARTED");
    if (!canFinish({ navigable: current.run.navigable, review: current.run.navReview })) return conflict(ctx, "SECTION_MISMATCH");
    await closeSectionRun(current.run.id, "SUBMIT");
    return candidateJson(await loadState(ctx));
  });
}
