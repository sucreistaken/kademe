import { createHmac } from "node:crypto";
import { approvedFeedback, type FeedbackContent, type StudentFeedbackStore } from "@/lib/exam/student-feedback";
import { isResultLevel } from "@/lib/exam/cefr";
import { recommendedClassOf, type RecommendedClass } from "@/lib/exam/placement";
import type { PanelLocale } from "@/i18n/locale";
import type { ResultLevel, Section } from "@/lib/exam/types";

/**
 * The printable result report, as data. Pure: the page loads the rows, this
 * turns them into exactly what the sheet may show. This summary (page 1)
 * carries levels only: no item, answer, key or AI score. The one piece of
 * free text is the teacher-approved feedback; a draft is never passed on.
 *
 * Teacher copy (decision 2026-10-16, kept): the school must be able to show
 * exactly what was answered wrongly, so the detailed part (detail-model.ts)
 * carries the student's answers and the keys. It still leaves out the reading
 * passages and the listening transcripts (titles only), to limit exposure of
 * the item bank, and any AI score the teacher did not adopt. This is the
 * teacher copy; the student copy has no questions or keys (owner 2026-10-23):
 * it is the analysis in student-analysis.ts, printed from the student's own
 * link or from here with `?copy=student`.
 *
 * Language (owner 2026-10-25): the teacher copy is printed in German whatever
 * language the panel is open in. The page renders both sheets with
 * `TEACHER_COPY_LOCALE`; only the toolbar around them follows the panel language.
 */

/** The language of the printed teacher copy (summary and detail sheet). */
export const TEACHER_COPY_LOCALE = "de" as const satisfies PanelLocale;

export type ReportSource = {
  status: string | null | undefined;
  schoolName: string;
  studentName: string;
  examName: string;
  examDate: Date | null;
  /** The ordered sections the exam had. */
  sections: string[];
  finalOverall: string | null | undefined;
  /** Final skill levels, by section. */
  skillLevels: Record<string, string | null | undefined>;
  mode: string;
  placement: { sublevel: string | null; borderline: boolean; recommended: string | null } | null | undefined;
  teacherName: string | null;
  finalizedAt: Date | null;
  attemptId: string;
  /** The stored feedback row; only its teacher-approved text can reach the model. */
  feedback?: StudentFeedbackStore | null;
};

export type ReportSkill = { section: Section; level: ResultLevel | null };

export type ReportModel = {
  schoolName: string;
  studentName: string;
  examName: string;
  examDate: Date | null;
  /** A0 to C2; A0 is Pre-A1. */
  overall: ResultLevel;
  skills: ReportSkill[];
  /** Only for a placement exam with a stored placement. A0 starts in the first course (`preA1`). */
  recommendedClass: RecommendedClass | null;
  teacherName: string | null;
  finalizedAt: Date | null;
  verificationCode: string;
  /** The teacher-approved feedback for the student, or null. A draft is never here. Only German feedback is printed. */
  feedback: FeedbackContent | null;
  /** Approved feedback exists but is written in the student's language: the German sheet points to the student copy instead. */
  feedbackOnStudentCopy: boolean;
};

/** A report is only for a decided result: the teacher finalised it. */
export function reportAllowed(status: string | null | undefined): boolean {
  return status === "FINAL";
}

/** 8 uppercase hex characters of an HMAC over the attempt id. Same input, same code. */
export function verificationCode(attemptId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kademe-report:${attemptId}`).digest("hex").slice(0, 8).toUpperCase();
}

const asLevel = (v: string | null | undefined): ResultLevel | null => (isResultLevel(v) ? v : null);

export function buildReport(src: ReportSource, secret: string): { ok: true; model: ReportModel } | { ok: false; reason: "NOT_FINAL" } {
  const overall = asLevel(src.finalOverall);
  if (!reportAllowed(src.status) || !overall) return { ok: false, reason: "NOT_FINAL" };
  const skills = src.sections.map((s) => ({ section: s as Section, level: asLevel(src.skillLevels[s]) }));
  const p = src.mode === "PLACEMENT" ? src.placement : null;
  const recommendedClass = p ? recommendedClassOf(overall, p) : null;
  // The note is written in the student's language, for the student; the German sheet prints it only when it is German.
  const approved = approvedFeedback(src.feedback);
  const german = src.feedback?.locale === "de";
  return {
    ok: true,
    model: {
      schoolName: src.schoolName,
      studentName: src.studentName,
      examName: src.examName,
      examDate: src.examDate,
      overall,
      skills,
      recommendedClass,
      teacherName: src.teacherName,
      finalizedAt: src.finalizedAt,
      verificationCode: verificationCode(src.attemptId, secret),
      feedback: approved && german ? approved : null,
      feedbackOnStudentCopy: !!approved && !german,
    },
  };
}
