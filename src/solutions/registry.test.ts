import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, inviteTargets, manifestByKind, SOLUTION_MANIFESTS } from "./registry";
import { candidateSolution, solutionModule, solutionModules } from "./registry.server";
import { languageExamManifest } from "./language-exam/manifest";
import type { SolutionManifest, SolutionModule } from "./types";

const shared = { today: "Bugün", settings: "Ayarlar", library: { label: "Kütüphane", positions: "Pozisyonlar", competencies: "Yetkinlikler" } };

describe("solution registry", () => {
  it("knows both solutions by their database kind, hiring first (HIRING-UX 4.1)", () => {
    expect(SOLUTION_MANIFESTS.map((m) => m.key)).toEqual(["hiring", "language-exam"]);
    expect(manifestByKind("HIRING")?.key).toBe("hiring");
    expect(solutionModule("HIRING")?.key).toBe("hiring");
    expect(solutionModule("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("keeps manifests and modules in the same order with the same keys", () => {
    expect(solutionModules().map((m) => m.key)).toEqual(SOLUTION_MANIFESTS.map((m) => m.key));
  });

  it("keeps every solution's menu and invite link under its own base path", () => {
    for (const m of SOLUTION_MANIFESTS) {
      expect(m.nav.length).toBeGreaterThan(0);
      for (const item of m.nav) expect(item.href.startsWith(`${m.basePath}/`), item.href).toBe(true);
      if (m.inviteHref) expect(m.inviteHref.startsWith(`${m.basePath}/`)).toBe(true);
    }
    expect(new Set(SOLUTION_MANIFESTS.map((m) => m.dbKind)).size).toBe(SOLUTION_MANIFESTS.length);
  });

  it("does not serve hiring candidates until plan 2 turns the flag on", () => {
    expect(manifestByKind("HIRING")?.candidateFlowLive).toBe(false);
    expect(candidateSolution("HIRING")).toBeNull();
    expect(candidateSolution("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("serves candidates only for a registered module whose flow is live (stubbed registry)", () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const fake = { ...exam, key: "hiring", dbKind: "HIRING", candidateFlowLive: false } as SolutionModule;
    expect(candidateSolution("HIRING", [exam])).toBeNull();
    expect(candidateSolution("HIRING", [exam, fake])).toBeNull();
    expect(candidateSolution("HIRING", [exam, { ...fake, candidateFlowLive: true }])?.key).toBe("hiring");
  });

  it("maps exam steps to the same screens as before", () => {
    const m = manifestByKind("LANGUAGE_EXAM")!;
    expect(m.candidateStepPath("tok", { step: "CONSENT" })).toBe("/a/tok");
    expect(m.candidateStepPath("tok", { step: "INFO" })).toBe("/a/tok/info");
    expect(m.candidateStepPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(m.candidateStepPath("tok", { step: "ITEM" })).toBe("/a/tok/exam");
    expect(m.candidateStepPath("tok", { step: "DONE" })).toBe("/a/tok/done");
    expect(m.candidateStepPath("tok", { step: "SOMETHING_ELSE" })).toBe("/a/tok");
  });

  it("builds the HIRING-UX 4.1 menu with group headers: Today, Hiring, Exam, Library, Settings", () => {
    const nav = buildNav("tr", shared);
    expect(nav.map((g) => g.key)).toEqual(["today", "hiring", "language-exam", "library", "settings"]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
    expect(nav[1].items).toEqual([{ href: "/hiring/openings", label: "Alımlar" }]);
    expect(buildNav("en", shared)[1].items[0].label).toBe("Openings");
  });

  it("drops group headers when only one solution is registered", () => {
    const nav = buildNav("tr", shared, [languageExamManifest]);
    expect(nav.map((g) => g.label)).toEqual([null, null, null, null]);
  });

  it("invites from Today with the first solution that can invite, not the first in the menu", () => {
    expect(inviteTargets()).toEqual([{ key: "language-exam", href: "/exam/students/new" }]);
    const noInvite = { ...languageExamManifest, inviteHref: null } as SolutionManifest;
    expect(inviteTargets([noInvite])).toEqual([]);
  });

  it("offers hiring's action on a position page", () => {
    expect(manifestByKind("HIRING")?.positionAction?.href("p1")).toBe("/hiring/openings/new?position=p1");
  });
});
