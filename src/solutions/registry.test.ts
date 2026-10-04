import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, manifestByKind, SOLUTION_MANIFESTS } from "./registry";
import { candidateSolution, solutionModule, solutionModules } from "./registry.server";
import { languageExamManifest } from "./language-exam/manifest";
import type { SolutionManifest, SolutionModule } from "./types";

describe("solution registry", () => {
  it("knows the language exam by its database kind", () => {
    expect(manifestByKind("LANGUAGE_EXAM")?.key).toBe("language-exam");
    expect(solutionModule("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("has no hiring module until sub-project 3 registers one", () => {
    expect(manifestByKind("HIRING")).toBeNull();
    expect(solutionModule("HIRING")).toBeNull();
  });

  it("keeps manifests and modules in the same order with the same keys", () => {
    expect(solutionModules().map((m) => m.key)).toEqual(SOLUTION_MANIFESTS.map((m) => m.key));
  });

  it("keeps every solution's menu under its own base path", () => {
    for (const m of SOLUTION_MANIFESTS) {
      expect(m.nav.length).toBeGreaterThan(0);
      for (const item of m.nav) expect(item.href.startsWith(`${m.basePath}/`), item.href).toBe(true);
      expect(m.inviteHref.startsWith(`${m.basePath}/`)).toBe(true);
    }
    const keys = SOLUTION_MANIFESTS.map((m) => m.dbKind);
    expect(new Set(keys).size).toBe(keys.length);
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

  const shared = { today: "Bugün", settings: "Ayarlar", library: { label: "Kütüphane", positions: "Pozisyonlar", competencies: "Yetkinlikler" } };

  it("builds the HIRING-UX 4.1 menu: Today, solutions, Library, Settings, no group header for a single solution", () => {
    const nav = buildNav("tr", shared, [languageExamManifest]);
    expect(nav.map((g) => g.key)).toEqual(["today", "language-exam", "library", "settings"]);
    expect(nav[1].label).toBeNull();
    expect(nav[2].label).toBeNull();
    expect(nav[1].items.map((i) => i.label)).toEqual(["Öğrenciler", "Sınavlar", "Soru bankası"]);
    expect(nav[2].items).toEqual([
      { href: "/library/positions", label: "Pozisyonlar" },
      { href: "/library/competencies", label: "Yetkinlikler" },
    ]);
    expect(buildNav("en", { ...shared, today: "Today", settings: "Settings" })[1].items[2].label).toBe("Question bank");
  });

  it("shows group headers once there is more than one solution", () => {
    const second = { ...languageExamManifest, key: "hiring", dbKind: "HIRING", basePath: "/hiring", label: { tr: "İşe alım", en: "Hiring" } } as SolutionManifest;
    const nav = buildNav("tr", shared, [second, languageExamManifest]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
  });
});

describe("candidate flow", () => {
  it("serves candidates only for a registered module whose candidate flow is live", () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const hiringNotLive = {
      ...exam,
      key: "hiring",
      dbKind: "HIRING",
      basePath: "/hiring",
      candidateFlowLive: false,
    } as SolutionModule;
    expect(exam.candidateFlowLive).toBe(true);
    expect(candidateSolution("LANGUAGE_EXAM")?.key).toBe("language-exam");
    expect(candidateSolution("HIRING", [exam])).toBeNull();
    expect(candidateSolution("HIRING", [exam, hiringNotLive])).toBeNull();
    expect(candidateSolution("HIRING", [exam, { ...hiringNotLive, candidateFlowLive: true }])?.key).toBe("hiring");
  });
});
