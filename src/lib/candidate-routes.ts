import type { CandidateState } from "@/lib/exam-flow";

/**
 * Where a given state belongs on screen. Both the server redirect and the
 * client navigation read this, so there is exactly one answer to "which page
 * should this student be on". Section introductions and items share one page,
 * so moving between questions never reloads the document (a reload would drop
 * the screen share and fullscreen).
 */
export function stepPath(token: string, state: Pick<CandidateState, "step">): string {
  const base = `/a/${encodeURIComponent(token)}`;
  switch (state.step) {
    case "CONSENT":
      return base;
    case "INFO":
      return `${base}/info`;
    case "CHECK":
      return `${base}/check`;
    case "SECTION_INTRO":
    case "ITEM":
      return `${base}/exam`;
    case "DONE":
      return `${base}/done`;
  }
}

/**
 * Where to go after a core step (consent, details, device check) answered with
 * a solution's state: the path the state names, else the exam's mapping.
 */
export function nextPath(token: string, state: { step: string; path?: string }): string {
  // A solution's state names its page relative to /a/[token] ("" for the landing).
  return state.path !== undefined ? `/a/${encodeURIComponent(token)}${state.path}` : stepPath(token, state as Pick<CandidateState, "step">);
}
