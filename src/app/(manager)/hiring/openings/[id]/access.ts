import { notFound } from "next/navigation";
import { ForbiddenError } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import { openingAccess } from "@/solutions/hiring/rules/access";
import { loadOpening } from "@/solutions/hiring/server/openings";

/**
 * The opening as the session user may see it: loaded scoped to the user's
 * organisation (openingAccess cannot tell organisations apart) and judged with
 * its status always passed, so a CLOSED opening is read-only for everyone.
 * Null when the user may not see it (its existence is not revealed).
 */
async function resolveOpening(openingId: string) {
  const user = await requireUser();
  const opening = await loadOpening(user.orgId, openingId);
  if (!opening) return { user, opening: null, access: { view: false, edit: false } } as const;
  const access = openingAccess(user, {
    decisionMakerId: opening.decisionMakerId,
    backupDecisionMakerId: opening.backupDecisionMakerId,
    memberIds: opening.memberIds,
    status: opening.status,
  });
  return { user, opening: access.view ? opening : null, access };
}

/**
 * Every opening page and action starts here. An opening the viewer may not see
 * answers 404; one they may see but not change throws ForbiddenError, which the
 * panel's error boundary explains.
 */
export async function openingFor(openingId: string, need: "view" | "edit") {
  const { user, opening, access } = await resolveOpening(openingId);
  if (!opening) notFound();
  if (need === "edit" && !access.edit) throw new ForbiddenError("opening:write");
  return { user, opening, access };
}

/**
 * openingFor(id, "edit") for actions the builder calls from the browser: the
 * same load and rights, answered as a code the builder turns into a sentence
 * (a thrown 404 or ForbiddenError would only reach it as a failed request).
 */
export async function editableOpening(openingId: string) {
  const { user, opening, access } = await resolveOpening(openingId);
  if (!opening) return { ok: false as const, code: "NOT_FOUND" as const };
  if (opening.status === "CLOSED") return { ok: false as const, code: "CLOSED" as const };
  if (!access.edit) return { ok: false as const, code: "FORBIDDEN" as const };
  return { ok: true as const, user, opening };
}
