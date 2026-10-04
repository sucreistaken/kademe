import type { CandidateVersion } from "@/solutions/hiring/rules/candidate-view";

/**
 * The candidate flow as a list of screens (HIRING-UX 6), kept apart from the
 * rendering so the preview and plan 2's candidate pages share one model.
 */
export type Step = { kind: "intro" } | { kind: "stage"; stage: number } | { kind: "activity"; stage: number; activity: number } | { kind: "done" };

export function stepsOf(version: CandidateVersion): Step[] {
  return [
    { kind: "intro" },
    ...version.stages.flatMap((s, si): Step[] => [{ kind: "stage", stage: si }, ...s.activities.map((_, ai): Step => ({ kind: "activity", stage: si, activity: ai }))]),
    { kind: "done" },
  ];
}

/** The key of the one filled button on a screen; the end screen has none. */
export function primaryOf(version: CandidateVersion, step: Step): "start" | "stageStart" | "next" | "finishStage" | "finish" | null {
  const stages = version.stages;
  if (step.kind === "intro") return stages.length ? "start" : null;
  if (step.kind === "stage") return stages[step.stage].activities.length ? "stageStart" : "next";
  if (step.kind === "activity") {
    if (step.activity < stages[step.stage].activities.length - 1) return "next";
    return step.stage === stages.length - 1 ? "finish" : "finishStage";
  }
  return null;
}

/** HIRING-UX 6: progress is the thin bar plus "Aşama 2 / 3", shown only inside a stage. */
export function progressOf(version: CandidateVersion, step: Step): { n: number; total: number } | null {
  return step.kind === "stage" || step.kind === "activity" ? { n: step.stage + 1, total: version.stages.length } : null;
}

/**
 * What the polite live region says when this screen opens. Null on the done
 * screen: its heading takes focus and is read, so the region stays empty and
 * the end is not announced twice.
 */
export function announcementOf(
  version: CandidateVersion,
  step: Step,
): { key: "announceIntro" | "announceStage" | "questionOf"; values: Record<string, number> } | null {
  const total = version.stages.length;
  if (step.kind === "stage") return { key: "announceStage", values: { n: step.stage + 1, total } };
  if (step.kind === "activity")
    return { key: "questionOf", values: { stage: step.stage + 1, stages: total, n: step.activity + 1, total: version.stages[step.stage].activities.length } };
  if (step.kind === "done") return null;
  return { key: "announceIntro", values: {} };
}
