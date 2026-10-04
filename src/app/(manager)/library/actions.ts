"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createCompetency,
  createPosition,
  saveCompetency,
  savePosition,
  saveScaleLabels,
  setCompetencyArchived,
  setPositionArchived,
  startLibrary,
  type CompetencyInput,
  type CompetencyWriteError,
  type PositionInput,
  type PositionWriteError,
  type SavedTag,
} from "@/server/library-write";
import { COMPETENCY_NAME_MAX, hasText, TAG_LABEL_MAX } from "@/lib/library/anchors";
import {
  POSITION_JOB_AD_MAX,
  POSITION_LANGUAGE_MAX,
  POSITION_LANGUAGES_MAX,
  POSITION_NAME_MAX,
  POSITION_PROFILE_MAX,
  POSITION_SHORT_MAX,
  POSITION_SKILL_MAX,
  POSITION_SKILLS_MAX,
  POSITION_TEAM_MAX,
} from "@/lib/library/positions";
import { draftAnchors, type AnchorDraftOutcome } from "@/server/anchor-draft-job";
import { loadCompetency, loadDefaultScale } from "@/server/library";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";

const i18nMax = (max: number) => z.object({ tr: z.string().max(max), en: z.string().max(max) });
const i18n = i18nMax(2000);
const level = z.enum(["1", "2", "3", "4", "5"]);

const competencySchema = z.object({
  name: i18nMax(COMPETENCY_NAME_MAX),
  description: i18n,
  anchors: z.partialRecord(level, i18n),
  tags: z.array(z.object({ id: z.uuid().nullable(), polarity: z.enum(["POSITIVE", "NEGATIVE"]), label: i18nMax(TAG_LABEL_MAX) })).max(24),
  markReviewed: z.boolean(),
});

export type LibraryActionResult = { ok: true; tags: SavedTag[] } | { ok: false; code: CompetencyWriteError | "INVALID" };

/** The "Başlangıç içeriğini ekle" button: same idempotent seeding as the script. */
export async function startLibraryAction() {
  const user = await requireUser("library:write");
  await startLibrary(user.orgId, user.id);
  revalidatePath("/library/competencies");
}

export async function createCompetencyAction(input: { name: { tr: string; en: string }; description: { tr: string; en: string } }) {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: i18nMax(COMPETENCY_NAME_MAX), description: i18n }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await createCompetency(user.orgId, user.id, parsed.data);
  if (!result.ok) return result;
  redirect(`/library/competencies/${result.id}`);
}

export async function saveCompetencyAction(id: string, input: CompetencyInput): Promise<LibraryActionResult> {
  const user = await requireUser("library:write");
  const parsed = competencySchema.safeParse(input);
  if (!isUuid(id) || !parsed.success) return { ok: false, code: "INVALID" };
  const result = await saveCompetency(user.orgId, user.id, id, parsed.data);
  if (result.ok) revalidatePath(`/library/competencies/${id}`);
  return result;
}

/**
 * Archive and its undo differ only in the flag and where they land; competencies
 * and positions differ only in the write and the page.
 */
async function setArchivedFromForm(
  formData: FormData,
  archived: boolean,
  write: (orgId: string, actorId: string, id: string, archived: boolean) => Promise<boolean>,
  page: "/library/competencies" | "/library/positions",
) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await write(user.orgId, user.id, id, archived);
  redirect(`${page}/${id}${archived ? "?archived=1" : ""}`);
}

export async function archiveCompetencyAction(formData: FormData) {
  await setArchivedFromForm(formData, true, setCompetencyArchived, "/library/competencies");
}

export async function restoreCompetencyAction(formData: FormData) {
  await setArchivedFromForm(formData, false, setCompetencyArchived, "/library/competencies");
}

export async function saveScaleAction(levels: Array<{ value: number; label: { tr: string; en: string } }>) {
  const user = await requireUser("library:scale");
  const parsed = z.array(z.object({ value: z.number().int().min(1).max(5), label: i18n })).max(5).safeParse(levels);
  if (!parsed.success) return { ok: false };
  const result = await saveScaleLabels(user.orgId, user.id, parsed.data);
  if (result.ok) revalidatePath("/library/competencies");
  return result;
}

const positionSchema = z.object({
  name: z.string().max(POSITION_NAME_MAX),
  team: z.string().max(POSITION_TEAM_MAX),
  shortDescription: z.string().max(POSITION_SHORT_MAX),
  jobDescription: z.string().max(POSITION_JOB_AD_MAX),
  skills: z.array(z.string().max(POSITION_SKILL_MAX)).max(POSITION_SKILLS_MAX),
  languages: z.array(z.string().max(POSITION_LANGUAGE_MAX)).max(POSITION_LANGUAGES_MAX),
  profile: z
    .array(z.object({ competencyId: z.uuid(), weight: z.number().int().min(0).max(100), expectedLevel: z.number().int().min(1).max(5).nullable() }))
    .max(POSITION_PROFILE_MAX),
});

export type PositionActionResult = { ok: true; position: PositionInput } | { ok: false; code: PositionWriteError | "INVALID" };

export async function createPositionAction(input: { name: string; team: string; jobDescription: string }) {
  const user = await requireUser("library:write");
  const parsed = positionSchema.pick({ name: true, team: true, jobDescription: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID" as const };
  const result = await createPosition(user.orgId, user.id, parsed.data);
  if (!result.ok) return result;
  redirect(`/library/positions/${result.id}`);
}

export async function savePositionAction(id: string, input: PositionInput): Promise<PositionActionResult> {
  const user = await requireUser("library:write");
  const parsed = positionSchema.safeParse(input);
  if (!isUuid(id) || !parsed.success) return { ok: false, code: "INVALID" };
  const result = await savePosition(user.orgId, user.id, id, parsed.data);
  if (result.ok) revalidatePath(`/library/positions/${id}`);
  return result;
}

export async function archivePositionAction(formData: FormData) {
  await setArchivedFromForm(formData, true, setPositionArchived, "/library/positions");
}

export async function restorePositionAction(formData: FormData) {
  await setArchivedFromForm(formData, false, setPositionArchived, "/library/positions");
}

/**
 * "AI ile çapa öner" (HIRING-UX 5.10): a proposal for the form, never written
 * to the competency. Reads the org's own row (tenancy) and refuses an archived
 * one, which is read-only; no AI call and no ai_runs row on any refusal.
 */
export async function draftAnchorsAction(
  competencyId: string,
  input: { name: { tr: string; en: string }; description: { tr: string; en: string } },
): Promise<AnchorDraftOutcome> {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: i18nMax(COMPETENCY_NAME_MAX), description: i18n }).safeParse(input);
  if (!isUuid(competencyId) || !parsed.success || !hasText(parsed.data.name)) return { status: "FAILED" };
  const competency = await loadCompetency(user.orgId, competencyId);
  if (!competency || competency.archivedAt) return { status: "FAILED" };
  const scale = await loadDefaultScale(user.orgId);
  return draftAnchors(user.orgId, user.id, competencyId, { ...parsed.data, levels: scale?.levels ?? [] });
}
