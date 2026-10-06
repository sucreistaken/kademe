import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import {
  assessmentLinks,
  assessments,
  attempts,
  auditLogs,
  candidateRequests,
  candidates,
  deletionRequests,
  hiringAssessments,
  hiringAssignments,
  hiringOpeningMembers,
  hiringOpenings,
  hiringStageRuns,
  hiringStages,
  hiringSurveyResponses,
  hiringVersions,
  messageOutbox,
  organizations,
  positions,
  users,
} from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { mintToken } from "@/lib/auth";
import { orgDay, zonedDayStart, zoneLabel } from "@/lib/org-timezone";
import { isUuid } from "@/server/settings";
import {
  addDays,
  candidateProgress,
  cleanInviteName,
  EXPIRING_SOON_MS,
  formatInviteDeadline,
  inviteMessage,
  isEmail,
  linkExpiryDay,
  releasedSurveyCount,
  sampleOf,
  seededRandom,
  SURVEY_MIN_ANSWERS,
  surveySeed,
  type CandidateProgress,
} from "../rules/invitation";
import { estimatedMinutes } from "../rules/disclosure";
import { deadlineToDate } from "../rules/opening-rules";
import { workingVersions } from "../rules/versions";
import { ensureHiringConsentText } from "./consent";
import { hasStarted } from "./started";
import { assertActiveUser, versionsOf } from "./versions";

/**
 * Inviting candidates to an opening (HIRING-UX 5.11) and the opening's view of
 * them (Candidates tab, funnel).
 *
 * Tenancy: every read and write is scoped to the caller's organisation. The
 * opening, its versions and its panel users are read with the caller's org_id
 * in the query; hiring_assessments.org_id is tied to the core invitation's by
 * the database (migration 0011), so the invitation rows read here are the
 * organisation's own. The version, the consent text and the panel are derived
 * on the server; no stage, activity or version id comes from a client.
 *
 * Capability: the actions (invite, new link, extend, request handled) check
 * `opening:write` for the session user; these functions check that the actor
 * is an active user of the organisation (assertActiveUser), as the other
 * hiring writes do, so a disabled or foreign user id never lands in
 * invited_by, handled_by or the audit log.
 *
 * Concurrency (READ COMMITTED), lock order opening -> invitation -> link:
 * - an invitation is one transaction that reads the opening FOR SHARE, so a
 *   close (setOpeningClosed, FOR UPDATE) waits until the invitation exists or
 *   runs first and the invitation then sees CLOSED;
 * - FOR SHARE alone does not order two invitations of one e-mail (both hold
 *   the share lock and neither sees the other's uncommitted rows), and a
 *   unique constraint cannot express "unless the manager asked for a
 *   duplicate". So the duplicate check first takes a transaction advisory lock
 *   on (opening, lower(e-mail)): the second invitation waits for the first to
 *   commit, then its check (a new snapshot) sees it and answers DUPLICATE;
 * - a new link locks the invitation row FOR UPDATE before it reads the live
 *   link, so two clicks run one after the other; the old link becomes EXPIRED
 *   and the new one is inserted in the same transaction (the partial unique
 *   index one_active_link_per_assessment holds at every commit).
 */

export type InviteInput = { openingId: string; fullName: string; email: string; locale: Locale; deadline: string | null; allowDuplicate?: boolean };
/**
 * OPENING_DEADLINE_PASSED: the opening's own deadline day is behind today
 * (ledger carry to the invite action); DEADLINE_PAST: the chosen last day is.
 */
export type InviteRefusal =
  | "NOT_FOUND"
  | "CLOSED"
  | "NOT_PUBLISHED"
  | "OPENING_DEADLINE_PASSED"
  | "NO_EVALUATORS"
  | "NAME"
  | "EMAIL"
  | "DEADLINE_INVALID"
  | "DEADLINE_PAST"
  | "DUPLICATE";
export type InviteOutcome =
  | { ok: true; assessmentId: string; candidateId: string; url: string; expiresAt: Date; message: { subject: string; body: string } }
  | { ok: false; code: InviteRefusal; existing?: { assessmentId: string; invitedAt: Date } };

const origin = (baseUrl?: string) => baseUrl ?? process.env.APP_ORIGIN ?? "http://localhost:3100";

/** Separates this lock's keys from any other advisory lock (pg_advisory_xact_lock(int, int)). */
const INVITE_LOCK_CLASS = 0x48495245; // "HIRE"


/**
 * The words of the ready message: organisation, position, contact, and the
 * minutes on the clock the way the landing counts them (C25): the stages'
 * minutes plus the grace of ALLOW_GRACE stages, without extra time.
 */
