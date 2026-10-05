import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { ensureDefaultScale, seedLibrary } from "@/db/library-seed";
import {
  auditLogs,
  competencies,
  competencyAnchors,
  observationTags,
  positionCompetencies,
  positions,
  ratingScales,
  scaleLevels,
  type I18nText,
} from "@/db/schema";
import { hasText, MAX_TAGS_PER_SIDE, missingAnchorLevels } from "@/lib/library/anchors";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { POSITION_LANGUAGES_MAX, POSITION_SKILLS_MAX } from "@/lib/library/positions";
import { libraryUsage } from "@/server/library";
import { isUuid } from "@/server/settings";

/**
 * Library writes. Every write is scoped by organisation and leaves an audit row.
 * Library foreign keys are single-column, so an id that arrives with a request
 * is only followed after the row it hangs off is proven to be the caller's.
 */

export const cleanText = (t: I18nText): I18nText => ({ tr: t.tr.trim(), en: t.en.trim() });

export async function audit(
  x: Executor,
  orgId: string,
  actorId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  meta?: Record<string, unknown>,
) {
  await x.insert(auditLogs).values({ orgId, actorId, action, subjectType, subjectId, meta: meta ?? null });
}

export type AnchorInput = Partial<Record<"1" | "2" | "3" | "4" | "5", I18nText>>;
export type TagInput = { id: string | null; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText };
export type CompetencyInput = {
  name: I18nText;
  description: I18nText;
  anchors: AnchorInput;
  tags: TagInput[];
  markReviewed: boolean;
};
export type CompetencyWriteError = "NAME_REQUIRED" | "ANCHORS_REQUIRED" | "TOO_MANY_TAGS" | "NOT_FOUND" | "ARCHIVED";
/** A tag as stored after a save, in form order: the form adopts these ids so the next save keeps them. */
export type SavedTag = { id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText };

/** The written levels only, trimmed, keyed by level number. */
export function anchorRecord(input: AnchorInput): Record<number, I18nText> {
  const out: Record<number, I18nText> = {};
  for (const [level, body] of Object.entries(input)) if (body && hasText(body)) out[Number(level)] = cleanText(body);
  return out;
}

/** Callers must have checked that the competency belongs to the organisation. */
async function replaceAnchors(x: Executor, competencyId: string, anchors: Record<number, I18nText>) {
  // Anchors are copied into a version at publish, nothing refers to their ids.
  await x.delete(competencyAnchors).where(eq(competencyAnchors.competencyId, competencyId));
  const rows = Object.entries(anchors).map(([value, body]) => ({ competencyId, value: Number(value), body }));
  if (rows.length) await x.insert(competencyAnchors).values(rows);
}

export async function createCompetency(
  orgId: string,
  actorId: string,
  input: { name: I18nText; description: I18nText; anchors?: AnchorInput },
  x: Executor = db,
  /** Where the row came from, kept on its audit row (e.g. an accepted AI card). */
  origin?: { via: string },
): Promise<{ ok: true; id: string } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!hasText(input.name)) return { ok: false, code: "NAME_REQUIRED" };
  // The organisation's own default scale: the only scale a new row may point at.
  const scale = await ensureDefaultScale(orgId);
  // Inside a caller's transaction this is a savepoint; on `db` it is the transaction.
  return x.transaction(async (tx) => {
    const [row] = await tx
      .insert(competencies)
      .values({ orgId, name: cleanText(input.name), description: cleanText(input.description), scaleId: scale.id, reviewedAt: new Date() })
      .returning({ id: competencies.id });
    await replaceAnchors(tx, row.id, anchorRecord(input.anchors ?? {}));
    await audit(tx, orgId, actorId, "library.competency.create", "competency", row.id, origin);
    return { ok: true as const, id: row.id };
  });
}

