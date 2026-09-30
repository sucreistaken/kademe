import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkWrite, saveDraft } from "@/lib/exam-flow";
import { conflict, readJson, withCandidate } from "@/lib/candidate-api";

type Body = { sectionPosition?: number; sequence?: number; answer?: unknown };

/** Autosave of the open item. Nothing is scored until the student moves on. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const check = await checkWrite(ctx, body?.sectionPosition, body?.sequence);
      if (!check.ok) return conflict(ctx, check.code);
      await saveDraft(ctx, check.response, body?.answer);
      return candidateJson({ saved: true, at: new Date().toISOString() });
    },
    { limit: 600 },
  );
}
