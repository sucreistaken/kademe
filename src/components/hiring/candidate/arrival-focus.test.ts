import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), "src/components/hiring/candidate", file), "utf8");

/**
 * Final wave A-I3 and the Task 13 minor: every candidate screen a client
 * navigation can land on takes focus on its title once (the useArrivalFocus
 * contract, tested in src/hooks). The DOM part is a browser check; this pins
 * the wiring.
 */
describe("arrival focus on every screen a navigation lands on", () => {
  it.each(["info-step.tsx", "practice.tsx", "done.tsx", "link-problem.tsx", "closed.tsx"])("%s focuses its title on arrival (positive control: /info and /practice)", (file) => {
    expect(read(file)).toMatch(/useArrivalFocus<HTMLHeadingElement>\(\)/);
  });

  it("the problem cards hand that ref to StatusScreen's title", () => {
    expect(read("link-problem.tsx").match(/titleRef=\{title\}/g)).toHaveLength(2);
    expect(read("closed.tsx")).toMatch(/titleRef=\{title\}/);
  });

  it("the device check lands on its title, the same heading its later steps rescue focus to", () => {
    const text = read("device-check.tsx");
    expect(text).toMatch(/useArrivalFocusOn\(title\)/);
    expect(text).toMatch(/titleRef=\{title\}/);
  });

  it("a stage lands on its intro or resume heading only, never on a question by arrival", () => {
    expect(read("stage-runner.tsx")).toMatch(/useArrivalFocusOn\(heading, phase !== "question"\)/);
  });
});
