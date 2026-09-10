import type { CandidateState } from "@/lib/candidate-flow";

/**
 * Where a given state belongs on screen. Both the server redirect and the
 * client navigation read this, so there is exactly one answer to "which page
 * should this candidate be on".
 */
export function stepPath(token: string, state: CandidateState): string {
  const base = `/a/${encodeURIComponent(token)}`;
  switch (state.step) {
    case "CONSENT":
      return base;
    case "INFO":
      return `${base}/info`;
    case "CHECK":
      return `${base}/check`;
    case "STAGE":
      return `${base}/stage/${state.stage?.position ?? 1}`;
    case "DONE":
      return `${base}/done`;
  }
}
