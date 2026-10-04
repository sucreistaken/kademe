import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { withSolution } from "@/lib/candidate-api";

/** Keeps the student's clock anchored to the server's. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(
    req,
    params,
    async (_request, ctx, solution) => {
      const { deadlineAt } = await solution.candidate.heartbeat(ctx);
      const now = new Date();
      return candidateJson({
        serverNow: now.toISOString(),
        deadlineAt: deadlineAt?.toISOString() ?? null,
        remainingMs: deadlineAt ? Math.max(0, deadlineAt.getTime() - now.getTime()) : null,
      });
    },
    { limit: 120 },
  );
}
