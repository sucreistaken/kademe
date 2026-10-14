import { createHmac } from "node:crypto";
import { CEFR_LEVELS, type Cefr, type Section } from "@/lib/exam/types";

/**
 * The printable result report, as data. Pure: the page loads the rows, this
 * turns them into exactly what the sheet may show. Nothing here carries an
 * item, an answer, a key or an AI score, so the sheet cannot print one.
 */

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
};

export type ReportSkill = { section: Section; level: Cefr | null };

export type ReportModel = {
  schoolName: string;
  studentName: string;
  examName: string;
  examDate: Date | null;
  overall: Cefr;
  skills: ReportSkill[];
  /** Only for a placement exam with a stored placement. */
  recommendedClass: { level: Cefr; sublevel: string | null } | null;
  teacherName: string | null;
  finalizedAt: Date | null;
  verificationCode: string;
};

/** A report is only for a decided result: the teacher finalised it. */
export function reportAllowed(status: string | null | undefined): boolean {
  return status === "FINAL";
}

/** 8 uppercase hex characters of an HMAC over the attempt id. Same input, same code. */
export function verificationCode(attemptId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kademe-report:${attemptId}`).digest("hex").slice(0, 8).toUpperCase();
}

const asCefr = (v: string | null | undefined): Cefr | null => ((CEFR_LEVELS as readonly string[]).includes(v ?? "") ? (v as Cefr) : null);

export function buildReport(src: ReportSource, secret: string): { ok: true; model: ReportModel } | { ok: false; reason: "NOT_FINAL" } {
  const overall = asCefr(src.finalOverall);
  if (!reportAllowed(src.status) || !overall) return { ok: false, reason: "NOT_FINAL" };
  const skills = src.sections.map((s) => ({ section: s as Section, level: asCefr(src.skillLevels[s]) }));
  const p = src.mode === "PLACEMENT" ? src.placement : null;
  const recommendedClass = p ? { level: (p.borderline ? asCefr(p.recommended) : null) ?? overall, sublevel: p.sublevel } : null;
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
    },
  };
}
