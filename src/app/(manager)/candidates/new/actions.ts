"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentLinks,
  assessments,
  auditLogs,
  candidates,
  messageOutbox,
  positions,
  templateVersions,
  templates,
} from "@/db/schema";
import { mintToken } from "@/lib/auth";
import { requireUser } from "@/server/session";
import { candidateT } from "@/i18n/candidate";
import { isLocale, type Locale } from "@/i18n/locale";

/** Two weeks is long enough for a holiday, short enough to keep the pipeline moving. */
const LINK_TTL_DAYS = 14;

/**
 * Errors travel as codes rather than sentences: the form renders them through
 * the manager dictionary, so the panel's language decides what the manager
 * reads instead of this module deciding it once at write time.
 */
export type InviteErrorCode =
  | "NAME_REQUIRED"
  | "EMAIL_INVALID"
  | "TEMPLATE_REQUIRED"
  | "TEMPLATE_UNPUBLISHED";

export type InviteResult =
  | { status: "idle" }
  | { status: "error"; code: InviteErrorCode }
  | {
      status: "created";
      /** Shown exactly once. Only the sha256 of this reaches the database. */
      token: string;
      candidateName: string;
      candidateId: string;
      expiresAt: string;
    };

export async function createInvite(
  _previous: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const user = await requireUser("candidate:invite");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const versionId = String(formData.get("versionId") ?? "");

  if (!fullName) return { status: "error", code: "NAME_REQUIRED" };
  if (!email.includes("@")) return { status: "error", code: "EMAIL_INVALID" };
  if (!versionId) return { status: "error", code: "TEMPLATE_REQUIRED" };

  // The version must belong to this organisation and be published: an unfrozen
  // draft could still change under a candidate who already started.
  const [version] = await db
    .select({
      id: templateVersions.id,
      positionName: positions.name,
      localeSet: templateVersions.localeSet,
      defaultLocale: templateVersions.defaultLocale,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(
        eq(templateVersions.id, versionId),
        eq(templateVersions.orgId, user.orgId),
        eq(templateVersions.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  if (!version) {
    return { status: "error", code: "TEMPLATE_UNPUBLISHED" };
  }

  // The candidate's language is a property of the invitation, not of the panel
  // the manager happens to be reading. It is checked against the languages the
  // template was authored in, so a form that was tampered with cannot send an
  // assessment whose questions do not exist in the chosen language.
  const authored: Locale[] = version.localeSet?.length
    ? version.localeSet
    : [version.defaultLocale];
  const asked = String(formData.get("locale") ?? "");
  const locale: Locale =
    isLocale(asked) && authored.includes(asked) ? asked : version.defaultLocale;

  const [candidate] = await db
    .insert(candidates)
    .values({ orgId: user.orgId, fullName, email, lastContactAt: new Date() })
    .returning({ id: candidates.id });

  const [assessment] = await db
    .insert(assessments)
    .values({
      orgId: user.orgId,
      candidateId: candidate.id,
      versionId,
      locale,
      invitedBy: user.id,
    })
    .returning({ id: assessments.id });

  const token = mintToken();
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(assessmentLinks).values({
    assessmentId: assessment.id,
    tokenHash: token.hash,
    status: "NOT_STARTED",
    expiresAt,
  });

  // Nothing is actually sent in the MVP; the manager pastes the link into their
  // own mail client. Writing the row anyway means switching to a real provider
  // later is one Mailer implementation, not a change to this action.
  // Written in the candidate's language, not the manager's. `candidateT` is the
  // same dictionary the candidate's own screens use, so the invitation and the
  // assessment cannot end up in two different languages.
  const ct = candidateT(locale);
  await db.insert(messageOutbox).values({
    orgId: user.orgId,
    kind: "INVITE",
    toEmail: email,
    subject: ct("invite.subject", { position: version.positionName }),
    body: ct("invite.body", { name: fullName, link: `/a/${token.raw}` }),
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "candidate.invite",
    subjectType: "assessment",
    subjectId: assessment.id,
    meta: { versionId, email, locale },
  });

  return {
    status: "created",
    token: token.raw,
    candidateName: fullName,
    candidateId: candidate.id,
    expiresAt: expiresAt.toISOString(),
  };
}
