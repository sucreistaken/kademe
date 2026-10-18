import { describe, expect, it } from "vitest";
import { candidateT } from "@/i18n/candidate";
import { EXAM_TEMPLATES } from "@/lib/exam/templates";
import { candidateExamName } from "./candidate-exam-name";

/** What the exam creator writes for a template exam: the name, then the length (defaultExamName). */
const defaultExamName = (name: string, minutes: number, locale: "tr" | "en") => `${name}, ${minutes} ${locale === "tr" ? "dk" : "min"}`;

describe("the exam name a student reads", () => {
  const placement = EXAM_TEMPLATES.find((x) => x.key === "placement")!;

  it("a template published in Turkish reads in English for an English student", () => {
    expect(candidateExamName("Yerleştirme sınavı", "en")).toBe("Placement test");
  });

  it("a template published in English reads in Turkish for a Turkish student", () => {
    expect(candidateExamName("Placement test", "tr")).toBe("Yerleştirme sınavı");
  });

  it("the default name with minutes takes the minutes in the student's language", () => {
    expect(candidateExamName(defaultExamName(placement.name.tr, 45, "tr"), "en")).toBe("Placement test, 45 min");
    expect(candidateExamName(defaultExamName(placement.name.en, 45, "en"), "tr")).toBe("Yerleştirme sınavı, 45 dk");
  });

  it("every template name is found in both manager languages, for all five student languages", () => {
    for (const template of EXAM_TEMPLATES) {
      for (const from of ["tr", "en"] as const) {
        for (const to of ["tr", "en", "de", "es", "ar"] as const) {
          const t = candidateT(to);
          const key = { "quick-screen": "quickScreen", placement: "placement", "level-check": "levelCheck" }[template.key] as "placement";
          expect(candidateExamName(template.name[from], to)).toBe(t(`examNames.${key}`));
          expect(candidateExamName(defaultExamName(template.name[from], 30, from), to)).toBe(`${t(`examNames.${key}`)}, ${t("exam.minutes", { n: 30 })}`);
        }
      }
    }
  });

  it("the dictionary names match the templates' own names in Turkish and English", () => {
    for (const template of EXAM_TEMPLATES) {
      const key = { "quick-screen": "quickScreen", placement: "placement", "level-check": "levelCheck" }[template.key] as "placement";
      expect(candidateT("tr")(`examNames.${key}`)).toBe(template.name.tr);
      expect(candidateT("en")(`examNames.${key}`)).toBe(template.name.en);
    }
  });

  it("a name the manager typed or edited is shown as stored", () => {
    expect(candidateExamName("Yerleştirme sınavı (Ekim grubu)", "en")).toBe("Yerleştirme sınavı (Ekim grubu)");
    expect(candidateExamName("Placement test, extended", "tr")).toBe("Placement test, extended");
    expect(candidateExamName("Placement test, 45 minutes", "tr")).toBe("Placement test, 45 minutes");
    expect(candidateExamName("Ekim grubu", "ar")).toBe("Ekim grubu");
  });
});
