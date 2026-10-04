import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_CANDIDATE_API_REWRITES } from "./legacy-routes";

const app = path.resolve(process.cwd(), "src/app");

describe("legacy candidate API rewrites", () => {
  it.each(LEGACY_CANDIDATE_API_REWRITES)("$source lands on an existing route", ({ source, destination }) => {
    const file = path.join(app, destination.replace(":token", "[token]"), "route.ts");
    expect(existsSync(file), file).toBe(true);
    const old = path.join(app, source.replace(":token", "[token]"), "route.ts");
    expect(existsSync(old), `${old} must be gone, or the rewrite is never used`).toBe(false);
  });
});
