import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringOpeningMembers, hiringOpenings, hiringVersions, positionCompetencies, positions, users } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ORG_TIMEZONE, orgDay } from "@/lib/org-timezone";
import { createPosition } from "@/server/library-write";
import { isUuid, loadPanelUsers } from "@/server/settings";
import { openingAccess, type Viewer } from "../rules/access";
import { deadlineToDate, openingRulesProblems, type OpeningRulesInput, type RulesProblem } from "../rules/opening-rules";
import { workingVersions } from "../rules/versions";
import { HiringNotFound } from "./errors";
import { assertActiveUser, cloneContent, inheritedSettings, lockOpening, versionRow, versionsOf } from "./versions";

export type OpeningStatus = "DRAFT" | "OPEN" | "CLOSED";
export type OpeningDetail = typeof hiringOpenings.$inferSelect & { positionName: string; memberIds: string[] };

export async function loadOpening(orgId: string, id: string): Promise<OpeningDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ opening: hiringOpenings, positionName: positions.name })
    .from(hiringOpenings)
    .innerJoin(positions, and(eq(positions.id, hiringOpenings.positionId), eq(positions.orgId, orgId)))
    .where(and(eq(hiringOpenings.id, id), eq(hiringOpenings.orgId, orgId)))
    .limit(1);
  if (!row) return null;
  // The opening was just proven to be the caller's, so its members are read by its id.
  const members = await db.select({ userId: hiringOpeningMembers.userId }).from(hiringOpeningMembers).where(eq(hiringOpeningMembers.openingId, row.opening.id));
  return { ...row.opening, positionName: row.positionName, memberIds: members.map((m) => m.userId) };
}

export type OpeningListRow = {
  id: string;
  name: string;
  status: OpeningStatus;
  deadlineAt: Date | null;
  positionName: string;
  ownerName: string | null;
  liveNumber: number | null;
  draftNumber: number | null;
};

/**
 * HIRING-UX 5.2. A reviewer sees only the openings they work on. `viewer` is
 * the session user of `orgId` (openingAccess cannot tell organisations apart).
 */
export async function listOpenings(orgId: string, viewer: Viewer, status: OpeningStatus): Promise<OpeningListRow[]> {
  const rows = await db
    .select({
      id: hiringOpenings.id,
      name: hiringOpenings.name,
      status: hiringOpenings.status,
      deadlineAt: hiringOpenings.deadlineAt,
      decisionMakerId: hiringOpenings.decisionMakerId,
      backupDecisionMakerId: hiringOpenings.backupDecisionMakerId,
      positionName: positions.name,
      ownerName: users.name,
    })
    .from(hiringOpenings)
    .innerJoin(positions, and(eq(positions.id, hiringOpenings.positionId), eq(positions.orgId, orgId)))
    .leftJoin(users, and(eq(users.id, hiringOpenings.ownerId), eq(users.orgId, orgId)))
    .where(and(eq(hiringOpenings.orgId, orgId), eq(hiringOpenings.status, status)))
    .orderBy(desc(hiringOpenings.createdAt), desc(hiringOpenings.id));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [members, versions] = await Promise.all([
    db.select().from(hiringOpeningMembers).where(inArray(hiringOpeningMembers.openingId, ids)),
    db
      .select({ openingId: hiringVersions.openingId, number: hiringVersions.versionNumber, status: hiringVersions.status })
      .from(hiringVersions)
      .where(and(inArray(hiringVersions.openingId, ids), eq(hiringVersions.orgId, orgId)))
      .orderBy(desc(hiringVersions.versionNumber)),
  ]);
  return rows
    .filter(
      (r) =>
        openingAccess(viewer, {
          decisionMakerId: r.decisionMakerId,
          backupDecisionMakerId: r.backupDecisionMakerId,
          memberIds: members.filter((m) => m.openingId === r.id).map((m) => m.userId),
          status: r.status,
        }).view,
    )
    .map((r) => {
      const own = versions.filter((v) => v.openingId === r.id);
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        deadlineAt: r.deadlineAt,
        positionName: r.positionName,
        ownerName: r.ownerName,
        liveNumber: own.find((v) => v.status === "PUBLISHED")?.number ?? null,
        draftNumber: own.find((v) => v.status === "DRAFT")?.number ?? null,
      };
    });
}

