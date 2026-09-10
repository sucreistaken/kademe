"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  activities,
  auditLogs,
  competencies,
  positions,
  ratingScales,
  stageCompetencies,
  stages,
  templateVersions,
  templates,
} from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import { requireUser } from "@/server/session";
import { authorize } from "@/lib/authorize";
import { generateTemplateDraft } from "@/lib/template-draft-job";
import {
  competencySuggestionSchema,
  jobAdProblem,
  stageSuggestionSchema,
  type CompetencySuggestion,
  type StageSuggestion,
  type TemplateDraft,
} from "@/lib/template-draft";
import { createDraftFrom } from "@/app/(manager)/positions/actions";

/**
 * The AI builder's writes.
 *
 * Two rules shape everything below:
 *  1. Generating suggestions writes nothing to the template. The draft comes
 *     back to the screen as cards; only accepting one turns it into a stage.
 *  2. Suggestions always land in a DRAFT version. A published version is frozen
 *     by a database trigger, so if this screen is opened on one, accepting
 *     opens a fresh draft off it and writes there instead.
 */

/**
 * Errors this module raises itself travel as codes, so the screen renders them
 * in the manager's own language. `message` is kept for the two states whose
 * text comes back from the model pipeline, which reports in prose.
 */
export type AiErrorCode =
  | "UNCONFIGURED"
  | "PROVIDER_FAILED"
  | "SCHEMA_FAILED"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "VERSION_NOT_FOUND"
  | "NO_STAGES"
  | "INVALID_STAGE"
  | "STAGE_NOT_FOUND"
  | "VERSION_PUBLISHED"
  | "INVALID_COMPETENCY"
  | "ACCEPT_STAGE_FIRST"
  | "NO_DRAFT_STAGE"
  | "NO_SCALE"
  | "NO_COMPETENCY_TO_UNDO"
  | "COMPETENCY_NOT_FOUND";

export type DraftState =
  | { status: "idle" }
  | { status: "error"; code: AiErrorCode }
  /**
   * A failure the pipeline named. `detail` is the provider's own words, shown
   * under the sentence rather than instead of it: the pipeline used to answer
   * in Turkish prose, which reached an English panel unchanged.
   */
  | { status: "reported"; code: AiErrorCode; detail?: string }
  | {
      status: "ready";
      draft: TemplateDraft;
      model: string;
      costUsd: number | null;
      repaired: boolean;
      /** Requests the provider needed, retries of a busy endpoint included. */
      attempts: number;
      /**
       * Set when the fast provider gave up and the backup answered instead.
       * The manager waited minutes rather than seconds and deserves to know
       * why, rather than concluding the feature is slow.
       */
      fellBackTo: string | null;
      /** Set when the draft is still longer than a candidate would finish. */
      budgetWarning: string | null;
      /** Suggestions past the stage cap, dropped before the cards were built. */
      droppedStages: number;
      /** Changes on every run, so the screen can tell two runs apart. */
      runId: string;
    };

const requestSchema = z.object({
  versionId: z.string().uuid(),
  jobDescription: z.string(),
});

