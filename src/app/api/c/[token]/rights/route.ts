import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidateRequests, deletionRequests } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { badRequest, message, readJson, withCandidate } from "@/lib/candidate-api";
import { manifestByKind } from "@/solutions/registry";

const Body = z.object({
  kind: z.enum(["ACCESS", "COPY", "DELETE", "ACCOMMODATION"]),
  message: z.string().optional(),
});

/**
 * candidate_requests.message carries a 2000-character CHECK; a longer note is
 * refused here with a 400 instead of failing the insert. `.max` counts UTF-16
 * units, never fewer than the characters Postgres counts, so a note that
 * passes always fits.
 */
const RequestMessage = z.string().max(2000);

/**
 * The candidate asking to see, copy or delete their data, or (where the
 * solution reads them) for an accommodation. Data rights requests land in
 * deletion_requests as before; an accommodation lands in candidate_requests,
 * in the invitation's organisation (ruling C7). Nothing is deleted or changed
 * automatically from here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const parsed = Body.safeParse(await readJson<unknown>(request));
      if (!parsed.success) return badRequest(ctx, "KIND_REQUIRED");
      const { kind, message: note = "" } = parsed.data;

      if (kind === "ACCOMMODATION") {
        if (manifestByKind(ctx.assessment.solution)?.accommodationRequests !== true) {
          return badRequest(ctx, "KIND_REQUIRED");
        }
        const bounded = RequestMessage.safeParse(note);
        if (!bounded.success) return badRequest(ctx, "MESSAGE_TOO_LONG");
        await db.insert(candidateRequests).values({
          orgId: ctx.assessment.orgId,
          assessmentId: ctx.assessment.id,
          kind,
          message: bounded.data || null,
        });
      } else {
        await db.insert(deletionRequests).values({
          candidateId: ctx.candidate.id,
          kind,
          message: note.slice(0, 2000) || null,
        });
      }
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
