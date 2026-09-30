/**
 * Automatic termination. Pure, no database.
 *
 * Off unless the policy opts in. Only two conditions can end an exam, both
 * unambiguous and both under the candidate's control: the screen share has
 * been gone too long, or fullscreen was left too many times. Model signals
 * (faces, phones, voices) never terminate; they are too easy to get wrong.
 */

import type { ProctoringPolicy } from "./policy";
import type { ProctorEventType } from "./taxonomy";

export type TerminationEvent = {
  type: ProctorEventType;
  startedAt: number;
  endedAt: number | null;
};

export type TerminationReason = "SCREEN_SHARE_GONE" | "FULLSCREEN_EXITS";

export type TerminationDecision = {
  terminate: boolean;
  reason: TerminationReason | null;
};

const KEEP_GOING: TerminationDecision = { terminate: false, reason: null };

export function shouldTerminate(
  events: TerminationEvent[],
  policy: Pick<ProctoringPolicy, "termination">,
  now: number,
): TerminationDecision {
  const { enabled, screenShareGoneSeconds, fullscreenExitMax } = policy.termination;
  if (!enabled) return KEEP_GOING;

  const goneLimitMs = screenShareGoneSeconds * 1000;
  // A share that came back after the limit still counts: the candidate was
  // unwatched for too long even if they later fixed it.
  const shareGone = events.some(
    (e) =>
      e.type === "SCREEN_SHARE_STOPPED" &&
      (e.endedAt ?? now) - e.startedAt > goneLimitMs,
  );
  if (shareGone) return { terminate: true, reason: "SCREEN_SHARE_GONE" };

  const exits = events.filter((e) => e.type === "FULLSCREEN_EXIT").length;
  if (exits > fullscreenExitMax) return { terminate: true, reason: "FULLSCREEN_EXITS" };

  return KEEP_GOING;
}
