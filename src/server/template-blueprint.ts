import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, examBlueprints } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { bankCoverage } from "@/lib/exam/blueprint";
import type { ReadyExamTemplate } from "@/lib/exam/templates";
import { bankCounts } from "@/server/panel";

type Blueprint = typeof examBlueprints.$inferSelect;

export type TemplateBlueprintResult = { ok: true; blueprint: Blueprint; created: boolean } | { ok: false; code: "TEMPLATE_COVERAGE" };

const published = (orgId: string, key: string) =>
  db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.orgId, orgId), eq(examBlueprints.templateKey, key), eq(examBlueprints.status, "PUBLISHED")));

/**
 * JSON with every object's keys sorted and undefined values left out, so a
 * config read back from jsonb (which reorders keys) compares equal to the
 * same config in code.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Whether a published template exam is still the template as the code has it
 * now. A template exam is never edited (published exams do not change and a
 * copy carries no template key), so a different mode or config means the
 * template changed after the exam was published, e.g. the 2026-10-14 switch
 * from adaptive sections to fixed forms.
 */
export function isCurrentTemplate(row: Pick<Blueprint, "mode" | "config">, template: Pick<ReadyExamTemplate, "mode" | "config">): boolean {
  return row.mode === template.mode && canonicalJson(row.config) === canonicalJson(template.config);
}

/**
 * The organisation's published exam for a ready template: the one the invite
 * form published before, or a new one published now. A new one passes the
 * same bank coverage check as publishing from the editor (every level, or
 * every claim a manager could choose; a course test: both of its forms), so a
 * template never becomes an exam the bank cannot fill.
 *
 * A published exam from an earlier version of the template is retired
 * (ARCHIVED) and the current template is published in its place, in one
 * transaction, so the wizard's card and the exam a new student gets are the
 * same. Students already invited keep their copy (exam_assessments.
 * blueprint_snapshot), so their exams do not change. When the bank does not
 * cover the current template, nothing is retired.
 *
 * Races meet at the partial unique index (one published exam per template):
 * a second call that read the same old row waits on its row lock, then
 * retires nothing (the row is no longer PUBLISHED), its insert does nothing
 * and it reads the winner's row.
 */
export async function ensureTemplateBlueprint(
  orgId: string,
  userId: string,
  template: ReadyExamTemplate,
  locale: Locale,
): Promise<TemplateBlueprintResult> {
  const [existing] = await published(orgId, template.key);
  if (existing && isCurrentTemplate(existing, template)) return { ok: true, blueprint: existing, created: false };

  const coverage = bankCoverage(await bankCounts(orgId), template.config, template.mode, null);
  if (!coverage.ok) return { ok: false, code: "TEMPLATE_COVERAGE" };

  const now = new Date();
  const row = await db.transaction(async (tx) => {
    const retired = existing
      ? await tx
          .update(examBlueprints)
          .set({ status: "ARCHIVED", archivedAt: now, updatedAt: now })
          .where(and(eq(examBlueprints.id, existing.id), eq(examBlueprints.status, "PUBLISHED")))
          .returning({ id: examBlueprints.id })
      : [];
    const [inserted] = await tx
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
    if (!inserted) return null;
    await tx.insert(auditLogs).values([
      ...retired.map((r) => ({
        orgId,
        actorId: userId,
        action: "blueprint.archive",
        subjectType: "exam_blueprint",
        subjectId: r.id,
        meta: { template: template.key, via: "invite", reason: "template-changed", replacedBy: inserted.id },
      })),
      { orgId, actorId: userId, action: "blueprint.create", subjectType: "exam_blueprint", subjectId: inserted.id, meta: { mode: template.mode, template: template.key, via: "invite" } },
      { orgId, actorId: userId, action: "blueprint.publish", subjectType: "exam_blueprint", subjectId: inserted.id, meta: { template: template.key, via: "invite" } },
    ]);
    return inserted;
  });
  if (!row) {
    const [winner] = await published(orgId, template.key);
    if (!winner) throw new Error(`template blueprint ${template.key} vanished after a conflict`);
    return { ok: true, blueprint: winner, created: false };
  }
  return { ok: true, blueprint: row, created: true };
}
