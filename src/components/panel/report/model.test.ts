import { describe, expect, it } from "vitest";
import { buildReport, reportAllowed, verificationCode, type ReportSource } from "./model";
import tr from "@/i18n/messages/screens.tr.json";
import en from "@/i18n/messages/screens.en.json";

const base: ReportSource = {
  status: "FINAL",
  schoolName: "Test Dil Okulu",
  studentName: "Ayşe Yılmaz",
  examName: "Seviye tespit",
  examDate: new Date("2026-10-01T09:00:00Z"),
  sections: ["GRAMMAR", "READING", "WRITING"],
  finalOverall: "B1",
  skillLevels: { GRAMMAR: "B1", READING: "B2", WRITING: undefined },
  mode: "PLACEMENT",
  placement: { sublevel: "B1.2", borderline: false, recommended: null },
  teacherName: "Hoca",
  finalizedAt: new Date("2026-10-02T09:00:00Z"),
  attemptId: "7f0c2c1e-1111-4222-8333-444455556666",
};

describe("reportAllowed", () => {
  it("is only true for a FINAL result", () => {
    expect(reportAllowed("FINAL")).toBe(true);
    for (const s of ["IN_PROGRESS", "AWAITING_GRADING", "READY", undefined, null]) expect(reportAllowed(s)).toBe(false);
  });
});

describe("verificationCode", () => {
  it("is 8 uppercase hex characters and deterministic", () => {
    const a = verificationCode("attempt-1", "secret");
    expect(a).toMatch(/^[0-9A-F]{8}$/);
    expect(verificationCode("attempt-1", "secret")).toBe(a);
  });
  it("changes with the attempt and with the secret", () => {
    expect(verificationCode("attempt-2", "secret")).not.toBe(verificationCode("attempt-1", "secret"));
    expect(verificationCode("attempt-1", "other")).not.toBe(verificationCode("attempt-1", "secret"));
  });
});

describe("buildReport", () => {
  it("refuses a result that is not final", () => {
    expect(buildReport({ ...base, status: "READY" }, "s")).toEqual({ ok: false, reason: "NOT_FINAL" });
  });
  it("refuses a final result with no overall level", () => {
    expect(buildReport({ ...base, finalOverall: null }, "s").ok).toBe(false);
  });
  it("assembles overall, skills in exam order, class and code", () => {
    const r = buildReport(base, "s");
    if (!r.ok) throw new Error("expected ok");
    expect(r.model.overall).toBe("B1");
    expect(r.model.skills).toEqual([
      { section: "GRAMMAR", level: "B1" },
      { section: "READING", level: "B2" },
      { section: "WRITING", level: null },
    ]);
    expect(r.model.recommendedClass).toEqual({ level: "B1", sublevel: "B1.2" });
    expect(r.model.verificationCode).toBe(verificationCode(base.attemptId, "s"));
    expect(r.model.teacherName).toBe("Hoca");
  });
  it("recommends the lower class while borderline", () => {
    const r = buildReport({ ...base, placement: { sublevel: "B2.1", borderline: true, recommended: "B1" }, finalOverall: "B2" }, "s");
    if (!r.ok) throw new Error("expected ok");
    expect(r.model.recommendedClass).toEqual({ level: "B1", sublevel: "B2.1" });
  });
  it("has no recommended class outside placement or without a stored placement", () => {
    for (const patch of [{ mode: "LEVEL_VERIFICATION" }, { placement: null }]) {
      const r = buildReport({ ...base, ...patch }, "s");
      if (!r.ok) throw new Error("expected ok");
      expect(r.model.recommendedClass).toBeNull();
    }
  });
  it("carries nothing but display fields", () => {
    const r = buildReport(base, "s");
    if (!r.ok) throw new Error("expected ok");
    expect(Object.keys(r.model).sort()).toEqual(
      ["schoolName", "studentName", "examName", "examDate", "overall", "skills", "recommendedClass", "teacherName", "finalizedAt", "verificationCode"].sort(),
    );
  });
});

describe("resultReport copy", () => {
  it("has the same keys in both languages and a sentence for every level", () => {
    expect(Object.keys(en.resultReport).sort()).toEqual(Object.keys(tr.resultReport).sort());
    for (const l of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(tr.resultReport.level[l as "A1"].length).toBeGreaterThan(20);
      expect(en.resultReport.level[l as "A1"].length).toBeGreaterThan(20);
    }
  });
});
