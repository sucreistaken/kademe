"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  positions,
  templates,
  templateVersions,
  stages,
  activities,
  stageCompetencies,
  auditLogs,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import { authorize } from "@/lib/authorize";
import { jobAdProblem } from "@/lib/template-draft";

const positionSchema = z.object({
  name: z.string().min(1).max(160),
  shortDescription: z.string().max(400).optional(),
});

/**
 * The job ad is deliberately NOT collected here. Its only consumer is the AI
 * builder, so asking for it before the manager has decided whether to use the
 * AI is asking for work that may be thrown away, and having the same textarea
 * on two consecutive screens reads as a bug. It is asked for on
 * /positions/[id]/templates/new instead, and written to the position from
 * there.
 */

/**
 * Errors travel as codes rather than sentences, so the screen renders them in
 * the manager's own language instead of this module fixing one at write time.
 */
export type PositionErrorCode =
  | "NAME_REQUIRED"
  | "POSITION_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "NO_STAGE"
  | "NO_ACTIVITY"
  | "TOO_SHORT"
  | "TOO_LONG";

export type PositionResult =
  | { status: "idle" }
  | { status: "error"; code: PositionErrorCode };

export async function createPosition(
  _previous: PositionResult,
  formData: FormData,
): Promise<PositionResult> {
  const user = await requireUser("position:write");
  const parsed = positionSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    shortDescription: String(formData.get("shortDescription") ?? "").trim(),
  });
  if (!parsed.success) return { status: "error", code: "NAME_REQUIRED" };

  const [position] = await db
    .insert(positions)
    .values({
      orgId: user.orgId,
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription || null,
    })
    .returning({ id: positions.id });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "position.create",
    subjectType: "position",
    subjectId: position.id,
  });

  revalidatePath("/positions");
  // Straight into the template choice rather than the position detail. A
  // position with no template cannot assess anyone, so the next decision is
  // always the same one, and it is where the AI path is offered.
  redirect(`/positions/${position.id}/templates/new`);
}

/**
 * A template always gets a first draft version, because a template with no
 * version is a row the manager cannot do anything with.
 */
export async function createTemplate(positionId: string, name: string) {
  const user = await requireUser("template:write");
  const [position] = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(and(eq(positions.id, positionId), eq(positions.orgId, user.orgId)))
    .limit(1);
  if (!position) return { ok: false as const, code: "POSITION_NOT_FOUND" as const };

  const versionId = await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(templates)
      // The caller supplies the default name in the manager's own language.
      // Falling back to the position's name keeps this module free of copy.
      .values({ orgId: user.orgId, positionId, name: name.trim() || position.name })
      .returning({ id: templates.id });
    const [version] = await tx
      .insert(templateVersions)
      .values({
        orgId: user.orgId,
        templateId: template.id,
        versionNumber: 1,
        status: "DRAFT",
      })
      .returning({ id: templateVersions.id, templateId: templateVersions.templateId });
    await tx.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "template.create",
      subjectType: "template",
      subjectId: template.id,
      meta: { positionId, versionId: version.id },
    });
    return version;
  });

  revalidatePath(`/positions/${positionId}`);
  return { ok: true as const, templateId: versionId.templateId, versionId: versionId.id };
}

/**
 * The AI path out of the template choice screen: keep the job ad, open the
 * template, and land the manager on the AI builder with the text already there.
 *
 * The ad is written to the position BEFORE the template is created, so a
 * failure halfway leaves the paste on disk rather than making the manager type
 * it twice. Nothing about the ad goes into the audit row except its length; the
 * text itself is the same kind of content `hashPrompt` refuses to store.
 */
export async function startTemplateWithAd(
  _previous: PositionResult,
  formData: FormData,
): Promise<PositionResult> {
  const user = await requireUser("template:write");
  // Two tables are written, so two capabilities. OWNER and RECRUITER hold both.
  authorize(user, "position:write");

  const positionId = String(formData.get("positionId") ?? "");
  const templateName = String(formData.get("templateName") ?? "").trim();
  const jobDescription = String(formData.get("jobDescription") ?? "").trim();

  const problem = jobAdProblem(jobDescription);
  if (problem) return { status: "error", code: problem };

  const [position] = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(and(eq(positions.id, positionId), eq(positions.orgId, user.orgId)))
    .limit(1);
  if (!position) return { status: "error", code: "POSITION_NOT_FOUND" };

  await db
    .update(positions)
    .set({ jobDescription })
    .where(and(eq(positions.id, positionId), eq(positions.orgId, user.orgId)));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "position.job_description_set",
    subjectType: "position",
    subjectId: positionId,
    meta: { length: jobDescription.length, source: "template_choice" },
  });

  const reused = await findEmptyDraft(positionId, user.orgId);
  const target = reused ?? (await createTemplate(positionId, templateName));
  if (!("ok" in target) || !target.ok) {
    return { status: "error", code: "POSITION_NOT_FOUND" };
  }

  revalidatePath(`/positions/${positionId}`);
  redirect(
    `/positions/${positionId}/templates/${target.templateId}/versions/${target.versionId}/ai`,
  );
}

