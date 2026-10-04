"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { seedLibrary } from "@/db/library-seed";
import {
  createCompetency,
  saveCompetency,
  saveScaleLabels,
  setCompetencyArchived,
  type CompetencyInput,
  type CompetencyWriteError,
} from "@/server/library-write";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";

const i18n = z.object({ tr: z.string().max(2000), en: z.string().max(2000) });
const level = z.enum(["1", "2", "3", "4", "5"]);

const competencySchema = z.object({
  name: i18n,
  description: i18n,
  anchors: z.partialRecord(level, i18n),
  tags: z.array(z.object({ id: z.uuid().nullable(), polarity: z.enum(["POSITIVE", "NEGATIVE"]), label: i18n })).max(24),
  markReviewed: z.boolean(),
});

export type LibraryActionResult = { ok: true } | { ok: false; code: CompetencyWriteError | "INVALID" };

/** The "Başlangıç içeriğini ekle" button: same idempotent seeding as the script. */
export async function startLibraryAction() {
  const user = await requireUser("library:write");
  await seedLibrary(user.orgId);
  revalidatePath("/library/competencies");
}

export async function createCompetencyAction(input: { name: { tr: string; en: string }; description: { tr: string; en: string } }) {
  const user = await requireUser("library:write");
  const parsed = z.object({ name: i18n, description: i18n }).safeParse(input);
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

/** Archive and its undo differ only in the flag and where they land. */
async function setArchivedFromForm(formData: FormData, archived: boolean) {
  const user = await requireUser("library:write");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await setCompetencyArchived(user.orgId, user.id, id, archived);
  redirect(`/library/competencies/${id}${archived ? "?archived=1" : ""}`);
}

export async function archiveCompetencyAction(formData: FormData) {
  await setArchivedFromForm(formData, true);
}

export async function restoreCompetencyAction(formData: FormData) {
  await setArchivedFromForm(formData, false);
}

export async function saveScaleAction(levels: Array<{ value: number; label: { tr: string; en: string } }>) {
  const user = await requireUser("library:scale");
  const parsed = z.array(z.object({ value: z.number().int().min(1).max(5), label: i18n })).max(5).safeParse(levels);
  if (!parsed.success) return { ok: false };
  const result = await saveScaleLabels(user.orgId, user.id, parsed.data);
  if (result.ok) revalidatePath("/library/competencies");
  return result;
}
