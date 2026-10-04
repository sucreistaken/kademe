import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { competencies, hiringActivities, hiringActivityCompetencies, hiringOpenings, hiringStages, hiringVersions, hiringWeightSets, hiringWeights, users } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { isUuid } from "@/server/settings";
import { isChoice, MAX_COMPETENCIES_PER_ACTIVITY, usedCompetencyIds, type ActivityType } from "../rules/content";
import {
  activityPatchSchema,
  activityPayloadOf,
  activityPayloadSchema,
  defaultsFor,
  emptyActivity,
  stagePatchSchema,
  stagePayloadOf,
  MAX_ACTIVITIES_PER_STAGE,
  stagePayloadSchema,
  versionLocalesSchema,
  type ActivityPatch,
  type ActivityPayload,
  type StagePatch,
  type StagePayload,
} from "../rules/patches";
import { workingVersions, type VersionSummary } from "../rules/versions";
import { weightsProblem, type WeightsProblem } from "../rules/weights";
import { loadVersionContent } from "./content";
import { frozenAsConflict, HiringConflict, HiringInvalid, HiringNotFound, parseOrInvalid } from "./errors";

/**
 * Versions of an opening's assessment. Every edit goes to the opening's single
 * draft; a published version is frozen by the database (migrations 0006, 0008),
 * and a write that meets that freeze answers NO_DRAFT (frozenAsConflict).
 *
 * Tenancy: every function takes the caller's organisation. A draft write first
 * locks the opening by id AND org_id (so two editors renumber in turn), finds
 * the draft among that organisation's versions, and reaches stages and
 * questions only through that draft. A linked competency must be the
 * organisation's own and active (one already linked may stay after it is
 * archived). Rows are never moved to another parent: moving only renumbers
 * within the same version or stage, copying inserts new rows.
 */

export async function versionsOf(orgId: string, openingId: string, x: Executor = db): Promise<VersionSummary[]> {
  if (!isUuid(openingId)) return [];
  return x
    .select({
      id: hiringVersions.id,
      number: hiringVersions.versionNumber,
      status: hiringVersions.status,
      publishedAt: hiringVersions.publishedAt,
      previewedAt: hiringVersions.previewedAt,
    })
    .from(hiringVersions)
    .where(and(eq(hiringVersions.openingId, openingId), eq(hiringVersions.orgId, orgId)))
    .orderBy(desc(hiringVersions.versionNumber));
}

/**
 * Locks the caller's opening for a write to its assessment; a CLOSED opening is
 * history and refuses every edit. Draft writes, publishing and weight sets all
 * take this lock first, so they run one at a time per opening and never
 * deadlock on each other (publishing then locks the version: same order).
 */
export async function lockOpening(x: Executor, orgId: string, openingId: string) {
  if (!isUuid(openingId)) throw new HiringNotFound("opening");
  const [row] = await x
    .select({ id: hiringOpenings.id, status: hiringOpenings.status, positionId: hiringOpenings.positionId, deadlineAt: hiringOpenings.deadlineAt })
    .from(hiringOpenings)
    .where(and(eq(hiringOpenings.id, openingId), eq(hiringOpenings.orgId, orgId)))
    .for("update");
  if (!row) throw new HiringNotFound("opening");
  if (row.status === "CLOSED") throw new HiringConflict("CLOSED");
  return row;
}

/** The acting user must be an active (not disabled) user of the caller's organisation. */
export async function assertActiveUser(x: Executor, orgId: string, userId: string) {
  if (!isUuid(userId)) throw new HiringNotFound("user");
  const [row] = await x
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), isNull(users.disabledAt)))
    .limit(1);
  if (!row) throw new HiringNotFound("user");
}

async function draftOf(x: Executor, orgId: string, openingId: string): Promise<string> {
  await lockOpening(x, orgId, openingId);
  const { draft } = workingVersions(await versionsOf(orgId, openingId, x));
  if (!draft) throw new HiringConflict("NO_DRAFT");
  return draft.id;
}