async function messageParts(x: Executor, orgId: string, positionId: string, versionId: string) {
  const [[org], [position], stages] = await Promise.all([
    x.select({ name: organizations.name, contactEmail: organizations.contactEmail }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    x.select({ name: positions.name }).from(positions).where(and(eq(positions.id, positionId), eq(positions.orgId, orgId))).limit(1),
    x
      .select({ id: hiringStages.id, durationSeconds: hiringStages.durationSeconds, graceSeconds: hiringStages.graceSeconds, onTimeout: hiringStages.onTimeout })
      .from(hiringStages)
      .where(eq(hiringStages.versionId, versionId)),
  ]);
  const minutes = estimatedMinutes({ stages }, 0, Object.fromEntries(stages.map((st) => [st.id, st.onTimeout === "ALLOW_GRACE" ? st.graceSeconds : 0])));
  return { orgName: org?.name ?? "", orgContact: org?.contactEmail ?? null, positionName: position?.name ?? "", minutes };
}

/** The message's deadline: the last day in the organisation's zone, with the zone named (Task 6 ruling). */
const deadlineText = (expiresAt: Date, locale: Locale) => formatInviteDeadline(orgDay(expiresAt), locale, zoneLabel(locale));

export async function createHiringInvitation(
  user: { id: string; orgId: string },
  input: InviteInput,
  options: { baseUrl?: string; now?: Date } = {},
): Promise<InviteOutcome> {
  const now = options.now ?? new Date();
  // The one name rule of the pasted list and the form (cleanInviteName).
  const fullName = cleanInviteName(input.fullName);
  // Never cut an address: a cut one is someone else's. isEmail caps the length.
  const email = input.email.trim();
  if (!fullName) return { ok: false, code: "NAME" };
  if (!isEmail(email)) return { ok: false, code: "EMAIL" };
  const today = orgDay(now);
  if (input.deadline !== null) {
    if (!zonedDayStart(input.deadline)) return { ok: false, code: "DEADLINE_INVALID" };
    if (input.deadline < today) return { ok: false, code: "DEADLINE_PAST" };
  }
  if (!isUuid(input.openingId)) return { ok: false, code: "NOT_FOUND" };
  const locale: Locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;

  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({
        id: hiringOpenings.id,
        status: hiringOpenings.status,
        deadlineAt: hiringOpenings.deadlineAt,
        positionId: hiringOpenings.positionId,
        candidateContactEmail: hiringOpenings.candidateContactEmail,
      })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, input.openingId), eq(hiringOpenings.orgId, user.orgId)))
      .for("share");
    if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
    await assertActiveUser(tx, user.orgId, user.id);
    if (opening.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
    const { live } = workingVersions(await versionsOf(user.orgId, opening.id, tx));
    if (opening.status !== "OPEN" || !live) return { ok: false as const, code: "NOT_PUBLISHED" as const };
    const openingDeadlineDay = opening.deadlineAt ? orgDay(opening.deadlineAt) : null;
    if (openingDeadlineDay !== null && openingDeadlineDay < today) return { ok: false as const, code: "OPENING_DEADLINE_PASSED" as const };

    // Open question 4: the opening's whole active panel, the organisation's own users only.
    const panel = await tx
      .select({ userId: hiringOpeningMembers.userId })
      .from(hiringOpeningMembers)
      .innerJoin(users, and(eq(users.id, hiringOpeningMembers.userId), eq(users.orgId, user.orgId), isNull(users.disabledAt)))
      .where(eq(hiringOpeningMembers.openingId, opening.id))
      .orderBy(asc(hiringOpeningMembers.userId));
    if (panel.length === 0) return { ok: false as const, code: "NO_EVALUATORS" as const };

    if (!input.allowDuplicate) {
      // Held to commit: a second invitation of this e-mail to this opening waits here (see the header).
      await tx.execute(
        sql`select pg_advisory_xact_lock(${INVITE_LOCK_CLASS}, hashtext(${opening.id}::text || ':' || lower(${email}::text)))`,
      );
      const [existing] = await tx
        .select({ assessmentId: hiringAssessments.assessmentId, invitedAt: assessments.createdAt })
        .from(hiringAssessments)
        .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, user.orgId)))
        .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
        .where(and(eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, opening.id), sql`lower(${candidates.email}) = lower(${email}::text)`))
        .orderBy(desc(assessments.createdAt))
        .limit(1);
      if (existing) return { ok: false as const, code: "DUPLICATE" as const, existing };
    }

    // Open question 3: the consent text is frozen per invitation.
    const consentTextId = await ensureHiringConsentText(user.orgId, tx);
    const parts = await messageParts(tx, user.orgId, opening.positionId, live.id);
    const day = linkExpiryDay({ chosen: input.deadline, openingDeadlineDay, today });
    const expiresAt = deadlineToDate(day);
    const token = mintToken();
    const url = `${origin(options.baseUrl)}/a/${token.raw}`;

    const [person] = await tx.insert(candidates).values({ orgId: user.orgId, fullName, email }).returning({ id: candidates.id });
    const [assessment] = await tx
      .insert(assessments)
      .values({ orgId: user.orgId, candidateId: person.id, solution: "HIRING", locale, invitedBy: user.id })
      .returning({ id: assessments.id, createdAt: assessments.createdAt });
    await tx.insert(hiringAssessments).values({
      assessmentId: assessment.id,
      orgId: user.orgId,
      openingId: opening.id,
      versionId: live.id,
      consentTextId,
      // Plan 2 freezes proctoring OFF; plan 4 copies the version's level.
      proctorLevel: "OFF",
      extraTimePct: 0,
    });
    await tx.insert(hiringAssignments).values(panel.map((p) => ({ assessmentId: assessment.id, userId: p.userId })));
    await tx.insert(assessmentLinks).values({ assessmentId: assessment.id, tokenHash: token.hash, status: "NOT_STARTED", expiresAt, attemptsAllowed: 1 });
    const message = inviteMessage({
      locale,
      candidateName: fullName,
      orgName: parts.orgName,
      positionName: parts.positionName,
      url,
      deadline: deadlineText(expiresAt, locale),
      minutes: parts.minutes,
      contactEmail: opening.candidateContactEmail ?? parts.orgContact,
    });
    // The outbox is the mail path: nothing is sent from here (schema/compliance.ts).
    await tx.insert(messageOutbox).values({ orgId: user.orgId, kind: "INVITE", toEmail: email, subject: message.subject, body: message.body });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.invite",
      subjectType: "assessment",
      subjectId: assessment.id,
      meta: { openingId: opening.id, versionId: live.id, consentTextId, evaluators: panel.length, expiresAt: expiresAt.toISOString(), duplicate: input.allowDuplicate === true },
    });
    return { ok: true as const, assessmentId: assessment.id, candidateId: person.id, url, expiresAt, message };
  });
}

