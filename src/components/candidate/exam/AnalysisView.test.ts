import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidateT } from "@/i18n/candidate";
import type { StudentResult } from "@/lib/exam-flow";
import { AnalysisView } from "./AnalysisView";

const base: StudentResult = {
  visibility: "FULL",
  released: true,
  awaitingTeacher: false,
  levelShown: true,
  overall: "B1",
  skills: [{ section: "GRAMMAR", level: "B1" }],
  analysis: {
    sections: [
      { section: "GRAMMAR", right: 30, wrong: 4, blank: 2 },
      { section: "WRITING", right: 0, wrong: 0, blank: 0, teacherAssessed: true },
    ],
    missedTopics: [{ topic: "dativ", label: "Dativ", missed: 3, asked: 5 }],
    strongTopics: Array.from({ length: 8 }, (_, i) => ({ topic: `t${i}`, label: `Strong${i}`, asked: 2 })),
  },
  feedback: { strengths: ["Good reading"], improve: [{ topic: "Dativ", why: "Practise cases." }], nextStep: "Do daily drills." },
};

function html(result: StudentResult, locale: "en" | "de" = "en") {
  const t = candidateT(locale);
  return renderToStaticMarkup(
    createElement(AnalysisView, {
      result,
      t: (k: string, v?: Record<string, string | number>) => t(`analysis.${k}` as never, v as never),
      sectionName: (s: string) => t(`section.${s}` as never),
    } as never),
  );
}

describe("AnalysisView", () => {
  it("shows counts, missed topics, at most six strong topics and the approved note", () => {
    const out = html(base);
    expect(out).toContain("30 right");
    expect(out).toContain("4 wrong");
    expect(out).toContain("2 blank");
    expect(out).toContain("Assessed by your teacher");
    expect(out).toContain("missed 3 of 5");
    expect(out).toContain("Strong5");
    expect(out).not.toContain("Strong6");
    expect(out).toContain("Do daily drills.");
    expect(out).not.toContain("%");
    expect(out).not.toMatch(/(text|bg)-(error|red|success)/);
  });

  it("shows the level only when the teacher allowed it", () => {
    expect(html(base)).toContain("Your level");
    const hidden = html({ ...base, levelShown: false });
    expect(hidden).not.toContain("Your level");
    expect(hidden).not.toContain("B1");
  });

  it("renders in the student's language", () => {
    expect(html(base, "de")).toContain("30 richtig");
  });
});
