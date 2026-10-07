import { describe, expect, it } from "vitest";
import { TEMPLATES, matchTemplate } from "@/solutions/hiring/templates/index";
import {
  afterCreate,
  answersOf,
  jobDescriptionOf,
  matchPosition,
  newOpeningStepOf,
  newOpeningStepOfRefusal,
  newOpeningSteps,
  ROLE_MAX_ROUNDS,
  roundsToFinish,
  suggestedPositions,
  templateForPosition,
  wizardJourney,
} from "./new-opening-steps";

describe("the hiring wizard's path (HIRING-UX 5.20)", () => {
  it("counts three steps everywhere: Rolü anlat, Sorular, Önizle ve yayınla", () => {
    expect(wizardJourney("role")).toEqual({ steps: 3, current: 1 });
    expect(wizardJourney("questions")).toEqual({ steps: 3, current: 2 });
    expect(wizardJourney("publish")).toEqual({ steps: 3, current: 3 });
  });

  it("counts the template gallery and the copy picker as step 1, so the bar never jumps", () => {
    expect(wizardJourney("template")).toEqual({ steps: 3, current: 1 });
    expect(wizardJourney("copy")).toEqual({ steps: 3, current: 1 });
  });

  it("offers the copy screen only when there is an opening to copy", () => {
    expect(newOpeningSteps({ hasCopySources: true })).toEqual(["role", "template", "copy"]);
    expect(newOpeningSteps({ hasCopySources: false })).toEqual(["role", "template"]);
  });

  it("follows the hash; an unknown or unoffered screen opens the role screen", () => {
    const steps = newOpeningSteps({ hasCopySources: false });
    expect(newOpeningStepOf("", steps)).toBe("role");
    expect(newOpeningStepOf("#template", steps)).toBe("template");
    expect(newOpeningStepOf("#copy", steps)).toBe("role");
    expect(newOpeningStepOf("#start", steps)).toBe("role");
  });

  it("opens the screen a refusal is about (W8)", () => {
    expect(newOpeningStepOfRefusal("POSITION_NAME_REQUIRED")).toBe("role");
    expect(newOpeningStepOfRefusal("JOB_AD_REQUIRED")).toBe("role");
    expect(newOpeningStepOfRefusal("TEMPLATE_NOT_FOUND")).toBe("template");
    expect(newOpeningStepOfRefusal("COPY_SOURCE_NOT_FOUND")).toBe("copy");
    expect(newOpeningStepOfRefusal("FAILED")).toBe("role");
  });

  it("asks step 2 to write the questions only after the AI start", () => {
    expect(afterCreate("/hiring/openings/o1/setup#questions", "AI")).toBe("/hiring/openings/o1/setup?draft=ai#questions");
    expect(afterCreate("/hiring/openings/o1/setup?x=1#questions", "AI")).toBe("/hiring/openings/o1/setup?x=1&draft=ai#questions");
    for (const start of ["BLANK", "TEMPLATE", "COPY"] as const) expect(afterCreate("/hiring/openings/o1/setup#questions", start)).toBe("/hiring/openings/o1/setup#questions");
  });
});

describe("the role conversation (step 1)", () => {
  const questions = [
    { key: "ehliyet", text: "Hangi ehliyet?", options: ["B", "C"], allowFree: true },
    { key: "deneyim", text: "Kaç yıl deneyim?", options: [], allowFree: true },
    { key: "gun", text: "Hangi günler?", options: ["Hafta içi"], allowFree: true },
  ];

  it("answers with the chip, or the own words when both are given; empty answers are left out", () => {
    expect(answersOf(questions, { ehliyet: "B", gun: "Hafta içi" }, { gun: "  Cumartesi dahil ", deneyim: "  " })).toEqual({ ehliyet: "B", gun: "Cumartesi dahil" });
    expect(answersOf(questions, {}, {})).toEqual({});
  });

  it("'Bu kadar yeter' fills the rounds up to the server's cap, so the next answer is the brief; nothing answered is lost", () => {
    const answered = { questions, answers: { ehliyet: "B" } };
    const out = roundsToFinish([answered]);
    expect(out).toHaveLength(ROLE_MAX_ROUNDS);
    expect(out[0]).toBe(answered);
    expect(out.slice(1).every((r) => r.questions.length === 0 && Object.keys(r.answers).length === 0)).toBe(true);
    expect(roundsToFinish(Array.from({ length: ROLE_MAX_ROUNDS }, () => answered))).toHaveLength(ROLE_MAX_ROUNDS);
  });

  it("keeps the AI's ad as it is, and adds the corrected bullets under it once the summary was changed", () => {
    const brief = { summary: ["B sınıfı ehliyet", "Hafta içi"], jobAd: "İlan metni." };
    expect(jobDescriptionOf(brief, brief.summary, 4000)).toBe("İlan metni.");
    expect(jobDescriptionOf(brief, ["B sınıfı ehliyet", "Hafta sonu dahil"], 4000)).toBe("İlan metni.\n\n- B sınıfı ehliyet\n- Hafta sonu dahil");
    expect(jobDescriptionOf(brief, ["B sınıfı ehliyet", "Hafta sonu dahil"], 5)).toHaveLength(5);
  });
});

describe("the position name and the library", () => {
  const list = [
    { id: "1", name: "Destek Uzmanı" },
    { id: "2", name: "Satış Uzmanı" },
    { id: "3", name: "İnsan Kaynakları" },
  ];

  it("a typed name that is a library position's name is that position, whatever its case and spaces (the old picker's rule)", () => {
    expect(matchPosition(list, "  destek uzmanı ")?.id).toBe("1");
    expect(matchPosition(list, "İNSAN KAYNAKLARI")?.id).toBe("3");
    expect(matchPosition(list, "Destek")).toBeNull();
    expect(matchPosition(list, "   ")).toBeNull();
  });

  it("suggests the library positions containing the typed text, not the one already typed in full", () => {
    expect(suggestedPositions(list, "").map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(suggestedPositions(list, "uzman").map((p) => p.id)).toEqual(["1", "2"]);
    expect(suggestedPositions(list, "destek uzmanı").map((p) => p.id)).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `Rol ${i}` }));
    expect(suggestedPositions(many, "")).toHaveLength(6);
  });

  it("finds the template for a position name by matchTemplate's rule (TR or EN name, any case, outer spaces ignored)", () => {
    const options = TEMPLATES.map((x) => ({ key: x.key, names: [x.name.tr, x.name.en] }));
    for (const x of TEMPLATES) {
      for (const name of [x.name.tr, x.name.en, `  ${x.name.tr.toLocaleUpperCase("tr")} `]) {
        expect(templateForPosition(options, name)?.key).toBe(matchTemplate(name)?.key);
        expect(templateForPosition(options, name)?.key).toBe(x.key);
      }
    }
    expect(templateForPosition(options, "Destek")).toBeNull();
    expect(templateForPosition(options, "   ")).toBeNull();
  });
});
