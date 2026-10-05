import { effectiveSeconds, type ExtraTimePct } from "./candidate-flow";
import type { CandidateVersion } from "./candidate-view";

/**
 * HIRING-UX 7.2 and A3: the landing names every signal that is recorded and
 * nothing else. Plan 2 records no monitoring signal (proctoring level OFF on
 * every invitation): only recorded answers and the technical log (upload
 * completeness and the last heartbeat of each stage). Plan 4 adds rows by level.
 */
export type RecordedSignal = "VIDEO_ANSWER" | "AUDIO_ANSWER" | "TECHNICAL";

const typesOf = (version: CandidateVersion) => new Set(version.stages.flatMap((s) => s.activities.map((a) => a.type)));

export function recordedSignals(version: CandidateVersion): RecordedSignal[] {
  const types = typesOf(version);
  const signals: RecordedSignal[] = [];
  if (types.has("VIDEO")) signals.push("VIDEO_ANSWER");
  if (types.has("AUDIO")) signals.push("AUDIO_ANSWER");
  signals.push("TECHNICAL");
  return signals;
}

/** What the device check proves and the landing lists under "İhtiyacın olanlar". */
export function devicesNeeded(version: CandidateVersion): { camera: boolean; microphone: boolean } {
  const types = typesOf(version);
  return { camera: types.has("VIDEO"), microphone: types.has("VIDEO") || types.has("AUDIO") };
}

/**
 * Whole minutes on this candidate's clocks, extra time included. A stage whose
 * timeout rule is ALLOW_GRACE adds its grace (`graceByStage`, stage id to
 * seconds): the deadline has it baked in, so the landing must not promise less
 * than the clock allows. The candidate view carries no timeout rule, the caller
 * passes only the stages that grant one.
 */
export function estimatedMinutes(
  version: { stages: ReadonlyArray<Pick<CandidateVersion["stages"][number], "id" | "durationSeconds">> },
  pct: ExtraTimePct,
  graceByStage: Record<string, number> = {},
): number {
  const seconds = version.stages.reduce((sum, s) => sum + effectiveSeconds(s.durationSeconds, pct) + Math.max(0, graceByStage[s.id] ?? 0), 0);
  return Math.ceil(seconds / 60);
}