/**
 * Guards the one failure that leaves rubbish behind: `redirect` throws a
 * framework error the client turns into navigation, so a dropped connection
 * leaves the manager on the choice screen with a template already created.
 * Pressing the button again would open a second one, because nothing stops a
 * position owning many templates.
 *
 * An untouched draft is indistinguishable from the one this action would have
 * made, so reusing it is honest, and it self-heals the browser-back case too.
 * A template that has any stage is never reused, which keeps "add a second
 * template to this position" working.
 */
async function findEmptyDraft(positionId: string, orgId: string) {
  const rows = await db
    .select({
      templateId: templates.id,
      versionId: templateVersions.id,
      stageCount: sql<number>`(
        select count(*) from ${stages} where ${stages.versionId} = ${templateVersions.id}
      )`,
      versionCount: sql<number>`(
        select count(*) from ${templateVersions} as v
        where v.template_id = ${templates.id}
      )`,
    })
    .from(templates)
    .innerJoin(templateVersions, eq(templateVersions.templateId, templates.id))
    .where(
      and(
        eq(templates.positionId, positionId),
        eq(templates.orgId, orgId),
        eq(templateVersions.status, "DRAFT"),
      ),
    );

  const empty = rows.find(
    (row) => Number(row.stageCount) === 0 && Number(row.versionCount) === 1,
  );
  return empty
    ? { ok: true as const, templateId: empty.templateId, versionId: empty.versionId }
    : null;
}

/**
 * The template's name is the only thing that tells two of them apart, and until
 * now every one was created as "Değerlendirme şablonu". It is manager-facing
 * metadata: the candidate never sees it, and the immutability trigger guards
 * `template_versions`, not this row, so renaming is safe even once a version is
 * published.
 *
 * FormData rather than arguments, matching the library's archive actions, so
 * the control works before hydration.
 */
export async function renameTemplate(formData: FormData) {
  const user = await requireUser("template:write");
  const templateId = String(formData.get("templateId") ?? "");
  const clean = String(formData.get("name") ?? "").trim().slice(0, 160);

  const [before] = await db
    .select({
      id: templates.id,
      name: templates.name,
      positionId: templates.positionId,
    })
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)))
    .limit(1);
  if (!before) redirect("/positions");
  const back = `/positions/${before.positionId}`;

  // An empty name would leave the row unidentifiable, which is the problem this
  // action exists to fix. Silently keeping the old one beats an error here.
  if (!clean || clean === before.name) redirect(back);

  await db
    .update(templates)
    .set({ name: clean })
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.rename",
    subjectType: "template",
    subjectId: templateId,
    meta: { from: before.name, to: clean },
  });

  revalidatePath(back);
  redirect(back);
}

/**
 * Archive, never delete. A template any candidate ever filled is the only
 * record of what they were asked, so removing it would leave their answers
 * pointing at nothing and the audit log unreadable. Archiving moves it out of
 * the way and keeps every row.
 *
 * A timestamp rather than a flag, so the screen and the audit trail can both
 * say when it happened. The versions keep their own status, which is what makes
 * restoring exact rather than a guess.
 */
export async function archiveTemplate(formData: FormData) {
  const user = await requireUser("template:write");
  const templateId = String(formData.get("templateId") ?? "");
  const name = String(formData.get("name") ?? "");

  const [before] = await db
    .select({ id: templates.id, positionId: templates.positionId })
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)))
    .limit(1);
  if (!before) redirect("/positions");
  const back = `/positions/${before.positionId}`;

  await db
    .update(templates)
    .set({ archivedAt: new Date() })
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.archive",
    subjectType: "template",
    subjectId: templateId,
    meta: { name },
  });

  revalidatePath(back);
  redirect(
    `${back}?undo=template&templateId=${templateId}&who=${encodeURIComponent(name)}`,
  );
}