export async function saveCompetency(
  orgId: string,
  actorId: string,
  id: string,
  input: CompetencyInput,
): Promise<{ ok: true; tags: SavedTag[] } | { ok: false; code: CompetencyWriteError }> {
  if (!hasText(input.name)) return { ok: false, code: "NAME_REQUIRED" };
  const anchors = anchorRecord(input.anchors);
  if (missingAnchorLevels(anchors).length) return { ok: false, code: "ANCHORS_REQUIRED" };
  const tags = input.tags.map((t) => ({ ...t, label: cleanText(t.label) })).filter((t) => hasText(t.label));
  for (const side of ["POSITIVE", "NEGATIVE"] as const) {
    if (tags.filter((t) => t.polarity === side).length > MAX_TAGS_PER_SIDE) return { ok: false, code: "TOO_MANY_TAGS" };
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: competencies.id, reviewedAt: competencies.reviewedAt, archivedAt: competencies.archivedAt })
      .from(competencies)
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    // An archived competency is read-only until it is restored (HIRING-UX 4.2 rule 3).
    if (row.archivedAt) return { ok: false as const, code: "ARCHIVED" as const };
    const now = new Date();
    const reviewedNow = input.markReviewed && !row.reviewedAt;
    await tx
      .update(competencies)
      .set({
        name: cleanText(input.name),
        description: cleanText(input.description),
        updatedAt: now,
        ...(reviewedNow ? { reviewedAt: now } : {}),
      })
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
    await replaceAnchors(tx, id, anchors);
    // Tag ids are kept: a published scorecard copies them. A removed tag is
    // archived. Only ids this competency owns are honoured; any other id (another
    // competency's, another organisation's) is written as a new tag.
    const owned = await tx
      .select({ id: observationTags.id, archivedAt: observationTags.archivedAt })
      .from(observationTags)
      .where(eq(observationTags.competencyId, id));
    const ownedIds = new Set(owned.map((o) => o.id));
    const isOwned = (tagId: string | null): tagId is string => tagId !== null && ownedIds.has(tagId);
    const keep = new Set(tags.flatMap((t) => (isOwned(t.id) ? [t.id] : [])));
    const gone = owned.filter((o) => !o.archivedAt && !keep.has(o.id)).map((o) => o.id);
    if (gone.length) {
      await tx
        .update(observationTags)
        .set({ archivedAt: now })
        .where(and(inArray(observationTags.id, gone), eq(observationTags.competencyId, id)));
    }
    const saved: SavedTag[] = [];
    for (const [orderIndex, tag] of tags.entries()) {
      let tagId: string;
      if (isOwned(tag.id)) {
        tagId = tag.id;
        await tx
          .update(observationTags)
          .set({ label: tag.label, polarity: tag.polarity, orderIndex, archivedAt: null })
          .where(and(eq(observationTags.id, tag.id), eq(observationTags.competencyId, id)));
      } else {
        const [created] = await tx
          .insert(observationTags)
          .values({ competencyId: id, polarity: tag.polarity, label: tag.label, orderIndex })
          .returning({ id: observationTags.id });
        tagId = created.id;
      }
      saved.push({ id: tagId, polarity: tag.polarity, label: tag.label });
    }
    await audit(tx, orgId, actorId, "library.competency.save", "competency", id, reviewedNow ? { markReviewed: true } : undefined);
    return { ok: true as const, tags: saved };
  });
}

/**
 * The scorecard's "Düzenle" (HIRING-UX 5.7): a competency's anchors only, from
 * the anchor Sheet. Still a library write: it changes the competency for every
 * draft that measures it, never a published version (its scorecard holds a
 * copy). Same rules as saveCompetency: levels 1, 3 and 5 required, the row
 * locked by id AND organisation, an archived competency read-only. Answers the
 * stored anchors, so the Sheet adopts what was saved (trimmed, empty levels gone).
 */
export async function saveAnchors(
  orgId: string,
  actorId: string,
  competencyId: string,
  input: AnchorInput,
): Promise<{ ok: true; anchors: Record<number, I18nText> } | { ok: false; code: "ANCHORS_REQUIRED" | "NOT_FOUND" | "ARCHIVED" }> {
  const anchors = anchorRecord(input);
  if (missingAnchorLevels(anchors).length) return { ok: false, code: "ANCHORS_REQUIRED" };
  if (!isUuid(competencyId)) return { ok: false, code: "NOT_FOUND" };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: competencies.id, archivedAt: competencies.archivedAt })
      .from(competencies)
      .where(and(eq(competencies.id, competencyId), eq(competencies.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    if (row.archivedAt) return { ok: false as const, code: "ARCHIVED" as const };
    await replaceAnchors(tx, competencyId, anchors);
    await tx
      .update(competencies)
      .set({ updatedAt: new Date() })
      .where(and(eq(competencies.id, competencyId), eq(competencies.orgId, orgId)));
    await audit(tx, orgId, actorId, "library.competency.anchors", "competency", competencyId, { levels: Object.keys(anchors).map(Number) });
    return { ok: true as const, anchors };
  });
}

/**
 * Archive and its undo for a library row. Only a row of the caller's
 * organisation that is not already in the asked state changes, and only a
 * change is audited.
 */
