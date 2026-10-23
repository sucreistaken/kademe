import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/panel/report/print-button";
import { candidateT } from "@/i18n/candidate";
import { loadState, resolveExamToken } from "@/lib/exam-flow";
import { StudentSheet } from "./student-sheet";

export const dynamic = "force-dynamic";

/**
 * The student's printable result: the analysis, no questions, no keys. Only for
 * a finished exam whose result the teacher released; anything else goes back to
 * the finish screen, which says what is still pending.
 */
export default async function StudentPrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveExamToken(token);
  const ctx = resolved.ctx;
  if (!ctx || (!resolved.ok && resolved.problem !== "COMPLETED")) notFound();
  const state = await loadState(ctx);
  const result = state.finished?.result;
  if (!state.finished || state.finished.terminated || !result?.released || !result.analysis) redirect(`/a/${encodeURIComponent(token)}/done`);
  const locale = ctx.locale;
  const t = candidateT(locale);
  return (
    <main className="report-wrap bg-canvas px-6 py-8">
      <div className="report-toolbar mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-4">
        <div>
          <Link href={`/a/${encodeURIComponent(token)}/done`} className="text-[13px] text-muted hover:text-ink">
            {t("analysis.back")}
          </Link>
          <p className="mt-1 text-[12.5px] text-muted">{t("analysis.printHint")}</p>
        </div>
        <PrintButton label={t("analysis.print")} />
      </div>
      <StudentSheet
        schoolName={state.orgName}
        studentName={ctx.candidate.fullName ?? ""}
        examName={state.examName}
        date={state.finished ? new Date() : null}
        result={result}
        locale={locale}
      />
    </main>
  );
}
