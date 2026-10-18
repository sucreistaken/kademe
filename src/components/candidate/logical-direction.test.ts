import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Arabic runs right to left, so a candidate screen must not hard-code a side.
 * Tailwind has a logical twin for every physical direction class (ms/me, ps/pe,
 * start/end, text-start/text-end, rounded-s/rounded-e, border-s/border-e); the
 * twin follows `dir` and the physical one does not.
 *
 * Pointer-coordinate code (a drag ghost's `style={{ left, top }}`) is not a
 * class and is not matched here.
 */

const ROOTS = ["src/components/candidate", "src/components/visual"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sources(file);
    const isSource = /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource ? [file] : [];
  });
}

/** Comments name directions in prose ("left to right"); only code can carry a class. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

/** A class that needs a value after the dash: ml-2, pr-1, left-0, -mr-px. */
const SIDED_WITH_VALUE = "(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-";
/** A class that is complete on its own or takes an optional size: text-left, border-l-2, rounded-r-lg. */
const SIDED_BARE = "(?:text-left|text-right|float-left|float-right|clear-left|clear-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)";
const PHYSICAL = new RegExp(
  `(?<![\\w./$-])(?:[a-z0-9-]+:|\\[[^\\]\\s]*\\]:)*-?(?:${SIDED_WITH_VALUE}[\\w\\[\\]./%()#-]+|${SIDED_BARE}(?:-[\\w\\[\\]./%()#-]+)?)(?![\\w-])`,
  "g",
);

function offenders(): string[] {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for (const file of sources(path.resolve(process.cwd(), root))) {
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        for (const m of line.matchAll(PHYSICAL)) {
          hits.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${m[0]}`);
        }
      });
    }
  }
  return hits;
}

describe("candidate screens use logical direction classes (RTL for Arabic)", () => {
  it("no physical left/right Tailwind class under components/candidate or components/visual", () => {
    expect(offenders()).toEqual([]);
  });

  it("the pattern really catches the classes it is meant to", () => {
    for (const cls of ["ml-2", "-mr-px", "pl-4", "sm:pr-1", "left-0", "right-[3px]", "text-left", "md:text-right", "rounded-l-lg", "rounded-r", "border-l-2", "hover:-ml-1"]) {
      PHYSICAL.lastIndex = 0;
      expect(`<div className="flex ${cls} gap-1">`.match(PHYSICAL), cls).not.toBeNull();
    }
    for (const cls of ["ms-2", "pe-1", "start-0", "end-[3px]", "text-start", "rounded-s-lg", "border-e-2", "rtl:-scale-x-100", "px-4", "mt-2"]) {
      PHYSICAL.lastIndex = 0;
      expect(`<div className="flex ${cls} gap-1">`.match(PHYSICAL), cls).toBeNull();
    }
  });

  it("the stylesheet keeps German content left to right inside an Arabic page", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\[dir="rtl"\] \[lang="de"\]\s*\{\s*direction: ltr;\s*unicode-bidi: isolate;/);
    // Nunito first, then Noto Sans Arabic, then the Arial fallbacks (the order is arabicFontStack's).
    expect(css).toMatch(/:lang\(ar\)\s*\{\s*font-family: var\(--font-arabic, var\(--font-sans\)\), ui-rounded, system-ui, sans-serif;/);
    expect(css).not.toMatch(/:lang\(ar\)\s*\{\s*font-family: var\(--font-noto-arabic\)/);
  });

  it("the Arabic face is not preloaded and the Arabic stack comes from both fonts' family lists", () => {
    const layout = readFileSync(path.resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/Noto_Sans_Arabic\(\{[^}]*subsets: \["arabic"\][^}]*preload: false[^}]*adjustFontFallback: false/);
    expect(layout).toContain('"--font-arabic": arabicFontStack(nunito.style.fontFamily, notoArabic.style.fontFamily)');
  });
});
