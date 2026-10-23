import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroupReport } from "@/components/panel/students/group-report-panel";
import { Level } from "@/components/panel/bits";
import { buildReport } from "@/components/panel/report/model";
import { ReportSheet } from "@/components/panel/report/report-sheet";
import { managerT } from "@/i18n/manager";
import candidateAr from "@/i18n/messages/candidate.ar.json";
import candidateDe from "@/i18n/messages/candidate.de.json";
import candidateEn from "@/i18n/messages/candidate.en.json";
import candidateEs from "@/i18n/messages/candidate.es.json";
import candidateTr from "@/i18n/messages/candidate.tr.json";
import screensDe from "@/i18n/messages/screens.de.json";
import screensEn from "@/i18n/messages/screens.en.json";
import screensTr from "@/i18n/messages/screens.tr.json";
import { isPreA1, levelLabel } from "./level-label";

const EM_DASH = "\u2014";

describe("levelLabel", () => {
  it("writes A0 with its CEFR name and leaves every other level alone", () => {
    expect(levelLabel("A0", "A0 (Pre-A1)")).toBe("A0 (Pre-A1)");
    expect(levelLabel("B1", "A0 (Pre-A1)")).toBe("B1");
    expect(levelLabel(null, "A0 (Pre-A1)")).toBe(null);
    expect(levelLabel(undefined, "A0 (Pre-A1)")).toBe(null);
    expect(isPreA1("A0")).toBe(true);
    expect(isPreA1("A1")).toBe(false);
  });
});

describe("A0 (Pre-A1) copy", () => {
  const panels = { tr: screensTr, en: screensEn, de: screensDe };
  const candidates = { tr: candidateTr, en: candidateEn, de: candidateDe, es: candidateEs, ar: candidateAr };

  it.each(Object.entries(panels))("panel %s names A0, describes it and explains the raised AI proposal", (_locale, m) => {
    expect(m.resultLevel.A0).toBe("A0 (Pre-A1)");
    expect(m.resultLevel.A0Name).toBe("Pre-A1");
    for (const text of [m.resultLevel.A0Note, m.resultLevel.A0Class, m.resultLevel.A0Pick]) expect(text.startsWith("A0 (Pre-A1)")).toBe(true);
    expect(m.resultLevel.A0Class).toContain("A1.1");
    expect(m.resultReport.level.A0.length).toBeGreaterThan(20);
    expect(m.result.flagA0_RAISED).toContain("A1");
    expect(JSON.stringify([m.resultLevel, m.resultReport.level.A0, m.result.flagA0_RAISED])).not.toContain(EM_DASH);
  });

  it.each(Object.entries(candidates))("candidate %s names A0 and explains it", (_locale, m) => {
    expect(m.analysis.levelA0).toBe("A0 (Pre-A1)");
    expect(m.analysis.levelA0Note).toContain("A0 (Pre-A1)");
    expect(m.analysis.levelA0Note).toContain("A1");
    expect(m.analysis.levelA0Note).not.toContain(EM_DASH);
  });
});

describe("A0 on the panel", () => {
  const t = managerT("tr");

  it("the level chip writes A0 (Pre-A1) when given the name", () => {
    expect(renderToStaticMarkup(createElement(Level, { level: "A0", preA1: t("resultLevel.A0") }))).toContain("A0 (Pre-A1)");
    expect(renderToStaticMarkup(createElement(Level, { level: "B1", preA1: t("resultLevel.A0") }))).toContain(">B1<");
  });

  it("the group report has an A0 bar first, named in its label", () => {
    const html = renderToStaticMarkup(
      createElement(GroupReport, {
        rows: [
          { status: "FINAL", level: "A0" },
          { status: "FINAL", level: "B1" },
        ],
        labels: {
          title: "t",
          sub: "s",
          invited: "i",
          started: "st",
          finished: "f",
          notStarted: "n",
          serious: "se",
          levels: "l",
          levelsNone: "none",
          levelCount: (level, n) => t("studentsExport.levelCount", { level: levelLabel(level, t("resultLevel.A0")), n }),
        },
      }),
    );
    const bars = [...html.matchAll(/<li[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(bars).toHaveLength(7);
    expect(bars[0]).toBe("A0 (Pre-A1) seviyesinde 1 öğrenci");
    expect(bars[1]).toBe("A1 seviyesinde 0 öğrenci");
  });

  it("the printed report shows A0, its name, its description and the first course", () => {
    const built = buildReport(
      {
        status: "FINAL",
        schoolName: "Okul",
        studentName: "Öğrenci",
        examName: "Seviye tespit",
        examDate: null,
        sections: ["GRAMMAR", "WRITING"],
        finalOverall: "A0",
        skillLevels: { GRAMMAR: "A0", WRITING: "A1" },
        mode: "PLACEMENT",
        placement: { sublevel: "A1.1", borderline: false, recommended: null },
        teacherName: null,
        finalizedAt: null,
        attemptId: "7f0c2c1e-1111-4222-8333-444455556666",
      },
      "secret",
    );
    if (!built.ok) throw new Error("expected a report");
    const html = renderToStaticMarkup(createElement(ReportSheet, { model: built.model, t, locale: "tr" }));
    expect(html).toContain(">A0<");
    expect(html).toContain(">Pre-A1<");
    expect(html).toContain(screensTr.resultReport.level.A0);
    expect(html).toContain(screensTr.resultLevel.A0Class.replace(/'/g, "&#x27;"));
    expect(html).toContain(screensTr.resultLevel.A0Note.replace(/'/g, "&#x27;"));
    expect(html).toContain("A1<span");
    expect(html).toContain("(A1.1)");
  });
});