export async function requestDraft(
  _previous: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const user = await requireUser("template:write");

  const parsed = requestSchema.safeParse({
    versionId: String(formData.get("versionId") ?? ""),
    jobDescription: String(formData.get("jobDescription") ?? "").trim(),
  });
  if (!parsed.success) {
    return { status: "error", code: "TOO_SHORT" };
  }
  // Bounds live in one place now. They used to be a `min(120).max(20000)` here
  // and a separate constant on the client, which meant a paste over the
  // maximum was reported to the manager as "too short".
  const problem = jobAdProblem(parsed.data.jobDescription);
  if (problem) return { status: "error", code: problem };

  const [version] = await db
    .select({
      id: templateVersions.id,
      localeSet: templateVersions.localeSet,
      positionId: positions.id,
      positionName: positions.name,
      jobDescription: positions.jobDescription,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(
        eq(templateVersions.id, parsed.data.versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!version) return { status: "error", code: "VERSION_NOT_FOUND" };

  // The ad is the manager's work, not a throwaway parameter. Keeping it means
  // a provider failure does not cost them the paste, and the next draft on this
  // position opens with it already there.
  if (parsed.data.jobDescription !== (version.jobDescription ?? "")) {
    authorize(user, "position:write");
    await db
      .update(positions)
      .set({ jobDescription: parsed.data.jobDescription })
      .where(
        and(eq(positions.id, version.positionId), eq(positions.orgId, user.orgId)),
      );
    await db.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "position.job_description_set",
      subjectType: "position",
      subjectId: version.positionId,
      // Length only. The text itself is the kind of content `hashPrompt`
      // deliberately refuses to store.
      meta: { length: parsed.data.jobDescription.length, source: "ai_builder" },
    });
  }

  const libraryRows = await db
    .select({ name: competencies.name })
    .from(competencies)
    .where(eq(competencies.orgId, user.orgId));

  const outcome = await generateTemplateDraft({
    orgId: user.orgId,
    requestedBy: user.id,
    positionId: version.positionId,
    positionName: version.positionName,
    jobDescription: parsed.data.jobDescription,
    locales: version.localeSet?.length ? version.localeSet : ["tr"],
    existingCompetencies: libraryRows.map((row) => row.name.tr || row.name.en),
  });

  if (outcome.status === "UNCONFIGURED") {
    return { status: "reported", code: "UNCONFIGURED" };
  }
  if (outcome.status === "FAILED") {
    return { status: "reported", code: outcome.code, detail: outcome.detail };
  }
  if (outcome.draft.stages.length === 0) {
    return { status: "error", code: "NO_STAGES" };
  }

  return {
    status: "ready",
    draft: outcome.draft,
    model: outcome.model,
    costUsd: outcome.costUsd,
    repaired: outcome.repaired,
    attempts: outcome.attempts,
    fellBackTo: outcome.fellBackTo,
    budgetWarning: outcome.budgetWarning,
    droppedStages: outcome.droppedStages,
    runId: crypto.randomUUID(),
  };
}

export type AcceptStageResult =
  | {
      ok: true;
      stageId: string;
      /** Where it actually landed. Not always the version in the URL. */
      targetVersionId: string;
      /** True when this accept had to open a new draft off a published version. */
      openedNewDraft: boolean;
      stageNumber: number;
      activityCount: number;
    }
  | { ok: false; code: AiErrorCode };

export async function acceptStageSuggestion(
  versionId: string,
  suggestion: StageSuggestion,
): Promise<AcceptStageResult> {
  const user = await requireUser("template:write");

  const parsed = stageSuggestionSchema.safeParse(suggestion);
  if (!parsed.success) return { ok: false, code: "INVALID_STAGE" as const };
  const stage = parsed.data;

  const target = await resolveDraftTarget(versionId, user.orgId);
  if (!target.ok) return { ok: false, code: target.code };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${stages.orderIndex}) + 1, 0)` })
    .from(stages)
    .where(eq(stages.versionId, target.versionId));

  const stageId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(stages)
      .values({
        versionId: target.versionId,
        orderIndex: next,
        name: i18n(stage.nameTr, stage.nameEn),
        description: i18n(stage.descriptionTr, stage.descriptionEn),
        internalPurpose: stage.internalPurpose || null,
        internalObjective: stage.internalObjective || null,
        durationSeconds: stage.durationSeconds,
      })
      .returning({ id: stages.id });

    await tx.insert(activities).values(
      stage.activities.map((activity, index) => ({
        stageId: created.id,
        orderIndex: index,
        type: activity.type,
        candidatePrompt: i18n(activity.promptTr, activity.promptEn),
        candidateNote: i18n(activity.noteTr, activity.noteEn),
        internalQuestion: activity.internalQuestion || null,
        internalObjective: activity.internalObjective || null,
        expectedBehaviours: activity.expectedBehaviours,
        redFlags: activity.redFlags,
        thinkSeconds: activity.thinkSeconds,
        answerSeconds: activity.answerSeconds,
      })),
    );

    return created.id;
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.ai_stage_accepted",
    subjectType: "stage",
    subjectId: stageId,
    meta: {
      versionId: target.versionId,
      suggestionKey: stage.key,
      activityCount: stage.activities.length,
    },
  });

  revalidatePath("/positions");
  return {
    ok: true,
    stageId,
    targetVersionId: target.versionId,
    openedNewDraft: target.openedNewDraft,
    stageNumber: next + 1,
    activityCount: stage.activities.length,
  };
}

/** The other half of "Geri al". Removes exactly what accepting just wrote. */
export async function undoStageAccept(stageId: string): Promise<{ ok: true } | { ok: false; code: AiErrorCode }> {
  const user = await requireUser("template:write");

  const [row] = await db
    .select({ versionId: stages.versionId, status: templateVersions.status })
    .from(stages)
    .innerJoin(templateVersions, eq(templateVersions.id, stages.versionId))
    .where(
      and(eq(stages.id, stageId), eq(templateVersions.orgId, user.orgId)),
    )
    .limit(1);
  if (!row) return { ok: false, code: "STAGE_NOT_FOUND" as const };
  if (row.status !== "DRAFT") {
    return { ok: false, code: "VERSION_PUBLISHED" as const };
  }

  await db.delete(stages).where(eq(stages.id, stageId));
  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.ai_stage_undone",
    subjectType: "stage",
    subjectId: stageId,
    meta: { versionId: row.versionId },
  });

  revalidatePath("/positions");
  return { ok: true };
}

export type AcceptCompetencyResult =
  | {
      ok: true;
      competencyId: string;
      /** True when the competency was added to the library by this accept, so
       *  "Geri al" knows whether removing it is safe. */
      createdInLibrary: boolean;
      linkedStageIds: string[];
    }
  | { ok: false; code: AiErrorCode };

/**
 * A competency suggestion is only half a suggestion on its own: it means
 * something once it is attached to the stages that measure it. So it can only
 * be accepted after at least one of those stages has been accepted, and the
 * screen disables the button with that reason until then.
 */
export async function acceptCompetencySuggestion(
  versionId: string,
  suggestion: CompetencySuggestion,
  stageIds: string[],
): Promise<AcceptCompetencyResult> {
  const user = await requireUser("template:write");

  const parsed = competencySuggestionSchema.safeParse(suggestion);
  if (!parsed.success) return { ok: false, code: "INVALID_COMPETENCY" as const };
  const wanted = parsed.data;

  const ids = z.array(z.string().uuid()).max(20).safeParse(stageIds);
  if (!ids.success || ids.data.length === 0) {
    return { ok: false, code: "ACCEPT_STAGE_FIRST" as const };
  }

  // Every stage must belong to this org and to a draft, or the database trigger
  // would reject the link with a raw Postgres error.
  const stageRows = await db
    .select({ id: stages.id, status: templateVersions.status })
    .from(stages)
    .innerJoin(templateVersions, eq(templateVersions.id, stages.versionId))
    .where(
      and(
        eq(templateVersions.orgId, user.orgId),
        sql`${stages.id} in (${sql.join(
          ids.data.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      ),
    );
  const usableStageIds = stageRows
    .filter((row) => row.status === "DRAFT")
    .map((row) => row.id);
  if (usableStageIds.length === 0) {
    return { ok: false, code: "NO_DRAFT_STAGE" as const };
  }

  const name = wanted.nameTr || wanted.nameEn;
  // Reuse before create: the library is org-wide, and a second "İletişim" that
  // differs only in capitalisation makes the weights screen unreadable.
  const [existing] = await db
    .select({ id: competencies.id })
    .from(competencies)
    .where(
      and(
        eq(competencies.orgId, user.orgId),
        sql`lower(${competencies.name}->>'tr') = lower(${name})`,
      ),
    )
    .limit(1);

  let competencyId = existing?.id ?? null;
  let createdInLibrary = false;

  if (!competencyId) {
    const [scale] = await db
      .select({ id: ratingScales.id })
      .from(ratingScales)
      .where(eq(ratingScales.orgId, user.orgId))
      .limit(1);
    if (!scale) {
      return { ok: false, code: "NO_SCALE" as const };
    }
    const [created] = await db
      .insert(competencies)
      .values({
        orgId: user.orgId,
        name: i18n(wanted.nameTr, wanted.nameEn),
        description: i18n(wanted.descriptionTr, wanted.descriptionEn),
        scaleId: scale.id,
      })
      .returning({ id: competencies.id });
    competencyId = created.id;
    createdInLibrary = true;
  }

  await db.transaction(async (tx) => {
    for (const stageId of usableStageIds) {
      const [{ next }] = await tx
        .select({
          next: sql<number>`coalesce(max(${stageCompetencies.orderIndex}) + 1, 0)`,
        })
        .from(stageCompetencies)
        .where(eq(stageCompetencies.stageId, stageId));

      await tx
        .insert(stageCompetencies)
        .values({ stageId, competencyId: competencyId!, orderIndex: next })
        .onConflictDoNothing();
    }
  });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.ai_competency_accepted",
    subjectType: "competency",
    subjectId: competencyId,
    meta: {
      versionId,
      createdInLibrary,
      stageIds: usableStageIds,
      suggestionKey: wanted.key,
    },
  });

  revalidatePath("/positions");
  revalidatePath("/library");
  return {
    ok: true,
    competencyId,
    createdInLibrary,
    linkedStageIds: usableStageIds,
  };
}

