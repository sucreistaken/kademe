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
