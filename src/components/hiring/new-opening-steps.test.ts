import { describe, expect, it } from "vitest";
import { TEMPLATES, matchTemplate } from "@/solutions/hiring/templates/index";
import { createWait, matchPosition, startAfterAdChange, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps, newOpeningSummary, templateForPosition, visiblePositions } from "./new-opening-steps";

describe("Alım aç as three steps (4.6, plan decision 13)", () => {
  it("asks for the job ad only for a new position name (a library position's ad lives on the position)", () => {
    expect(newOpeningSteps({ newName: true })).toEqual(["position", "ad", "start"]);
    expect(newOpeningSteps({ newName: false })).toEqual(["position", "start"]);
  });

  it("follows the address's hash so the browser's back button steps back, and never skips the position", () => {
    const steps = newOpeningSteps({ newName: true });
    expect(newOpeningStepOf("", { steps, positionReady: true })).toBe("position");
    expect(newOpeningStepOf("#ad", { steps, positionReady: true })).toBe("ad");
    expect(newOpeningStepOf("#start", { steps, positionReady: true })).toBe("start");
    expect(newOpeningStepOf("#start", { steps, positionReady: false })).toBe("position");
    expect(newOpeningStepOf("#ad", { steps: newOpeningSteps({ newName: false }), positionReady: true })).toBe("position");
  });

  it("waits for a position, then for a start, then for a source when copying", () => {
    expect(createWait({ positionReady: false, start: "BLANK", copyFrom: "" })).toBe("needPosition");
    expect(createWait({ positionReady: false, start: null, copyFrom: "" })).toBe("needPosition");
    expect(createWait({ positionReady: true, start: null, copyFrom: "" })).toBe("needStart");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "" })).toBe("needCopySource");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "o1" })).toBeNull();
    expect(createWait({ positionReady: true, start: "AI", copyFrom: "" })).toBeNull();
  });

  it("clears the job-ad start when the ad goes away, so it never comes back on its own; other starts stay", () => {
    expect(startAfterAdChange("AI", false)).toBeNull();
    expect(startAfterAdChange("AI", true)).toBe("AI");
    expect(startAfterAdChange("COPY", false)).toBe("COPY");
    expect(startAfterAdChange("BLANK", false)).toBe("BLANK");
    expect(startAfterAdChange(null, false)).toBeNull();
    expect(startAfterAdChange(null, true)).toBeNull();
    // The ad goes away, then comes back: the cleared choice stays cleared.
    expect(startAfterAdChange(startAfterAdChange("AI", false), true)).toBeNull();
  });

  it("opens the step a refusal is about (W8): the position for a missing or gone position, the start for everything else", () => {
    expect(newOpeningStepOfRefusal("POSITION_NAME_REQUIRED")).toBe("position");
    expect(newOpeningStepOfRefusal("POSITION_NOT_FOUND")).toBe("position");
    expect(newOpeningStepOfRefusal("JOB_AD_REQUIRED")).toBe("start");
    expect(newOpeningStepOfRefusal("COPY_SOURCE_NOT_FOUND")).toBe("start");
    expect(newOpeningStepOfRefusal("INVALID")).toBe("start");
    expect(newOpeningStepOfRefusal("FAILED")).toBe("start");
  });

  it("says every decision in one line on the last step, and names a copy only once its source is chosen (H3)", () => {
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "AI", copyName: null })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryAd" }, { key: "summaryAi" }]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: false, start: "BLANK", copyName: null })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryNoAd" }, { key: "summaryBlank" }]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "COPY", copyName: "Destek 2025" })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryAd" }, { key: "summaryCopy", name: "Destek 2025" }]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "COPY", copyName: null })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryAd" }]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: null, copyName: null })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryAd" }]);
  });
});

describe("the ready-template start (manager mockup 4, 4b)", () => {
  it("adds the template step after the start only when the ready template is the start", () => {
    expect(newOpeningSteps({ newName: true, template: true })).toEqual(["position", "ad", "start", "template"]);
    expect(newOpeningSteps({ newName: false, template: true })).toEqual(["position", "start", "template"]);
    expect(newOpeningSteps({ newName: false, template: false })).toEqual(["position", "start"]);
    expect(newOpeningStepOf("#template", { steps: newOpeningSteps({ newName: false, template: true }), positionReady: true })).toBe("template");
    expect(newOpeningStepOf("#template", { steps: newOpeningSteps({ newName: false, template: false }), positionReady: true })).toBe("position");
  });

  it("waits for a template once the ready template is the start", () => {
    expect(createWait({ positionReady: true, start: "TEMPLATE", copyFrom: "", templateKey: null })).toBe("needTemplate");
    expect(createWait({ positionReady: true, start: "TEMPLATE", copyFrom: "", templateKey: "customer-support" })).toBeNull();
    expect(createWait({ positionReady: false, start: "TEMPLATE", copyFrom: "", templateKey: "customer-support" })).toBe("needPosition");
    expect(createWait({ positionReady: true, start: "BLANK", copyFrom: "", templateKey: null })).toBeNull();
  });

  it("keeps the ready template when the ad goes away", () => {
    expect(startAfterAdChange("TEMPLATE", false)).toBe("TEMPLATE");
  });

  it("opens the template step for a template that is gone", () => {
    expect(newOpeningStepOfRefusal("TEMPLATE_NOT_FOUND")).toBe("template");
  });

  it("names the chosen template in the summary, and nothing of it before one is chosen", () => {
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "TEMPLATE", copyName: null, templateName: "Müşteri Destek Uzmanı" })).toEqual([
      { text: "Destek Uzmanı" },
      { key: "summaryAd" },
      { key: "summaryTemplate", name: "Müşteri Destek Uzmanı" },
    ]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "TEMPLATE", copyName: null, templateName: null })).toEqual([{ text: "Destek Uzmanı" }, { key: "summaryAd" }]);
    expect(newOpeningSummary({ name: "Destek Uzmanı", hasAd: true, start: "BLANK", copyName: null, templateName: "Müşteri Destek Uzmanı" })).toEqual([
      { text: "Destek Uzmanı" },
      { key: "summaryAd" },
      { key: "summaryBlank" },
    ]);
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

describe("the position cards (manager mockup 3)", () => {
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

  it("filters the cards by the search and keeps the chosen card in view", () => {
    expect(visiblePositions(list, "", null).map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(visiblePositions(list, "uzman", null).map((p) => p.id)).toEqual(["1", "2"]);
    expect(visiblePositions(list, "satış", "1").map((p) => p.id)).toEqual(["1", "2"]);
  });
});
