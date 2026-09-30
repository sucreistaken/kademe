import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sectionRuns } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { currentSection } from "@/lib/exam-flow";
import { withCandidate } from "@/lib/candidate-api";

/** Keeps the student's clock anchored to the server's. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(
    req,
    params,
    async (_request, ctx) => {
      const current = await currentSection(ctx);
      const run = current?.run;
      if (run?.startedAt && !run.submittedAt) {
        await db.update(sectionRuns).set({ lastHeartbeatAt: new Date() }).where(eq(sectionRuns.id, run.id));
      }
      const now = new Date();
      return candidateJson({
        serverNow: now.toISOString(),
        deadlineAt: run?.deadlineAt?.toISOString() ?? null,
        remainingMs: run?.deadlineAt ? Math.max(0, run.deadlineAt.getTime() - now.getTime()) : null,
      });
    },
    { limit: 120 },
  );
}
