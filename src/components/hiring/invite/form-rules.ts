import type { InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { stepOfProblem } from "@/components/manager/flow-model";
import { cleanInviteName, isEmail, linkExpiryDay, type InviteRow } from "@/solutions/hiring/rules/invitation";

/**
 * An opening the invite form offers: OPEN, of the session's organisation
 * (invitableOpenings). `evaluators` counts the active panel the invitation
 * copies; `deadlineDay` is the opening's last day in the organisation's zone.
 */
export type InviteOpening = { id: string; name: string; live: boolean; evaluators: number; deadlineDay: string | null };
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
  return personWait(input);
}

/** The person step's own reason (4.9, W8): the name and e-mail, or the pasted list. */
export function personWait(input: { mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[] }): "name" | "email" | "noRows" | "rows" | null {
  if (input.mode === "single") {
    // The server's rule (cleanInviteName), so the button never lets through a name it refuses.
    if (cleanInviteName(input.fullName) === null) return "name";
    if (!isEmail(input.email)) return "email";
    return null;
  }
  if (input.rows.length === 0) return "noRows";
  if (input.rows.some((r) => r.problem !== null)) return "rows";
  return null;
}

/**
 * HIRING-VISUAL-FLOW 4.9 (D11): the invite as a guided flow. The main path is
 * the person and the summary, with the opening first on the page when more
 * than one is invitable; the language and the last day open from the summary
 * ("Değiştir") with their defaults already in it.
 */
export type InviteStep = "opening" | "person" | "summary" | "language" | "deadline";
export const INVITE_STEPS: InviteStep[] = ["opening", "person", "summary", "language", "deadline"];
export const invitePath = (input: { pickOpening: boolean }): InviteStep[] => (input.pickOpening ? ["opening", "person", "summary"] : ["person", "summary"]);

/** W3: the first step that is not ready (the opening, then the person); a link past it opens it. */
export function inviteFirstInvalid(input: { opening: InviteOpening | null; pickOpening: boolean; mode: "single" | "many"; fullName: string; email: string; rows: InviteRow[] }): InviteStep | null {
  if (!input.opening && input.pickOpening) return "opening";
  return personWait(input) ? "person" : null;
}

type InviteCode = Extract<InviteOneResult, { ok: false }>["code"];
const REFUSAL_STEP: Partial<Record<InviteCode, InviteStep>> = {
  NAME: "person",
  EMAIL: "person",
  DUPLICATE: "person",
  DEADLINE_INVALID: "deadline",
  DEADLINE_PAST: "deadline",
  NOT_FOUND: "opening",
};

/**
 * W8: the step a refusal of inviteCandidateAction / inviteManyAction is about,
 * shown there with its existing sentence (hiringInvite.err*); the opening's
 * own state (closed, not published, its deadline, no evaluators), the role and
 * a failure stay on the summary. Where there is no opening step (a Sheet, a
 * page with one opening) the caller falls back to the summary.
 */
export const inviteStepOf = (code: InviteCode): InviteStep => stepOfProblem(REFUSAL_STEP, code) ?? "summary";

/**
 * W8: where the flow goes when a request is refused or fails, or null to stay:
 * the step the refusal is about (the opening step only where it is offered,
 * else the summary). A failure after "Yine de davet et" on the person step
 * opens the summary, where its sentence shows, so the duplicate note never
 * vanishes as if the invitation had been made.
 */
export function refusalMove(code: InviteCode, at: { step: InviteStep; pickOpening: boolean }): InviteStep | null {
  const to = inviteStepOf(code);
  const target = to === "opening" && !at.pickOpening ? "summary" : to;
  return target === at.step ? null : target;
}

/**
 * HIRING-VISUAL-FLOW 4.9: the "Son gün" row says the day the server will use
 * (linkExpiryDay), or, before an opening is chosen, that one must be chosen
 * first (never an empty value next to "Değiştir").
 */
export function deadlineRow(input: { opening: InviteOpening | null; deadline: string | null; today: string }): { kind: "pickOpening" } | { kind: "day"; day: string } {
  if (!input.opening) return { kind: "pickOpening" };
  return { kind: "day", day: linkExpiryDay({ chosen: input.deadline, openingDeadlineDay: input.opening.deadlineDay, today: input.today }) };
}

/**
 * The Sheet stays open while a request runs or links are shown: Escape and a
 * click outside would drop a link that is shown only once. Its close button
 * still closes it.
 */
export function sheetLocked(state: { pending: boolean; done: boolean }): boolean {
  return state.pending || state.done;
}

/**
 * The day the date field shows: the day the server will use (linkExpiryDay
 * holds a later day to the opening's deadline), except a past day, which
 * stays as typed so the reason next to the button speaks about what is seen.
 */
export function deadlineInputValue(input: { opening: InviteOpening | null; deadline: string | null; today: string }): string {
  if (!input.opening) return "";
  if (input.deadline !== null && input.deadline < input.today) return input.deadline;
  return linkExpiryDay({ chosen: input.deadline, openingDeadlineDay: input.opening.deadlineDay, today: input.today });
}
