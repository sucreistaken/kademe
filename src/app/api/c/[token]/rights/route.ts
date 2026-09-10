import type { NextRequest } from "next/server";
import { db } from "@/db";
import { deletionRequests } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { badRequest, message, readJson, withCandidate } from "@/lib/candidate-api";

type Body = { kind?: "ACCESS" | "DELETE" | "COPY"; message?: string };

/**
 * The candidate asking to see, copy or delete their data. It lands in the
 * manager's queue; nothing is deleted automatically from here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const kind = body?.kind;
      if (kind !== "ACCESS" && kind !== "DELETE" && kind !== "COPY") {
        return badRequest(ctx, "KIND_REQUIRED");
      }
      await db.insert(deletionRequests).values({
        candidateId: ctx.candidate.id,
        kind,
        message: (body?.message ?? "").slice(0, 2000) || null,
      });
      return candidateJson({
        received: true,
        message: message(ctx.locale, "RIGHTS_RECEIVED"),
      });
    },
    {
      limit: 10,
      windowMs: 60_000,
      allowProblems: ["EXPIRED", "NOT_YET", "COMPLETED"],
    },
  );
}