/** Openings whose assessment can be copied into a new one (HIRING-UX 5.3 "Önceki bir alımdan kopyala"). */
export async function copySources(orgId: string): Promise<Array<{ id: string; name: string; status: OpeningStatus; createdAt: Date }>> {
  return db
    .select({ id: hiringOpenings.id, name: hiringOpenings.name, status: hiringOpenings.status, createdAt: hiringOpenings.createdAt })
    .from(hiringOpenings)
    .where(eq(hiringOpenings.orgId, orgId))
    .orderBy(desc(hiringOpenings.createdAt), desc(hiringOpenings.id));
}

export type CreateOpeningInput = {
  position: { kind: "existing"; id: string } | { kind: "new"; name: string; jobDescription: string };
  start: "AI" | "COPY" | "BLANK";
  copyFrom: string | null;
};

export type CreateOpeningResult =
  | { ok: true; openingId: string; next: string }
  | { ok: false; code: "POSITION_NAME_REQUIRED" | "POSITION_NOT_FOUND" | "JOB_AD_REQUIRED" | "COPY_SOURCE_NOT_FOUND" };

/**
 * `base` when no opening of the organisation has that name, otherwise
 * `base (n)` with the smallest free n from 2. Two openings created at the same
 * instant can still collide (there is no unique index); the name is a label,
 * the id is the identity.
 */
export function uniqueOpeningName(base: string, taken: readonly string[]): string {
  const names = new Set(taken.filter((n): n is string => typeof n === "string"));
  if (!names.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!names.has(candidate)) return candidate;
  }
}

/**
 * The month in the organisation's own time zone (ORG_TIMEZONE) and language.
 * There is no per-organisation locale column: the organisation's language is
 * DEFAULT_LOCALE, the one new assessment versions start in too. The name is a
 * shared label, so it never follows the creator's own interface language.
 */
const monthName = () => new Intl.DateTimeFormat(DEFAULT_LOCALE === "en" ? "en-GB" : "tr-TR", { month: "long", timeZone: ORG_TIMEZONE }).format(new Date());

/**
 * HIRING-UX 5.3. Everything is checked before anything is written, so a refused
 * start leaves no stray position behind. The creator owns the opening and is
 * its first decision maker, so it must be an active user of the organisation
 * (HiringNotFound otherwise); v1 is an empty draft or a copy.
 */