/** A draft write: one transaction, and a freeze refusal answered as NO_DRAFT. */
function draftWrite<T>(run: (tx: Executor) => Promise<T>): Promise<T> {
  return frozenAsConflict(() => db.transaction((tx) => run(tx)));
}

async function stageIds(x: Executor, versionId: string): Promise<string[]> {
  const rows = await x.select({ id: hiringStages.id }).from(hiringStages).where(eq(hiringStages.versionId, versionId)).orderBy(asc(hiringStages.orderIndex), asc(hiringStages.id));
  return rows.map((r) => r.id);
}

async function activityIds(x: Executor, stageId: string): Promise<string[]> {
  const rows = await x
    .select({ id: hiringActivities.id })
    .from(hiringActivities)
    .where(eq(hiringActivities.stageId, stageId))
    .orderBy(asc(hiringActivities.orderIndex), asc(hiringActivities.id));
  return rows.map((r) => r.id);
}

/** Only order_index changes: a renumbered row stays in its version or stage. */
async function renumberStages(x: Executor, versionId: string, ids: string[]) {
  for (const [orderIndex, id] of ids.entries()) {
    await x
      .update(hiringStages)
      .set({ orderIndex })
      .where(and(eq(hiringStages.id, id), eq(hiringStages.versionId, versionId)));
  }
}

async function renumberActivities(x: Executor, stageId: string, ids: string[]) {
  for (const [orderIndex, id] of ids.entries()) {
    await x
      .update(hiringActivities)
      .set({ orderIndex })
      .where(and(eq(hiringActivities.id, id), eq(hiringActivities.stageId, stageId)));
  }
}

async function ownStage(x: Executor, versionId: string, stageId: string) {
  if (!isUuid(stageId)) throw new HiringNotFound("stage");
  const [row] = await x
    .select({ id: hiringStages.id })
    .from(hiringStages)
    .where(and(eq(hiringStages.id, stageId), eq(hiringStages.versionId, versionId)))
    .limit(1);
  if (!row) throw new HiringNotFound("stage");
}

async function ownActivity(x: Executor, versionId: string, activityId: string): Promise<{ stageId: string; type: ActivityType }> {
  if (!isUuid(activityId)) throw new HiringNotFound("activity");
  const [row] = await x
    .select({ stageId: hiringActivities.stageId, type: hiringActivities.type })
    .from(hiringActivities)
    .innerJoin(hiringStages, eq(hiringStages.id, hiringActivities.stageId))
    .where(and(eq(hiringActivities.id, activityId), eq(hiringStages.versionId, versionId)))
    .limit(1);
  if (!row) throw new HiringNotFound("activity");
  return row;
}

/**
 * A question may only measure the organisation's own competencies, and only
 * active ones, except those in `kept` (already linked; an archived one stays
 * where it was chosen, like a position profile keeps it).
 */
async function assertCompetencies(x: Executor, orgId: string, ids: string[], kept: string[] = []) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await x
    .select({ id: competencies.id, archivedAt: competencies.archivedAt })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), inArray(competencies.id, unique)));
  if (rows.length !== unique.length) throw new HiringConflict("COMPETENCY");
  if (rows.some((r) => r.archivedAt !== null && !kept.includes(r.id))) throw new HiringConflict("COMPETENCY");
}

async function insertActivityRow(x: Executor, stageId: string, orderIndex: number, payload: ActivityPayload): Promise<string> {
  const { competencyIds, ...fields } = payload;
  const [row] = await x.insert(hiringActivities).values({ stageId, orderIndex, ...fields }).returning({ id: hiringActivities.id });
  const ids = isChoice(payload.type) ? [] : [...new Set(competencyIds)].slice(0, MAX_COMPETENCIES_PER_ACTIVITY);
  if (ids.length) {
    await x.insert(hiringActivityCompetencies).values(ids.map((competencyId, i) => ({ activityId: row.id, competencyId, orderIndex: i })));
  }
  return row.id;
}

async function insertStageRows(x: Executor, versionId: string, orderIndex: number, payload: StagePayload): Promise<string> {
  const { activities, ...fields } = payload;
  const [row] = await x.insert(hiringStages).values({ versionId, orderIndex, ...fields }).returning({ id: hiringStages.id });
  for (const [i, activity] of activities.entries()) await insertActivityRow(x, row.id, i, activity);
  return row.id;
}

