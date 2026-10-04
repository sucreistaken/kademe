import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { ensureDefaultScale, seedLibrary } from "@/db/library-seed";
import { auditLogs, competencies, competencyAnchors, observationTags, ratingScales, scaleLevels, type I18nText } from "@/db/schema";
import { hasText, MAX_TAGS_PER_SIDE, missingAnchorLevels } from "@/lib/library/anchors";

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
    await audit(tx, orgId, actorId, "library.competency.create", "competency", row.id);
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

export async function setCompetencyArchived(orgId: string, actorId: string, id: string, archived: boolean): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(competencies)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(competencies.id, id), eq(competencies.orgId, orgId)))
      .returning({ id: competencies.id });
    if (rows.length === 0) return false;
    await audit(tx, orgId, actorId, archived ? "library.competency.archive" : "library.competency.restore", "competency", id);
    return true;
  });
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
