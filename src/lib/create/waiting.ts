/** After this long the usual "10-40 s" is no longer true; the line says so (same rule as the hiring AI page). */
export const SLOW_AFTER_SECONDS = 40;

export function waitingKey(seconds: number): "working" | "workingSlow" {
  return seconds >= SLOW_AFTER_SECONDS ? "workingSlow" : "working";
}
