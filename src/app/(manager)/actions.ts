"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assessmentLinks, assessments, auditLogs, decisions } from "@/db/schema";
import { decisionStatus, linkStatus } from "@/db/schema";
import { requireUser } from "@/server/session";

const DAY_MS = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 60 * 60 * 1000; // one hour, as promised next to the decision button

/**
 * Every action here follows the same shape: do the thing immediately, then hand
 * back an undo. No confirmation dialog exists anywhere in this product.
 */

export async function extendLink(formData: FormData) {
  const user = await requireUser("candidate:invite");

  const linkId = String(formData.get("linkId") ?? "");
  const days = Number(formData.get("days") ?? 3);
  const back = safeBack(formData.get("back"));
  // No fallback name here: an empty `who` lets the screen name the candidate in
  // the manager's own language instead of shipping a Turkish word in a URL.
  const candidateName = String(formData.get("candidateName") ?? "").trim();

  const [link] = await db
    .select({
      id: assessmentLinks.id,
      expiresAt: assessmentLinks.expiresAt,
      status: assessmentLinks.status,
    })
    .from(assessmentLinks)
    .where(eq(assessmentLinks.id, linkId))
    .limit(1);
  if (!link) redirect(back);

  // Extend from now when the link has already lapsed, otherwise from its own
  // deadline. Extending an expired link from its old date would add nothing.
  const from = Math.max(Date.now(), link.expiresAt.getTime());
  const next = new Date(from + days * DAY_MS);

  // Only an EXPIRED link is revived. A candidate who is halfway through keeps
  // IN_PROGRESS: giving them more time must not rewind where they are.
  const nextStatus = link.status === "EXPIRED" ? "NOT_STARTED" : link.status;

  await db
    .update(assessmentLinks)
    .set({ expiresAt: next, status: nextStatus })
    .where(eq(assessmentLinks.id, linkId));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "link.extend",
    subjectType: "assessment_link",
    subjectId: linkId,
    meta: { days, from: link.expiresAt.toISOString(), to: next.toISOString() },
  });

  revalidatePath(back);
  redirect(
    withQuery(back, {
      undo: "link",
      linkId,
      prev: link.expiresAt.toISOString(),
      prevStatus: link.status,
      ...(candidateName ? { who: candidateName } : {}),
      days: String(days),
    }),
  );
}

export async function undoExtendLink(formData: FormData) {
  const user = await requireUser("candidate:invite");

  const linkId = String(formData.get("linkId") ?? "");
  const previous = new Date(String(formData.get("prev") ?? ""));
  const previousStatus = String(formData.get("prevStatus") ?? "");
  const back = safeBack(formData.get("back"));
  if (!linkId || Number.isNaN(previous.getTime())) redirect(back);

  await db
    .update(assessmentLinks)
    .set({
      expiresAt: previous,
      // Restoring the date without the status would leave a revived expired
      // link looking live, which is the opposite of what undo promised.
      ...(isLinkStatus(previousStatus) ? { status: previousStatus } : {}),
    })
    .where(eq(assessmentLinks.id, linkId));

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "link.extend.undo",
    subjectType: "assessment_link",
    subjectId: linkId,
    meta: { restoredTo: previous.toISOString() },
  });

  revalidatePath(back);
  redirect(back);
}

export async function saveDecision(formData: FormData) {
  const user = await requireUser("decision:write");

  const assessmentId = String(formData.get("assessmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const back = safeBack(formData.get("back"));

  if (!assessmentId || !isDecisionStatus(status)) redirect(back);

  // The assessment id comes from a hidden form field. Without this check a
  // manager could write a decision onto another organisation's candidate by
  // editing it, so the row must be one of ours. Not a throw: a page has no way
  // to show a thrown error as a sentence, so it goes back with a code instead.
  if (!(await ownsAssessment(assessmentId, user.orgId))) {
    redirect(withQuery(back, { error: "decision" }));
  }

  const [inserted] = await db
    .insert(decisions)
    .values({
      assessmentId,
      status,
      note: note.length > 0 ? note : null,
      decidedBy: user.id,
    })
    .returning({ id: decisions.id });

  await db.insert(auditLogs).values({
    orgId: user.orgId,
    actorId: user.id,
    action: "decision.write",
    subjectType: "assessment",
    subjectId: assessmentId,
    meta: { status },
  });

  revalidatePath(back);
  redirect(withQuery(back, { undo: "decision", decisionId: inserted.id }));
}

/**
 * Undo removes the row that was just written rather than writing a reversing
 * one, so an undone decision leaves no trace in the history the team reads.
 * Only the newest decision, and only within the promised hour.
 */
export async function undoDecision(formData: FormData) {
  const user = await requireUser("decision:write");

  const decisionId = String(formData.get("decisionId") ?? "");
  const back = safeBack(formData.get("back"));
  if (!decisionId) redirect(back);

  const [row] = await db
    .select({
      id: decisions.id,
      assessmentId: decisions.assessmentId,
      at: decisions.at,
      orgId: assessments.orgId,
    })
    .from(decisions)
    .innerJoin(assessments, eq(assessments.id, decisions.assessmentId))
    .where(eq(decisions.id, decisionId))
    .limit(1);
  if (!row) redirect(back);
  // Same scoping as saveDecision: the decision id arrives from the undo strip.
  if (row.orgId !== user.orgId) redirect(withQuery(back, { error: "decision" }));

  const [newest] = await db
    .select({ id: decisions.id })
    .from(decisions)
    .where(eq(decisions.assessmentId, row.assessmentId))
    .orderBy(desc(decisions.at))
    .limit(1);

  const stillUndoable = Date.now() - row.at.getTime() < UNDO_WINDOW_MS;
  if (newest?.id === row.id && stillUndoable) {
    await db.delete(decisions).where(eq(decisions.id, decisionId));
    await db.insert(auditLogs).values({
      orgId: user.orgId,
      actorId: user.id,
      action: "decision.undo",
      subjectType: "assessment",
      subjectId: row.assessmentId,
      meta: { decisionId },
    });
  }

  revalidatePath(back);
  redirect(back);
}

/** Only ever redirect back inside the manager area. */
function safeBack(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "/dashboard");
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

/**
 * `back` may already carry a query (the candidate page keeps `?assessment=`
 * so a candidate in two positions lands on the right one), so parameters are
 * appended with URLSearchParams rather than a hand-written "?".
 */
function withQuery(back: string, params: Record<string, string>): string {
  const [path, existing = ""] = back.split("?", 2);
  const query = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function ownsAssessment(assessmentId: string, orgId: string) {
  const [row] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.orgId, orgId)))
    .limit(1);
  return Boolean(row);
}

function isLinkStatus(
  value: string,
): value is (typeof linkStatus.enumValues)[number] {
  return (linkStatus.enumValues as readonly string[]).includes(value);
}

function isDecisionStatus(
  value: string,
): value is (typeof decisionStatus.enumValues)[number] {
  return (decisionStatus.enumValues as readonly string[]).includes(value);
}
