import { describe, expect, it } from "vitest";
import { lostWords, markLostWords, type DraftStorage } from "./draft-store";
import { devicesLine, surveyAfterFailure, takeLastLostWords } from "./done-model";

function memory(): DraftStorage & { keys: () => string[] } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

const broken: DraftStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("the finish page's model", () => {
  it("names the devices the assessment used, and nothing for a written one (Task 12 carry)", () => {
    expect(devicesLine({ camera: true, microphone: true })).toBe("cameraAndMicrophone");
    expect(devicesLine({ camera: false, microphone: true })).toBe("microphone");
    // A written assessment never opened a device: saying "switched off" would be noise.
    expect(devicesLine({ camera: false, microphone: false })).toBeNull();
  });

  it("reads the last stage's lost-words flag once, and clears every stage's flag (Task 13 carry)", () => {
    const s = memory();
    markLostWords(s, "tok", 1, "choice");
    markLostWords(s, "tok", 2, "text");
    markLostWords(s, "other", 2, "text");
    expect(takeLastLostWords(s, "tok", [1, 2])).toBe("text");
    // Shown once: the flags of this link are gone, another link's flag stays.
    expect(lostWords(s, "tok", 1)).toBeNull();
    expect(lostWords(s, "tok", 2)).toBeNull();
    expect(lostWords(s, "other", 2)).toBe("text");
    expect(takeLastLostWords(s, "tok", [1, 2])).toBeNull();
  });

  it("says nothing when only an earlier stage lost words (its intro said so already)", () => {
    const s = memory();
    markLostWords(s, "tok", 1, "text");
    expect(takeLastLostWords(s, "tok", [1, 2])).toBeNull();
    expect(s.keys()).toHaveLength(0);
  });

  it("survives a storage the browser refuses", () => {
    expect(takeLastLostWords(broken, "tok", [1, 2])).toBeNull();
    expect(takeLastLostWords(null, "tok", [1])).toBeNull();
    // A version without stages has no last stage.
    expect(takeLastLostWords(memory(), "tok", [])).toBeNull();
  });

  it("counts a survey the server already holds as sent, and anything else as a failure to retry", () => {
    const refusal = (code: string, status: number) => Object.assign(new Error("x"), { code, status });
    expect(surveyAfterFailure(refusal("ALREADY_ANSWERED", 409))).toBe("sent");
    expect(surveyAfterFailure(refusal("SURVEY_INVALID", 400))).toBe("failed");
    expect(surveyAfterFailure(new TypeError("Failed to fetch"))).toBe("failed");
    expect(surveyAfterFailure(null)).toBe("failed");
  });

  it("treats a survey that is off, or a finish the server does not see, as closed: no form, no retry (M2)", () => {
    const refusal = (code: string, status: number) => Object.assign(new Error("x"), { code, status });
    expect(surveyAfterFailure(refusal("SURVEY_OFF", 409))).toBe("closed");
    expect(surveyAfterFailure(refusal("NOT_FINISHED", 409))).toBe("closed");
    // Positive control: a refusal worth retrying stays a failure.
    expect(surveyAfterFailure(refusal("RATE_LIMITED", 429))).toBe("failed");
  });
});
