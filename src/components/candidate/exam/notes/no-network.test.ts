import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = __dirname;
const sources = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

describe("notes stay in the browser", () => {
  it("finds the notes sources", () => {
    expect(sources.length).toBeGreaterThan(5);
  });
  it.each(sources)("%s imports no api client or network module and calls no network API", (file) => {
    const src = readFileSync(join(dir, file), "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      expect(spec).not.toMatch(/client\/api|\/api\/|candidate-client-api|fetch|upload|socket/i);
    }
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  });
});
