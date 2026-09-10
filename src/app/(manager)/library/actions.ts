"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  auditLogs,
  competencies,
  evaluationOptions,
  ratingScales,
  scaleLevels,
} from "@/db/schema";
import { countLiveCompetencies } from "@/lib/library-data";
import { requireUser } from "@/server/session";

/**
 * The library is template content, so it rides on the template:write
 * capability: a REVIEWER scores candidates and does not get to redefine what
 * is being scored.
 */
const CAPABILITY = "template:write" as const;

const LIBRARY = "/library";

export async function createCompetency(formData: FormData) {
  const user = await requireUser(CAPABILITY);

  const nameTr = text(formData, "nameTr");
  const nameEn = text(formData, "nameEn");
  const descriptionTr = text(formData, "descriptionTr");
  const descriptionEn = text(formData, "descriptionEn");

  if (!nameTr) redirect(`${LIBRARY}/competencies/new?error=name`);

  const [scale] = await db
    .select({ id: ratingScales.id })
    .from(ratingScales)
    .where(eq(ratingScales.orgId, user.orgId))
    .limit(1);
  if (!scale) redirect(`${LIBRARY}?error=scale`);

  const [created] = await db
    .insert(competencies)
    .values({
      orgId: user.orgId,
      name: { tr: nameTr, en: nameEn || nameTr },
      description: { tr: descriptionTr, en: descriptionEn },
      scaleId: scale.id,
    })
    .returning({ id: competencies.id });

  await writeAudit(user, "competency.create", created.id, { nameTr });
  revalidatePath(LIBRARY);
  redirect(`${LIBRARY}/competencies/${created.id}?created=1`);
}

export async function updateCompetency(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const id = text(formData, "competencyId");
  const nameTr = text(formData, "nameTr");
  const back = `${LIBRARY}/competencies/${id}`;
  if (!id || !nameTr) redirect(`${back}?error=name`);

  await db
    .update(competencies)
    .set({
      name: { tr: nameTr, en: text(formData, "nameEn") || nameTr },
      description: {
        tr: text(formData, "descriptionTr"),
        en: text(formData, "descriptionEn"),
      },
    })
    .where(and(eq(competencies.id, id), eq(competencies.orgId, user.orgId)));

  await writeAudit(user, "competency.update", id, { nameTr });
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/**
 * Archive, never delete. A competency that scored somebody last month has to
 * keep existing or that evaluation stops making sense; evaluation_items points
 * at it with onDelete restrict for exactly that reason.
 */
export async function archiveCompetency(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const id = text(formData, "competencyId");
  const name = text(formData, "name");
  if (!id) redirect(LIBRARY);

  // Never leave the library empty: an empty library is the abandonment risk
  // this whole feature exists to avoid.
  if ((await countLiveCompetencies(user.orgId)) <= 1) {
    redirect(`${LIBRARY}?error=last`);
  }

  await db
    .update(competencies)
    .set({ archivedAt: new Date() })
    .where(and(eq(competencies.id, id), eq(competencies.orgId, user.orgId)));

  await writeAudit(user, "competency.archive", id, { name });
  revalidatePath(LIBRARY);
  redirect(
    `${LIBRARY}?undo=competency&competencyId=${id}&who=${encodeURIComponent(name)}`,
  );
}

export async function restoreCompetency(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const id = text(formData, "competencyId");
  if (!id) redirect(LIBRARY);

  await db
    .update(competencies)
    .set({ archivedAt: null })
    .where(and(eq(competencies.id, id), eq(competencies.orgId, user.orgId)));

  await writeAudit(user, "competency.restore", id, {});
  revalidatePath(LIBRARY);
  redirect(LIBRARY);
}

export async function addOption(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const competencyId = text(formData, "competencyId");
  const labelTr = text(formData, "labelTr");
  const polarity = text(formData, "polarity") === "NEGATIVE" ? "NEGATIVE" : "POSITIVE";
  const back = `${LIBRARY}/competencies/${competencyId}`;
  if (!competencyId || !labelTr) redirect(`${back}?error=label`);

  await assertOwnsCompetency(user.orgId, competencyId, back);

  const [{ highest }] = await db
    .select({ highest: max(evaluationOptions.orderIndex) })
    .from(evaluationOptions)
    .where(eq(evaluationOptions.competencyId, competencyId));

  await db.insert(evaluationOptions).values({
    competencyId,
    polarity,
    label: { tr: labelTr, en: text(formData, "labelEn") || labelTr },
    orderIndex: (highest ?? -1) + 1,
  });

  await writeAudit(user, "option.create", competencyId, { labelTr, polarity });
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/**
 * Chips are archived too, not deleted: evaluation_items stores the ids of the
 * chips that were clicked, and a past evaluation must stay readable.
 */
export async function archiveOption(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const optionId = text(formData, "optionId");
  const competencyId = text(formData, "competencyId");
  const label = text(formData, "label");
  const back = `${LIBRARY}/competencies/${competencyId}`;
  if (!optionId) redirect(back);

  await assertOwnsCompetency(user.orgId, competencyId, back);

  await db
    .update(evaluationOptions)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(evaluationOptions.id, optionId),
        eq(evaluationOptions.competencyId, competencyId),
      ),
    );

  await writeAudit(user, "option.archive", competencyId, { optionId, label });
  revalidatePath(back);
  redirect(
    `${back}?undo=option&optionId=${optionId}&who=${encodeURIComponent(label)}`,
  );
}

