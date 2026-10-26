import { AnalysisView } from "@/components/candidate/exam/AnalysisView";
import { BrandMark } from "@/components/visual/brand-mark";
import { candidateT } from "@/i18n/candidate";
import { dirOf, type CandidateLocale } from "@/i18n/locale";
import type { StudentResult } from "@/lib/exam-flow";
import { candidateExamName } from "@/lib/exam/candidate-exam-name";

/**
 * The student's copy of the result: the same analysis as the finish screen on
 * an A4 sheet, in the student's language. It has no questions, no answers and
 * no keys (owner, 2026-10-23); the teacher's copy is the question-by-question
 * report. The teacher prints this same sheet from the panel with `?copy=student`.
 */
const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; height: auto !important; }
  [data-slot="sidebar-wrapper"] > :not(:last-child),
  [data-slot="sidebar-wrapper"] header,
  .report-toolbar { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-wrapper"] > div { min-height: 0 !important; }
  .report-wrap { padding: 0 !important; margin: 0 !important; }
  .student-sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; width: 210mm !important; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

const dayFmt = (d: Date, locale: CandidateLocale) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);

export function StudentSheet({
  schoolName,
  studentName,
  examName,
  date,
  result,
  locale,
}: {
  schoolName: string;
  studentName: string;
  examName: string;
  date: Date | null;
  result: StudentResult;
  locale: CandidateLocale;
}) {
  const t = candidateT(locale);
  const an = (key: string, values?: Record<string, string | number>) => t(`analysis.${key}` as never, values as never);
  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        lang={locale}
        dir={dirOf(locale)}
        className="student-sheet mx-auto flex w-[210mm] max-w-full min-h-[296mm] flex-col rounded-[16px] border border-line bg-white px-[16mm] py-[14mm] text-ink shadow-panel"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <div className="text-[20px] font-bold tracking-[-0.01em]">{schoolName}</div>
          </div>
          <div className="text-end">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{an("printTitle")}</div>
            {date ? <div className="tnum text-[12.5px] text-muted">{dayFmt(date, locale)}</div> : null}
          </div>
        </div>

        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.06em] text-muted">{an("studentLabel")}</div>
          <h1 className="mt-1 break-words text-headline">{studentName}</h1>
          <div className="mt-3 text-[13.5px]">
            <div className="text-[12px] uppercase tracking-[0.06em] text-muted">{an("examLabel")}</div>
            {/* A template's default name is stored in the manager's language; the student reads it in theirs. */}
            <div className="mt-0.5 font-medium">{candidateExamName(examName, locale)}</div>
          </div>
        </div>

        <AnalysisView result={result} t={an as never} sectionName={(s) => t(`section.${s}` as never)} className="mt-8" />
      </article>
    </>
  );
}