export async function restoreTemplate(formData: FormData) {
  const user = await requireUser("template:write");
  const templateId = String(formData.get("templateId") ?? "");

  const [before] = await db
    .select({ id: templates.id, positionId: templates.positionId })
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)))
    .limit(1);
  if (!before) redirect("/positions");
  const back = `/positions/${before.positionId}`;

  await db
    .update(templates)
    .set({ archivedAt: null })
    .where(and(eq(templates.id, templateId), eq(templates.orgId, user.orgId)));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.restore",
    subjectType: "template",
    subjectId: templateId,
  });

  revalidatePath(back);
  redirect(back);
}

/**
 * Editing a published version is impossible by design (a database trigger
 * refuses it), so "edit" means copying it into a fresh draft. Everything is
 * duplicated: stages, activities and the competency links.
 */
export async function createDraftFrom(versionId: string) {
  const user = await requireUser("template:write");

  const [source] = await db
    .select()
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.id, versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!source) return { ok: false as const, code: "VERSION_NOT_FOUND" as const };

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${templateVersions.versionNumber}), 0)` })
    .from(templateVersions)
    .where(eq(templateVersions.templateId, source.templateId));

  const draftId = await db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(templateVersions)
      .values({
        orgId: user.orgId,
        templateId: source.templateId,
        versionNumber: max + 1,
        status: "DRAFT",
        defaultLocale: source.defaultLocale,
        localeSet: source.localeSet,
        introTitle: source.introTitle,
        introBody: source.introBody,
        consentTextId: source.consentTextId,
      })
      .returning({ id: templateVersions.id });

    const sourceStages = await tx
      .select()
      .from(stages)
      .where(eq(stages.versionId, versionId));

    for (const stage of sourceStages) {
      const [copy] = await tx
        .insert(stages)
        .values({
          versionId: draft.id,
          orderIndex: stage.orderIndex,
          name: stage.name,
          description: stage.description,
          internalPurpose: stage.internalPurpose,
          internalObjective: stage.internalObjective,
          durationSeconds: stage.durationSeconds,
          graceSeconds: stage.graceSeconds,
          onTimeout: stage.onTimeout,
          backNavigation: stage.backNavigation,
          allowedAttempts: stage.allowedAttempts,
        })
        .returning({ id: stages.id });

      const sourceActivities = await tx
        .select()
        .from(activities)
        .where(eq(activities.stageId, stage.id));
      if (sourceActivities.length) {
        await tx.insert(activities).values(
          sourceActivities.map((a) => ({
            stageId: copy.id,
            orderIndex: a.orderIndex,
            type: a.type,
            isRequired: a.isRequired,
            candidatePrompt: a.candidatePrompt,
            candidateNote: a.candidateNote,
            internalQuestion: a.internalQuestion,
            internalObjective: a.internalObjective,
            expectedBehaviours: a.expectedBehaviours,
            redFlags: a.redFlags,
            managerNotes: a.managerNotes,
            thinkSeconds: a.thinkSeconds,
            answerSeconds: a.answerSeconds,
            maxTakes: a.maxTakes,
            config: a.config,
          })),
        );
      }

      const links = await tx
        .select()
        .from(stageCompetencies)
        .where(eq(stageCompetencies.stageId, stage.id));
      if (links.length) {
        await tx.insert(stageCompetencies).values(
          links.map((l) => ({
            stageId: copy.id,
            competencyId: l.competencyId,
            orderIndex: l.orderIndex,
          })),
        );
      }
    }
    return draft.id;
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "version.draft_from",
    subjectType: "template_version",
    subjectId: draftId,
    meta: { source: versionId },
  });

  return { ok: true as const, versionId: draftId };
}

export async function publishVersion(versionId: string) {
  const user = await requireUser("template:publish");

  const tree = await db
    .select({ stageId: stages.id })
    .from(stages)
    .where(eq(stages.versionId, versionId));
  if (tree.length === 0) {
    return { ok: false as const, code: "NO_STAGE" as const };
  }

  const activityRows = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      sql`${activities.stageId} in (${sql.join(
        tree.map((t) => sql`${t.stageId}`),
        sql`, `,
      )})`,
    );
  if (activityRows.length === 0) {
    return { ok: false as const, code: "NO_ACTIVITY" as const };
  }

  await db
    .update(templateVersions)
    .set({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: user.id })
    .where(
      and(
        eq(templateVersions.id, versionId),
        eq(templateVersions.orgId, user.orgId),
        eq(templateVersions.status, "DRAFT"),
      ),
    );

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "version.publish",
    subjectType: "template_version",
    subjectId: versionId,
  });

  return { ok: true as const };
}