export type NewLinkOutcome =
  | { ok: true; url: string; expiresAt: Date; name: string; message: { subject: string; body: string } }
  | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" };

/** A new link lives at least this many more days. */
const NEW_LINK_MIN_DAYS = 7;

/**
 * "Yeni link üret": the old link stops working (EXPIRED, kept for history), a
 * new one keeps the progress state (NOT_STARTED, IN_PROGRESS or
 * RETAKE_AVAILABLE) and lives until the later of the old date and the end of
 * the org's day seven days from today. A finished candidate keeps their link
 * (it is their way back to /done). On a CLOSED opening only a candidate who
 * already started gets one (planner open question 6: a close stops only
 * not-started candidates).
 */
export async function newHiringLink(
  user: { id: string; orgId: string },
  openingId: string,
  assessmentId: string,
  options: { baseUrl?: string; now?: Date } = {},
): Promise<NewLinkOutcome> {
  if (!isUuid(openingId) || !isUuid(assessmentId)) return { ok: false, code: "NOT_FOUND" };
  const now = options.now ?? new Date();
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id, status: hiringOpenings.status, positionId: hiringOpenings.positionId, candidateContactEmail: hiringOpenings.candidateContactEmail })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, user.orgId)))
      .for("share");
    if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
    await assertActiveUser(tx, user.orgId, user.id);
    const [row] = await tx
      .select({
        assessmentId: hiringAssessments.assessmentId,
        versionId: hiringAssessments.versionId,
        name: candidates.fullName,
        email: candidates.email,
        locale: assessments.locale,
      })
      .from(hiringAssessments)
      .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, user.orgId)))
      .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
      .where(and(eq(hiringAssessments.assessmentId, assessmentId), eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, opening.id)))
      .limit(1)
      .for("update", { of: hiringAssessments });
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    const [old] = await tx
      .select({ id: assessmentLinks.id, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt })
      .from(assessmentLinks)
      .where(and(eq(assessmentLinks.assessmentId, row.assessmentId), ne(assessmentLinks.status, "EXPIRED")))
      .for("update");
    if (old?.status === "COMPLETED") return { ok: false as const, code: "COMPLETED" as const };
    // Planner open question 6: a closed opening stops only candidates who have not started.
    const begun = old?.status === "IN_PROGRESS" || old?.status === "RETAKE_AVAILABLE";
    if (opening.status === "CLOSED" && !begun && !(await hasStarted(tx, row.assessmentId))) return { ok: false as const, code: "CLOSED" as const };
    // The replaced link closes now: its card ("Bu linkin süresi dolmuş ...") never names a later day (Task 18 fix round 1).
    if (old) {
      await tx
        .update(assessmentLinks)
        .set({ status: "EXPIRED", expiresAt: old.expiresAt.getTime() < now.getTime() ? old.expiresAt : now })
        .where(and(eq(assessmentLinks.id, old.id), eq(assessmentLinks.assessmentId, row.assessmentId)));
    }
    const week = deadlineToDate(addDays(orgDay(now), NEW_LINK_MIN_DAYS));
    const expiresAt = old && old.expiresAt.getTime() > week.getTime() ? old.expiresAt : week;
    const token = mintToken();
    const url = `${origin(options.baseUrl)}/a/${token.raw}`;
    await tx.insert(assessmentLinks).values({
      assessmentId: row.assessmentId,
      tokenHash: token.hash,
      status: old?.status ?? "NOT_STARTED",
      expiresAt,
      attemptsAllowed: 1,
    });
    const parts = await messageParts(tx, user.orgId, opening.positionId, row.versionId);
    const message = inviteMessage({
      locale: row.locale,
      candidateName: row.name ?? "",
      orgName: parts.orgName,
      positionName: parts.positionName,
      url,
      deadline: deadlineText(expiresAt, row.locale),
      minutes: parts.minutes,
      contactEmail: opening.candidateContactEmail ?? parts.orgContact,
    });
    if (row.email) await tx.insert(messageOutbox).values({ orgId: user.orgId, kind: "INVITE", toEmail: row.email, subject: message.subject, body: message.body });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.link",
      subjectType: "assessment",
      subjectId: row.assessmentId,
      meta: { openingId: opening.id, replaced: old?.id ?? null, expiresAt: expiresAt.toISOString() },
    });
    await answerLinkRequests(tx, user, opening.id, row.assessmentId, "new-link");
    return { ok: true as const, url, expiresAt, name: row.name ?? "", message };
  });
}

/**
 * A new link or an extension is the answer to the candidate's "Yeni link talep
 * et" (ledger, Task 7 carry): their open NEW_LINK requests are closed by the
 * acting user, one audit row each, as "Tamam" would. Locked after the link
 * (lock order opening -> invitation -> link -> request).
 */
async function answerLinkRequests(
  x: Executor,
  user: { id: string; orgId: string },
  openingId: string,
  assessmentId: string,
  answeredBy: "new-link" | "extend",
): Promise<void> {
  const open = await x
    .select({ id: candidateRequests.id })
    .from(candidateRequests)
    .where(
      and(
        eq(candidateRequests.orgId, user.orgId),
        eq(candidateRequests.assessmentId, assessmentId),
        eq(candidateRequests.kind, "NEW_LINK"),
        isNull(candidateRequests.handledAt),
      ),
    )
    .for("update");
  if (open.length === 0) return;
  const at = new Date();
  await x
    .update(candidateRequests)
    .set({ handledBy: user.id, handledAt: at })
    .where(
      and(
        inArray(
          candidateRequests.id,
          open.map((r) => r.id),
        ),
        eq(candidateRequests.orgId, user.orgId),
        isNull(candidateRequests.handledAt),
      ),
    );
  for (const r of open) {
    await x.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.request",
      subjectType: "assessment",
      subjectId: assessmentId,
      meta: { openingId, requestId: r.id, kind: "NEW_LINK", answeredBy },
    });
  }
}

