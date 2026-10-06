import type { InviteOpening } from "@/components/hiring/invite/form-rules";
import type { managerT } from "@/i18n/manager";

/**
 * Why "Aday davet et" waits on an opening's pages (RULES 5, Task 19 ruling 2,
 * fix round 1 M1): one reason, the same on the overview and the Candidates tab.
 * A closed opening first, then a role that cannot invite, then an opening whose
 * assessment is not published yet.
 */
export function inviteWaitReason(closed: boolean, canEdit: boolean, t: ReturnType<typeof managerT>): string {
  if (closed) return t("hiringOverview.closedBody");
  if (!canEdit) return t("hiringInvite.noPermission");
  return t("hiringCandidates.emptyNotLive");
}

/**
 * B-M3: an invitable opening the invite form would refuse anyway (inviteReason's
 * opening checks, in its order): no active evaluator on the team, or the
 * opening's last day before `today` (the organisation's day). The opening's
 * header then shows "Aday davet et" waiting with the form's own reason
 * (hiringInvite.reason*) instead of opening the Sheet. A team that is only
 * short of the rule still invites (the calm panelShort warning).
 */
export function inviteBlock(opening: InviteOpening | null, today: string): "noEvaluators" | "openingDeadline" | null {
  if (!opening) return null;
  if (opening.evaluators === 0) return "noEvaluators";
  if (opening.deadlineDay !== null && opening.deadlineDay < today) return "openingDeadline";
  return null;
}