export async function undoCompetencyAccept(
  competencyId: string,
  stageIds: string[],
  createdInLibrary: boolean,
): Promise<{ ok: true } | { ok: false; code: AiErrorCode }> {
  const user = await requireUser("template:write");

  const ids = z.array(z.string().uuid()).max(20).safeParse(stageIds);
  const competency = z.string().uuid().safeParse(competencyId);
  if (!ids.success || !competency.success) {
    return { ok: false, code: "NO_COMPETENCY_TO_UNDO" as const };
  }

  const [owned] = await db
    .select({ id: competencies.id })
    .from(competencies)
    .where(
      and(
        eq(competencies.id, competency.data),
        eq(competencies.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!owned) return { ok: false, code: "COMPETENCY_NOT_FOUND" as const };

  for (const stageId of ids.data) {
    await db
      .delete(stageCompetencies)
      .where(
        and(
          eq(stageCompetencies.stageId, stageId),
          eq(stageCompetencies.competencyId, competency.data),
        ),
      );
  }

  // Only a competency this accept put in the library may be removed again, and
  // only while nothing else uses it. One that was already there belongs to the
  // org, not to this suggestion.
  if (createdInLibrary) {
    const [{ uses }] = await db
      .select({ uses: sql<number>`count(*)::int` })
      .from(stageCompetencies)
      .where(eq(stageCompetencies.competencyId, competency.data));
    if (uses === 0) {
      await db.delete(competencies).where(eq(competencies.id, competency.data));
    }
  }

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "template.ai_competency_undone",
    subjectType: "competency",
    subjectId: competency.data,
    meta: { stageIds: ids.data, createdInLibrary },
  });

  revalidatePath("/positions");
  revalidatePath("/library");
  return { ok: true };
}

