import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, auditLogs, candidates, examAssessments, examBlueprints, messageOutbox } from "@/db/schema";
import { mintToken, safeEqual, sha256 } from "@/lib/auth";
import type { CandidateLocale } from "@/i18n/locale";
import { candidateExamName } from "@/lib/exam/candidate-exam-name";
import { isCourseForm, singleInviteForm } from "@/lib/exam/course/forms";
import type { CourseForm, CourseKey } from "@/lib/exam/course/types";
import type { Cefr } from "@/lib/exam/types";
import { outboxLinkPlaceholder } from "@/lib/outbox";
import { resolveSigningSecret } from "@/lib/signing-secret";
import { courseFormsSeenBy } from "@/server/exam-exposure";

/**
 * Invites one student to one exam. Shared by the panel, the seed and the dev
 * scripts so there is exactly one place that knows what an invitation is.
 *
 * The blueprint's config is copied onto the assessment here. That copy is the
 * exam this student takes, whatever happens to the blueprint afterwards.
 *
 * Nothing is e-mailed: the row in message_outbox is the future mail path and
 * nothing reads it yet; its body names the invitation where the link goes
 * (outboxLinkPlaceholder), never the link. The school shares each link
 * itself, so the link must stay retrievable for the panel (inviteLink), while
 * the database still only holds the token's hash: the raw token is an HMAC of
 * the link row's id under the server's secret, so a database read alone never
 * yields it.
 */

export const LINK_TTL_DAYS = 14;

export type InviteInput = {
  orgId: string;
  blueprintId: string;
  fullName: string;
  email: string;
  claimedLevel: Cefr | null;
  locale: CandidateLocale;
  invitedBy: string | null;
  baseUrl?: string;
  ttlDays?: number;
  /** The exam's window (src/lib/exam-window): not before this instant (default: open now), last entry at `expiresAt` (default: ttlDays from now). */
  notBefore?: Date | null;
  expiresAt?: Date;
  /** This student's level shift (-1 easier, 1 harder), written into their copy of the exam; omitted keeps the exam's own. */
  difficultyOffset?: -1 | 0 | 1;
  /**
   * Course tests (spec 2026-10-28): the form this student sits, written into
   * their copy of the exam. Omitted or null: the form they have not seen yet,
   * else A (a list of students chooses per row, see course/forms.ts).
   */
  courseForm?: CourseForm | null;
};

export type InviteResult =
  | { ok: true; assessmentId: string; candidateId: string; rawToken: string; url: string; expiresAt: Date; notBefore: Date | null; courseForm?: CourseForm; outboxId: string }
  | { ok: false; code: "BLUEPRINT_NOT_FOUND" | "NOT_PUBLISHED" | "CLAIM_REQUIRED" };

/**
 * The exam link's raw token for one link row: 32 bytes of HMAC-SHA256 of the
 * row's id, base64url, the same shape as a random token. Without the secret
 * it cannot be computed from the id.
 */
