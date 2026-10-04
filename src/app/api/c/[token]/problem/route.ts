import type { NextRequest } from "next/server";
import { db } from "@/db";
import { messageOutbox } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { message, readJson } from "@/lib/candidate-api";
import { withExamCandidate } from "@/lib/exam-candidate-api";

type Body = { area?: string; message?: string };

/**
 * "Bir sorun var" from the candidate side. A candidate whose camera will not
 * open must have somewhere to go other than abandoning the assessment, so the
 * report lands in the manager's outbox queue with enough context to answer it.
 *
 * It is addressed to the hiring team (`ctx.contactEmail`: the recruiter who
 * sent the link, or the org fallback). The candidate's own address goes in the
 * body so the team can reply; it used to be the recipient, which mailed the
 * complaint back to the person who made it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withExamCandidate(
    req,
    params,
    async (request, ctx) => {
      const body = await readJson<Body>(request);
      const area = (body?.area ?? "GENERAL").slice(0, 40);
      const note = (body?.message ?? "").slice(0, 2000);

      await db.insert(messageOutbox).values({
        orgId: ctx.assessment.orgId,
        kind: "STUDENT_PROBLEM",
        toEmail: ctx.contactEmail ?? "okul@kademe.local",
        subject: `Öğrenci sorun bildirdi: ${ctx.candidate.fullName ?? "isimsiz"} (${area})`,
        body:
          `Öğrenci: ${ctx.candidate.fullName ?? "-"} <${ctx.candidate.email ?? "-"}>\n` +
          `Sınav: ${ctx.assessment.examName}\n` +
          `Cevap adresi: ${ctx.candidate.email ?? "bilinmiyor"}\n` +
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
