"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, examBlueprints } from "@/db/schema";
import { bankCoverage, blueprintConfigSchema, type BlueprintConfig } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";
import type { PolicyPreset } from "@/lib/proctor/policy";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { bankCounts } from "@/server/panel";
import { requireUser } from "@/server/session";
import { sectionsWait, startDraft, wizardConfig, type ExamStart, type SectionChoice } from "./new/wizard-model";
import { contentLocale } from "@/i18n/locale";

/**
 * Exams (blueprints). A published exam never changes: invitations already
 * carry a copy of its config, and "edit" on a published exam makes a new draft.
 */

async function own(id: string, orgId: string) {
  const [b] = await db.select().from(examBlueprints).where(and(eq(examBlueprints.id, id), eq(examBlueprints.orgId, orgId)));
  return b ?? null;
}

async function audit(orgId: string, actorId: string, action: string, id: string, meta?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ orgId, actorId, action, subjectType: "exam_blueprint", subjectId: id, meta: meta ?? null });
}

export type CreateExamInput = {
  start: ExamStart;
  /** Empty keeps the template's name (in the manager's language) or the mode's default name. */
  name: string;
  sections: SectionChoice[];
  preset: PolicyPreset;
  /** True: publish now (after the bank check). False: keep it a draft and open the editor. */
  publish: boolean;
};

export type CreateExamResult =
  | { ok: true; id: string; name: string; status: "DRAFT" | "PUBLISHED" }
  | { ok: false; code: "TEMPLATE" | "NO_SECTION" | "INVALID" | "COVERAGE" | "FAILED" };

/**
 * The exam wizard's last step: the start's config with the manager's
 * sections, minutes and watching level, saved as a draft or published at
 * once. Publishing runs the editor's bank check first and writes nothing
 * when the bank cannot fill the exam.
 */
export async function createExamAction(input: CreateExamInput): Promise<CreateExamResult> {
  const user = await requireUser("blueprint:write");
  const locale = await managerLocale();
  const start: ExamStart | null =
    input?.start?.kind === "template" && typeof input.start.key === "string"
      ? { kind: "template", key: input.start.key }
      : input?.start?.kind === "blank"
        ? { kind: "blank", mode: input.start.mode === "LEVEL_VERIFICATION" ? "LEVEL_VERIFICATION" : "PLACEMENT" }
        : null;
  const template = start?.kind === "template" ? examTemplateByKey(start.key) : null;
  if (!start || (start.kind === "template" && !template)) return { ok: false, code: "TEMPLATE" };
  const draft = startDraft(start, template ? [{ key: template.key, mode: template.mode, name: template.name[contentLocale(locale)], config: template.config }] : []);
  if (!draft) return { ok: false, code: "TEMPLATE" };
  const choices = Array.isArray(input.sections) ? input.sections.filter((c) => c && typeof c.section === "string").map((c) => ({ section: c.section, enabled: c.enabled === true, minutes: Number(c.minutes) })) : [];
  if (sectionsWait(choices) || !draft.config.sections.some((s) => choices.find((c) => c.section === s.section)?.enabled)) return { ok: false, code: "NO_SECTION" };
  const preset: PolicyPreset = input.preset === "OFF" || input.preset === "STRICT" ? input.preset : "STANDARD";
  const parsed = blueprintConfigSchema.safeParse(wizardConfig(draft.config, choices, preset));
  if (!parsed.success) return { ok: false, code: "INVALID" };
  const config = parsed.data;
  const typed = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  const t = managerT(locale);
  const name = typed || (template ? template.name[contentLocale(locale)] : t(draft.mode === "PLACEMENT" ? "examWizard.defaultNamePlacement" : "examWizard.defaultNameVerification"));
  if (input.publish && !bankCoverage(await bankCounts(user.orgId), config, draft.mode, null).ok) return { ok: false, code: "COVERAGE" };
  try {
    const now = new Date();
    const [b] = await db
      .insert(examBlueprints)
      .values({
        orgId: user.orgId,
        name,
        description: template ? template.summary[contentLocale(locale)] : "",
        mode: draft.mode,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        config,
        createdBy: user.id,
        ...(input.publish ? { publishedAt: now } : {}),
      })
      .returning();
    await audit(user.orgId, user.id, "blueprint.create", b.id, { mode: draft.mode, ...(template ? { template: template.key } : {}), via: "wizard" });
    if (input.publish) await audit(user.orgId, user.id, "blueprint.publish", b.id, { via: "wizard" });
    revalidatePath("/exam/exams");
    return { ok: true, id: b.id, name, status: input.publish ? "PUBLISHED" : "DRAFT" };
  } catch {
    return { ok: false, code: "FAILED" };
  }
}

export type SaveResult = { ok: true; at: string } | { ok: false; error: string };

export async function saveBlueprint(id: string, patch: { name: string; description: string; config: BlueprintConfig }): Promise<SaveResult> {
  const user = await requireUser("blueprint:write");
  const b = await own(id, user.orgId);
  if (!b) return { ok: false, error: "not found" };
  if (b.status !== "DRAFT") return { ok: false, error: "published exams do not change; edit a copy" };
  const parsed = blueprintConfigSchema.safeParse(patch.config);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ").slice(0, 300) };
  if (parsed.data.proctoring.preset === "OFF" && (parsed.data.proctoring.camera || parsed.data.proctoring.screenShare)) {
    parsed.data.proctoring.preset = "STANDARD";
  }
  await db
    .update(examBlueprints)
    .set({ name: patch.name.trim().slice(0, 120) || b.name, description: patch.description.slice(0, 500), config: parsed.data, updatedAt: new Date() })
    .where(eq(examBlueprints.id, id));
  return { ok: true, at: new Date().toISOString() };
}

export async function publishBlueprint(formData: FormData) {
  const user = await requireUser("blueprint:write");
  const id = String(formData.get("id"));
  const b = await own(id, user.orgId);
  if (!b || b.status !== "DRAFT") redirect(`/exam/exams/${id}`);
  // Placement: every level must be covered. Verification: every claim a
  // teacher could choose at invite time.
  const coverage = bankCoverage(await bankCounts(user.orgId), b.config, b.mode, null);
  if (!coverage.ok) redirect(`/exam/exams/${id}?error=coverage`);
  await db.update(examBlueprints).set({ status: "PUBLISHED", publishedAt: new Date(), updatedAt: new Date() }).where(eq(examBlueprints.id, id));
  await audit(user.orgId, user.id, "blueprint.publish", id);
  revalidatePath("/exam/exams");
  redirect(`/exam/exams/${id}`);
}

export async function copyBlueprint(formData: FormData) {
  const user = await requireUser("blueprint:write");
  const b = await own(String(formData.get("id")), user.orgId);
  if (!b) redirect("/exam/exams");
  const [c] = await db
    .insert(examBlueprints)
    .values({ orgId: user.orgId, name: `${b.name} (2)`, description: b.description, mode: b.mode, status: "DRAFT", config: b.config, createdBy: user.id })
    .returning();
  await audit(user.orgId, user.id, "blueprint.copy", c.id, { from: b.id });
  redirect(`/exam/exams/${c.id}`);
}

export async function archiveBlueprint(formData: FormData) {
  const user = await requireUser("blueprint:write");
  const b = await own(String(formData.get("id")), user.orgId);
  if (!b) redirect("/exam/exams");
  await db.update(examBlueprints).set({ status: "ARCHIVED", archivedAt: new Date() }).where(eq(examBlueprints.id, b.id));
  await audit(user.orgId, user.id, "blueprint.archive", b.id);
  revalidatePath("/exam/exams");
  redirect("/exam/exams");
}