export type ExtendLinkOutcome = { ok: true; expiresAt: Date } | { ok: false; code: "NOT_FOUND" | "COMPLETED" | "CLOSED" | "STARTED" };

/** "7 gün uzat" gives this many more days. */
const EXTEND_DAYS = 7;

/**
 * "7 gün uzat" on the Candidates tab (ruling C8; the core extendLink serves
 * exam links only). Scoped to the opening: the invitation must be this
 * opening's, in the caller's organisation, and the opening not CLOSED. It acts
 * on the invitation's newest link (a link replaced by "Yeni link üret" is
 * older and stays EXPIRED): seven more days to the end of the organisation's
 * day, counted from the later of today and the link's own last day, and an
 * expired link works again (NOT_STARTED; the sweep expires only links never
 * started). A candidate who started is not stopped by the link's date
 * (candidate-context), so there is nothing to extend (STARTED); a finished one
 * keeps their link (COMPLETED). Not clamped to the opening's deadline (Task 7
 * ruling). Audited.
 */
export async function extendHiringLink(
  user: { id: string; orgId: string },
  openingId: string,
  assessmentId: string,
  options: { now?: Date } = {},
): Promise<ExtendLinkOutcome> {
  if (!isUuid(openingId) || !isUuid(assessmentId)) return { ok: false, code: "NOT_FOUND" };
  const now = options.now ?? new Date();
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id, status: hiringOpenings.status })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, user.orgId)))
      .for("share");
    if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
    await assertActiveUser(tx, user.orgId, user.id);
    if (opening.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
    const [row] = await tx
      .select({ assessmentId: hiringAssessments.assessmentId })
      .from(hiringAssessments)
      .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, user.orgId)))
      .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
      .where(and(eq(hiringAssessments.assessmentId, assessmentId), eq(hiringAssessments.orgId, user.orgId), eq(hiringAssessments.openingId, opening.id)))
      .limit(1)
      .for("update", { of: hiringAssessments });
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    const [link] = await tx
      .select({ id: assessmentLinks.id, status: assessmentLinks.status, expiresAt: assessmentLinks.expiresAt })
      .from(assessmentLinks)
      .where(eq(assessmentLinks.assessmentId, row.assessmentId))
      .orderBy(desc(assessmentLinks.createdAt), desc(assessmentLinks.id))
      .limit(1)
      .for("update");
    if (!link) return { ok: false as const, code: "NOT_FOUND" as const };
    if (link.status === "COMPLETED") return { ok: false as const, code: "COMPLETED" as const };
    if (link.status === "IN_PROGRESS" || link.status === "RETAKE_AVAILABLE") return { ok: false as const, code: "STARTED" as const };
    const from = link.expiresAt.getTime() > now.getTime() ? link.expiresAt : now;
    const expiresAt = deadlineToDate(addDays(orgDay(from), EXTEND_DAYS));
    await tx
      .update(assessmentLinks)
      .set({ expiresAt, status: "NOT_STARTED" })
      .where(and(eq(assessmentLinks.id, link.id), eq(assessmentLinks.assessmentId, row.assessmentId)));
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.extend",
      subjectType: "assessment",
      subjectId: row.assessmentId,
      meta: { openingId: opening.id, linkId: link.id, from: link.expiresAt.toISOString(), to: expiresAt.toISOString() },
    });
    await answerLinkRequests(tx, user, opening.id, row.assessmentId, "extend");
    return { ok: true as const, expiresAt };
  });
}

export type CandidateRequestRow = {
  id: string;
  /** REQUEST: candidate_requests (accommodation, new link), closed with markRequestHandled. DATA_RIGHTS: the person's deletion_requests (see, copy, delete), shown so the team knows; handled outside this tab. */
  source: "REQUEST" | "DATA_RIGHTS";
  kind: string;
  message: string | null;
  createdAt: Date;
};

export type OpeningCandidateRow = {
  assessmentId: string;
  candidateId: string;
  /** Invitation order, 1-based: "Aday 3" when identity is hidden. */
  seq: number;
  name: string | null;
  email: string | null;
  locale: Locale;
  invitedAt: Date;
  link: { id: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "RETAKE_AVAILABLE"; expiresAt: Date } | null;
  progress: CandidateProgress;
  stagesDone: number;
  stageCount: number;
  lastActivityAt: Date | null;
  completedAt: Date | null;
  /**
   * "Süre uyarlaması uygulandı", only for someone who runs the opening and is
   * not on this invitation's panel (an evaluator never learns it); never the
   * percentage (HIRING-UX A6).
   */
  adapted: boolean;
  /** The candidate's open requests (accommodation, new link, data rights), oldest first; only for someone who runs the opening. */
  requests: CandidateRequestRow[];
};

const latest = (...dates: Array<Date | null>) => dates.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

/**
 * The opening's Candidates tab. `viewer.runs` (owner or manager) sees the
 * adaptation flag (except on invitations whose panel names `viewer.id`, A6)
 * and the requests and acts on links and requests; a viewer
 * who does not run the opening gets no name and no e-mail while blind mode is
 * on (HIRING-UX 3.8). What a viewer may not see is cut in the query, never
 * after it (spec 4, UX R1): identity, extra time and requests are not read.
 *
 * Visibility (ruling C12): this is plan 2's interim rule (the recruiter tracks
 * candidates by name; no submissions exist yet; blind mode masks only
 * non-runners). Plan 3's visibility.ts (spec 4, visibilityFor) replaces it,
 * lifting blind mode after the viewer's own submission.
 */
