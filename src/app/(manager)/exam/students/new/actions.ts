"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { examBlueprints } from "@/db/schema";
import { bankCoverage } from "@/lib/exam/blueprint";
import { isCefr } from "@/lib/exam/cefr";
import { bankCounts } from "@/server/panel";
import { createInvitation } from "@/server/invite";
import { requireUser } from "@/server/session";

export type InviteState =
  | { ok: true; url: string; name: string }
  | { ok: false; code: "NAME" | "EMAIL" | "EXAM" | "CLAIM_REQUIRED" | "NOT_PUBLISHED" | "BLUEPRINT_NOT_FOUND" | "COVERAGE" | "GENERIC" }
  | null;

/**
 * Creates the invitation and hands the link back once. The bank is checked
 * for this student's exam before anything is written: a student must never
 * reach a section with nothing in it.
 */
export async function inviteStudent(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireUser("student:invite");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const blueprintId = String(formData.get("blueprintId") ?? "");
  const claimedRaw = String(formData.get("claimed") ?? "");
  const locale = formData.get("locale") === "en" ? "en" : "tr";
  if (fullName.length < 2) return { ok: false, code: "NAME" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, code: "EMAIL" };
  const [bp] = await db.select().from(examBlueprints).where(eq(examBlueprints.id, blueprintId));
  if (!bp || bp.orgId !== user.orgId) return { ok: false, code: "EXAM" };
  const claimed = isCefr(claimedRaw) ? claimedRaw : null;
  if (bp.mode === "LEVEL_VERIFICATION" && !claimed) return { ok: false, code: "CLAIM_REQUIRED" };
  const coverage = bankCoverage(await bankCounts(user.orgId), bp.config, bp.mode, claimed);
  if (!coverage.ok) return { ok: false, code: "COVERAGE" };
  try {
    const r = await createInvitation({ orgId: user.orgId, blueprintId, fullName, email, claimedLevel: claimed, locale, invitedBy: user.id });
    if (!r.ok) return { ok: false, code: r.code };
    return { ok: true, url: r.url, name: fullName };
  } catch {
    return { ok: false, code: "GENERIC" };
  }
}