export async function createOpening(user: { id: string; orgId: string }, input: CreateOpeningInput): Promise<CreateOpeningResult> {
  return db.transaction(async (tx) => {
    const [creator] = isUuid(user.id)
      ? await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, user.id), eq(users.orgId, user.orgId), isNull(users.disabledAt)))
          .limit(1)
      : [];
    if (!creator) throw new HiringNotFound("user");

    let position: { id: string | null; name: string; jobDescription: string | null };
    if (input.position.kind === "new") {
      if (!input.position.name.trim()) return { ok: false as const, code: "POSITION_NAME_REQUIRED" as const };
      position = { id: null, name: input.position.name.trim(), jobDescription: input.position.jobDescription.trim() || null };
    } else {
      if (!isUuid(input.position.id)) return { ok: false as const, code: "POSITION_NOT_FOUND" as const };
      // Archived positions are read-only (HIRING-UX 4.2 rule 3): they start nothing new.
      const [row] = await tx
        .select({ id: positions.id, name: positions.name, jobDescription: positions.jobDescription })
        .from(positions)
        .where(and(eq(positions.id, input.position.id), eq(positions.orgId, user.orgId), isNull(positions.archivedAt)))
        .limit(1);
      if (!row) return { ok: false as const, code: "POSITION_NOT_FOUND" as const };
      position = row;
    }
    if (input.start === "AI" && !position.jobDescription?.trim()) return { ok: false as const, code: "JOB_AD_REQUIRED" as const };
    let sourceVersionId: string | null = null;
    if (input.start === "COPY") {
      const [source] =
        input.copyFrom && isUuid(input.copyFrom)
          ? await tx
              .select({ id: hiringOpenings.id })
              .from(hiringOpenings)
              .where(and(eq(hiringOpenings.id, input.copyFrom), eq(hiringOpenings.orgId, user.orgId)))
              // Its draft must not change (or be renumbered) while it is copied.
              .for("share")
          : [];
      const { live, draft } = source ? workingVersions(await versionsOf(user.orgId, source.id, tx)) : { live: null, draft: null };
      sourceVersionId = (live ?? draft)?.id ?? null;
      if (!sourceVersionId) return { ok: false as const, code: "COPY_SOURCE_NOT_FOUND" as const };
    }

    let positionId = position.id;
    if (!positionId) {
      const created = await createPosition(user.orgId, user.id, { name: position.name, jobDescription: position.jobDescription ?? "" }, tx);
      if (!created.ok) return { ok: false as const, code: "POSITION_NAME_REQUIRED" as const };
      positionId = created.id;
    }
    // Two openings for one position in one month would read the same in the list: number the later ones.
    const base = `${position.name} · ${monthName()}`;
    const taken = await tx
      .select({ name: hiringOpenings.name })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.orgId, user.orgId), sql`starts_with(${hiringOpenings.name}, ${base})`));
    const [opening] = await tx
      .insert(hiringOpenings)
      .values({ orgId: user.orgId, positionId, name: uniqueOpeningName(base, taken.map((r) => r.name)), ownerId: user.id, decisionMakerId: user.id })
      .returning({ id: hiringOpenings.id });
    // A copy takes the source's languages, intro, proctoring and practice; weights start over.
    const settings = sourceVersionId ? inheritedSettings(await versionRow(tx, user.orgId, sourceVersionId)) : {};
    const [version] = await tx
      .insert(hiringVersions)
      .values({ orgId: user.orgId, openingId: opening.id, versionNumber: 1, ...settings })
      .returning({ id: hiringVersions.id });
    if (sourceVersionId) await cloneContent(tx, user.orgId, sourceVersionId, version.id);
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "hiring.opening.create",
      subjectType: "hiring_opening",
      subjectId: opening.id,
      meta: { positionId, start: input.start, copyFrom: input.start === "COPY" ? input.copyFrom : null },
    });
    // A blank or copied start opens the builder; an AI start opens the AI draft screen.
    const next = `/hiring/openings/${opening.id}/assessment/${input.start === "AI" ? "ai" : "edit"}`;
    return { ok: true as const, openingId: opening.id, next };
  });
}

/**
 * Positions an opening may start from (HIRING-UX 5.3), with "has a job ad" and
 * the profile summary. Archived positions are read-only and start nothing new
 * (HIRING-UX 4.2 rule 3), so they are not offered.
 */
export async function positionOptions(orgId: string): Promise<Array<{ id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean }>> {
  const rows = await db
    .select({
      id: positions.id,
      name: positions.name,
      hasJobAd: sql<boolean>`coalesce(length(trim(${positions.jobDescription})) > 0, false)`,
      competencyCount: sql<number>`(select count(*)::int from ${positionCompetencies} pc where pc.position_id = ${positions.id})`,
      distinctWeights: sql<number>`(select count(distinct pc.weight)::int from ${positionCompetencies} pc where pc.position_id = ${positions.id})`,
    })
    .from(positions)
    .where(and(eq(positions.orgId, orgId), isNull(positions.archivedAt)))
    .orderBy(positions.name, positions.id);
  return rows.map((r) => ({ id: r.id, name: r.name, hasJobAd: r.hasJobAd, competencyCount: r.competencyCount, weightsEqual: r.distinctWeights <= 1 }));
}

/**
 * HIRING-UX 5.18 "Kaydet": team, fair review and candidate contact, checked
 * with the same rules as the form (the client is never trusted). In one
 * transaction: the opening is locked by id AND org_id first (lockOpening), so
 * a CLOSED opening refuses (history is read-only) and a foreign one is not
 * found; the stored deadline comes from that locked row, so a deadline that
 * has passed is refused only when it changes; the people are the
 * organisation's own users, read through the same transaction after the lock,
 * so a member, decision maker or backup from anywhere else, or a disabled one,
 * is refused. A refusal writes nothing. A new name that another opening of the
 * organisation already has is numbered (uniqueOpeningName); the stored name is
 * returned so the form can show it.
 */
