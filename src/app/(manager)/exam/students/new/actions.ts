"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { examBlueprints } from "@/db/schema";
import { bankCoverage } from "@/lib/exam/blueprint";
import { isCefr } from "@/lib/exam/cefr";
import { assignCourseForms, isCourseForm } from "@/lib/exam/course/forms";
import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import { parseExamChoice } from "@/lib/exam/exam-choice";
import { readyTemplateByKey } from "@/lib/exam/templates";
import type { Cefr } from "@/lib/exam/types";
import { resolveWindow, type WindowFault, type WindowInput } from "@/lib/exam-window";
import { managerLocale } from "@/i18n/manager-locale";
import { DEFAULT_CANDIDATE_LOCALE, isCandidateLocale, type CandidateLocale, contentLocale } from "@/i18n/locale";
import { courseFormsSeenBy } from "@/server/exam-exposure";
import { bankCounts } from "@/server/panel";
import { createInvitation } from "@/server/invite";
import { sendOutboxAfterResponse, type OutboxSend } from "@/server/mail";
import { requireUser } from "@/server/session";
import { ensureTemplateBlueprint } from "@/server/template-blueprint";
import { claimFor, listWait, MAX_LIST_TEXT, parseStudentRows } from "./rows";

export type InviteStudentsInput = {
  /** The pasted or uploaded list, as the manager sees it; the server parses it again. */
  text: string;
  /** An exam-choice value (src/lib/exam/exam-choice). */
  exam: string;
  /** Verification exams: the claim for every row that does not name its own. */
  claimed: string | null;
  /** The language the student sees the exam and the invitation in. */
  locale: CandidateLocale;
  /** The exam window as typed (school time); omitted: open now, last entry in 14 days. The server resolves it again. */
  window?: WindowInput;
  /** Verification exams: one CEFR level easier (-1) or harder (1) for these students; omitted keeps the exam's own. */
  shift?: -1 | 0 | 1 | null;
  /** Course tests (spec 2026-10-28): force form A or B for every row; omitted or null alternates A, B, A, B (a returning student gets the unseen one). */
  courseForm?: "A" | "B" | null;
};

export type InviteFailure = "BLUEPRINT_NOT_FOUND" | "NOT_PUBLISHED" | "CLAIM_REQUIRED" | "GENERIC";

export type InviteStudentsResult =
  | {
      ok: true;
      examName: string;
      /** `form`: a course test only, the form this student was given. */
      created: Array<{ line: number; fullName: string; email: string; url: string; expiresAt: string; notBefore: string | null; form?: CourseForm }>;
      failed: Array<{ line: number; fullName: string; email: string; code: InviteFailure }>;
      /** The invitations also go out by e-mail (the server has SMTP settings, src/server/mail.ts). */
      mailed: boolean;
    }
  | { ok: false; code: "LIST" | "EXAM" | "CLAIM_REQUIRED" | "COVERAGE" | "TEMPLATE_COVERAGE" | "GENERIC" }
  | { ok: false; code: "WINDOW"; fault: WindowFault };

/**
 * The form of every row of a course test list, in list order: the forced one,
 * else A, B, A, B around what each student (same e-mail) already sat in this
 * school (course/forms.ts). Nothing is looked up when a form is forced.
 */
async function courseFormsFor(orgId: string, key: CourseKey, rows: ReadonlyArray<{ email: string }>, forced: CourseForm | null): Promise<CourseForm[]> {
  const seen = forced ? new Map<string, Set<CourseForm>>() : await courseFormsSeenBy(orgId, rows.map((r) => r.email), key);
  return assignCourseForms(rows.map((r) => seen.get(r.email.trim().toLowerCase()) ?? new Set<CourseForm>()), forced);
}

/** The posted window with only strings in it (a server action's input is not typed at runtime). */
function cleanWindow(w: unknown): WindowInput {
  const moment = (m: unknown) => {
    const v = m as { date?: unknown; time?: unknown } | null | undefined;
    if (v == null) return null;
    // Anything that is not a pair of strings fails the window's own check rather than reading as "now".
    return { date: typeof v.date === "string" ? v.date : "", time: typeof v.time === "string" ? v.time : "" };
  };
  const raw = (w ?? {}) as { start?: unknown; end?: unknown };
  return { start: moment(raw.start), end: moment(raw.end) };
}

/**
 * Invites every student of the list to one exam and hands every link back.
 * Nothing is e-mailed; the school shares the links (the result screen and the
 * student list both offer them). The list is parsed again here with the same
 * rules the wizard showed, and a list with any marked row invites nobody. The
 * bank is checked for the exam (and every claim on the list) before anything
 * is written, so no student meets an empty section. A ready template is
 * published on its first use after the editor's coverage check. Each student
 * is one invitation of its own; one that fails is reported on its line and
 * the others stand.
 *
 * A course test (spec 2026-10-28) has no claim; each student is given one of
 * its two forms (course/forms.ts): the one the teacher forced, else A, B, A,
 * B in the order of the list, except a returning student, who gets the form
 * they have not seen.
 */
