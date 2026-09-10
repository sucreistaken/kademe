"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  templateVersions,
  stages,
  activities,
  stageCompetencies,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import type { I18nText, ActivityConfig } from "@/db/schema/types";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locale";

/**
 * Every write here goes through this guard first. A published version is frozen
 * by a database trigger, so writing to one would throw a raw Postgres error at
 * the manager. Checking up front lets us name the reason as a code the screen
 * renders in the manager's own language.
 */
async function assertDraft(
  versionId: string,
  orgId: string,
): Promise<BuilderErrorCode | null> {
  const [version] = await db
    .select({ status: templateVersions.status })
    .from(templateVersions)
    .where(
      and(eq(templateVersions.id, versionId), eq(templateVersions.orgId, orgId)),
    )
    .limit(1);
  if (!version) return "VERSION_NOT_FOUND";
  if (version.status !== "DRAFT") return "VERSION_PUBLISHED";
  return null;
}

async function versionOfStage(stageId: string) {
  const [row] = await db
    .select({ versionId: stages.versionId })
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1);
  return row?.versionId ?? null;
}

/** Codes, not sentences: the builder screen renders them from the dictionary. */
export type BuilderErrorCode =
  | "VERSION_NOT_FOUND"
  | "VERSION_PUBLISHED"
  | "STAGE_NOT_FOUND"
  | "INVALID_STAGE"
  | "ACTIVITY_NOT_FOUND"
  | "INVALID_ACTIVITY";

export type Ok = { ok: true } | { ok: false; code: BuilderErrorCode };

/**
 * Which languages this version will be delivered in.
 *
 * It exists because a template opens Turkish only and nothing else could say
 * otherwise, which left the bilingual fields in the editor unreachable and the
 * invitation screen unable to offer English.
 *
 * Turkish is not removable here: it is the version's `default_locale` and the
 * fallback every reader lands on. Dropping a language never deletes what was
 * written in it; the text stays in the jsonb column and comes back if the
 * language is added again.
 */
export async function setVersionLocales(
  versionId: string,
  locales: string[],
): Promise<Ok> {
  const user = await requireUser("template:write");
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  const wanted = LOCALES.filter((code) => locales.includes(code));
  const next: Locale[] = wanted.length ? wanted : [DEFAULT_LOCALE];

  await db
    .update(templateVersions)
    .set({ localeSet: next })
    .where(
      and(eq(templateVersions.id, versionId), eq(templateVersions.orgId, user.orgId)),
    );

  revalidatePath("/positions");
  return { ok: true };
}

export async function addStage(versionId: string): Promise<Ok> {
  const user = await requireUser("template:write");
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${stages.orderIndex}) + 1, 0)` })
    .from(stages)
    .where(eq(stages.versionId, versionId));

  await db.insert(stages).values({
    versionId,
    orderIndex: next,
    name: { tr: `Aşama ${next + 1}`, en: `Stage ${next + 1}` } satisfies I18nText,
    durationSeconds: 300,
  });
  revalidatePath("/positions");
  return { ok: true };
}

const stagePatch = z.object({
  name: z.object({ tr: z.string(), en: z.string() }).optional(),
  description: z.object({ tr: z.string(), en: z.string() }).optional(),
  internalPurpose: z.string().nullable().optional(),
  internalObjective: z.string().nullable().optional(),
  durationSeconds: z.number().int().min(30).max(7200).optional(),
  graceSeconds: z.number().int().min(0).max(1800).optional(),
  backNavigation: z.boolean().optional(),
  onTimeout: z
    .enum(["AUTO_SUBMIT", "AUTO_CLOSE", "ALLOW_GRACE", "ALLOW_LATE"])
    .optional(),
});

export async function updateStage(
  stageId: string,
  patch: z.infer<typeof stagePatch>,
): Promise<Ok> {
  const user = await requireUser("template:write");
  const versionId = await versionOfStage(stageId);
  if (!versionId) return { ok: false, code: "STAGE_NOT_FOUND" };
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  const parsed = stagePatch.safeParse(patch);
  if (!parsed.success) return { ok: false, code: "INVALID_STAGE" };

  await db.update(stages).set(parsed.data).where(eq(stages.id, stageId));
  revalidatePath("/positions");
  return { ok: true };
}

export async function deleteStage(stageId: string): Promise<Ok> {
  const user = await requireUser("template:write");
  const versionId = await versionOfStage(stageId);
  if (!versionId) return { ok: false, code: "STAGE_NOT_FOUND" };
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  await db.delete(stages).where(eq(stages.id, stageId));
  await renumber(versionId);
  revalidatePath("/positions");
  return { ok: true };
}

/**
 * Order is a unique index per version, so a naive "set each row to its new
 * index" collides halfway through. Everything is pushed out of the way first.
 */
export async function reorderStages(
  versionId: string,
  orderedIds: string[],
): Promise<Ok> {
  const user = await requireUser("template:write");
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(stages)
        .set({ orderIndex: 10_000 + i })
        .where(and(eq(stages.id, id), eq(stages.versionId, versionId)));
    }
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(stages)
        .set({ orderIndex: i })
        .where(and(eq(stages.id, id), eq(stages.versionId, versionId)));
    }
  });
  revalidatePath("/positions");
  return { ok: true };
}

async function renumber(versionId: string) {
  const rows = await db
    .select({ id: stages.id })
    .from(stages)
    .where(eq(stages.versionId, versionId))
    .orderBy(stages.orderIndex);
  await db.transaction(async (tx) => {
    for (const [i, row] of rows.entries()) {
      await tx
        .update(stages)
        .set({ orderIndex: 10_000 + i })
        .where(eq(stages.id, row.id));
    }
    for (const [i, row] of rows.entries()) {
      await tx.update(stages).set({ orderIndex: i }).where(eq(stages.id, row.id));
    }
  });
}

export async function addActivity(
  stageId: string,
  type:
    | "VIDEO"
    | "AUDIO"
    | "LONG_TEXT"
    | "SHORT_TEXT"
    | "SINGLE_CHOICE"
    | "MULTI_CHOICE"
    | "FILE_UPLOAD"
    | "SCENARIO",
): Promise<Ok> {
  const user = await requireUser("template:write");
  const versionId = await versionOfStage(stageId);
  if (!versionId) return { ok: false, code: "STAGE_NOT_FOUND" };
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${activities.orderIndex}) + 1, 0)` })
    .from(activities)
    .where(eq(activities.stageId, stageId));

  const isMedia = type === "VIDEO" || type === "AUDIO";
  await db.insert(activities).values({
    stageId,
    orderIndex: next,
    type,
    candidatePrompt: { tr: "", en: "" } satisfies I18nText,
    thinkSeconds: isMedia ? 30 : 0,
    answerSeconds: isMedia ? 180 : null,
    maxTakes: 1,
    config: {} satisfies ActivityConfig,
  });
  revalidatePath("/positions");
  return { ok: true };
}

