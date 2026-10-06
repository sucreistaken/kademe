import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, inviteTargets, manifestByKind, SOLUTION_MANIFESTS, transcriptionHintFor } from "./registry";
import { candidateSolution, servingSolution, solutionModule, solutionModules } from "./registry.server";
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

  it("serves hiring candidates since plan 2 proved the flow (Task 10)", () => {
    expect(manifestByKind("HIRING")?.candidateFlowLive).toBe(true);
    expect(candidateSolution("HIRING")?.key).toBe("hiring");
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

  it("builds the HIRING-UX 4.1 menu with group headers and an icon per item: Today, Hiring, Exam, Library, Settings (P1)", () => {
    const nav = buildNav("tr", shared);
    expect(nav.map((g) => g.key)).toEqual(["today", "hiring", "language-exam", "library", "settings"]);
    expect(nav.map((g) => g.label)).toEqual([null, "İşe alım", "Sınav", "Kütüphane", null]);
    expect(nav[1].items).toEqual([{ href: "/hiring/openings", label: "Alımlar", icon: "briefcase" }]);
    expect(nav.flatMap((g) => g.items.map((i) => i.icon))).toEqual(["sun", "briefcase", "users", "file-text", "library", "id-card", "target", "settings"]);
    // The live exam's three items keep their links, words and order; only the icon is new.
    expect(nav[2].items.map(({ href, label }) => [href, label])).toEqual([
      ["/exam/students", "Öğrenciler"],
      ["/exam/exams", "Sınavlar"],
      ["/exam/bank", "Soru bankası"],
    ]);
    expect(buildNav("en", shared)[1].items[0].label).toBe("Openings");
  });

  it("links Today to hiring's control view only, under its own base path (H1)", () => {
    expect(SOLUTION_MANIFESTS.map((m) => m.overview?.href ?? null)).toEqual(["/hiring/openings", null]);
    for (const m of SOLUTION_MANIFESTS) if (m.overview) expect(m.overview.href.startsWith(`${m.basePath}/`)).toBe(true);
  });

  it("drops group headers when only one solution is registered", () => {
    const nav = buildNav("tr", shared, [languageExamManifest]);
    expect(nav.map((g) => g.label)).toEqual([null, null, null, null]);
  });

  it("lists every solution that can invite, in menu order, with its label and capability", () => {
    expect(inviteTargets()).toEqual([
      { key: "hiring", href: "/hiring/invite", label: { tr: "Aday davet et", en: "Invite a candidate" }, capability: "opening:write" },
      { key: "language-exam", href: "/exam/students/new", label: { tr: "Öğrenci davet et", en: "Invite a student" }, capability: "student:invite" },
    ]);
    const noInvite = { ...languageExamManifest, inviteHref: null } as SolutionManifest;
    expect(inviteTargets([noInvite])).toEqual([]);
  });

  it("offers hiring's action on a position page", () => {
    expect(manifestByKind("HIRING")?.positionAction?.href("p1")).toBe("/hiring/openings/new?position=p1");
  });
});

describe("contract additions (plan 2)", () => {
  it("transcribes exam recordings as German and lets the provider detect hiring answers", () => {
    expect(transcriptionHintFor("LANGUAGE_EXAM")).toBe("de");
    expect(transcriptionHintFor("HIRING")).toBeNull();
    expect(transcriptionHintFor(null)).toBeNull();
  });

  it("offers accommodation requests where the solution reads them", () => {
    expect(manifestByKind("HIRING")?.accommodationRequests).toBe(true);
    expect(manifestByKind("LANGUAGE_EXAM")?.accommodationRequests).toBe(false);
  });

  it("serves an invitation only through a live module that serves it", async () => {
    const exam = solutionModule("LANGUAGE_EXAM")!;
    const ctxOf = (solution: "HIRING" | "LANGUAGE_EXAM") => ({ assessment: { id: "a", orgId: "o", solution } }) as Parameters<typeof servingSolution>[0];
    const hiring = (serves: boolean) =>
      ({ ...exam, key: "hiring", dbKind: "HIRING", candidateFlowLive: true, candidate: { ...exam.candidate, serves: async () => serves } }) as SolutionModule;
    expect((await servingSolution(ctxOf("LANGUAGE_EXAM"), [exam]))?.key).toBe("language-exam");
    expect(await servingSolution(ctxOf("HIRING"), [exam, hiring(false)])).toBeNull();
    expect((await servingSolution(ctxOf("HIRING"), [exam, hiring(true)]))?.key).toBe("hiring");
    expect(await servingSolution(ctxOf("HIRING"), [exam, { ...hiring(true), candidateFlowLive: false }])).toBeNull();
  });
});