export async function restoreOption(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const optionId = text(formData, "optionId");
  const competencyId = text(formData, "competencyId");
  const back = `${LIBRARY}/competencies/${competencyId}`;
  if (!optionId) redirect(back);

  await assertOwnsCompetency(user.orgId, competencyId, back);

  await db
    .update(evaluationOptions)
    .set({ archivedAt: null })
    .where(
      and(
        eq(evaluationOptions.id, optionId),
        eq(evaluationOptions.competencyId, competencyId),
      ),
    );

  await writeAudit(user, "option.restore", competencyId, { optionId });
  revalidatePath(back);
  redirect(back);
}

/**
 * One form for all five levels. Editing an anchor changes what a past score
 * meant, which is why the screen says so out loud instead of hiding it.
 */
export async function updateScale(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const scaleId = text(formData, "scaleId");
  const back = `${LIBRARY}/scale`;
  if (!scaleId) redirect(back);

  const [scale] = await db
    .select({ id: ratingScales.id })
    .from(ratingScales)
    .where(and(eq(ratingScales.id, scaleId), eq(ratingScales.orgId, user.orgId)))
    .limit(1);
  if (!scale) redirect(back);

  const levels = await db
    .select({ id: scaleLevels.id })
    .from(scaleLevels)
    .where(eq(scaleLevels.scaleId, scaleId));

  for (const level of levels) {
    const labelTr = text(formData, `label-tr-${level.id}`);
    if (!labelTr) continue; // A level without a short label would render blank.
    await db
      .update(scaleLevels)
      .set({
        label: { tr: labelTr, en: text(formData, `label-en-${level.id}`) || labelTr },
        anchor: {
          tr: text(formData, `anchor-tr-${level.id}`),
          en: text(formData, `anchor-en-${level.id}`),
        },
      })
      .where(eq(scaleLevels.id, level.id));
  }

  await writeAudit(user, "scale.update", scaleId, { levels: levels.length });
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/* ------------------------------------------------------------------ */

async function assertOwnsCompetency(orgId: string, competencyId: string, back: string) {
  const [row] = await db
    .select({ id: competencies.id })
    .from(competencies)
    .where(and(eq(competencies.id, competencyId), eq(competencies.orgId, orgId)))
    .limit(1);
  if (!row) redirect(back);
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function writeAudit(
  user: { orgId: string; id: string },
  action: string,
  subjectId: string,
  meta: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action,
    subjectType: "competency",
    subjectId,
    meta,
  });
}
