export type Viewer = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" };
export type OpeningPeople = {
  decisionMakerId: string | null;
  backupDecisionMakerId: string | null;
  memberIds: string[];
  /** Omitted means not closed. */
  status?: "DRAFT" | "OPEN" | "CLOSED";
};

/**
 * Who sees and edits an opening (plan decision 13). Owners and managers run
 * openings; a reviewer sees only the openings they work on. A reviewer outside
 * the team gets a 404, so an opening's existence is not revealed.
 *
 * Precondition: this function cannot tell organisations apart. The caller loads
 * `people` and the viewer's role scoped to the opening's own organisation (the
 * org id is in the query), and answers 404 for an opening of another org itself.
 * A CLOSED opening is history: everyone who may see it can read it, nobody edits it.
 */
export function openingAccess(viewer: Viewer, people: OpeningPeople): { view: boolean; edit: boolean } {
  const runs = viewer.role === "OWNER" || viewer.role === "MANAGER";
  const edit = runs && people.status !== "CLOSED";
  const view =
    runs ||
    people.memberIds.includes(viewer.id) ||
    people.decisionMakerId === viewer.id ||
    people.backupDecisionMakerId === viewer.id;
  return { view, edit };
}

/** HIRING-UX 4.6: a decision maker (or backup) is an owner or a manager. */
export function canDecide(role: Viewer["role"]): boolean {
  return role === "OWNER" || role === "MANAGER";
}
