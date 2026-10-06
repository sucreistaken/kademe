import { describe, expect, it } from "vitest";
import { createWait, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps, newOpeningSummary } from "./new-opening-steps";

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

  it("waits for a position, then for a source when copying, with the existing reasons", () => {
    expect(createWait({ positionReady: false, start: "BLANK", copyFrom: "" })).toBe("needPosition");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "" })).toBe("needCopySource");
    expect(createWait({ positionReady: true, start: "COPY", copyFrom: "o1" })).toBeNull();
    expect(createWait({ positionReady: true, start: "AI", copyFrom: "" })).toBeNull();
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
  });
});
