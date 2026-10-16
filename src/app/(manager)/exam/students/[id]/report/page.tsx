import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { PrintButton } from "@/components/panel/report/print-button";
import { ReportSheet } from "@/components/panel/report/report-sheet";
import { buildReport } from "@/components/panel/report/model";
import { buildDetail } from "@/components/panel/report/detail-model";
import { DetailSheet } from "@/components/panel/report/detail-sheet";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { resolveSigningSecret } from "@/lib/signing-secret";
import { loadResultView } from "@/server/panel";
import { loadAcceptances } from "@/server/result-review";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * One student's printable level report. Same audience and org scope as the
 * result page (`loadResultView` filters by the user's org), and it exists only
 * for a FINAL result: anything else gets the reason instead of a sheet.
 */
export default async function ResultReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  // The detailed part is on unless the manager turned it off (?detail=0).
  const withDetail = (await searchParams).detail !== "0";
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

  // Everything below comes from the org-scoped result view and org-scoped acceptances.
  const detail = withDetail
    ? buildDetail({
        sections: view.sections,
        skillLevels,
        runs: view.runs,
        responses: view.responses,
        gradings: view.gradings,
        acceptances: await loadAcceptances(user.orgId, view.responses.map((r) => r.id)),
        transcripts: Object.fromEntries(view.transcripts.map((x) => [x.mediaAssetId, x.text])),
        nameOf: view.nameOf,
      })
    : [];

  return (
    <main className="report-wrap bg-canvas px-6 py-8">
      <div className="report-toolbar mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-4">
        <div>
          {back}
          <p className="mt-1 text-[12.5px] text-muted">{t("resultReport.printHint")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PrintButton label={t("resultReport.print")} />
          <Link
            href={withDetail ? `/exam/students/${id}/report?detail=0` : `/exam/students/${id}/report`}
            className="inline-flex items-center gap-2 text-[13px] text-ink"
            title={t("resultReport.detailHint")}
          >
            <span aria-hidden className="inline-flex size-4 items-center justify-center rounded-[4px] border border-line-strong bg-surface text-[12px] leading-none">
              {withDetail ? "\u2713" : ""}
            </span>
            {t("resultReport.detailToggle")}
          </Link>
        </div>
      </div>
      <ReportSheet model={built.model} t={t} locale={locale} />
      <DetailSheet sections={detail} studentName={built.model.studentName} t={t} locale={locale} />
    </main>
  );
}
