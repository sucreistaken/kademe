import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The tutorial stage is inert and offline: it never reaches the API client,
 * the real listening player and speaking recorder (MediaItems), the media
 * recorder or the proctor engine. Checked twice: what the tutorial files import
 * themselves (the ESLint rule says the same), and everything they reach through
 * other modules. The one door left is the proctor context (ProctorProvider):
 * the stage draws the real exam bar, which reads it, and wraps itself in
 * WithoutProctor so that read finds no engine.
 */

const SRC = path.resolve(process.cwd(), "src");
const DIR = __dirname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sources(file);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [file] : [];
  });
}

const importsOf = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*\(\s*|import\s+)"([^"]+)"/g)].map((m) => m[1]);

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const FORBIDDEN = [
  "lib/client/api.ts",
  "lib/client/recorder.ts",
  "lib/client/proctor/engine.ts",
  "components/candidate/exam/MediaItems.tsx",
].map((f) => path.join(SRC, f));
const FORBIDDEN_SPEC = /(^|\/)lib\/client\/api$|(^|\/)client\/recorder$|(^|\/)lib\/client\/proctor\/|(^|\/)MediaItems$/;
/** Read for its context only; the stage gives it no engine (WithoutProctor). */
const CONTEXT_ONLY = path.join(SRC, "components/candidate/proctor/ProctorProvider.tsx");

const files = sources(DIR);

describe("the tutorial stays offline and inert", () => {
  it("finds the tutorial sources", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [path.relative(DIR, f), f]))("%s imports no API client, real media module or proctor engine", (_name, file) => {
    for (const spec of importsOf(file)) expect(spec).not.toMatch(FORBIDDEN_SPEC);
    expect(readFileSync(file, "utf8")).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|getUserMedia|MediaRecorder/);
  });

  it("reaches none of them through other modules either (only the proctor context, which it neutralises)", () => {
    const seen = new Set<string>();
    const reached: string[] = [];
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (FORBIDDEN.includes(file)) reached.push(path.relative(SRC, file));
      if (file === CONTEXT_ONLY) return;
      for (const spec of importsOf(file)) {
        const next = resolve(file, spec);
        if (next) walk(next);
      }
    };
    files.forEach(walk);
    expect(seen.has(CONTEXT_ONLY)).toBe(true);
    expect(reached).toEqual([]);
  });

  it("wraps the stage in WithoutProctor and makes it inert and hidden from screen readers", () => {
    const stage = readFileSync(path.join(DIR, "DemoStage.tsx"), "utf8");
    expect(stage).toContain("<WithoutProctor>");
    expect(stage).toMatch(/<div inert aria-hidden="true"/);
  });

  it("is covered by an ESLint rule that bans the same imports", () => {
    const config = readFileSync(path.resolve(process.cwd(), "eslint.config.mjs"), "utf8");
    expect(config).toContain('"src/components/candidate/exam/tutorial/**/*.{ts,tsx}"');
    for (const banned of ["@/lib/client/api", "@/lib/client/recorder", "@/lib/client/proctor/*", "@/components/candidate/exam/MediaItems"]) {
      expect(config).toContain(`"${banned}"`);
    }
  });
});
