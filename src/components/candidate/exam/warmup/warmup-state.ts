/**
 * The optional practice on a section introduction. It is kept in the browser
 * only: nothing in it is sent to the server or scored.
 *
 * offer: the question "Bir deneme sorusu çözmek ister misiniz?" is shown.
 * practice: the student is working through the sample steps.
 * done: the practice is over, the introduction says "start when ready".
 * skipped: the student declined or left; the introduction shows no offer.
 */
export type WarmupState = { phase: "offer" } | { phase: "practice"; step: number } | { phase: "done" } | { phase: "skipped" };

export type WarmupAction = { type: "try" } | { type: "skip" } | { type: "next"; total: number } | { type: "leave" };

export const INITIAL_WARMUP: WarmupState = { phase: "offer" };

export function warmupReduce(state: WarmupState, action: WarmupAction): WarmupState {
  switch (action.type) {
    case "try":
      return state.phase === "offer" ? { phase: "practice", step: 0 } : state;
    case "skip":
      return state.phase === "offer" ? { phase: "skipped" } : state;
    case "next":
      if (state.phase !== "practice") return state;
      return state.step + 1 >= action.total ? { phase: "done" } : { phase: "practice", step: state.step + 1 };
    case "leave":
      return state.phase === "practice" ? { phase: "skipped" } : state;
  }
}
