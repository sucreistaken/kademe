import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkItem, checkSection, loadState, moveTo, saveDraft } from "@/lib/exam-flow";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { sectionPosition?: number; sequence?: number; answer?: unknown; to?: unknown };

/**
 * Navigable sections: moves the screen to another item (`to` is its sequence)
 * or to the review step (`to: "REVIEW"`), first keeping the answer of the item
 * being left as a draft. Nothing is scored here; a one-way section refuses.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const section = await checkSection(ctx, body?.sectionPosition);
      if (!section.ok) return conflict(ctx, section.code);
      if (body?.sequence !== undefined && body.answer !== undefined) {
        const check = await checkItem(section.run, body.sequence);
        if (!check.ok) return conflict(ctx, check.code);
        await saveDraft(ctx, check.response, body.answer);
      }
      if (!(await moveTo(section.run, body?.to))) return conflict(ctx, "ITEM_MISMATCH");
      return candidateJson(await loadState(ctx));
    },
    { limit: 600 },
  );
}
