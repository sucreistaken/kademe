import { confirmCourseGrading, setCourseCommonErrors, setCourseGradingPoints } from "@/app/(manager)/exam/students/[id]/course-actions";
import type { managerT } from "@/i18n/manager";
import { COMMON_WRITING_ERRORS, CRITERION_LABEL_DE, type CommonWritingError, type CoursePoints, type CourseRubricProposal } from "@/lib/exam/course/types";
import { CourseGradingEditor } from "./grading-editor";
import {
  COMMON_ERROR_IDS,
  criteriaOf,
  criterionMax,
  editorCriteria,
  isDecidedStatus,
  pointsTotal,
  proposalPoints,
  rubricMax,
  type CourseGradingStatus,
  type GradedSection,
} from "./grading-model";

type T = ReturnType<typeof managerT>;

/** The part of a grading row the panel reads. */
export type PanelGrading = {
  id: string;
  status: CourseGradingStatus;
  courseProposal: CourseRubricProposal | null;
  coursePoints: { points: CoursePoints; commonErrors?: CommonWritingError[] } | null;
  aiError: string | null;
  reason: string | null;
  decidedBy: string | null;
  updatedAt: Date;
};

/** The decided points, criterion by criterion, as plain lines (no form): a teacher without the grading right sees these. */
function RubricLines({ section, points, t }: { section: GradedSection; points: CoursePoints; t: T }) {
  return (
    <ul className="mt-3 divide-y divide-line">
      {criteriaOf(section).map((id) => (
        <li key={id} className="flex items-baseline justify-between gap-3 py-2">
          <span lang="de" className="text-[13.5px] text-ink">
            {CRITERION_LABEL_DE[id]}
          </span>
          <span className="tnum text-[13.5px] font-semibold text-ink">{t("courseResult.decidedPoints", { points: points[id] ?? "-", max: criterionMax(section) })}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The right-hand card of a writing or speaking answer: who decided and what the
 * points are, the AI's state (on its way, failed, or a rule's zero), and the
 * grading form. A decided grading shows its points and keeps the form behind
 * "Punkte ändern", so a confirmed answer is not an open form. The form is the
 * one client piece; the rest is plain markup.
 */
export function GradingPanel({
  t,
  grading,
  section,
  tab,
  canGrade,
  nameOf,
}: {
  t: T;
  grading: PanelGrading;
  section: GradedSection;
  tab: string;
  canGrade: boolean;
  nameOf: Record<string, string>;
}) {
  const decided = isDecidedStatus(grading.status) && grading.coursePoints ? grading.coursePoints : null;
  const proposal = grading.courseProposal;
  const proposed = proposalPoints(proposal, section);
  // The total the card leads with: the teacher's, else the AI's when it judged every criterion.
  const total = decided ? pointsTotal(decided.points) : proposal && proposed.open.length === 0 ? pointsTotal(proposed.points) : null;
  const who = grading.decidedBy ? (nameOf[grading.decidedBy] ?? "") : "";
  const editor = (
    <CourseGradingEditor
      key={`${grading.id}:${grading.status}:${grading.updatedAt.getTime()}`}
      gradingId={grading.id}
      tab={tab}
      section={section}
      status={grading.status}
      proposal={proposal}
      decided={decided}
      criteria={editorCriteria(section, proposal)}
      boxes={section === "WRITING" ? COMMON_ERROR_IDS.map((id) => ({ id, label: COMMON_WRITING_ERRORS[id] })) : []}
      actions={{ confirm: confirmCourseGrading, change: setCourseGradingPoints, errors: setCourseCommonErrors }}
    />
  );
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{decided ? t("source.TEACHER") : t("source.AI")}</div>
        <div className="tnum text-[22px] font-bold text-ink">
          {total ?? "-"} <span className="text-[14px] font-semibold text-muted">/ {rubricMax(section)}</span>
        </div>
      </div>
      {decided ? (
        <p className="mt-1 text-[12.5px] text-muted">
          {grading.status === "CONFIRMED" ? t("source.aiConfirmed", { name: who }) : `${t("source.overridden", { name: who })}: ${grading.reason ?? ""}`}
        </p>
      ) : null}
      {grading.status === "PENDING" ? <p className="mt-3 text-[13.5px] text-muted">{t("result.pending")}</p> : null}
      {grading.status === "AI_FAILED" ? <p className="mt-3 text-[13.5px] text-ink-2">{t("courseResult.aiFailed", { reason: grading.aiError ?? "-" })}</p> : null}
      {proposal?.byRule === "EMPTY" ? <p className="mt-3 text-[13px] leading-5 text-ink-2">{t("courseResult.byRuleEMPTY")}</p> : null}

      {!canGrade ? (
        decided ? <RubricLines section={section} points={decided.points} t={t} /> : null
      ) : decided ? (
        <>
          <RubricLines section={section} points={decided.points} t={t} />
          <details className="mt-4 border-t border-line pt-4">
            <summary className="cursor-pointer text-[13px] font-medium text-ink underline underline-offset-2">{t("courseResult.changePoints")}</summary>
            <div className="mt-3">{editor}</div>
          </details>
        </>
      ) : (
        <div className="mt-4 border-t border-line pt-4">
          {grading.status === "PENDING" ? <p className="mb-3 text-[12.5px] text-muted">{t("courseResult.gradeWithoutAi")}</p> : null}
          {editor}
        </div>
      )}
    </div>
  );
}