async function setArchived(
  table: typeof competencies | typeof positions,
  subject: "competency" | "position",
  orgId: string,
  actorId: string,
  id: string,
  archived: boolean,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(table)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.orgId, orgId), archived ? isNull(table.archivedAt) : isNotNull(table.archivedAt)))
      .returning({ id: table.id });
    if (rows.length === 0) return false;
    await audit(tx, orgId, actorId, `library.${subject}.${archived ? "archive" : "restore"}`, subject, id);
    return true;
  });
}

export async function setCompetencyArchived(orgId: string, actorId: string, id: string, archived: boolean): Promise<boolean> {
  return setArchived(competencies, "competency", orgId, actorId, id, archived);
}

export async function saveScaleLabels(
  orgId: string,
  actorId: string,
  levels: Array<{ value: number; label: I18nText }>,
): Promise<{ ok: boolean }> {
  if (levels.length === 0 || levels.some((l) => !hasText(l.label))) return { ok: false };
  const [scale] = await db
    .select({ id: ratingScales.id })
    .from(ratingScales)
    .where(and(eq(ratingScales.orgId, orgId), eq(ratingScales.isDefault, true)))
    .limit(1);
  if (!scale) return { ok: false };
  const stored = await db
    .select({ value: scaleLevels.value, label: scaleLevels.label })
    .from(scaleLevels)
    .where(eq(scaleLevels.scaleId, scale.id));
  // Exactly the scale's own levels: no missing, extra or repeated value.
  const values = new Set(levels.map((l) => l.value));
  const sameSet = values.size === levels.length && levels.length === stored.length && stored.every((l) => values.has(l.value));
  if (!sameSet) return { ok: false };
  const changed = levels
    .map((l) => ({ value: l.value, label: cleanText(l.label) }))
    .filter((l) => {
      const before = stored.find((s) => s.value === l.value)!.label;
      return before.tr !== l.label.tr || before.en !== l.label.en;
    });
  if (changed.length === 0) return { ok: true };
  await db.transaction(async (tx) => {
    for (const level of changed) {
      await tx
        .update(scaleLevels)
        .set({ label: level.label })
        .where(and(eq(scaleLevels.scaleId, scale.id), eq(scaleLevels.value, level.value)));
    }
    await audit(tx, orgId, actorId, "library.scale.save", "rating_scale", scale.id, { levels: changed.map((l) => l.value) });
  });
  return { ok: true };
}

/** The empty library's "Başlangıç içeriğini ekle": idempotent seeding, audited when it added anything. */
export async function startLibrary(orgId: string, actorId: string) {
  const result = await seedLibrary(orgId);
  if (result.scaleCreated || result.competenciesCreated > 0) {
    await audit(db, orgId, actorId, "library.seed", "organization", orgId, result);
  }
  return result;
}

export type PositionInput = {
  name: string;
  team: string;
  shortDescription: string;
  jobDescription: string;
  skills: string[];
  languages: string[];
  profile: Array<{ competencyId: string; weight: number; expectedLevel: number | null }>;
};
export type PositionWriteError = "NAME_REQUIRED" | "NOT_FOUND" | "ARCHIVED" | "COMPETENCY";

const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const list = (items: string[], max: number) => [...new Set(items.map((s) => s.trim()).filter(Boolean))].slice(0, max);

/** The input as it is stored: trimmed text, clean lists, one profile row per competency. */
function normalizePosition(input: PositionInput): PositionInput {
  const seen = new Set<string>();
  return {
    name: input.name.trim(),
    team: input.team.trim(),
    shortDescription: input.shortDescription.trim(),
    jobDescription: input.jobDescription.trim(),
    skills: list(input.skills, POSITION_SKILLS_MAX),
    languages: list(input.languages, POSITION_LANGUAGES_MAX),
    profile: input.profile
      .filter((p) => (seen.has(p.competencyId) ? false : (seen.add(p.competencyId), true)))
      .map((p) => ({ competencyId: p.competencyId, weight: p.weight, expectedLevel: p.expectedLevel })),
  };
}

const sameList = <T>(a: readonly T[], b: readonly T[], eqItem: (x: T, y: T) => boolean = (x, y) => x === y) =>
  a.length === b.length && a.every((x, i) => eqItem(x, b[i]));

