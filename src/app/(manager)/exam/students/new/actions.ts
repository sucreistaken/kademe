"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { examBlueprints } from "@/db/schema";
import { bankCoverage } from "@/lib/exam/blueprint";
import { isCefr } from "@/lib/exam/cefr";
import { parseExamChoice } from "@/lib/exam/exam-choice";
import { examTemplateByKey } from "@/lib/exam/templates";
import type { Cefr } from "@/lib/exam/types";
import { managerLocale } from "@/i18n/manager-locale";
import { bankCounts } from "@/server/panel";
import { createInvitation } from "@/server/invite";
import { requireUser } from "@/server/session";
import { ensureTemplateBlueprint } from "@/server/template-blueprint";
import { claimFor, listWait, MAX_LIST_TEXT, parseStudentRows } from "./rows";

export type InviteStudentsInput = {
  /** The pasted or uploaded list, as the manager sees it; the server parses it again. */
  text: string;
  /** An exam-choice value (src/lib/exam/exam-choice). */
  exam: string;
  /** Verification exams: the claim for every row that does not name its own. */
  claimed: string | null;
  locale: "tr" | "en";
};

export type InviteFailure = "BLUEPRINT_NOT_FOUND" | "NOT_PUBLISHED" | "CLAIM_REQUIRED" | "GENERIC";

export type InviteStudentsResult =
  | {
      ok: true;
      examName: string;
      created: Array<{ line: number; fullName: string; email: string; url: string; expiresAt: string }>;
      failed: Array<{ line: number; fullName: string; email: string; code: InviteFailure }>;
    }
  | { ok: false; code: "LIST" | "EXAM" | "CLAIM_REQUIRED" | "COVERAGE" | "TEMPLATE_COVERAGE" | "GENERIC" };

/**
 * Invites every student of the list to one exam and hands every link back.
 * Nothing is e-mailed; the school shares the links (the result screen and the
 * student list both offer them). The list is parsed again here with the same
 * rules the wizard showed, and a list with any marked row invites nobody. The
 * bank is checked for the exam (and every claim on the list) before anything
 * is written, so no student meets an empty section. A ready template is
 * published on its first use after the editor's coverage check. Each student
 * is one invitation of its own; one that fails is reported on its line and
 * the others stand.
 */
export async function inviteStudentsAction(input: InviteStudentsInput): Promise<InviteStudentsResult> {
  const user = await requireUser("student:invite");
  const text = typeof input?.text === "string" ? input.text.slice(0, MAX_LIST_TEXT) : "";
  const parsed = parseStudentRows(text);
  if (listWait(parsed)) return { ok: false, code: "LIST" };
  const choice = parseExamChoice(typeof input.exam === "string" ? input.exam : "");
  if (!choice) return { ok: false, code: "EXAM" };
  const batch: Cefr | null = isCefr(input.claimed) ? input.claimed : null;
  const locale = input.locale === "en" ? "en" : "tr";

  let bp: typeof examBlueprints.$inferSelect | undefined;
  if (choice.kind === "template") {
    const template = examTemplateByKey(choice.key);
    if (!template) return { ok: false, code: "EXAM" };
    // Asked before anything is published, so a missing claim publishes nothing.
    if (template.mode === "LEVEL_VERIFICATION" && parsed.rows.some((r) => !claimFor(r, template.mode, batch))) return { ok: false, code: "CLAIM_REQUIRED" };
    const ensured = await ensureTemplateBlueprint(user.orgId, user.id, template, await managerLocale());
    if (!ensured.ok) return { ok: false, code: ensured.code };
    bp = ensured.blueprint;
  } else {
    [bp] = await db.select().from(examBlueprints).where(eq(examBlueprints.id, choice.id));
    if (!bp || bp.orgId !== user.orgId || bp.status !== "PUBLISHED") return { ok: false, code: "EXAM" };
  }
  const exam = bp;
  const claims = parsed.rows.map((r) => claimFor(r, exam.mode, batch));
  if (exam.mode === "LEVEL_VERIFICATION" && claims.some((c) => !c)) return { ok: false, code: "CLAIM_REQUIRED" };
  const counts = await bankCounts(user.orgId);
  for (const claim of new Set(claims)) {
    if (!bankCoverage(counts, exam.config, exam.mode, claim).ok) return { ok: false, code: "COVERAGE" };
  }

  const created: Extract<InviteStudentsResult, { ok: true }>["created"] = [];
  const failed: Extract<InviteStudentsResult, { ok: true }>["failed"] = [];
  for (const [i, row] of parsed.rows.entries()) {
    const fullName = row.fullName.replace(/\s+/g, " ").trim();
    try {
      const r = await createInvitation({ orgId: user.orgId, blueprintId: exam.id, fullName, email: row.email, claimedLevel: claims[i], locale, invitedBy: user.id });
      if (r.ok) created.push({ line: row.line, fullName, email: row.email, url: r.url, expiresAt: r.expiresAt.toISOString() });
      else failed.push({ line: row.line, fullName, email: row.email, code: r.code });
    } catch {
      failed.push({ line: row.line, fullName, email: row.email, code: "GENERIC" });
    }
  }
  if (created.length) revalidatePath("/exam/students");
  return { ok: true, examName: exam.name, created, failed };
}
