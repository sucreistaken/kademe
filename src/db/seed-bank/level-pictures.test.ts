import { describe, expect, it } from "vitest";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";

/**
 * Every picture id a level file uses is in the catalog. `img()` throws on an unknown id while the level file
 * loads, so loading each level on its own names the level that holds the bad id. This file imports no level
 * statically on purpose: a test file that imports the whole bank (bank-quality.test.ts) fails to load as a
 * whole on such an id, before any test can say which level it is in.
 */
const LEVEL_FILES: Record<Cefr, () => Promise<unknown>> = {
  A1: () => import("./levels/a1"),
  A2: () => import("./levels/a2"),
  B1: () => import("./levels/b1"),
  B2: () => import("./levels/b2"),
  C1: () => import("./levels/c1"),
  C2: () => import("./levels/c2"),
};

describe("every level's pictures are in the catalog", () => {
  for (const level of CEFR_LEVELS) {
    it(`${level}: the level file loads, so every img() id it uses is in images/manifest.json`, async () => {
      const error = await LEVEL_FILES[level]().then(
        () => null,
        (e: unknown) => (e instanceof Error ? e.message : String(e)),
      );
      expect(error, `${level}: ${error}`).toBeNull();
    });
  }
});
