export type Viewer = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" };
export type OpeningPeople = { decisionMakerId: string | null; backupDecisionMakerId: string | null; memberIds: string[] };

/**
 * Who sees and edits an opening (plan decision 13). Owners and managers run
 * openings; a reviewer sees only the openings they work on. A reviewer outside
 * the team gets a 404, so an opening's existence is not revealed.
 */
export function openingAccess(viewer: Viewer, people: OpeningPeople): { view: boolean; edit: boolean } {
  const edit = viewer.role === "OWNER" || viewer.role === "MANAGER";
  const view =
    edit ||
    people.memberIds.includes(viewer.id) ||
    people.decisionMakerId === viewer.id ||
    people.backupDecisionMakerId === viewer.id;
  return { view, edit };
}

/** HIRING-UX 4.6: a decision maker (or backup) is an owner or a manager. */
export function canDecide(role: Viewer["role"]): boolean {
  return role === "OWNER" || role === "MANAGER";
}
