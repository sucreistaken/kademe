import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, manifestByKind, SOLUTION_MANIFESTS } from "./registry";
import { solutionModule, solutionModules } from "./registry.server";

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

  it("builds the HIRING-UX 4.1 menu: Today, solutions, Settings, no group header for a single solution", () => {
    const nav = buildNav("tr", { today: "Bugün", settings: "Ayarlar" });
    expect(nav.map((g) => g.key)).toEqual(["today", "language-exam", "settings"]);
    expect(nav[1].label).toBeNull();
    expect(nav[1].items.map((i) => i.label)).toEqual(["Öğrenciler", "Sınavlar", "Soru bankası"]);
    expect(buildNav("en", { today: "Today", settings: "Settings" })[1].items[2].label).toBe("Question bank");
  });
});
