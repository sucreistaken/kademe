import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { loadState, startSection } from "@/lib/exam-flow";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

/**
 * Starts the current section's clock. Idempotent: the deadline is written once
 * and a second call, a double click or a reload leave it where it is.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(req, params, async (request, ctx) => {
    const body = await readJson<{ sectionPosition?: number }>(request);
    const started = await startSection(ctx, body?.sectionPosition ?? -1);
    if (!started.ok) return conflict(ctx, started.code);
    return candidateJson(await loadState(ctx));
  });
}