/** HIRING-UX 4.2 rule 4: an opening can create its position in place; it is still an org row. */
export async function createPosition(
  orgId: string,
  actorId: string,
  input: { name: string; jobDescription?: string; team?: string },
  x: Executor = db,
): Promise<{ ok: true; id: string } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!input.name.trim()) return { ok: false, code: "NAME_REQUIRED" };
  // Inside a caller's transaction this is a savepoint; on `db` it is the transaction.
  return x.transaction(async (tx) => {
    const [row] = await tx
      .insert(positions)
      .values({ orgId, name: input.name.trim(), team: orNull(input.team), jobDescription: orNull(input.jobDescription) })
      .returning({ id: positions.id });
    await audit(tx, orgId, actorId, "library.position.create", "position", row.id);
    return { ok: true as const, id: row.id };
  });
}

/**
 * Saves the definition and the competency profile. Returns the stored value so
 * the form shows exactly what the next save sends. A save that changes nothing
 * writes nothing, audit included.
 */
export async function savePosition(
  orgId: string,
  actorId: string,
  id: string,
  input: PositionInput,
): Promise<{ ok: true; position: PositionInput } | { ok: false; code: PositionWriteError }> {
  if (!input.name.trim()) return { ok: false, code: "NAME_REQUIRED" };
  const next = normalizePosition(input);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: positions.id,
        name: positions.name,
        team: positions.team,
        shortDescription: positions.shortDescription,
        jobDescription: positions.jobDescription,
        skills: positions.skills,
        languages: positions.languages,
        archivedAt: positions.archivedAt,
      })
      .from(positions)
      .where(and(eq(positions.id, id), eq(positions.orgId, orgId)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    // An archived position is read-only until it is restored (HIRING-UX 4.2 rule 3).
    if (row.archivedAt) return { ok: false as const, code: "ARCHIVED" as const };
    // The position is the caller's, so its profile rows are too.
    const storedProfile = await tx
      .select({
        competencyId: positionCompetencies.competencyId,
        weight: positionCompetencies.weight,
        expectedLevel: positionCompetencies.expectedLevel,
      })
      .from(positionCompetencies)
      .where(eq(positionCompetencies.positionId, id))
      .orderBy(asc(positionCompetencies.orderIndex));
    const ids = next.profile.map((p) => p.competencyId);
    if (ids.length) {
      // The FK is single-column: only the caller's competencies may be linked, and an
      // archived one only when the profile already had it (it stays, it is not picked anew).
      const owned = await tx
        .select({ id: competencies.id, archivedAt: competencies.archivedAt })
        .from(competencies)
        .where(and(eq(competencies.orgId, orgId), inArray(competencies.id, ids)));
      const had = new Set(storedProfile.map((p) => p.competencyId));
      if (owned.length !== ids.length || owned.some((c) => c.archivedAt && !had.has(c.id))) {
        return { ok: false as const, code: "COMPETENCY" as const };
      }
    }
    const fields = {
      name: next.name,
      team: orNull(next.team),
      shortDescription: orNull(next.shortDescription),
      jobDescription: orNull(next.jobDescription),
      skills: next.skills,
      languages: next.languages,
    };
    const fieldsChanged =
      fields.name !== row.name ||
      fields.team !== row.team ||
      fields.shortDescription !== row.shortDescription ||
      fields.jobDescription !== row.jobDescription ||
      !sameList(fields.skills, row.skills) ||
      !sameList(fields.languages, row.languages);
    const profileChanged = !sameList(
      next.profile,
      storedProfile,
      (a, b) => a.competencyId === b.competencyId && a.weight === b.weight && a.expectedLevel === b.expectedLevel,
    );
    if (!fieldsChanged && !profileChanged) return { ok: true as const, position: next };
    if (fieldsChanged) {
      await tx
        .update(positions)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(positions.id, id), eq(positions.orgId, orgId)));
    }
    if (profileChanged) {
      // The profile is copied into an opening at publish; nothing refers to these rows.
      await tx.delete(positionCompetencies).where(eq(positionCompetencies.positionId, id));
      const rows = next.profile.map((p, orderIndex) => ({ positionId: id, ...p, orderIndex }));
      if (rows.length) await tx.insert(positionCompetencies).values(rows);
    }
    await audit(tx, orgId, actorId, "library.position.save", "position", id, { competencies: next.profile.length });
    return { ok: true as const, position: next };
  });
}

export async function setPositionArchived(orgId: string, actorId: string, id: string, archived: boolean): Promise<boolean> {
  return setArchived(positions, "position", orgId, actorId, id, archived);
}