const payloadCompetencies = (activities: ActivityPayload[]) => activities.flatMap((a) => (isChoice(a.type) ? [] : a.competencyIds));

/**
 * How an inserted payload's competencies are checked. `restore: true` is the
 * undo of a delete: the payload held links the question already had, so a
 * competency archived since is accepted (it must still be the organisation's).
 * Anything new (an accepted AI card) may only link active competencies.
 */
export type InsertOptions = { restore?: boolean };
const keptOnRestore = (ids: string[], options: InsertOptions) => (options.restore ? ids : []);

/** The settings a version passes on to a version made from it (a new draft or a copy); never the weights of a copy. */
export function inheritedSettings(source: typeof hiringVersions.$inferSelect | undefined) {
  // A stored row passed the locale CHECKs; anything else starts in the default language.
  const locales = versionLocalesSchema.safeParse({ defaultLocale: source?.defaultLocale, localeSet: source?.localeSet });
  return {
    defaultLocale: locales.success ? locales.data.defaultLocale : DEFAULT_LOCALE,
    localeSet: locales.success ? locales.data.localeSet : [DEFAULT_LOCALE],
    introTitle: source?.introTitle ?? null,
    introBody: source?.introBody ?? null,
    proctorLevel: source?.proctorLevel ?? "BASIC",
    practiceEnabled: source?.practiceEnabled ?? true,
  };
}

/** A version row of the caller's organisation, or undefined. */
export async function versionRow(x: Executor, orgId: string, versionId: string) {
  const [row] = await x
    .select()
    .from(hiringVersions)
    .where(and(eq(hiringVersions.id, versionId), eq(hiringVersions.orgId, orgId)))
    .limit(1);
  return row;
}

async function assertRoom(x: Executor, stageId: string): Promise<string[]> {
  const ids = await activityIds(x, stageId);
  if (ids.length >= MAX_ACTIVITIES_PER_STAGE) throw new HiringConflict("STAGE_FULL");
  return ids;
}

/**
 * Copies the content of a version into a draft of the same organisation, as new
 * rows (the source is never touched). Links to competencies archived since are
 * copied as they are; the publish gate names them.
 */
export async function cloneContent(x: Executor, orgId: string, fromVersionId: string, toVersionId: string) {
  const source = await loadVersionContent(orgId, fromVersionId, x);
  if (!source) throw new HiringNotFound("version");
  const [target] = await x
    .select({ id: hiringVersions.id })
    .from(hiringVersions)
    .where(and(eq(hiringVersions.id, toVersionId), eq(hiringVersions.orgId, orgId), eq(hiringVersions.status, "DRAFT")))
    .limit(1);
  if (!target) throw new HiringNotFound("version");
  const payloads = source.stages.map(stagePayloadOf);
  const linked = payloadCompetencies(payloads.flatMap((p) => p.activities));
  await assertCompetencies(x, orgId, linked, linked);
  for (const [i, payload] of payloads.entries()) await insertStageRows(x, target.id, i, payload);
}

/** The newest weight set of a version of the caller's organisation: what the next draft starts from. */
export async function latestWeights(
  x: Executor,
  orgId: string,
  versionId: string,
): Promise<{ enabled: boolean; weights: Record<string, number>; label: string; reason: string | null; createdAt: Date } | null> {
  const [set] = await x
    .select({
      id: hiringWeightSets.id,
      isActive: hiringWeightSets.isActive,
      label: hiringWeightSets.label,
      reason: hiringWeightSets.reason,
      createdAt: hiringWeightSets.createdAt,
    })
    .from(hiringWeightSets)
    .innerJoin(hiringVersions, eq(hiringVersions.id, hiringWeightSets.versionId))
    .where(and(eq(hiringWeightSets.versionId, versionId), eq(hiringVersions.orgId, orgId)))
    .orderBy(desc(hiringWeightSets.createdAt), desc(hiringWeightSets.id))
    .limit(1);
  if (!set) return null;
  const rows = await x.select().from(hiringWeights).where(eq(hiringWeights.weightSetId, set.id));
  return {
    enabled: set.isActive,
    weights: Object.fromEntries(rows.map((r) => [r.competencyId, Number(r.percentage)])),
    label: set.label,
    reason: set.reason,
    createdAt: set.createdAt,
  };
}

