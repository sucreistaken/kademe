import { ORG_TIMEZONE, zonedDayStart } from "@/lib/org-timezone";
import { canDecide } from "./access";

export type OpeningRulesInput = {
  name: string;
  memberIds: string[];
  decisionMakerId: string | null;
  backupDecisionMakerId: string | null;
  blindMode: boolean;
  /** YYYY-MM-DD in the organisation's time zone, or null for no deadline. */
  deadline: string | null;
  feedbackDays: number;
  candidateContactEmail: string;
  /** The finish survey (HIRING-UX 6.13); left out by callers that do not show it, which keeps the saved value. */
  finishSurveyEnabled?: boolean;
};

export type RulesProblem =
  | "NAME_REQUIRED"
  | "DECISION_MAKER_REQUIRED"
  | "DECISION_MAKER_ROLE"
  | "BACKUP_SAME"
  | "BACKUP_ROLE"
  | "MEMBER_UNKNOWN"
  | "FEEDBACK_DAYS"
  | "DEADLINE_INVALID"
  | "DEADLINE_PAST"
  | "EMAIL";

export type PanelUser = { id: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

/**
 * HIRING-UX 5.18 and 4.6, shared by the form (the disabled reason) and the
 * server (the refusal). `users` are the organisation's own users, so an id from
 * anywhere else is unknown. `today` is the organisation's calendar day (orgDay).
 * `savedDeadline` is the stored deadline day: a deadline that has already
 * passed is refused only when it is being changed, so a passed deadline never
 * locks the team.
 */
export function openingRulesProblems(input: OpeningRulesInput, users: PanelUser[], today: string, savedDeadline: string | null = null): RulesProblem[] {
  const problems: RulesProblem[] = [];
  const active = (id: string | null) => users.find((u) => u.id === id && !u.disabled) ?? null;
  if (!input.name.trim()) problems.push("NAME_REQUIRED");
  if (!input.decisionMakerId) problems.push("DECISION_MAKER_REQUIRED");
  else {
    const dm = active(input.decisionMakerId);
    if (!dm || !canDecide(dm.role)) problems.push("DECISION_MAKER_ROLE");
  }
  if (input.backupDecisionMakerId) {
    if (input.backupDecisionMakerId === input.decisionMakerId) problems.push("BACKUP_SAME");
    else {
      const backup = active(input.backupDecisionMakerId);
      if (!backup || !canDecide(backup.role)) problems.push("BACKUP_ROLE");
    }
  }
  if (input.memberIds.some((id) => !active(id))) problems.push("MEMBER_UNKNOWN");
  // The same range as the database CHECK hiring_feedback_days.
  if (!Number.isInteger(input.feedbackDays) || input.feedbackDays < 1 || input.feedbackDays > 60) problems.push("FEEDBACK_DAYS");
  if (input.deadline) {
    // zonedDayStart answers null for anything that is not a real YYYY-MM-DD.
    if (!zonedDayStart(input.deadline)) problems.push("DEADLINE_INVALID");
    else if (input.deadline !== savedDeadline && input.deadline < today) problems.push("DEADLINE_PAST");
  }
  const email = input.candidateContactEmail.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("EMAIL");
  return problems;
}

/**
 * The last second of the deadline day in the organisation's time zone
 * (ruling C6: ORG_TIMEZONE, never a fixed offset): one second before the next
 * day starts there, so a daylight saving switch is handled by zonedDayStart.
 */
export function deadlineToDate(day: string, timeZone: string = ORG_TIMEZONE): Date {
  const next = zonedDayStart(day, timeZone, 1);
  if (!next) throw new RangeError(`Not a calendar day: ${day}`);
  return new Date(next.getTime() - 1000);
}