export async function listOpeningCandidates(
  orgId: string,
  openingId: string,
  viewer: { id: string; runs: boolean; blindMode: boolean },
  now: Date = new Date(),
): Promise<OpeningCandidateRow[]> {
  if (!isUuid(openingId)) return [];
  const identity = viewer.runs || !viewer.blindMode;
  const rows: Array<{
    assessmentId: string;
    candidateId: string;
    name?: string | null;
    email?: string | null;
    locale: Locale;
    invitedAt: Date;
    versionId: string;
    extraTimePct?: number;
  }> = await db
    .select({
      assessmentId: hiringAssessments.assessmentId,
      candidateId: candidates.id,
      ...(identity ? { name: candidates.fullName, email: candidates.email } : {}),
      locale: assessments.locale,
      invitedAt: assessments.createdAt,
      versionId: hiringAssessments.versionId,
      // Spec 2.4: extra time is selected only for someone who runs the opening.
      ...(viewer.runs ? { extraTimePct: hiringAssessments.extraTimePct } : {}),
    })
    .from(hiringAssessments)
    .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId)))
    .orderBy(asc(assessments.createdAt), asc(hiringAssessments.assessmentId));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.assessmentId);
  const candidateIds = rows.map((r) => r.candidateId);
  const [links, attemptRows, counts, requests, rights, panel] = await Promise.all([
    db
      .select({
        id: assessmentLinks.id,
        assessmentId: assessmentLinks.assessmentId,
        status: assessmentLinks.status,
        expiresAt: assessmentLinks.expiresAt,
        firstSeenIp: assessmentLinks.firstSeenIp,
        createdAt: assessmentLinks.createdAt,
      })
      .from(assessmentLinks)
      .where(inArray(assessmentLinks.assessmentId, ids))
      .orderBy(desc(assessmentLinks.createdAt)),
    db
      .select({ id: attempts.id, assessmentId: attempts.assessmentId, startedAt: attempts.startedAt, completedAt: attempts.completedAt })
      .from(attempts)
      .where(inArray(attempts.assessmentId, ids))
      .orderBy(desc(attempts.attemptNumber)),
    db
      .select({ versionId: hiringStages.versionId, count: sql<number>`count(*)::int` })
      .from(hiringStages)
      .where(inArray(hiringStages.versionId, [...new Set(rows.map((r) => r.versionId))]))
      .groupBy(hiringStages.versionId),
    viewer.runs
      ? db
          .select({ id: candidateRequests.id, assessmentId: candidateRequests.assessmentId, kind: candidateRequests.kind, message: candidateRequests.message, createdAt: candidateRequests.createdAt })
          .from(candidateRequests)
          .where(and(eq(candidateRequests.orgId, orgId), inArray(candidateRequests.assessmentId, ids), isNull(candidateRequests.handledAt)))
          .orderBy(asc(candidateRequests.createdAt))
      : Promise.resolve([]),
    viewer.runs
      ? db
          .select({ id: deletionRequests.id, candidateId: deletionRequests.candidateId, kind: deletionRequests.kind, message: deletionRequests.message, createdAt: deletionRequests.createdAt })
          .from(deletionRequests)
          .innerJoin(candidates, and(eq(candidates.id, deletionRequests.candidateId), eq(candidates.orgId, orgId)))
          .where(and(inArray(deletionRequests.candidateId, candidateIds), isNull(deletionRequests.handledAt)))
          .orderBy(asc(deletionRequests.createdAt))
      : Promise.resolve([]),
    // A6: the invitations this runner evaluates; the adaptation stays hidden on those.
    viewer.runs
      ? db
          .select({ assessmentId: hiringAssignments.assessmentId })
          .from(hiringAssignments)
          .where(and(eq(hiringAssignments.userId, viewer.id), inArray(hiringAssignments.assessmentId, ids)))
      : Promise.resolve([]),
  ]);
  const evaluates = new Set(panel.map((p) => p.assessmentId));
  const attemptIds = attemptRows.map((a) => a.id);
  const runs = attemptIds.length
    ? await db
        .select({ attemptId: hiringStageRuns.attemptId, startedAt: hiringStageRuns.startedAt, submittedAt: hiringStageRuns.submittedAt, lastHeartbeatAt: hiringStageRuns.lastHeartbeatAt })
        .from(hiringStageRuns)
        .where(inArray(hiringStageRuns.attemptId, attemptIds))
    : [];
  return rows.map((r, i) => {
    // Links and attempts come newest first (ordered above). The link shown is
    // the live one (at most one is not EXPIRED), else the newest; "opened"
    // counts any link of the invitation, so a new link never makes a
    // candidate who already opened one look merely invited.
    const ownLinks = links.filter((l) => l.assessmentId === r.assessmentId);
    const link = ownLinks.find((l) => l.status !== "EXPIRED") ?? ownLinks[0] ?? null;
    const attempt = attemptRows.find((a) => a.assessmentId === r.assessmentId) ?? null;
    const own = attempt ? runs.filter((run) => run.attemptId === attempt.id) : [];
    const open: CandidateRequestRow[] = [
      ...requests.filter((q) => q.assessmentId === r.assessmentId).map((q) => ({ id: q.id, source: "REQUEST" as const, kind: q.kind, message: q.message, createdAt: q.createdAt })),
      ...rights.filter((q) => q.candidateId === r.candidateId).map((q) => ({ id: q.id, source: "DATA_RIGHTS" as const, kind: q.kind, message: q.message, createdAt: q.createdAt })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return {
      assessmentId: r.assessmentId,
      candidateId: r.candidateId,
      seq: i + 1,
      name: identity ? (r.name ?? null) : null,
      email: identity ? (r.email ?? null) : null,
      locale: r.locale,
      invitedAt: r.invitedAt,
      link: link ? { id: link.id, status: link.status, expiresAt: link.expiresAt } : null,
      progress: candidateProgress({
        linkStatus: link?.status ?? "EXPIRED",
        linkExpiresAt: link?.expiresAt ?? new Date(0),
        firstSeen: ownLinks.some((l) => !!l.firstSeenIp),
        started: !!attempt?.startedAt,
        completed: !!attempt?.completedAt,
        now,
      }),
      stagesDone: own.filter((run) => run.submittedAt).length,
      stageCount: counts.find((c) => c.versionId === r.versionId)?.count ?? 0,
      lastActivityAt: latest(...own.flatMap((run) => [run.startedAt, run.submittedAt, run.lastHeartbeatAt])),
      completedAt: attempt?.completedAt ?? null,
      adapted: viewer.runs && !evaluates.has(r.assessmentId) && (r.extraTimePct ?? 0) > 0,
      requests: viewer.runs ? open : [],
    };
  });
}

/**
 * "Tamam" on a candidate's request (ruling C7: candidate_requests only): a
 * request of an invitation to this opening of this organisation, found through
 * the invitation (org_id on both rows, opening_id on the invitation). The row
 * is locked, so two clicks write one handler; a request already handled
 * answers true without a write (idempotent). handled_by is the acting user
 * (RESTRICT: users are disabled, never deleted).
 */
export async function markRequestHandled(user: { id: string; orgId: string }, openingId: string, requestId: string): Promise<boolean> {
  if (!isUuid(openingId) || !isUuid(requestId)) return false;
  return db.transaction(async (tx) => {
    await assertActiveUser(tx, user.orgId, user.id);
    const [found] = await tx
      .select({ id: candidateRequests.id, assessmentId: candidateRequests.assessmentId, kind: candidateRequests.kind, handledAt: candidateRequests.handledAt })
      .from(candidateRequests)
      .innerJoin(
        hiringAssessments,
        and(eq(hiringAssessments.assessmentId, candidateRequests.assessmentId), eq(hiringAssessments.orgId, candidateRequests.orgId)),
      )
      .where(and(eq(candidateRequests.id, requestId), eq(candidateRequests.orgId, user.orgId), eq(hiringAssessments.openingId, openingId)))
      .limit(1)
      .for("update", { of: candidateRequests });
    if (!found) return false;
    if (found.handledAt) return true;
    await tx
      .update(candidateRequests)
      .set({ handledBy: user.id, handledAt: new Date() })
      .where(and(eq(candidateRequests.id, found.id), eq(candidateRequests.orgId, user.orgId), isNull(candidateRequests.handledAt)));
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.candidate.request",
      subjectType: "assessment",
      subjectId: found.assessmentId,
      meta: { openingId, requestId: found.id, kind: found.kind },
    });
    return true;
  });
}

