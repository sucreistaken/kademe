import { describe, expect, it } from "vitest";
import { agreeWaitReason, bringList, CONSENT_HASH, landingStepOf, welcomePath } from "./landing-model";

describe("the landing as two steps (K3, 3.1, 3.2)", () => {
  it("reads the step from the address's hash, so the browser's back button returns to Welcome", () => {
    expect(CONSENT_HASH).toBe("#consent");
    expect(landingStepOf("#consent")).toBe("consent");
    expect(landingStepOf("")).toBe("welcome");
    expect(landingStepOf("#other")).toBe("welcome");
  });

  it("lists only the parts this assessment has, and always the team at the end", () => {
    expect(welcomePath({ device: true, warmup: true })).toEqual(["device", "warmup", "questions", "team"]);
    expect(welcomePath({ device: true, warmup: false })).toEqual(["device", "questions", "team"]);
    expect(welcomePath({ device: false, warmup: false })).toEqual(["questions", "team"]);
  });

  it("asks for a camera only when a video question exists, a microphone for sound only, and always a computer (K2)", () => {
    expect(bringList({ camera: true, microphone: true })).toEqual(["quiet", "cameraMic", "computer"]);
    expect(bringList({ camera: false, microphone: true })).toEqual(["quiet", "mic", "computer"]);
    expect(bringList({ camera: false, microphone: false })).toEqual(["quiet", "computer"]);
  });

  it("holds 'Kabul et ve başla' until the box is ticked, and says why", () => {
    expect(agreeWaitReason(false)).toBe("tickFirst");
    expect(agreeWaitReason(true)).toBeNull();
  });
});
