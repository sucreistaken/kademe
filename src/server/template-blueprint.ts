import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, examBlueprints } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { bankCoverage } from "@/lib/exam/blueprint";
import type { ExamTemplate } from "@/lib/exam/templates";
import { bankCounts } from "@/server/panel";

type Blueprint = typeof examBlueprints.$inferSelect;

export type TemplateBlueprintResult = { ok: true; blueprint: Blueprint; created: boolean } | { ok: false; code: "TEMPLATE_COVERAGE" };

const published = (orgId: string, key: string) =>
  db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.orgId, orgId), eq(examBlueprints.templateKey, key), eq(examBlueprints.status, "PUBLISHED")));

/**
 * The organisation's published exam for a ready template: the one the invite
 * form published before, or a new one published now. A new one passes the
 * same bank coverage check as publishing from the editor (every level, or
 * every claim a manager could choose), so a template never becomes an exam
 * the bank cannot fill. Two invites racing on the same template meet at the
 * partial unique index; the loser reads the winner's row.
 */
export async function ensureTemplateBlueprint(
  orgId: string,
  userId: string,
  template: ExamTemplate,
  locale: Locale,
): Promise<TemplateBlueprintResult> {
  const [existing] = await published(orgId, template.key);
  if (existing) return { ok: true, blueprint: existing, created: false };

  const coverage = bankCoverage(await bankCounts(orgId), template.config, template.mode, null);
  if (!coverage.ok) return { ok: false, code: "TEMPLATE_COVERAGE" };

  const now = new Date();
  const [row] = await db
    .insert(examBlueprints)
    .values({
      orgId,
      name: template.name[locale],
      description: template.summary[locale],
      mode: template.mode,
      status: "PUBLISHED",
      config: template.config,
      templateKey: template.key,
      createdBy: userId,
      publishedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    const [winner] = await published(orgId, template.key);
    if (!winner) throw new Error(`template blueprint ${template.key} vanished after a conflict`);
    return { ok: true, blueprint: winner, created: false };
  }
  await db.insert(auditLogs).values([
    { orgId, actorId: userId, action: "blueprint.create", subjectType: "exam_blueprint", subjectId: row.id, meta: { mode: template.mode, template: template.key, via: "invite" } },
    { orgId, actorId: userId, action: "blueprint.publish", subjectType: "exam_blueprint", subjectId: row.id, meta: { template: template.key, via: "invite" } },
  ]);
  return { ok: true, blueprint: row, created: true };
}
