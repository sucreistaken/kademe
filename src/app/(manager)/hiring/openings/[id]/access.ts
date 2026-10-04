import { notFound } from "next/navigation";
import { ForbiddenError } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import { openingAccess } from "@/solutions/hiring/rules/access";
import { loadOpening } from "@/solutions/hiring/server/openings";

/**
 * Every opening page and action starts here. An opening the viewer may not see
 * answers 404 (its existence is not revealed); one they may see but not change
 * throws ForbiddenError, which the panel's error boundary explains. The opening
 * is loaded scoped to the viewer's organisation (openingAccess cannot tell
 * organisations apart) and its status is always passed, so a CLOSED opening is
 * read-only for everyone.
 */
export async function openingFor(openingId: string, need: "view" | "edit") {
  const user = await requireUser();
  const opening = await loadOpening(user.orgId, openingId);
  if (!opening) notFound();
  const access = openingAccess(user, {
    decisionMakerId: opening.decisionMakerId,
    backupDecisionMakerId: opening.backupDecisionMakerId,
    memberIds: opening.memberIds,
    status: opening.status,
  });
  if (!access.view) notFound();
  if (need === "edit" && !access.edit) throw new ForbiddenError("opening:write");
  return { user, opening, access };
}
