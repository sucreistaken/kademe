import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import { withCandidate } from "@/lib/candidate-api";

/**
 * Upload bandwidth probe for the device check, artboard A9.
 *
 * The body is read and thrown away; the only thing that matters is how long the
 * candidate's browser took to send it. Upload rather than download on purpose:
 * this product asks people to send video, and a link that downloads quickly can
 * still be too slow to upload an answer.
 *
 * Nothing is stored and nothing is scored. The row it feeds is advice, and a
 * candidate whose connection cannot be measured is never blocked by it.
 */

/** Enough bytes to measure, small enough to cost a candidate nothing. */
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(req, params, async (request) => {
    const body = await request.arrayBuffer();
    const bytes = Math.min(body.byteLength, MAX_BYTES);
    return candidateJson({ bytes });
  });
}
