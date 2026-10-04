"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/authorize";
import { activityPayloadSchema, stagePayloadSchema, type ActivityPatch, type StagePatch } from "@/solutions/hiring/rules/patches";
import type { ActivityType } from "@/solutions/hiring/rules/content";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import {
  addActivity,
  addStage,
  deleteActivity,
  deleteStage,
  ensureDraftVersion,
  insertActivity,
  insertStage,
  moveActivity,
  moveStage,
  setActivityCompetencies,
  updateActivity,
  updateStage,
  versionsOf,
} from "@/solutions/hiring/server/versions";
import { workingVersions } from "@/solutions/hiring/rules/versions";
import { editableOpening, openingFor } from "../../access";
import type { ActionResult, UndoTicket } from "./result";
import { signUndo, verifyUndo } from "./undo-token";

/**
 * Builder writes (HIRING-UX 5.5). Every action asks for the right to edit this
 * opening (organisation-scoped load, role, CLOSED) before anything else, and
 * writes with the session's organisation, never one from the browser. The
 * draft functions validate every value; a refusal comes back as a code (with
 * field paths for INVALID) that the builder turns into a sentence. Anything
 * else is a real error and reaches the caller.
 */
function refusalOf(error: unknown): Extract<ActionResult<never>, { ok: false }> | null {
  if (error instanceof HiringConflict) return { ok: false, code: error.code };
  if (error instanceof HiringNotFound) return { ok: false, code: "NOT_FOUND" };
  if (error instanceof HiringInvalid) return { ok: false, code: "INVALID", fields: error.issues.map((i) => i.path) };
  if (error instanceof ZodError) return { ok: false, code: "INVALID", fields: error.issues.map((i) => i.path.map(String).join(".")) };
  return null;
}

const invalidId = { ok: false as const, code: "INVALID" as const, fields: ["id"] };
const allStrings = (...values: unknown[]) => values.every((value) => typeof value === "string");

async function run<T>(openingId: string, work: (orgId: string) => Promise<T>): Promise<ActionResult<T>> {
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  try {
    const value = await work(gate.user.orgId);
    revalidatePath("/hiring/openings/[id]", "layout");
    return { ok: true, value, at: new Date().toISOString() };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return refusal;
    throw error;
  }
}

/** "Düzenlemeye başla": opens v(n+1) as a copy of the live version (carry 6: editing a live version is explicit). */
export async function startDraftAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  const { user, opening, access } = await openingFor(openingId, "view");
  const builder = `/hiring/openings/${opening.id}/assessment/edit`;
  // A closed opening is history: say so before the role check, which would answer "your role cannot".
  if (opening.status === "CLOSED") redirect(`${builder}?draft=closed`);
  if (!access.edit) throw new ForbiddenError("opening:write");
  let destination = builder;
  try {
    await ensureDraftVersion(user.orgId, opening.id);
  } catch (error) {
    if (error instanceof HiringConflict && error.code === "CLOSED") destination = `${builder}?draft=closed`;
    else if (refusalOf(error)) destination = `${builder}?draft=failed`;
    else throw error;
  }
  revalidatePath("/hiring/openings/[id]", "layout");
  // redirect() throws, so it stays outside the try.
  redirect(destination);
}

export async function addStageAction(openingId: string) {
  if (!allStrings(openingId)) return invalidId;
  return run(openingId, (orgId) => addStage(orgId, openingId));
}
export async function saveStageAction(openingId: string, stageId: string, patch: StagePatch) {
  if (!allStrings(openingId, stageId)) return invalidId;
  return run(openingId, (orgId) => updateStage(orgId, openingId, stageId, patch));
}
export async function moveStageAction(openingId: string, stageId: string, direction: -1 | 1) {
  if (!allStrings(openingId, stageId)) return invalidId;
  return run(openingId, (orgId) => moveStage(orgId, openingId, stageId, direction));
}
export async function addActivityAction(openingId: string, stageId: string, type: ActivityType) {
  if (!allStrings(openingId, stageId)) return invalidId;
  return run(openingId, (orgId) => addActivity(orgId, openingId, stageId, type));
}
export async function saveActivityAction(openingId: string, activityId: string, patch: ActivityPatch) {
  if (!allStrings(openingId, activityId)) return invalidId;
  return run(openingId, (orgId) => updateActivity(orgId, openingId, activityId, patch));
}
export async function moveActivityAction(openingId: string, activityId: string, direction: -1 | 1) {
  if (!allStrings(openingId, activityId)) return invalidId;
  return run(openingId, (orgId) => moveActivity(orgId, openingId, activityId, direction));
}
export async function setCompetenciesAction(openingId: string, activityId: string, ids: string[]) {
  if (!allStrings(openingId, activityId)) return invalidId;
  return run(openingId, (orgId) => setActivityCompetencies(orgId, openingId, activityId, ids));
}

