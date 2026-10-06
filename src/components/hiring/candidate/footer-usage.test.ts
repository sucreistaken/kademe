import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.join(process.cwd(), "src/components/hiring/candidate");

describe("one filled button at one place (G9)", () => {
  it("no hiring candidate screen keeps the old ActionBar: the footer draws the button", () => {
    expect(existsSync(path.join(dir, "action-bar.tsx"))).toBe(false);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(/action-bar|ActionBar/);
    }
  });

  it("every screen with a filled button draws it through StepFooter (positive control: the runner does)", () => {
    const runner = readFileSync(path.join(dir, "stage-runner.tsx"), "utf8");
    expect(runner).toMatch(/<StepFooter/);
    // The phone screen (desktop-only.tsx) has no footer: its one filled button is drawn in place.
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx") && f !== "desktop-only.tsx")) {
      const text = readFileSync(path.join(dir, file), "utf8");
      expect(text, file).not.toMatch(/variant="primary"/);
    }
  });
});
