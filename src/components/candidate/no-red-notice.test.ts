import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? files(f) : f.endsWith(".tsx") ? [f] : [];
  });
}

describe("no red notice box on a candidate screen (red rule)", () => {
  it("nothing under components/candidate draws bg-danger-soft", () => {
    const hits = files(path.resolve(process.cwd(), "src/components/candidate")).filter((f) => readFileSync(f, "utf8").includes("bg-danger-soft"));
    expect(hits).toEqual([]);
  });
});