export async function saveOpeningRules(
  orgId: string,
  actorId: string,
  openingId: string,
  input: OpeningRulesInput,
): Promise<{ ok: true; name: string } | { ok: false; problems: RulesProblem[] }> {
  return db.transaction(async (tx) => {
    const opening = await lockOpening(tx, orgId, openingId);
    await assertActiveUser(tx, orgId, actorId);
    const people = (await loadPanelUsers(orgId, tx)).map((u) => ({ id: u.id, role: u.role, disabled: u.disabledAt !== null }));
    const savedDeadline = opening.deadlineAt ? orgDay(opening.deadlineAt) : null;
    const problems = openingRulesProblems(input, people, orgDay(), savedDeadline);
    if (problems.length) return { ok: false as const, problems };
    const members = [...new Set(input.memberIds)];
    // The day as stored when it did not change, so an untouched deadline keeps its exact instant.
    const deadlineAt = input.deadline === savedDeadline ? opening.deadlineAt : input.deadline ? deadlineToDate(input.deadline) : null;
    const wanted = input.name.trim();
    const taken = await tx
      .select({ name: hiringOpenings.name })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.orgId, orgId), ne(hiringOpenings.id, openingId), sql`starts_with(${hiringOpenings.name}, ${wanted})`));
    const name = uniqueOpeningName(wanted, taken.map((r) => r.name));
    const candidateContactEmail = input.candidateContactEmail.trim() || null;
    await tx
      .update(hiringOpenings)
      .set({
        name,
        decisionMakerId: input.decisionMakerId,
        backupDecisionMakerId: input.backupDecisionMakerId,
        minEvaluations: input.minEvaluations,
        blindMode: input.blindMode,
        deadlineAt,
        feedbackDays: input.feedbackDays,
        candidateContactEmail,
        updatedAt: new Date(),
      })
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)));
    // The opening was just locked as the caller's, so its panel is replaced by its id.
    await tx.delete(hiringOpeningMembers).where(eq(hiringOpeningMembers.openingId, openingId));
    if (members.length) await tx.insert(hiringOpeningMembers).values(members.map((userId) => ({ openingId, userId })));
    await tx.insert(auditLogs).values({
      orgId,
      actorId,
      action: "hiring.opening.rules",
      subjectType: "hiring_opening",
      subjectId: openingId,
      meta: {
        name,
        members,
        decisionMakerId: input.decisionMakerId,
        backupDecisionMakerId: input.backupDecisionMakerId,
        minEvaluations: input.minEvaluations,
        blindMode: input.blindMode,
        deadlineAt: deadlineAt?.toISOString() ?? null,
        feedbackDays: input.feedbackDays,
        candidateContactEmail,
      },
    });
    return { ok: true as const, name };
  });
}

/**
 * Close, or reopen (also the undo of a close). A reopened opening is OPEN when
 * it has a published version, else DRAFT. Asking for the state the opening is
 * already in changes and audits nothing, so a double click or a late undo is
 * harmless. Not found when the opening is not the caller's.
 */
export async function setOpeningClosed(orgId: string, actorId: string, openingId: string, closed: boolean): Promise<void> {
  if (!isUuid(openingId)) throw new HiringNotFound("opening");
  await db.transaction(async (tx) => {
    const [opening] = await tx
      .select({ id: hiringOpenings.id, status: hiringOpenings.status })
      .from(hiringOpenings)
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
      .for("update");
    if (!opening) throw new HiringNotFound("opening");
    await assertActiveUser(tx, orgId, actorId);
    if ((opening.status === "CLOSED") === closed) return;
    const { live } = workingVersions(await versionsOf(orgId, openingId, tx));
    const status: OpeningStatus = closed ? "CLOSED" : live ? "OPEN" : "DRAFT";
    await tx
      .update(hiringOpenings)
      .set({ status, closedAt: closed ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)));
    await tx.insert(auditLogs).values({
      orgId,
      actorId,
      action: closed ? "hiring.opening.close" : "hiring.opening.reopen",
      subjectType: "hiring_opening",
      subjectId: openingId,
      meta: { status },
    });
  });
}