/** The opening's draft version id, which every undo ticket is bound to; NO_DRAFT when there is none. */
async function draftId(orgId: string, openingId: string): Promise<string> {
  const { draft } = workingVersions(await versionsOf(orgId, openingId));
  if (!draft) throw new HiringConflict("NO_DRAFT");
  return draft.id;
}

/**
 * Deletes answer with an undo ticket: the removed content as the exact JSON
 * string the server signed, its place, and the signature (undo-token.ts).
 */
export async function deleteStageAction(openingId: string, stageId: string): Promise<ActionResult<UndoTicket>> {
  if (!allStrings(openingId, stageId)) return invalidId;
  return run(openingId, async (orgId) => {
    const versionId = await draftId(orgId, openingId);
    const { payload, index } = await deleteStage(orgId, openingId, stageId);
    const json = JSON.stringify(payload);
    return { payload: json, index, token: signUndo({ orgId, openingId, versionId, kind: "stage", stageId: "", index, payload: json }) };
  });
}
export async function deleteActivityAction(openingId: string, activityId: string): Promise<ActionResult<UndoTicket & { stageId: string }>> {
  if (!allStrings(openingId, activityId)) return invalidId;
  return run(openingId, async (orgId) => {
    const versionId = await draftId(orgId, openingId);
    const { payload, stageId, index } = await deleteActivity(orgId, openingId, activityId);
    const json = JSON.stringify(payload);
    return { payload: json, stageId, index, token: signUndo({ orgId, openingId, versionId, kind: "activity", stageId, index, payload: json }) };
  });
}

/** What a "Geri al" form carries, read as strings only. */
function ticketOf(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const index = Number(field("index"));
  return {
    openingId: field("openingId"),
    stageId: field("stageId"),
    payload: field("payload"),
    token: field("token"),
    index: Number.isInteger(index) && index >= 0 ? index : -1,
  };
}

/**
 * The undo of a delete, accepted only as the server handed it out (signature)
 * and validated again with the payload schema; inserted with `restore: true`,
 * so a competency archived since the delete stays on the question (lossless).
 */
async function restore<T>(
  kind: "stage" | "activity",
  formData: FormData,
  insert: (orgId: string, ticket: ReturnType<typeof ticketOf>, payload: unknown) => Promise<T>,
  schema: typeof stagePayloadSchema | typeof activityPayloadSchema,
): Promise<ActionResult<T>> {
  const ticket = ticketOf(formData);
  return run(ticket.openingId, async (orgId) => {
    const versionId = await draftId(orgId, ticket.openingId);
    const subject = { orgId, openingId: ticket.openingId, versionId, kind, stageId: kind === "stage" ? "" : ticket.stageId, index: ticket.index, payload: ticket.payload };
    if (ticket.index < 0 || !verifyUndo(subject, ticket.token)) throw new UndoRefused();
    let raw: unknown;
    try {
      raw = JSON.parse(ticket.payload);
    } catch {
      throw new HiringInvalid([]);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new HiringInvalid(parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })));
    return insert(orgId, ticket, parsed.data);
  }).catch((error: unknown) => {
    if (error instanceof UndoRefused) return { ok: false as const, code: "UNDO_EXPIRED" as const };
    throw error;
  });
}

class UndoRefused extends Error {}

/** The 8 second undo strip after deleting a stage. */
export async function restoreStageFormAction(formData: FormData): Promise<ActionResult<string>> {
  return restore(
    "stage",
    formData,
    (orgId, ticket, payload) => insertStage(orgId, ticket.openingId, payload as Parameters<typeof insertStage>[2], ticket.index, { restore: true }),
    stagePayloadSchema,
  );
}

/** The 8 second undo strip after deleting a question. */
export async function restoreActivityFormAction(formData: FormData): Promise<ActionResult<string>> {
  return restore(
    "activity",
    formData,
    (orgId, ticket, payload) => insertActivity(orgId, ticket.openingId, ticket.stageId, payload as Parameters<typeof insertActivity>[3], ticket.index, { restore: true }),
    activityPayloadSchema,
  );
}
