import { describe, expect, it } from "vitest";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { agreeWaitReason, bringList, CONSENT_HASH, consentNote, continueWaitReason, landingStateOf, landingStepOf, welcomePath } from "./landing-model";

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

  it("holds 'Devam et' while an extra-time choice is still saving, and says why (review fix 1)", () => {
    expect(continueWaitReason("saving")).toBe("extraSavingWait");
    expect(continueWaitReason("idle")).toBeNull();
    expect(continueWaitReason("saved")).toBeNull();
  });

  it("holds 'Kabul et ve başla' too while the extra time saves, the saving reason first (review fix 1)", () => {
    expect(agreeWaitReason(false, true)).toBe("extraSavingWait");
    expect(agreeWaitReason(true, true)).toBe("extraSavingWait");
    expect(agreeWaitReason(true, false)).toBeNull();
  });

  it("tells the candidate on Consent that a failed extra-time choice was not saved, so nobody starts believing it was (review fix 1)", () => {
    expect(consentNote(true)).toBe("extraNotSaved");
    expect(consentNote(false)).toBeNull();
  });
});

describe("the landing's projection (final wave A-M2)", () => {
  it("keeps the counts and the candidate's own facts, and drops the stages' names and the running stage", () => {
    const state = {
      step: "CONSENT",
      orgName: "Örnek A.Ş.",
      positionName: "Ürün Tasarımcısı",
      candidateName: "Elif",
      intro: { title: { tr: "Başlık", en: "" }, body: { tr: "Hoş geldin.", en: "" } },
      stages: [
        { position: 1, name: { tr: "LEAKVISIBLE_STAGE bir", en: "" }, minutes: 10, graceSeconds: 0, questions: 2, done: false },
        { position: 2, name: { tr: "LEAKVISIBLE_STAGE iki", en: "" }, minutes: 5, graceSeconds: 0, questions: 1, done: false },
      ],
      totalMinutes: 15,
      reviewers: 2,
      signals: ["VIDEO_ANSWER"],
      devices: { camera: true, microphone: true },
      extraTimePct: 25,
      extraTimeLocked: false,
      practice: true,
      contactEmail: "ekip@ornek.com",
      retention: { mediaDays: 180, candidateDays: 730 },
      current: null,
      finished: null,
    } as unknown as HiringCandidateState;
    const landing = landingStateOf(state);
    expect(landing).toMatchObject({ stageCount: 2, totalMinutes: 15, reviewers: 2, extraTimePct: 25, introBody: { tr: "Hoş geldin.", en: "" } });
    expect(JSON.stringify(landing)).not.toContain("LEAKVISIBLE_STAGE");
    expect(Object.keys(landing)).not.toContain("stages");
    expect(Object.keys(landing)).not.toContain("current");
  });
});
