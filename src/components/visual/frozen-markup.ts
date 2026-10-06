import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Test helper: the markup a shared block drew before a change. Run the test
 * once with CAPTURE_MARKUP=1 at the commit before the change: the current
 * markup is written to `file` (relative to the repository root). Every later
 * run returns what was written, so a default that moves by one class fails.
 */
export function frozenMarkup(file: string, current: string[]): string[] {
  const full = path.resolve(process.cwd(), file);
  if (process.env.CAPTURE_MARKUP === "1") writeFileSync(full, `${JSON.stringify(current, null, 2)}\n`);
  if (!existsSync(full)) throw new Error(`No frozen markup at ${file}: run this test once with CAPTURE_MARKUP=1 before changing the component.`);
  return JSON.parse(readFileSync(full, "utf8")) as string[];
}
