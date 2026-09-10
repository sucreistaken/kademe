import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { loadState } from "@/lib/candidate-flow";
import { withCandidate } from "@/lib/candidate-api";

/**
 * The one read every candidate screen is built from: is the link usable, which
 * screen am I on, and how much time is left. Nothing here is derived from what
 * the client claims.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (_req, ctx) =>
    candidateJson(await loadState(ctx)),
  );
}