/**
 * An accepted AI competency card (HIRING-UX 5.6): an active competency of the
 * organisation with the same name (Turkish or English, any case) is reused;
 * otherwise the proposal joins the library with its anchors, which stay
 * editable there and in the scorecard (the publish gate still asks for levels
 * 1, 3 and 5). Archived rows are not looked at: an archived competency is
 * never brought back silently, a new row is made instead.
 */
export async function findOrCreateCompetency(
  orgId: string,
  actorId: string,
  proposal: { name: I18nText; description: I18nText; anchors: AnchorInput },
  /** Recorded on the create audit row; archiveCompetencyIfUnused asks for the same value. */
  via: string,
): Promise<{ ok: true; id: string; created: boolean } | { ok: false; code: "NAME_REQUIRED" }> {
  if (!hasText(proposal.name)) return { ok: false, code: "NAME_REQUIRED" };
  const key = (name: string) => name.trim().toLocaleLowerCase("tr");
  const wanted = [proposal.name.tr, proposal.name.en].map(key).filter(Boolean);
  const rows = await db
    .select({ id: competencies.id, name: competencies.name })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
  const existing = rows.find((r) => [r.name.tr, r.name.en].some((n) => wanted.includes(key(n))));
  if (existing) return { ok: true, id: existing.id, created: false };
  const created = await createCompetency(orgId, actorId, proposal, db, { via });
  return created.ok ? { ok: true, id: created.id, created: true } : created;
}

/**
 * "Geri al" on an accepted AI competency (ruling C1: the library never
 * deletes, it archives). Only a row this acceptance created is touched: its
 * create audit row names this actor and `via` (findOrCreateCompetency wrote
 * it), so a reused library competency is never archived (NOT_CREATED). It is
 * archived only while nothing uses it: no position profile and no solution
 * (libraryUsage asks each one, e.g. a question of any opening's version); a
 * used one stays active (IN_USE). The row is locked by id AND organisation first.
 */
export async function archiveCompetencyIfUnused(
  orgId: string,
  actorId: string,
  id: string,
  via: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "NOT_CREATED" | "IN_USE" }> {
  if (!isUuid(id)) return { ok: false, code: "NOT_FOUND" };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: competencies.id })
      .from(competencies)
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId), isNull(competencies.archivedAt)))
      .for("update");
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };
    const [createdHere] = await tx
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.orgId, orgId),
          eq(auditLogs.action, "library.competency.create"),
          eq(auditLogs.subjectId, id),
          eq(auditLogs.actorId, actorId),
          sql`${auditLogs.meta}->>'via' = ${via}`,
        ),
      )
      .limit(1);
    if (!createdHere) return { ok: false as const, code: "NOT_CREATED" as const };
    // The competency is the caller's, so a profile row that names it is the caller's too (writes check that).
    const [inProfile] = await tx
      .select({ id: positionCompetencies.positionId })
      .from(positionCompetencies)
      .where(eq(positionCompetencies.competencyId, id))
      .limit(1);
    if (inProfile) return { ok: false as const, code: "IN_USE" as const };
    // Counts only: whether anything uses it, not which openings.
    // On this transaction's connection: it holds the competency FOR UPDATE, and a global read here could starve the pool.
    const usage = await libraryUsage(orgId, { positionIds: [], competencyIds: [id] }, DEFAULT_LOCALE, null, tx);
    if ((usage.competencies[id] ?? []).length > 0) return { ok: false as const, code: "IN_USE" as const };
    await tx
      .update(competencies)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
    await audit(tx, orgId, actorId, "library.competency.archive", "competency", id, { reason: "hiring-ai-undo" });
    return { ok: true as const };
  });
}

/**
 * The AI screen saves the pasted job ad onto the position, but never over one
 * the team wrote and never onto an archived position (read-only until it is
 * restored): one conditional update, so two tabs cannot overwrite each other.
 */
export async function setPositionJobAdIfEmpty(orgId: string, actorId: string, positionId: string, text: string): Promise<void> {
  const ad = text.trim();
  if (!ad || !isUuid(positionId)) return;
  const rows = await db
    .update(positions)
    .set({ jobDescription: ad, updatedAt: new Date() })
    .where(
      and(
        eq(positions.id, positionId),
        eq(positions.orgId, orgId),
        isNull(positions.archivedAt),
        or(isNull(positions.jobDescription), sql`trim(${positions.jobDescription}) = ${""}`),
      ),
    )
    .returning({ id: positions.id });
  if (rows.length) await audit(db, orgId, actorId, "library.position.job-ad", "position", positionId);
}