/**
 * The opening's draft, opened from the newest published version when there is
 * none (HIRING-UX 5.5: editing a published assessment creates v(n+1)).
 */
export async function ensureDraftVersion(orgId: string, openingId: string): Promise<{ versionId: string; created: boolean }> {
  return draftWrite(async (tx) => {
    await lockOpening(tx, orgId, openingId);
    const list = await versionsOf(orgId, openingId, tx);
    const { draft, live } = workingVersions(list);
    if (draft) return { versionId: draft.id, created: false };
    const source = live ? await versionRow(tx, orgId, live.id) : undefined;
    const weights = live ? await latestWeights(tx, orgId, live.id) : null;
    const [created] = await tx
      .insert(hiringVersions)
      .values({
        orgId,
        openingId,
        versionNumber: (list[0]?.number ?? 0) + 1,
        ...inheritedSettings(source),
        weightsEnabled: weights?.enabled ?? false,
        draftWeights: weights?.enabled ? weights.weights : null,
      })
      .returning({ id: hiringVersions.id });
    if (live) await cloneContent(tx, orgId, live.id, created.id);
    return { versionId: created.id, created: true };
  });
}

const directionOf = (direction: number): -1 | 1 => {
  if (direction !== -1 && direction !== 1) throw new HiringInvalid([{ path: "direction", message: "must be -1 or 1" }]);
  return direction;
};

/** Where an inserted row goes: the given place clamped to 0..length, or the end. */
const insertAt = (index: number | null | undefined, length: number) =>
  index === null || index === undefined || !Number.isFinite(index) ? length : Math.max(0, Math.min(Math.trunc(index), length));

export async function addStage(orgId: string, openingId: string): Promise<string> {
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const ids = await stageIds(tx, versionId);
    return insertStageRows(tx, versionId, ids.length, {
      name: { tr: "", en: "" },
      description: { tr: "", en: "" },
      internalPurpose: null,
      durationSeconds: 600,
      graceSeconds: 0,
      onTimeout: "AUTO_SUBMIT",
      backNavigation: false,
      activities: [],
    });
  });
}

export async function updateStage(orgId: string, openingId: string, stageId: string, patch: StagePatch) {
  const parsed = parseOrInvalid(stagePatchSchema, patch);
  await draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    if (Object.keys(parsed).length === 0) return;
    await tx
      .update(hiringStages)
      .set(parsed)
      .where(and(eq(hiringStages.id, stageId), eq(hiringStages.versionId, versionId)));
  });
}

export async function moveStage(orgId: string, openingId: string, stageId: string, direction: -1 | 1) {
  const step = directionOf(direction);
  await draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const ids = await stageIds(tx, versionId);
    const i = ids.indexOf(stageId);
    if (i === -1) throw new HiringNotFound("stage");
    const j = i + step;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await renumberStages(tx, versionId, ids);
  });
}

export async function deleteStage(orgId: string, openingId: string, stageId: string): Promise<{ payload: StagePayload; index: number }> {
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const content = await loadVersionContent(orgId, versionId, tx);
    const index = content?.stages.findIndex((st) => st.id === stageId) ?? -1;
    if (index === -1) throw new HiringNotFound("stage");
    const payload = stagePayloadOf(content!.stages[index]);
    await tx.delete(hiringStages).where(and(eq(hiringStages.id, stageId), eq(hiringStages.versionId, versionId)));
    await renumberStages(tx, versionId, await stageIds(tx, versionId));
    return { payload, index };
  });
}

