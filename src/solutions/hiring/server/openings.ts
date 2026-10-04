import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hiringOpeningMembers, hiringOpenings, hiringVersions, positionCompetencies, positions, users } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { createPosition } from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { openingAccess, type Viewer } from "../rules/access";
import { workingVersions } from "../rules/versions";
import { HiringNotFound } from "./errors";
import { cloneContent, inheritedSettings, versionRow, versionsOf } from "./versions";

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
export async function copySources(orgId: string): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: hiringOpenings.id, name: hiringOpenings.name })
    .from(hiringOpenings)
    .where(eq(hiringOpenings.orgId, orgId))
    .orderBy(desc(hiringOpenings.createdAt), desc(hiringOpenings.id));
}

export type CreateOpeningInput = {
  position: { kind: "existing"; id: string } | { kind: "new"; name: string; jobDescription: string };
  start: "AI" | "COPY" | "BLANK";
  copyFrom: string | null;
  locale: Locale;
};

export type CreateOpeningResult =
  | { ok: true; openingId: string; next: string }
  | { ok: false; code: "POSITION_NAME_REQUIRED" | "POSITION_NOT_FOUND" | "JOB_AD_REQUIRED" | "COPY_SOURCE_NOT_FOUND" };

/** The month in the organisation's own time zone (ORG_TIMEZONE), in the manager's language. */
const monthName = (locale: Locale) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", { month: "long", timeZone: ORG_TIMEZONE }).format(new Date());

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
    const [opening] = await tx
      .insert(hiringOpenings)
      .values({ orgId: user.orgId, positionId, name: `${position.name} · ${monthName(input.locale)}`, ownerId: user.id, decisionMakerId: user.id })
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
    // Ruling C7: only routes that exist. Every start lands on the overview until
    // the builder (Task 15) and the AI screen (Task 17) point this at their routes.
    return { ok: true as const, openingId: opening.id, next: `/hiring/openings/${opening.id}` };
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
