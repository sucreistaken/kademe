import type { NextRequest } from "next/server";
import { db } from "@/db";
import { messageOutbox } from "@/db/schema";
import { candidateJson } from "@/lib/candidate-safe";
import { message, readJson, withSolution } from "@/lib/candidate-api";
import { fileCandidateRequest } from "@/server/candidate-requests";

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
 *
 * The mail keeps the exam's wording for exam invitations and reads neutrally
 * for every other solution, named by its label (ruling C28). "Yeni link iste"
 * (area LINK) also files a NEW_LINK candidate request where the solution reads
 * them (ruling C7), so the team sees it next to the candidate.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return withSolution(
    req,
    params,
    async (request, ctx, solution) => {
      const body = await readJson<Body>(request);
      const area = (body?.area ?? "GENERAL").slice(0, 40);
      const note = (body?.message ?? "").slice(0, 2000);

      const title = await solution.candidate.title(ctx);
      const exam = solution.dbKind === "LANGUAGE_EXAM";
      const person = exam ? "Öğrenci" : "Aday";
      const assessmentLine = exam ? `Sınav: ${title}` : `Değerlendirme: ${solution.label.tr} · ${title}`;

      await db.insert(messageOutbox).values({
        orgId: ctx.assessment.orgId,
        kind: "STUDENT_PROBLEM",
        toEmail: ctx.contactEmail ?? "okul@kademe.local",
        subject: `${person} sorun bildirdi: ${ctx.candidate.fullName ?? "isimsiz"} (${area})`,
        body:
          `${person}: ${ctx.candidate.fullName ?? "-"} <${ctx.candidate.email ?? "-"}>\n` +
          `${assessmentLine}\n` +
          `Cevap adresi: ${ctx.candidate.email ?? "bilinmiyor"}\n` +
          `Alan: ${area}\n` +
          `Mesaj: ${note || "-"}\n` +
          `Tarayıcı: ${request.headers.get("user-agent") ?? "-"}`,
      });

      // The outbox row alone reaches nobody until mail exists. `note` is at most
      // 2000 UTF-16 units, so it always fits candidate_requests' 2000 CHECK.
      // While one NEW_LINK request is open a second is not filed; the answer
      // is the same (fileCandidateRequest).
      if (area === "LINK" && solution.accommodationRequests) {
        await fileCandidateRequest({
          orgId: ctx.assessment.orgId,
          assessmentId: ctx.assessment.id,
          kind: "NEW_LINK",
          message: note || null,
        });
      }

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