export async function inviteStudentsAction(input: InviteStudentsInput): Promise<InviteStudentsResult> {
  const user = await requireUser("student:invite");
  const text = typeof input?.text === "string" ? input.text.slice(0, MAX_LIST_TEXT) : "";
  // The manager's language decides the capitals of a lower-case name, as in the wizard's preview.
  const parsed = parseStudentRows(text, contentLocale(await managerLocale()));
  if (listWait(parsed)) return { ok: false, code: "LIST" };
  const choice = parseExamChoice(typeof input.exam === "string" ? input.exam : "");
  if (!choice) return { ok: false, code: "EXAM" };
  const batch: Cefr | null = isCefr(input.claimed) ? input.claimed : null;
  const locale: CandidateLocale = isCandidateLocale(input.locale) ? input.locale : DEFAULT_CANDIDATE_LOCALE;
  // The window is checked before anything is published or written.
  const window = resolveWindow(cleanWindow(input.window), { now: new Date() });
  if (!window.ok) return { ok: false, code: "WINDOW", fault: window.fault };

  let bp: typeof examBlueprints.$inferSelect | undefined;
  if (choice.kind === "template") {
    const template = readyTemplateByKey(choice.key);
    if (!template) return { ok: false, code: "EXAM" };
    // Asked before anything is published, so a missing claim publishes nothing.
    if (template.mode === "LEVEL_VERIFICATION" && parsed.rows.some((r) => !claimFor(r, template.mode, batch))) return { ok: false, code: "CLAIM_REQUIRED" };
    const ensured = await ensureTemplateBlueprint(user.orgId, user.id, template, contentLocale(await managerLocale()));
    if (!ensured.ok) return { ok: false, code: ensured.code };
    bp = ensured.blueprint;
  } else {
    [bp] = await db.select().from(examBlueprints).where(eq(examBlueprints.id, choice.id));
    if (!bp || bp.orgId !== user.orgId || bp.status !== "PUBLISHED") return { ok: false, code: "EXAM" };
  }
  const exam = bp;
  const claims = parsed.rows.map((r) => claimFor(r, exam.mode, batch));
  if (exam.mode === "LEVEL_VERIFICATION" && claims.some((c) => !c)) return { ok: false, code: "CLAIM_REQUIRED" };
  // The difficulty the manager chose for this list; only verification exams take one.
  const shift = exam.mode === "LEVEL_VERIFICATION" && (input.shift === -1 || input.shift === 0 || input.shift === 1) ? input.shift : undefined;
  const config = shift === undefined ? exam.config : { ...exam.config, difficultyOffset: shift };
  const counts = await bankCounts(user.orgId);
  for (const claim of new Set(claims)) {
    if (!bankCoverage(counts, config, exam.mode, claim).ok) return { ok: false, code: "COVERAGE" };
  }
  // A course test gives each student a form: forced for all, else alternating down the list around what they sat before.
  const courseKey = exam.mode === "COURSE_TEST" ? exam.config.course?.key : undefined;
  if (exam.mode === "COURSE_TEST" && !courseKey) return { ok: false, code: "EXAM" };
  const forms = courseKey ? await courseFormsFor(user.orgId, courseKey, parsed.rows, isCourseForm(input.courseForm) ? input.courseForm : null) : null;

  const created: Extract<InviteStudentsResult, { ok: true }>["created"] = [];
  const failed: Extract<InviteStudentsResult, { ok: true }>["failed"] = [];
  const mail: OutboxSend[] = [];
  for (const [i, row] of parsed.rows.entries()) {
    const fullName = row.fullName.replace(/\s+/g, " ").trim();
    try {
      const r = await createInvitation({ orgId: user.orgId, blueprintId: exam.id, fullName, email: row.email, claimedLevel: claims[i], locale, invitedBy: user.id, notBefore: window.notBefore, expiresAt: window.expiresAt, difficultyOffset: shift, ...(forms ? { courseForm: forms[i] } : {}) });
      if (r.ok) mail.push({ id: r.outboxId, assessmentId: r.assessmentId, link: r.url });
      if (r.ok) created.push({ line: row.line, fullName, email: row.email, url: r.url, expiresAt: r.expiresAt.toISOString(), notBefore: r.notBefore?.toISOString() ?? null, ...(r.courseForm ? { form: r.courseForm } : {}) });
      else failed.push({ line: row.line, fullName, email: row.email, code: r.code });
    } catch {
      failed.push({ line: row.line, fullName, email: row.email, code: "GENERIC" });
    }
  }
  if (created.length) revalidatePath("/exam/students");
  const mailed = sendOutboxAfterResponse(mail);
  return { ok: true, examName: exam.name, created, failed, mailed };
}
