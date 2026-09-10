import type { NextRequest } from "next/server";
import { db } from "@/db";
import { messageOutbox } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { message, readJson, withCandidate } from "@/lib/candidate-api";

type Body = { area?: string; message?: string };

/**
 * "Bir sorun var" from the candidate side. A candidate whose camera will not
 * open must have somewhere to go other than abandoning the assessment, so the
 * report lands in the manager's outbox queue with enough context to answer it.
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
      const area = (body?.area ?? "GENERAL").slice(0, 40);
      const note = (body?.message ?? "").slice(0, 2000);

      await db.insert(messageOutbox).values({
        orgId: ctx.assessment.orgId,
        kind: "CANDIDATE_PROBLEM",
        toEmail: ctx.candidate.email ?? "bilinmiyor",
        subject: `Aday sorun bildirdi: ${ctx.candidate.fullName ?? "isimsiz"} (${area})`,
        body:
          `Aday: ${ctx.candidate.fullName ?? "-"} <${ctx.candidate.email ?? "-"}>\n` +
          `Alan: ${area}\n` +
          `Mesaj: ${note || "-"}\n` +
          `Tarayıcı: ${request.headers.get("user-agent") ?? "-"}`,
      });

      return candidateJson({
        received: true,
        message: message(ctx.locale, "PROBLEM_RECEIVED"),
      });
    },
    {
      limit: 5,
      windowMs: 60_000,
      allowProblems: ["EXPIRED", "NOT_YET", "COMPLETED"],
    },
  );
}
