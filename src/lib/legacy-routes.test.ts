import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNav, SOLUTION_MANIFESTS } from "@/solutions/registry";
import { LEGACY_CANDIDATE_API_REWRITES, LEGACY_PANEL_REDIRECTS } from "./legacy-routes";

const app = path.resolve(process.cwd(), "src/app");

describe("legacy candidate API rewrites", () => {
  it.each(LEGACY_CANDIDATE_API_REWRITES)("$source lands on an existing route", ({ source, destination }) => {
    const file = path.join(app, destination.replace(":token", "[token]"), "route.ts");
    expect(existsSync(file), file).toBe(true);
    const old = path.join(app, source.replace(":token", "[token]"), "route.ts");
    expect(existsSync(old), `${old} must be gone, or the rewrite is never used`).toBe(false);
  });
});

const manager = path.resolve(process.cwd(), "src/app/(manager)");

describe("legacy panel redirects", () => {
  it.each(LEGACY_PANEL_REDIRECTS)("$source goes to an existing page", ({ source, destination, permanent }) => {
    const base = destination.replace("/:path*", "");
    expect(existsSync(path.join(manager, base, "page.tsx")), base).toBe(true);
    expect(existsSync(path.join(manager, source.replace("/:path*", "")))).toBe(false);
    expect(permanent).toBe(false);
  });
});

describe("menu", () => {
  it("links only to pages that exist (RULES.md rule 7)", () => {
    const groups = buildNav("tr", { today: "", settings: "", advanced: "" });
    for (const href of groups.flatMap((g) => g.items.map((i) => i.href))) {
      expect(existsSync(path.join(manager, href, "page.tsx")), href).toBe(true);
    }
    for (const m of SOLUTION_MANIFESTS) {
      if (m.inviteHref) expect(existsSync(path.join(manager, m.inviteHref, "page.tsx")), m.inviteHref).toBe(true);
    }
  });
});