const activityPatch = z.object({
  candidatePrompt: z.object({ tr: z.string(), en: z.string() }).optional(),
  candidateNote: z.object({ tr: z.string(), en: z.string() }).optional(),
  internalQuestion: z.string().nullable().optional(),
  internalObjective: z.string().nullable().optional(),
  expectedBehaviours: z.array(z.string()).optional(),
  redFlags: z.array(z.string()).optional(),
  managerNotes: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
  thinkSeconds: z.number().int().min(0).max(600).optional(),
  answerSeconds: z.number().int().min(10).max(3600).nullable().optional(),
  maxTakes: z.number().int().min(1).max(5).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function updateActivity(
  activityId: string,
  patch: z.infer<typeof activityPatch>,
): Promise<Ok> {
  const user = await requireUser("template:write");
  const [row] = await db
    .select({ versionId: stages.versionId })
    .from(activities)
    .innerJoin(stages, eq(stages.id, activities.stageId))
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!row) return { ok: false, code: "ACTIVITY_NOT_FOUND" };
  const blocked = await assertDraft(row.versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  const parsed = activityPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, code: "INVALID_ACTIVITY" };

  await db
    .update(activities)
    .set(parsed.data as never)
    .where(eq(activities.id, activityId));
  revalidatePath("/positions");
  return { ok: true };
}

export async function deleteActivity(activityId: string): Promise<Ok> {
  const user = await requireUser("template:write");
  const [row] = await db
    .select({ versionId: stages.versionId, stageId: activities.stageId })
    .from(activities)
    .innerJoin(stages, eq(stages.id, activities.stageId))
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!row) return { ok: false, code: "ACTIVITY_NOT_FOUND" };
  const blocked = await assertDraft(row.versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  await db.delete(activities).where(eq(activities.id, activityId));
  revalidatePath("/positions");
  return { ok: true };
}

/** Which competencies this stage measures. Drives the rail on the review screen. */
export async function setStageCompetencies(
  stageId: string,
  competencyIds: string[],
): Promise<Ok> {
  const user = await requireUser("template:write");
  const versionId = await versionOfStage(stageId);
  if (!versionId) return { ok: false, code: "STAGE_NOT_FOUND" };
  const blocked = await assertDraft(versionId, user.orgId);
  if (blocked) return { ok: false, code: blocked };

  await db.transaction(async (tx) => {
    await tx
      .delete(stageCompetencies)
      .where(eq(stageCompetencies.stageId, stageId));
    if (competencyIds.length) {
      await tx.insert(stageCompetencies).values(
        competencyIds.map((competencyId, i) => ({
          stageId,
          competencyId,
          orderIndex: i,
        })),
      );
    }
  });
  revalidatePath("/positions");
  return { ok: true };
}