export function examLinkToken(linkId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kademe:exam-link:v1:${linkId}`).digest("base64url");
}

/**
 * The secret links are derived with, or null where the server has none (a
 * production without AUTH_SECRET). Inviting never depends on it: without it
 * the token is random, as before, and the panel says the link cannot be
 * shown again.
 */
function linkSecret(): string | null {
  try {
    return resolveSigningSecret(process.env);
  } catch {
    return null;
  }
}
const origin = (baseUrl?: string) => baseUrl ?? process.env.APP_ORIGIN ?? "http://localhost:3100";
export const examLinkUrl = (raw: string, baseUrl?: string) => `${origin(baseUrl)}/a/${raw}`;

/** The outbox message, with `link` where the student's link goes. The exam needs a computer (desktop only, 2026-10-14). */
function inviteBody(input: Pick<InviteInput, "fullName" | "locale">, examName: string, link: string): string {
  const name = input.fullName.trim();
  switch (input.locale) {
    case "en":
      return [name ? `Hello ${name},` : "Hello,", `Your German exam "${examName}" is ready. To start: ${link}`, "Please open the link on a computer; the exam does not run on a phone or tablet."].join("\n\n");
    case "de":
      return [name ? `Hallo ${name},` : "Hallo,", `Ihre Deutschprüfung "${examName}" ist bereit. Zum Starten: ${link}`, "Bitte öffnen Sie den Link an einem Computer; die Prüfung läuft nicht auf einem Handy oder Tablet."].join("\n\n");
    case "es":
      return [name ? `Hola ${name},` : "Hola,", `Su examen de alemán "${examName}" está listo. Para empezar: ${link}`, "Abra el enlace en un ordenador; el examen no funciona en un móvil ni en una tableta."].join("\n\n");
    case "ar":
      return [name ? `مرحباً ${name}،` : "مرحباً،", `امتحان اللغة الألمانية "${examName}" جاهز. للبدء: ${link}`, "يرجى فتح الرابط على جهاز كمبيوتر؛ لا يعمل الامتحان على الهاتف أو الجهاز اللوحي."].join("\n\n");
    case "tr":
      return [name ? `Merhaba ${name},` : "Merhaba,", `"${examName}" Almanca sınavınız hazır. Başlamak için: ${link}`, "Linki bir bilgisayarda açın; sınav telefon veya tablette çalışmaz."].join("\n\n");
  }
}

/** The outbox subject line, in the student's language. */
function inviteSubject(locale: CandidateLocale, examName: string): string {
  switch (locale) {
    case "en":
      return `Your German exam: ${examName}`;
    case "de":
      return `Ihre Deutschprüfung: ${examName}`;
    case "es":
      return `Su examen de alemán: ${examName}`;
    case "ar":
      return `امتحان اللغة الألمانية: ${examName}`;
    case "tr":
      return `Almanca sınavınız: ${examName}`;
  }
}

/** The form of a course test invitation: the one asked for, else the one this student has not seen, else A. */
async function courseFormFor(input: InviteInput, key: CourseKey): Promise<CourseForm> {
  if (isCourseForm(input.courseForm)) return input.courseForm;
  const seen = await courseFormsSeenBy(input.orgId, [input.email], key);
  return singleInviteForm(seen.get(input.email.trim().toLowerCase()) ?? new Set());
}

export async function createInvitation(input: InviteInput): Promise<InviteResult> {
  const [blueprint] = await db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.id, input.blueprintId), eq(examBlueprints.orgId, input.orgId)));
  if (!blueprint) return { ok: false, code: "BLUEPRINT_NOT_FOUND" };
  if (blueprint.status !== "PUBLISHED") return { ok: false, code: "NOT_PUBLISHED" };
  if (blueprint.mode === "LEVEL_VERIFICATION" && !input.claimedLevel) return { ok: false, code: "CLAIM_REQUIRED" };

  // Only a verification has a claim; a course test never needs one (spec 2026-10-28). It sits one of
  // its two forms instead. A COURSE_TEST blueprint that does not say which course it is cannot be
  // served, so nobody is invited to it.
  const claimedLevel = blueprint.mode === "LEVEL_VERIFICATION" ? input.claimedLevel : null;
  const course = blueprint.mode === "COURSE_TEST" ? blueprint.config.course : undefined;
  if (blueprint.mode === "COURSE_TEST" && !course) return { ok: false, code: "BLUEPRINT_NOT_FOUND" };
  const courseForm = course ? await courseFormFor(input, course.key) : null;
  const shifted = input.difficultyOffset === undefined ? blueprint.config : { ...blueprint.config, difficultyOffset: input.difficultyOffset };
  const snapshot = course && courseForm ? { ...shifted, course: { ...course, form: courseForm } } : shifted;

  // A template's default name is shown in the student's own language, as on the exam screen.
  const shownName = candidateExamName(blueprint.name, input.locale);
  const linkId = randomUUID();
  const s = linkSecret();
  const raw = s ? examLinkToken(linkId, s) : mintToken().raw;
  const expiresAt = input.expiresAt ?? new Date(Date.now() + (input.ttlDays ?? LINK_TTL_DAYS) * 86_400_000);
  const notBefore = input.notBefore ?? null;
  const url = examLinkUrl(raw, input.baseUrl);
  const outboxId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .insert(candidates)
      .values({ orgId: input.orgId, fullName: input.fullName, email: input.email })
      .returning();
    const [assessment] = await tx
      .insert(assessments)
      .values({
        orgId: input.orgId,
        candidateId: candidate.id,
        solution: "LANGUAGE_EXAM",
        locale: input.locale,
        invitedBy: input.invitedBy,
      })
      .returning();
    await tx.insert(examAssessments).values({
      assessmentId: assessment.id,
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      blueprintSnapshot: snapshot,
      mode: blueprint.mode,
      claimedLevel,
    });
    await tx.insert(assessmentLinks).values({
      id: linkId,
      assessmentId: assessment.id,
      tokenHash: sha256(raw),
      status: "NOT_STARTED",
      expiresAt,
      notBefore,
      attemptsAllowed: 1,
    });
    await tx.insert(messageOutbox).values({
      id: outboxId,
      orgId: input.orgId,
      kind: "INVITE",
      toEmail: input.email,
      subject: inviteSubject(input.locale, shownName),
      body: inviteBody(input, shownName, outboxLinkPlaceholder(assessment.id)),
    });
    await tx.insert(auditLogs).values({
      orgId: input.orgId,
      actorId: input.invitedBy,
      action: "student.invite",
      subjectType: "assessment",
      subjectId: assessment.id,
      meta: { blueprintId: blueprint.id, mode: blueprint.mode, claimedLevel, ...(course && courseForm ? { course: course.key, form: courseForm } : {}) },
    });
    return { assessmentId: assessment.id, candidateId: candidate.id };
  });
  return { ok: true, ...result, rawToken: raw, url, expiresAt, notBefore, outboxId, ...(courseForm ? { courseForm } : {}) };
}

export type InviteLinkResult =
  | { ok: true; url: string; expiresAt: Date }
  /**
   * NOT_FOUND: no such exam invitation in this organisation. USED: the exam is
   * finished, the link opens nothing. EXPIRED: past its last day or replaced.
   * NOT_RECOVERABLE: an invitation from before links were derived (its token
   * was random and only its hash is stored), or the server's secret changed.
   */
  | { ok: false; code: "NOT_FOUND" | "USED" | "EXPIRED" | "NOT_RECOVERABLE" };

/** Which link of an invitation the panel may hand out again, pure. */
export function linkVerdict(
  link: { id: string; tokenHash: string; status: string; expiresAt: Date },
  now: Date,
  secretValue: string,
): { ok: true; raw: string } | { ok: false; code: "USED" | "EXPIRED" | "NOT_RECOVERABLE" } {
  if (link.status === "COMPLETED") return { ok: false, code: "USED" };
  if (link.status === "EXPIRED" || link.expiresAt.getTime() <= now.getTime()) return { ok: false, code: "EXPIRED" };
  const raw = examLinkToken(link.id, secretValue);
  return safeEqual(sha256(raw), link.tokenHash) ? { ok: true, raw } : { ok: false, code: "NOT_RECOVERABLE" };
}

/**
 * The live link of one exam invitation, again, for the panel's "Linki
 * kopyala". Only the organisation's own exam invitation, only while the link
 * still opens the exam (not started or in progress, before its last day).
 * Each reveal is written to the audit log.
 */
export async function inviteLink(input: { orgId: string; assessmentId: string; actorId: string; baseUrl?: string; now?: Date }): Promise<InviteLinkResult> {
  const rows = await db
    .select({ id: assessmentLinks.id, tokenHash: assessmentLinks.tokenHash, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .where(and(eq(assessmentLinks.assessmentId, input.assessmentId), eq(assessments.orgId, input.orgId), eq(assessments.solution, "LANGUAGE_EXAM")));
  // At most one link is not EXPIRED (one_active_link_per_assessment); replaced ones stay as EXPIRED rows.
  const link = rows.find((r) => r.status !== "EXPIRED") ?? rows[0] ?? null;
  if (!link) return { ok: false, code: "NOT_FOUND" };
  const s = linkSecret();
  if (!s) return { ok: false, code: "NOT_RECOVERABLE" };
  const verdict = linkVerdict(link, input.now ?? new Date(), s);
  if (!verdict.ok) return verdict;
  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorId: input.actorId,
    action: "student.link.show",
    subjectType: "assessment",
    subjectId: input.assessmentId,
    meta: null,
  });
  return { ok: true, url: examLinkUrl(verdict.raw, input.baseUrl), expiresAt: link.expiresAt };
}
