/**
 * A served hiring link that cannot be used now. The expired and not-yet cards
 * say the assessment can still be done; that is untrue on a closed opening for
 * someone who never started (the team cannot give them a new link: Task 7
 * ruling 3), so they get the closed card. An invalid link keeps the core card.
 */
export function hiringProblemView(input: { problem: "EXPIRED" | "NOT_YET" | "INVALID"; openingClosed: boolean; started: boolean }): "expired" | "notYet" | "closed" | "invalid" {
  if (input.problem === "INVALID") return "invalid";
  if (input.openingClosed && !input.started) return "closed";
  return input.problem === "EXPIRED" ? "expired" : "notYet";
}
