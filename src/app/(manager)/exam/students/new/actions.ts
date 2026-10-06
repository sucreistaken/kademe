"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { examBlueprints } from "@/db/schema";
import { bankCoverage } from "@/lib/exam/blueprint";
import { isCefr } from "@/lib/exam/cefr";
import { parseExamChoice } from "@/lib/exam/exam-choice";
import { examTemplateByKey } from "@/lib/exam/templates";
import { managerLocale } from "@/i18n/manager-locale";
import { bankCounts } from "@/server/panel";
import { createInvitation } from "@/server/invite";
import { requireUser } from "@/server/session";
import { ensureTemplateBlueprint } from "@/server/template-blueprint";

export type InviteState =
  | { ok: true; url: string; name: string }
  | { ok: false; code: "NAME" | "EMAIL" | "EXAM" | "CLAIM_REQUIRED" | "NOT_PUBLISHED" | "BLUEPRINT_NOT_FOUND" | "COVERAGE" | "TEMPLATE_COVERAGE" | "GENERIC" }
  | null;

/**
 * Creates the invitation and hands the link back once. The bank is checked
 * for this student's exam before anything is written: a student must never
 * reach a section with nothing in it. A ready template needs no publish step:
 * the organisation's published exam for it is reused, or published here
 * after the same coverage check the editor's publish runs.
 */
export async function inviteStudent(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireUser("student:invite");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const choice = parseExamChoice(String(formData.get("exam") ?? ""));
  const claimedRaw = String(formData.get("claimed") ?? "");
  const locale = formData.get("locale") === "en" ? "en" : "tr";
  if (fullName.length < 2) return { ok: false, code: "NAME" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, code: "EMAIL" };
  if (!choice) return { ok: false, code: "EXAM" };
  const claimed = isCefr(claimedRaw) ? claimedRaw : null;

  let bp: typeof examBlueprints.$inferSelect | undefined;
  if (choice.kind === "template") {
    const template = examTemplateByKey(choice.key);
    if (!template) return { ok: false, code: "EXAM" };
    // Asked before anything is published, so a missing claim publishes nothing.
    if (template.mode === "LEVEL_VERIFICATION" && !claimed) return { ok: false, code: "CLAIM_REQUIRED" };
    const ensured = await ensureTemplateBlueprint(user.orgId, user.id, template, await managerLocale());
    if (!ensured.ok) return { ok: false, code: ensured.code };
    bp = ensured.blueprint;
  } else {
    [bp] = await db.select().from(examBlueprints).where(eq(examBlueprints.id, choice.id));
    if (!bp || bp.orgId !== user.orgId) return { ok: false, code: "EXAM" };
  }
  if (bp.mode === "LEVEL_VERIFICATION" && !claimed) return { ok: false, code: "CLAIM_REQUIRED" };
  const coverage = bankCoverage(await bankCounts(user.orgId), bp.config, bp.mode, claimed);
  if (!coverage.ok) return { ok: false, code: "COVERAGE" };
  try {
    const r = await createInvitation({ orgId: user.orgId, blueprintId: bp.id, fullName, email, claimedLevel: claimed, locale, invitedBy: user.id });
    if (!r.ok) return { ok: false, code: r.code };
    return { ok: true, url: r.url, name: fullName };
  } catch {
    return { ok: false, code: "GENERIC" };
  }
}
