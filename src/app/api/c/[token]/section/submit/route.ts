import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { closeSectionRun, currentSection, loadState } from "@/lib/exam-flow";
import { conflict, readJson, withCandidate } from "@/lib/candidate-api";

/**
 * Ends the current section early. Whatever is saved counts, planned items not
 * reached score zero, and the next section's introduction follows.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(req, params, async (request, ctx) => {
    const body = await readJson<{ sectionPosition?: number }>(request);
    const current = await currentSection(ctx);
    if (!current) return conflict(ctx, "NO_SECTION");
    if (current.position !== body?.sectionPosition) return conflict(ctx, "SECTION_MISMATCH");
    if (!current.run?.startedAt) return conflict(ctx, "SECTION_NOT_STARTED");
    await closeSectionRun(current.run.id, "SUBMIT");
    return candidateJson(await loadState(ctx));
  });
}
