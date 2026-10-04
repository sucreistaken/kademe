import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkWrite, commitAnswer, loadState } from "@/lib/exam-flow";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { sectionPosition?: number; sequence?: number; answer?: unknown };

/**
 * Closes the open item with the given answer and returns the next screen. The
 * reply never says whether the answer was right: the engine knows, the student
 * does not, and the teacher sees it in the report.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<Body>(request);
    const check = await checkWrite(ctx, body?.sectionPosition, body?.sequence);
    if (!check.ok) return conflict(ctx, check.code);
    await commitAnswer(ctx, check.run, check.response, body?.answer);
    return candidateJson(await loadState(ctx));
  });
}
