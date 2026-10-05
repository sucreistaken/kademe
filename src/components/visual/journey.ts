/** HIRING-VISUAL-FLOW G3: the preparation journey; parts the assessment does not have are dropped (2, 3 or 4 parts). */
export type JourneyKey = "prep" | "device" | "warmup" | "questions";

export function journeySteps(input: { device: boolean; warmup: boolean }): JourneyKey[] {
  return ["prep", ...(input.device ? (["device"] as const) : []), ...(input.warmup ? (["warmup"] as const) : []), "questions"];
}

export function journeyPosition(steps: JourneyKey[], at: JourneyKey): { current: number; total: number } {
  const index = steps.indexOf(at);
  if (index < 0) throw new Error(`journey has no "${at}" part`);
  return { current: index + 1, total: steps.length };
}
