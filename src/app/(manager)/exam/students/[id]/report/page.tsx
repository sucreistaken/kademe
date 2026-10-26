import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/panel/report/print-button";
import { ReportSheet } from "@/components/panel/report/report-sheet";
import { buildReport, TEACHER_COPY_LOCALE } from "@/components/panel/report/model";
import { buildDetail } from "@/components/panel/report/detail-model";
import { DetailSheet } from "@/components/panel/report/detail-sheet";
import { StudentSheet } from "@/components/candidate/exam/student-sheet";
import { examDateOf, studentSheetDate } from "@/lib/exam/sheet-date";
import { studentFacingFeedback } from "@/lib/exam/student-feedback";
import type { StudentResult } from "@/lib/exam-flow";
import { loadStudentAnalysis } from "@/server/student-analysis";
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
 *
 * Language: the toolbar and the hints around a sheet follow the panel language
 * (`t`); the teacher copy itself is always German (`sheetT`), and the student
 * copy is in the student's own language.
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
  const sheetT = managerT(TEACHER_COPY_LOCALE);
  const { id } = await params;
  // The detailed part is on unless the manager turned it off (?detail=0).
  const sp = await searchParams;
  const withDetail = sp.detail !== "0";
  // ?copy=student prints the student's sheet (the analysis, no questions or keys); the default is the teacher copy.
  const studentCopy = sp.copy === "student";
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
      examDate: examDateOf(attempt),
      sections: view.sections,
      finalOverall: result?.finalOverall,
      skillLevels,
      mode: assessment.mode,
      placement: result?.computed?.placement ?? null,
      teacherName: result?.finalizedBy ? (view.nameOf[result.finalizedBy] ?? null) : null,
      finalizedAt: result?.finalizedAt ?? null,
      attemptId: attempt.id,
      feedback: result?.studentFeedback ?? null,
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
  const detail = withDetail && !studentCopy
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

  const copyLinks = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {studentCopy ? (
        <PrintButton label={t("resultReport.copyStudent")} />
      ) : (
        <Link href={`/exam/students/${id}/report?copy=student`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          {t("resultReport.copyStudent")}
        </Link>
      )}
      {studentCopy ? (
        <Link href={`/exam/students/${id}/report`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          {t("resultReport.copyTeacher")}
        </Link>
      ) : (
        <PrintButton label={t("resultReport.copyTeacher")} />
      )}
    </div>
  );

  if (studentCopy) {
    const cfg = assessment.blueprintSnapshot;
    const analysis = await loadStudentAnalysis(user.orgId, attempt.id, view.sections, assessment.locale);
    const levelShown = result?.levelShown ?? cfg.resultVisibility !== "NONE";
    const studentResult: StudentResult = {
      visibility: cfg.resultVisibility,
      released: true,
      awaitingTeacher: false,
      levelShown,
      overall: built.model.overall,
      outcome: levelShown ? (result?.finalOutcome ?? null) : undefined,
      skills: cfg.resultVisibility === "FULL" ? built.model.skills : undefined,
      analysis: analysis ?? undefined,
      feedback: studentFacingFeedback(result?.studentFeedback),
    };
    return (
      <main className="report-wrap bg-canvas px-6 py-8">
        <div className="report-toolbar mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-4">
          <div>
            {back}
            <p className="mt-1 text-[12.5px] text-muted">{t("resultReport.studentCopyHint")}</p>
          </div>
          {copyLinks}
        </div>
        <StudentSheet
          schoolName={built.model.schoolName}
          studentName={built.model.studentName}
          examName={built.model.examName}
          date={studentSheetDate({ finalizedAt: built.model.finalizedAt, examDate: built.model.examDate })}
          result={studentResult}
          locale={assessment.locale}
        />
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
        <div className="flex flex-col items-end gap-1">
          {copyLinks}
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
      <ReportSheet model={built.model} t={sheetT} locale={TEACHER_COPY_LOCALE} />
      <DetailSheet sections={detail} studentName={built.model.studentName} t={sheetT} locale={TEACHER_COPY_LOCALE} />
    </main>
  );
}