/** Undo of a delete (`{ restore: true }`), and an accepted AI stage card. */
export async function insertStage(orgId: string, openingId: string, payload: StagePayload, index: number | null = null, options: InsertOptions = {}): Promise<string> {
  const parsed = parseOrInvalid(stagePayloadSchema, payload);
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const linked = payloadCompetencies(parsed.activities);
    await assertCompetencies(tx, orgId, linked, keptOnRestore(linked, options));
    const ids = await stageIds(tx, versionId);
    const at = insertAt(index, ids.length);
    const id = await insertStageRows(tx, versionId, at, parsed);
    await renumberStages(tx, versionId, [...ids.slice(0, at), id, ...ids.slice(at)]);
    return id;
  });
}

export async function addActivity(orgId: string, openingId: string, stageId: string, type: ActivityType): Promise<string> {
  const parsedType = parseOrInvalid(activityPayloadSchema.shape.type, type);
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    const ids = await assertRoom(tx, stageId);
    return insertActivityRow(tx, stageId, ids.length, emptyActivity(parsedType));
  });
}

export async function updateActivity(orgId: string, openingId: string, activityId: string, patch: ActivityPatch) {
  const parsed = parseOrInvalid(activityPatchSchema, patch);
  await draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const current = await ownActivity(tx, versionId, activityId);
    let next: ActivityPatch = parsed;
    if (parsed.type && parsed.type !== current.type) {
      // A new type brings that type's settings; explicit fields in the patch still win.
      next = { ...defaultsFor(parsed.type), ...parsed };
      if (isChoice(parsed.type)) await tx.delete(hiringActivityCompetencies).where(eq(hiringActivityCompetencies.activityId, activityId));
    }
    if (Object.keys(next).length === 0) return;
    await tx
      .update(hiringActivities)
      .set(next)
      .where(and(eq(hiringActivities.id, activityId), eq(hiringActivities.stageId, current.stageId)));
  });
}

export async function moveActivity(orgId: string, openingId: string, activityId: string, direction: -1 | 1) {
  const step = directionOf(direction);
  await draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const { stageId } = await ownActivity(tx, versionId, activityId);
    const ids = await activityIds(tx, stageId);
    const i = ids.indexOf(activityId);
    const j = i + step;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await renumberActivities(tx, stageId, ids);
  });
}

export async function deleteActivity(orgId: string, openingId: string, activityId: string): Promise<{ payload: ActivityPayload; stageId: string; index: number }> {
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const { stageId } = await ownActivity(tx, versionId, activityId);
    const content = await loadVersionContent(orgId, versionId, tx);
    const activities = content?.stages.find((st) => st.id === stageId)?.activities ?? [];
    const index = activities.findIndex((a) => a.id === activityId);
    if (index === -1) throw new HiringNotFound("activity");
    const payload = activityPayloadOf(activities[index]);
    await tx.delete(hiringActivities).where(and(eq(hiringActivities.id, activityId), eq(hiringActivities.stageId, stageId)));
    await renumberActivities(tx, stageId, await activityIds(tx, stageId));
    return { payload, stageId, index };
  });
}

/** Undo of a delete (`{ restore: true }`), and a new question from a payload. */
export async function insertActivity(
  orgId: string,
  openingId: string,
  stageId: string,
  payload: ActivityPayload,
  index: number | null = null,
  options: InsertOptions = {},
): Promise<string> {
  const parsed = parseOrInvalid(activityPayloadSchema, payload);
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    await ownStage(tx, versionId, stageId);
    const ids = await assertRoom(tx, stageId);
    const linked = payloadCompetencies([parsed]);
    await assertCompetencies(tx, orgId, linked, keptOnRestore(linked, options));
    const at = insertAt(index, ids.length);
    const id = await insertActivityRow(tx, stageId, at, parsed);
    await renumberActivities(tx, stageId, [...ids.slice(0, at), id, ...ids.slice(at)]);
    return id;
  });
}

const competencyIdsSchema = z.array(z.string().refine(isUuid, "not an id"));

