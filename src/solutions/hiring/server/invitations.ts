import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
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
  formatInviteDeadline,
  inviteMessage,
  isEmail,
  linkExpiryDay,
  MAX_NAME_LENGTH,
  SURVEY_MIN_ANSWERS,
  type CandidateProgress,
} from "../rules/invitation";
import { deadlineToDate } from "../rules/opening-rules";
import { workingVersions } from "../rules/versions";
import { ensureHiringConsentText } from "./consent";
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
 * Capability: the actions (invite, new link, request handled) check
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

/** The same name rule as the pasted list (parseInviteRows): 2 to MAX_NAME_LENGTH characters, no angle brackets, no "@". */
function cleanName(value: string): string | null {
  const name = value.replace(/\s+/g, " ").trim();
  const length = Array.from(name).length;
  return length >= 2 && length <= MAX_NAME_LENGTH && !/[<>@]/.test(name) ? name : null;
}

/** The words of the ready message: organisation, position, minutes on the clock (without extra time), contact. */
async function messageParts(x: Executor, orgId: string, positionId: string, versionId: string) {
  const [[org], [position], [length]] = await Promise.all([
    x.select({ name: organizations.name, contactEmail: organizations.contactEmail }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    x.select({ name: positions.name }).from(positions).where(and(eq(positions.id, positionId), eq(positions.orgId, orgId))).limit(1),
    x.select({ total: sql<number>`coalesce(sum(${hiringStages.durationSeconds}), 0)::int` }).from(hiringStages).where(eq(hiringStages.versionId, versionId)),
  ]);
  return { orgName: org?.name ?? "", orgContact: org?.contactEmail ?? null, positionName: position?.name ?? "", minutes: Math.ceil(Number(length?.total ?? 0) / 60) };
}

/** The message's deadline: the last day in the organisation's zone, with the zone named (Task 6 ruling). */
const deadlineText = (expiresAt: Date, locale: Locale) => formatInviteDeadline(orgDay(expiresAt), locale, zoneLabel(locale));

export async function createHiringInvitation(
  user: { id: string; orgId: string },
  input: InviteInput,
  options: { baseUrl?: string; now?: Date } = {},
): Promise<InviteOutcome> {
  const now = options.now ?? new Date();
  const fullName = cleanName(input.fullName);
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

/** The candidate has begun: an attempt of the invitation started, or one of its stages did. */
async function hasStarted(x: Executor, assessmentId: string): Promise<boolean> {
  const [started] = await x
    .select({ id: attempts.id })
    .from(attempts)
    .leftJoin(hiringStageRuns, eq(hiringStageRuns.attemptId, attempts.id))
    .where(and(eq(attempts.assessmentId, assessmentId), or(isNotNull(attempts.startedAt), isNotNull(hiringStageRuns.startedAt))))
    .limit(1);
  return !!started;
}

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
    if (old) await tx.update(assessmentLinks).set({ status: "EXPIRED" }).where(and(eq(assessmentLinks.id, old.id), eq(assessmentLinks.assessmentId, row.assessmentId)));
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
    return { ok: true as const, url, expiresAt, name: row.name ?? "", message };
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
  /** "Süre uyarlaması uygulandı", only for someone who runs the opening; never the percentage (HIRING-UX A6). */
  adapted: boolean;
  /** The candidate's open requests (accommodation, new link, data rights), oldest first; only for someone who runs the opening. */
  requests: CandidateRequestRow[];
};

const latest = (...dates: Array<Date | null>) => dates.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

/**
 * The opening's Candidates tab. `viewer.runs` (owner or manager) sees the
 * adaptation flag and the requests and acts on links and requests; a viewer
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
  viewer: { runs: boolean; blindMode: boolean },
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
  const [links, attemptRows, counts, requests, rights] = await Promise.all([
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
  ]);
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
      adapted: viewer.runs && (r.extraTimePct ?? 0) > 0,
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
  survey: { count: number; average: number | null; latest: Array<{ rating: number; comment: string; at: Date }> };
};

export { SURVEY_MIN_ANSWERS };

/**
 * HIRING-UX 5.4 in plan 2: Davet, Başladı, Tamamladı, each invitation counted
 * once (its primary attempt); the median time against the live version's
 * estimate; the survey from SURVEY_MIN_ANSWERS answers. Only this
 * organisation's invitations to this opening count.
 */
export async function openingFunnel(orgId: string, openingId: string): Promise<OpeningFunnel> {
  const empty: OpeningFunnel = { invited: 0, started: 0, completed: 0, medianMinutes: null, estimateMinutes: null, survey: { count: 0, average: null, latest: [] } };
  if (!isUuid(openingId)) return empty;
  const invited = await db
    .select({ assessmentId: hiringAssessments.assessmentId })
    .from(hiringAssessments)
    .innerJoin(assessments, and(eq(assessments.id, hiringAssessments.assessmentId), eq(assessments.orgId, orgId)))
    .innerJoin(candidates, and(eq(candidates.id, assessments.candidateId), isNull(candidates.deletedAt)))
    .where(and(eq(hiringAssessments.orgId, orgId), eq(hiringAssessments.openingId, openingId)));
  if (invited.length === 0) return empty;
  const ids = invited.map((r) => r.assessmentId);
  const [attemptRows, survey, versions] = await Promise.all([
    db
      .select({ assessmentId: attempts.assessmentId, startedAt: attempts.startedAt, completedAt: attempts.completedAt })
      .from(attempts)
      .where(and(inArray(attempts.assessmentId, ids), eq(attempts.isPrimary, true), isNotNull(attempts.startedAt))),
    db
      .select({ rating: hiringSurveyResponses.rating, comment: hiringSurveyResponses.comment, at: hiringSurveyResponses.createdAt })
      .from(hiringSurveyResponses)
      .where(inArray(hiringSurveyResponses.assessmentId, ids))
      .orderBy(desc(hiringSurveyResponses.createdAt)),
    versionsOf(orgId, openingId),
  ]);
  const { live } = workingVersions(versions);
  const [length] = live
    ? await db.select({ total: sql<number>`coalesce(sum(${hiringStages.durationSeconds}), 0)::int` }).from(hiringStages).where(eq(hiringStages.versionId, live.id))
    : [];
  // One row per invitation, even if a later attempt is ever marked primary too.
  const byInvitation = new Map<string, { startedAt: Date | null; completedAt: Date | null }>();
  for (const a of attemptRows) if (!byInvitation.has(a.assessmentId)) byInvitation.set(a.assessmentId, a);
  const started = [...byInvitation.values()];
  const done = started.filter((a) => a.completedAt && a.startedAt);
  const enough = survey.length >= SURVEY_MIN_ANSWERS;
  const minutes = median(done.map((a) => (a.completedAt!.getTime() - a.startedAt!.getTime()) / 60_000));
  return {
    invited: invited.length,
    started: started.length,
    completed: done.length,
    medianMinutes: minutes === null ? null : Math.round(minutes),
    estimateMinutes: length ? Math.ceil(Number(length.total) / 60) : null,
    survey: {
      count: survey.length,
      average: enough ? Math.round((survey.reduce((s, r) => s + r.rating, 0) / survey.length) * 10) / 10 : null,
      latest: enough
        ? survey
            .filter((r) => r.comment && r.comment.trim())
            .slice(0, 3)
            .map((r) => ({ rating: r.rating, comment: r.comment!.trim(), at: r.at }))
        : [],
    },
  };
}