type DraftTarget =
  | { ok: true; versionId: string; openedNewDraft: boolean }
  | { ok: false; code: AiErrorCode };

/**
 * Where an accepted suggestion is allowed to land.
 *
 * The version in the URL is used when it is still a draft. When it is published
 * the trigger in 0001_immutability.sql would refuse the insert, so the newest
 * existing draft of the same template is used instead, and if there is none a
 * fresh one is opened off the published version.
 */
async function resolveDraftTarget(
  versionId: string,
  orgId: string,
): Promise<DraftTarget> {
  const [version] = await db
    .select({
      id: templateVersions.id,
      status: templateVersions.status,
      templateId: templateVersions.templateId,
    })
    .from(templateVersions)
    .where(
      and(eq(templateVersions.id, versionId), eq(templateVersions.orgId, orgId)),
    )
    .limit(1);
  if (!version) return { ok: false, code: "VERSION_NOT_FOUND" as const };
  if (version.status === "DRAFT") {
    return { ok: true, versionId: version.id, openedNewDraft: false };
  }

  const [existingDraft] = await db
    .select({ id: templateVersions.id })
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.templateId, version.templateId),
        eq(templateVersions.status, "DRAFT"),
      ),
    )
    .orderBy(sql`${templateVersions.versionNumber} desc`)
    .limit(1);
  if (existingDraft) {
    return { ok: true, versionId: existingDraft.id, openedNewDraft: false };
  }

  const opened = await createDraftFrom(version.id);
  if (!opened.ok) return { ok: false, code: "VERSION_NOT_FOUND" as const };
  return { ok: true, versionId: opened.versionId, openedNewDraft: true };
}

/** An empty string means "fall back to the version's default locale". */
function i18n(tr: string, en: string): I18nText {
  return { tr: tr.trim(), en: en.trim() };
}
