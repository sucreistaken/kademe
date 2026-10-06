"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, examBlueprints } from "@/db/schema";
import { bankCoverage, blueprintConfigSchema, defaultBlueprint, type BlueprintConfig } from "@/lib/exam/blueprint";
import { examTemplateByKey } from "@/lib/exam/templates";
import type { ExamMode } from "@/lib/exam/types";
import { managerLocale } from "@/i18n/manager-locale";
import { bankCounts } from "@/server/panel";
import { requireUser } from "@/server/session";

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

/**
 * A new exam: blank (the mode's default config) or from a ready template, in
 * which case the template sets the mode and config and, unless the manager
 * typed a name, the name in the manager's language.
 */
export async function createBlueprint(formData: FormData) {
  const user = await requireUser("blueprint:write");
  const key = String(formData.get("template") ?? "").trim();
  const template = key ? examTemplateByKey(key) : null;
  if (key && !template) redirect("/exam/exams/new?error=template");
  const typed = String(formData.get("name") ?? "").trim().slice(0, 120);
  let mode: ExamMode;
  let name: string;
  let config: BlueprintConfig;
  if (template) {
    mode = template.mode;
    name = typed || template.name[await managerLocale()];
    config = template.config;
  } else {
    mode = formData.get("mode") === "LEVEL_VERIFICATION" ? "LEVEL_VERIFICATION" : "PLACEMENT";
    name = typed || (mode === "PLACEMENT" ? "Seviye tespit sınavı" : "Seviye doğrulama sınavı");
    config = defaultBlueprint(mode);
  }
  const [b] = await db
    .insert(examBlueprints)
    .values({ orgId: user.orgId, name, mode, status: "DRAFT", config, createdBy: user.id })
    .returning();
  await audit(user.orgId, user.id, "blueprint.create", b.id, template ? { mode, template: template.key } : { mode });
  redirect(`/exam/exams/${b.id}`);
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
