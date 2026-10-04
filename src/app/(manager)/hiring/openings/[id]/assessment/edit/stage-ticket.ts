import { workingVersions } from "@/solutions/hiring/rules/versions";
import { HiringConflict } from "@/solutions/hiring/server/errors";
import { deleteStage, versionsOf } from "@/solutions/hiring/server/versions";
import type { UndoTicket } from "./result";
import { signUndo } from "./undo-token";

/** The opening's draft version id, which every undo ticket is bound to; NO_DRAFT when there is none. */
export async function draftId(orgId: string, openingId: string): Promise<string> {
  const { draft } = workingVersions(await versionsOf(orgId, openingId));
  if (!draft) throw new HiringConflict("NO_DRAFT");
  return draft.id;
}

/**
 * Deletes a stage from the draft and answers its undo ticket: the removed
 * content as the exact JSON string the server signed, its place, and the
 * signature (undo-token.ts). The builder's delete and the AI screen's "Geri al"
 * on an accepted stage both use it, so either is undone by restoreStageFormAction.
 * Callers have already checked the right to edit the opening.
 */
export async function deleteStageWithTicket(orgId: string, openingId: string, stageId: string): Promise<UndoTicket> {
  const versionId = await draftId(orgId, openingId);
  const { payload, index } = await deleteStage(orgId, openingId, stageId);
  const json = JSON.stringify(payload);
  return { payload: json, index, token: signUndo({ orgId, openingId, versionId, kind: "stage", stageId: "", index, payload: json }) };
}
