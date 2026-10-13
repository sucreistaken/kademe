import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { checkSection, setFlag } from "@/lib/exam-flow";
import { conflict, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { sectionPosition?: number; sequence?: number; flagged?: unknown };

/**
 * Navigable sections: marks or unmarks an item to come back to. Answers with
 * the new mark only, so a draft being typed on screen is not replaced by a
 * fresh state.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withExamCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const section = await checkSection(ctx, body?.sectionPosition);
      if (!section.ok) return conflict(ctx, section.code);
      const flagged = body?.flagged === true;
      if (!(await setFlag(section.run, body?.sequence, flagged))) return conflict(ctx, "ITEM_MISMATCH");
      return candidateJson({ sequence: body?.sequence, flagged });
    },
    { limit: 600 },
  );
}
