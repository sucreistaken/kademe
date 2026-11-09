import { describe, expect, it, vi } from "vitest";
import { examTemplateByKey, webCheckTemplate } from "@/lib/exam/templates";
import type { BlueprintConfig } from "@/lib/exam/blueprint";
import { courseBlueprint } from "@/lib/exam/course/config";

/** loadState's phone flag (the web check, 2026-11-09). Before consent nothing else is read, so no database is needed. */
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: () => () => { throw new Error("database reached"); } }),
}));
vi.mock("@/lib/candidate-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/candidate-context")>()),
  hasConsented: async () => false,
}));

import { loadState, type ExamCandidateContext } from "./exam-flow";

const ctxOf = (config: BlueprintConfig, mode: "PLACEMENT" | "LEVEL_VERIFICATION" | "COURSE_TEST" = "PLACEMENT"): ExamCandidateContext =>
  ({
    link: { id: "l1", status: "NOT_STARTED", expiresAt: new Date("2026-11-12T10:00:00Z"), notBefore: null, firstSeenIp: null },
    assessment: { id: "a1", orgId: "o1", solution: "LANGUAGE_EXAM", blueprintId: "bp1", examName: "Online level test", mode, claimedLevel: mode === "LEVEL_VERIFICATION" ? "B1" : null, config },
    candidate: { id: "c1", fullName: "Ada Lovelace", email: "ada@example.com", phone: null, location: null },
    orgName: "Campus German",
    locale: "en",
  }) as unknown as ExamCandidateContext;

describe("loadState: allowMobile", () => {
  it("is true for the web check", async () => {
    const state = await loadState(ctxOf(webCheckTemplate().config));
    expect(state.step).toBe("CONSENT");
    expect(state.allowMobile).toBe(true);
  });

  it("is false for the ready templates and a course test", async () => {
    for (const key of ["quick-screen", "placement", "level-check"]) {
      const t = examTemplateByKey(key)!;
      expect((await loadState(ctxOf(t.config, t.mode))).allowMobile, key).toBe(false);
    }
    expect((await loadState(ctxOf(courseBlueprint("B1"), "COURSE_TEST"))).allowMobile).toBe(false);
  });

  it("is false when a stored config asks for phones but watches or has writing", async () => {
    const quick = examTemplateByKey("quick-screen")!.config;
    expect((await loadState(ctxOf({ ...quick, allowMobile: true }))).allowMobile).toBe(false);
    const web = webCheckTemplate().config;
    const withWriting = { ...web, sections: web.sections.map((s) => (s.section === "WRITING" ? { ...s, enabled: true } : s)) };
    expect((await loadState(ctxOf(withWriting))).allowMobile).toBe(false);
  });
});
