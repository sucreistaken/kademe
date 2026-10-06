import { describe, expect, it } from "vitest";
import { hiringProblemView } from "./problem-view";

describe("which card a served hiring link with a problem shows (Task 18 carry, plan decision 9)", () => {
  it("shows the expired and not-yet cards on an open opening", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: false, started: false })).toBe("expired");
    expect(hiringProblemView({ problem: "NOT_YET", openingClosed: false, started: false })).toBe("notYet");
  });

  it("never says the assessment is open when the opening is closed and the candidate never started: the closed card", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: true, started: false })).toBe("closed");
    expect(hiringProblemView({ problem: "NOT_YET", openingClosed: true, started: false })).toBe("closed");
  });

  it("lets a candidate who started ask for a new link on a closed opening (Task 7 ruling 3)", () => {
    expect(hiringProblemView({ problem: "EXPIRED", openingClosed: true, started: true })).toBe("expired");
  });

  it("leaves an invalid link to the core's card", () => {
    expect(hiringProblemView({ problem: "INVALID", openingClosed: false, started: false })).toBe("invalid");
  });
});