export async function setActivityCompetencies(orgId: string, openingId: string, activityId: string, competencyIds: string[]) {
  const ids = [...new Set(parseOrInvalid(competencyIdsSchema, competencyIds))];
  await draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    const current = await ownActivity(tx, versionId, activityId);
    if (isChoice(current.type) && ids.length) throw new HiringConflict("CHOICE_COMPETENCY");
    if (ids.length > MAX_COMPETENCIES_PER_ACTIVITY) throw new HiringConflict("TOO_MANY_COMPETENCIES");
    const linked = await tx
      .select({ competencyId: hiringActivityCompetencies.competencyId })
      .from(hiringActivityCompetencies)
      .where(eq(hiringActivityCompetencies.activityId, activityId));
    await assertCompetencies(
      tx,
      orgId,
      ids,
      linked.map((l) => l.competencyId),
    );
    await tx.delete(hiringActivityCompetencies).where(eq(hiringActivityCompetencies.activityId, activityId));
    if (ids.length) {
      await tx.insert(hiringActivityCompetencies).values(ids.map((competencyId, orderIndex) => ({ activityId, competencyId, orderIndex })));
    }
  });
}

/**
 * HIRING-UX 5.7 for a draft: weighting off means a plain average; on needs a
 * weight for every measured competency (WEIGHTS_MISSING), whole percentages
 * adding up to 100 (NOT_WHOLE / NOT_100, rules/weights).
 * `versionId`, when given, is the draft the form was loaded for: compared under
 * the opening's lock, so weights chosen for a draft that was published (and
 * replaced by a new draft) meanwhile answer STALE instead of landing elsewhere.
 */
export async function saveDraftWeights(
  orgId: string,
  openingId: string,
  input: { versionId?: string; enabled: boolean; weights: Record<string, number> },
): Promise<{ ok: true } | { ok: false; code: "STALE" } | { ok: false; code: "WEIGHTS_MISSING"; competencyId: string } | ({ ok: false } & WeightsProblem)> {
  return draftWrite(async (tx) => {
    const versionId = await draftOf(tx, orgId, openingId);
    if (input.versionId !== undefined && input.versionId !== versionId) return { ok: false as const, code: "STALE" as const };
    const content = await loadVersionContent(orgId, versionId, tx);
    if (!content) throw new HiringNotFound("version");
    const used = usedCompetencyIds(content);
    // Weighting on: every measured competency needs its own weight (the gate's WEIGHTS_MISSING), never a silent 0.
    const left = input.enabled ? used.find((id) => !Object.hasOwn(input.weights, id)) : undefined;
    if (left) return { ok: false as const, code: "WEIGHTS_MISSING" as const, competencyId: left };
    const weights = Object.fromEntries(used.map((id) => [id, Object.hasOwn(input.weights, id) ? input.weights[id] : 0]));
    if (input.enabled) {
      const problem = weightsProblem(weights, used);
      if (problem) return { ok: false as const, ...problem };
    }
    await tx
      .update(hiringVersions)
      .set({ weightsEnabled: input.enabled, draftWeights: input.enabled ? weights : null, updatedAt: new Date() })
      .where(and(eq(hiringVersions.id, versionId), eq(hiringVersions.orgId, orgId)));
    return { ok: true as const };
  });
}

/**
 * "Önizleme yapıldı" (HIRING-UX 5.4): an editor opened the candidate preview.
 * Only a draft is stamped (a published version is frozen; the WHERE never
 * names one, and a freeze refusal still answers NO_DRAFT). The opening is
 * locked first like every draft write, so a CLOSED opening refuses and a
 * publish running at the same moment goes first or second, never between.
 * `versionId` is the draft the preview showed: if it was published meanwhile
 * (and a new draft opened), nothing is stamped. True when a row was stamped.
 */
export async function markPreviewed(orgId: string, openingId: string, versionId?: string): Promise<boolean> {
  if (versionId !== undefined && !isUuid(versionId)) return false;
  return draftWrite(async (tx) => {
    await lockOpening(tx, orgId, openingId);
    const rows = await tx
      .update(hiringVersions)
      .set({ previewedAt: new Date() })
      .where(
        and(
          eq(hiringVersions.openingId, openingId),
          eq(hiringVersions.orgId, orgId),
          eq(hiringVersions.status, "DRAFT"),
          versionId === undefined ? undefined : eq(hiringVersions.id, versionId),
        ),
      )
      .returning({ id: hiringVersions.id });
    return rows.length > 0;
  });
}