/** One row per invitation, even if a later attempt is ever marked primary too: the funnel's "started" (openingFunnel and openingCardFacts). */
function firstAttempts<T extends { assessmentId: string }>(rows: readonly T[]): Map<string, T> {
  const first = new Map<string, T>();
  for (const a of rows) if (!first.has(a.assessmentId)) first.set(a.assessmentId, a);
  return first;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type OpeningFunnel = {
  invited: number;
  started: number;
  completed: number;
  medianMinutes: number | null;
  estimateMinutes: number | null;
  /**
   * The finish survey as the team may see it (Task 16 carry, Task 19 ruling 1
   * and fix round 1): the candidate is told the team never sees their name,
   * only the average and unnamed comments. So only the oldest whole batches of
   * SURVEY_BATCH answers count (`count` is that released number, 0 before the
   * first batch); a comment carries no rating and no date; the comments are a
   * few of the released ones in an order seeded by the opening and the released
   * count, the same on every reload.
   */
  survey: { count: number; average: number | null; comments: string[] };
};

export { SURVEY_MIN_ANSWERS };

/** How many comments the overview shows, drawn from this many of the newest released non-empty ones. */
const SURVEY_COMMENTS_SHOWN = 3;
const SURVEY_COMMENTS_POOL = 20;

/**
 * HIRING-UX 5.4 in plan 2: Davet, Başladı, Tamamladı, each invitation counted
 * once (its primary attempt); the median wall-clock time (start to finish,
 * breaks included) against the estimate the candidate was given (C25: the live
 * version's stage minutes plus the grace of ALLOW_GRACE stages, no extra time);
 * the survey in released batches. Only this organisation's invitations to this
 * opening count. `prng` makes the comment sample's generator from its seed
 * (tests pass their own).
 */
export async function openingFunnel(orgId: string, openingId: string, prng: (seed: number) => () => number = seededRandom): Promise<OpeningFunnel> {
  const empty: OpeningFunnel = { invited: 0, started: 0, completed: 0, medianMinutes: null, estimateMinutes: null, survey: { count: 0, average: null, comments: [] } };
  if (!isUuid(openingId)) return empty;
  const invited = await db
    .select({ assessmentId: hiringAssessments.assessmentId })
    .from(hiringAssessments)
    .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId)));
  if (invited.length === 0) return empty;
  const ids = invited.map((r) => r.assessmentId);
  const [attemptRows, [answered], versions] = await Promise.all([
    db
      .select({ assessmentId: attempts.assessmentId, startedAt: attempts.startedAt, completedAt: attempts.completedAt })
      .from(attempts)
      .where(and(inArray(attempts.assessmentId, ids), eq(attempts.isPrimary, true), isNotNull(attempts.startedAt))),
    // The survey is read for the opening through its invitations (M2), never by a list of ids;
    // only answers older than a day count (fix round 2), in this total and in the batch read.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(hiringSurveyResponses)
      .innerJoin(hiringAssessments, eq(hiringAssessments.assessmentId, hiringSurveyResponses.assessmentId))
      .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
      .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
      .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId), sql`${hiringSurveyResponses.createdAt} < now() - interval '24 hours'`)),
    versionsOf(orgId, openingId),
  ]);
  const { live } = workingVersions(versions);
  const stages = live
    ? await db
        .select({ id: hiringStages.id, durationSeconds: hiringStages.durationSeconds, graceSeconds: hiringStages.graceSeconds, onTimeout: hiringStages.onTimeout })
        .from(hiringStages)
        .where(eq(hiringStages.versionId, live.id))
    : null;
  const started = [...firstAttempts(attemptRows).values()];
  const done = started.filter((a) => a.completedAt && a.startedAt);
  const minutes = median(done.map((a) => (a.completedAt!.getTime() - a.startedAt!.getTime()) / 60_000));
  return {
    invited: invited.length,
    started: started.length,
    completed: done.length,
    medianMinutes: minutes === null ? null : Math.round(minutes),
    estimateMinutes: stages
      ? estimatedMinutes(
          { stages },
          0,
          Object.fromEntries(stages.map((st) => [st.id, st.onTimeout === "ALLOW_GRACE" ? st.graceSeconds : 0])),
        )
      : null,
    survey: await releasedSurvey(orgId, openingId, Number(answered?.n ?? 0), prng),
  };
}

