import { isEmail, type InviteRow } from "@/solutions/hiring/rules/invitation";

/**
 * An opening the invite form offers: OPEN, of the session's organisation
 * (invitableOpenings). `evaluators` counts the active panel the invitation
 * copies; `minEvaluations` is the decision minimum; `deadlineDay` is the
 * opening's last day in the organisation's zone.
 */
export type InviteOpening = { id: string; name: string; live: boolean; evaluators: number; minEvaluations: number; deadlineDay: string | null };
export type FormReason = "noOpening" | "notPublished" | "noEvaluators" | "openingDeadline" | "deadline" | "name" | "email" | "noRows" | "rows";

/**
 * HIRING-UX 5.11 "Erken doğrulama": the one reason the invite button waits,
 * the opening's first (published? a team? its own deadline still ahead?),
 * then the chosen day, then the person or the pasted list. The server checks
 * all of it again.
 */
export function inviteReason(input: {
  opening: InviteOpening | null;
  mode: "single" | "many";
  fullName: string;
  email: string;
  rows: InviteRow[];
  deadline: string | null;
  today: string;
}): FormReason | null {
  if (!input.opening) return "noOpening";
  if (!input.opening.live) return "notPublished";
  if (input.opening.evaluators === 0) return "noEvaluators";
  if (input.opening.deadlineDay && input.opening.deadlineDay < input.today) return "openingDeadline";
  if (input.deadline && input.deadline < input.today) return "deadline";
  if (input.mode === "single") {
    if (input.fullName.trim().length < 2) return "name";
    if (!isEmail(input.email)) return "email";
    return null;
  }
  if (input.rows.length === 0) return "noRows";
  if (input.rows.some((r) => r.problem !== null)) return "rows";
  return null;
}

/**
 * A live opening whose active panel is smaller than its decision minimum
 * (ledger, Task 11 carry): the invitation still opens (the candidate is told
 * "at least n" with n = min(minimum, assigned)), but the manager sees the
 * numbers so the team can be filled before decisions. An empty panel is not
 * a shortfall here: the button already waits for it.
 */
export function panelShortfall(opening: InviteOpening | null): { evaluators: number; min: number } | null {
  if (!opening || !opening.live || opening.evaluators === 0) return null;
  return opening.evaluators < opening.minEvaluations ? { evaluators: opening.evaluators, min: opening.minEvaluations } : null;
}
