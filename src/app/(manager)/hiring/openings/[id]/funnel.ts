import { SURVEY_BATCH } from "@/solutions/hiring/rules/invitation";
import type { OpeningFunnel } from "@/solutions/hiring/server/invitations";

export type FunnelView = {
  steps: Array<{ key: "invited" | "started" | "completed"; count: number }>;
  time: { median: number; estimate: number | null; over: boolean } | null;
  /**
   * Task 19 ruling 1 and fix round 1: the released batches' average and count and unnamed
   * comments as plain text; no rating or date per comment, and no live count while waiting.
   */
  experience: { kind: "off" } | { kind: "waiting"; needed: number } | { kind: "shown"; average: number; count: number; comments: string[] };
};

/** "Over" when the wall-clock median is a quarter longer than the estimate the candidate was given. */
const OVER = 1.25;

/** HIRING-UX 5.4 in plan 2: the counts, the time against the estimate, and the experience in batches of five. */
export function funnelView(f: OpeningFunnel, surveyEnabled: boolean): FunnelView | null {
  if (f.invited === 0) return null;
  return {
    steps: [
      { key: "invited", count: f.invited },
      { key: "started", count: f.started },
      { key: "completed", count: f.completed },
    ],
    time:
      f.medianMinutes === null
        ? null
        : { median: f.medianMinutes, estimate: f.estimateMinutes, over: f.estimateMinutes !== null && f.medianMinutes > f.estimateMinutes * OVER },
    // Answers gathered before the survey was switched off still show once there are enough.
    experience:
      f.survey.average !== null
        ? { kind: "shown", average: f.survey.average, count: f.survey.count, comments: f.survey.comments }
        : !surveyEnabled
          ? { kind: "off" }
          : { kind: "waiting", needed: SURVEY_BATCH },
  };
}