/**
 * The released part of the opening's finish survey (Task 19 fix rounds 1 and
 * 2): of the answers older than a day (so a release is never the moment one
 * candidate finished), the oldest releasedSurveyCount(total), ordered by when
 * they came (then by invitation id, so ties are stable), counted and averaged
 * in SQL; the comment pool is the 20 newest non-empty comments among them. No
 * date and no rating per comment leaves the database. If the batch read finds
 * fewer answers than were released (one was deleted between the two reads),
 * it waits: a smaller batch would tell what the missing answer was. The pool
 * is sorted by its words before the seeded sample, so the order shown carries
 * no time.
 */
async function releasedSurvey(orgId: string, openingId: string, total: number, prng: (seed: number) => () => number): Promise<OpeningFunnel["survey"]> {
  const released = releasedSurveyCount(total);
  if (released === 0) return { count: 0, average: null, comments: [] };
  const [row] = (await db.execute(sql`
    with released as (
      select r.rating, r.comment, r.created_at, r.assessment_id
      from hiring_survey_responses r
      join hiring_assessments h on h.assessment_id = r.assessment_id
      join assessments a on a.id = h.assessment_id and a.org_id = ${orgId}
      join candidates c on c.id = a.candidate_id and c.deleted_at is null
      where h.org_id = ${orgId} and h.opening_id = ${openingId}
        and r.created_at < now() - interval '24 hours'
      order by r.created_at asc, r.assessment_id asc
      limit ${released}
    )
    select
      (select count(*)::int from released) as count,
      (select avg(rating) from released) as average,
      (select coalesce(array_agg(comment order by created_at desc, assessment_id desc), '{}') from (
        select comment, created_at, assessment_id from released
        where btrim(coalesce(comment, '')) <> ''
        order by created_at desc, assessment_id desc
        limit 20
      ) pool) as comments
  `)) as unknown as Array<{ count: number; average: string | number | null; comments: Array<string | null> | null }>;
  const count = Number(row?.count ?? 0);
  if (count !== released || row?.average === null || row?.average === undefined) return { count: 0, average: null, comments: [] };
  const pool = (row.comments ?? [])
    .map((c) => (c ?? "").trim())
    .filter((c) => c !== "")
    .slice(0, SURVEY_COMMENTS_POOL)
    // By code units: the same order on every server, whatever its locale.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    count,
    average: Math.round(Number(row.average) * 10) / 10,
    comments: sampleOf(pool, SURVEY_COMMENTS_SHOWN, prng(surveySeed(openingId, count))),
  };
}

/**
 * HIRING-VISUAL-FLOW 4.4 (KG1, KG4, H9): what an opening's row in the control
 * view says. `requests` is there only for someone who runs openings, and only
 * then are requests read at all (STATUS 321): open candidate requests
 * (accommodation, new link) and data-rights requests (counted, handled with
 * plan 3, ruling C6). A reviewer's facts have no `requests` key.
 */
export type OpeningCardFacts = {
  invited: number;
  started: number;
  completed: number;
  /** Links not finished that expire within EXPIRING_SOON_MS, on openings not closed (a count, so a reviewer sees it too, H9). */
  expiringSoon: number;
  requests?: { open: number; rights: number };
};

/**
 * The facts of many openings at once. Invited, started and completed count
 * what the overview's funnel counts (openingFunnel): this organisation's
 * invitations of people not deleted, each counted once by its first primary
 * attempt that started. A closed opening's link can be neither opened nor
 * extended, so it is not counted as expiring (as on Today). Every read is
 * scoped to the organisation (attempts, links and requests through the
 * invitations read first) and runs after the one before (ruling C21: the pool
 * of five connections is shared with the live exam's writes).
 */
