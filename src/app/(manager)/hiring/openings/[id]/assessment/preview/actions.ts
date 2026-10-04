"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/server/settings";
import { HiringConflict, HiringNotFound } from "@/solutions/hiring/server/errors";
import { markPreviewed } from "@/solutions/hiring/server/versions";
import { editableOpening } from "../../access";
import type { PreviewStampResult } from "./result";

/**
 * Called once when an editor opens the preview of a draft (HIRING-UX 5.4
 * "Önizleme yapıldı"). The right to edit this opening is checked again here
 * (organisation-scoped load, role, CLOSED: editableOpening), so a reviewer's
 * visit stamps nothing; the stamp uses the session's organisation, and only
 * the draft the preview showed (`versionId`) is stamped.
 */
export async function markPreviewedAction(openingId: string, versionId: string): Promise<PreviewStampResult> {
  if (typeof openingId !== "string" || typeof versionId !== "string" || !isUuid(versionId)) return { ok: false, code: "INVALID" };
  const gate = await editableOpening(openingId);
  if (!gate.ok) return { ok: false, code: gate.code };
  try {
    const stamped = await markPreviewed(gate.user.orgId, openingId, versionId);
    // The overview's readiness row reads the stamp.
    if (stamped) revalidatePath("/hiring/openings/[id]", "page");
    return { ok: true, stamped };
  } catch (error) {
    if (error instanceof HiringConflict && (error.code === "NO_DRAFT" || error.code === "CLOSED")) return { ok: false, code: error.code };
    if (error instanceof HiringNotFound) return { ok: false, code: "NOT_FOUND" };
    throw error;
  }
}
