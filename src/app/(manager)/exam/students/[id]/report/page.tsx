import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { PrintButton } from "@/components/panel/report/print-button";
import { ReportSheet } from "@/components/panel/report/report-sheet";
import { buildReport } from "@/components/panel/report/model";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { resolveSigningSecret } from "@/lib/signing-secret";
import { loadResultView } from "@/server/panel";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * One student's printable level report. Same audience and org scope as the
 * result page (`loadResultView` filters by the user's org), and it exists only
 * for a FINAL result: anything else gets the reason instead of a sheet.
 */
export default async function ResultReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const view = await loadResultView(user.orgId, id);
  if (!view || !view.attempt) notFound();
  const { assessment, candidate, attempt, result } = view;
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, user.orgId));

  const skillLevels: Record<string, string> = {};
  for (const [section, s] of Object.entries(result?.finalSkills ?? {})) skillLevels[section] = s.level;
  const built = buildReport(
    {
      status: result?.status,
      schoolName: org?.name ?? "Kademe",
      studentName: candidate.fullName ?? "-",
      examName: assessment.blueprintName,
      examDate: attempt.completedAt ?? attempt.startedAt,
      sections: view.sections,
      finalOverall: result?.finalOverall,
      skillLevels,
      mode: assessment.mode,
      placement: result?.computed?.placement ?? null,
      teacherName: result?.finalizedBy ? (view.nameOf[result.finalizedBy] ?? null) : null,
      finalizedAt: result?.finalizedAt ?? null,
      attemptId: attempt.id,
    },
    resolveSigningSecret(process.env),
  );

  const back = (
    <Link href={`/exam/students/${id}`} className="text-[13px] text-muted hover:text-ink">
      {t("resultReport.back")}
    </Link>
  );

  if (!built.ok) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-8">
        {back}
        <p className="mt-6 text-[14px] text-ink-2">{t("resultReport.notFinal")}</p>
      </main>
    );
  }

  return (
    <main className="report-wrap bg-canvas px-6 py-8">
      <div className="report-toolbar mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-4">
        <div>
          {back}
          <p className="mt-1 text-[12.5px] text-muted">{t("resultReport.printHint")}</p>
        </div>
        <PrintButton label={t("resultReport.print")} />
      </div>
      <ReportSheet model={built.model} t={t} locale={locale} />
    </main>
  );
}