export async function openingCardFacts(orgId: string, openingIds: string[], viewer: { runs: boolean }, now: Date = new Date()): Promise<Record<string, OpeningCardFacts>> {
  const ids = openingIds.filter(isUuid);
  if (ids.length === 0) return {};
  const blank = (): OpeningCardFacts => ({ invited: 0, started: 0, completed: 0, expiringSoon: 0, ...(viewer.runs ? { requests: { open: 0, rights: 0 } } : {}) });
  const facts: Record<string, OpeningCardFacts> = Object.fromEntries(ids.map((id) => [id, blank()]));
  const invitations = await db
    .select({ assessmentId: hiringAssessments.assessmentId, openingId: hiringAssessments.openingId, candidateId: candidates.id })
    .from(hiringAssessments)
    .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), inArray(hiringAssessments.openingId, ids)));
  if (invitations.length === 0) return facts;
  const assessmentIds = invitations.map((i) => i.assessmentId);
  const tries = await db
    .select({ assessmentId: attempts.assessmentId, completedAt: attempts.completedAt })
    .from(attempts)
    .where(and(inArray(attempts.assessmentId, assessmentIds), eq(attempts.isPrimary, true), isNotNull(attempts.startedAt)));
  const expiring = await db
    .select({ assessmentId: assessmentLinks.assessmentId })
    .from(assessmentLinks)
    .innerJoin(hiringAssessments, and(eq(hiringAssessments.assessmentId, assessmentLinks.assessmentId), eq(hiringAssessments.orgId, orgId)))
    .innerJoin(hiringOpenings, and(eq(hiringOpenings.id, hiringAssessments.openingId), eq(hiringOpenings.orgId, orgId)))
    .where(
      and(
        inArray(assessmentLinks.assessmentId, assessmentIds),
        inArray(assessmentLinks.status, ["NOT_STARTED", "IN_PROGRESS"]),
        gt(assessmentLinks.expiresAt, now),
        lt(assessmentLinks.expiresAt, new Date(now.getTime() + EXPIRING_SOON_MS)),
        ne(hiringOpenings.status, "CLOSED"),
      ),
    );
  const requests = viewer.runs
    ? await db
        .select({ assessmentId: candidateRequests.assessmentId })
        .from(candidateRequests)
        .where(and(eq(candidateRequests.orgId, orgId), inArray(candidateRequests.assessmentId, assessmentIds), isNull(candidateRequests.handledAt)))
    : [];
  const rights = viewer.runs
    ? await db
        .select({ id: deletionRequests.id, candidateId: deletionRequests.candidateId })
        .from(deletionRequests)
        .innerJoin(candidates, and(eq(candidates.id, deletionRequests.candidateId), eq(candidates.orgId, orgId)))
        .where(and(inArray(deletionRequests.candidateId, [...new Set(invitations.map((i) => i.candidateId))]), isNull(deletionRequests.handledAt)))
    : [];
  // Counted by invitation through maps, so a page of many openings stays linear.
  const tally = (rows: ReadonlyArray<{ assessmentId: string }>) => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.assessmentId, (n.get(r.assessmentId) ?? 0) + 1);
    return n;
  };
  const first = firstAttempts(tries);
  const expiringBy = tally(expiring);
  const requestsBy = tally(requests);
  const peopleBy = new Map<string, Set<string>>();
  for (const inv of invitations) {
    const f = facts[inv.openingId];
    if (!f) continue;
    const attempt = first.get(inv.assessmentId);
    f.invited += 1;
    if (attempt) f.started += 1;
    if (attempt?.completedAt) f.completed += 1;
    f.expiringSoon += expiringBy.get(inv.assessmentId) ?? 0;
    if (f.requests) f.requests.open += requestsBy.get(inv.assessmentId) ?? 0;
    peopleBy.set(inv.openingId, (peopleBy.get(inv.openingId) ?? new Set()).add(inv.candidateId));
  }
  // A data-rights request belongs to the person: counted once in each opening the person was invited to.
  for (const [openingId, f] of Object.entries(facts)) {
    if (!f.requests) continue;
    const people = peopleBy.get(openingId) ?? new Set<string>();
    f.requests.rights = new Set(rights.filter((r) => people.has(r.candidateId)).map((r) => r.id)).size;
  }
  return facts;
}

/**
 * The organisation's OPEN openings with what the invite form needs (HIRING-UX
 * 5.11): whether a version is live, how many active evaluators the invitation
 * would copy, the decision minimum (for the small-panel warning) and the
 * opening's last day in the organisation's zone. Only callers who run
 * openings use it. Every read carries the organisation: the openings, their
 * published versions, and the panel's users.
 */
export async function invitableOpenings(
  orgId: string,
): Promise<Array<{ id: string; name: string; live: boolean; evaluators: number; minEvaluations: number; deadlineDay: string | null }>> {
  const rows = await db
    .select({ id: hiringOpenings.id, name: hiringOpenings.name, deadlineAt: hiringOpenings.deadlineAt, minEvaluations: hiringOpenings.minEvaluations })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.orgId, orgId), eq(hiringOpenings.status, "OPEN")))
    .orderBy(desc(hiringOpenings.createdAt), desc(hiringOpenings.id));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [live, members] = await Promise.all([
    db
      .select({ openingId: hiringVersions.openingId })
      .from(hiringVersions)
      .where(and(inArray(hiringVersions.openingId, ids), eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "PUBLISHED"))),
    db
      .select({ openingId: hiringOpeningMembers.openingId, count: sql<number>`count(*)::int` })
      .from(hiringOpeningMembers)
      .innerJoin(users, and(eq(users.id, hiringOpeningMembers.userId), eq(users.orgId, orgId), isNull(users.disabledAt)))
      .where(inArray(hiringOpeningMembers.openingId, ids))
      .groupBy(hiringOpeningMembers.openingId),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    live: live.some((v) => v.openingId === r.id),
    evaluators: Number(members.find((m) => m.openingId === r.id)?.count ?? 0),
    minEvaluations: r.minEvaluations,
    deadlineDay: r.deadlineAt ? orgDay(r.deadlineAt) : null,
  }));
}
