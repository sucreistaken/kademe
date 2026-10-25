import { describe, expect, it } from "vitest";
import { policyFromPreset } from "@/lib/proctor/policy";
import { checkStep, planSteps, primaryEnabled, readyRules, type StepState } from "./check-steps";

const strict = planSteps(policyFromPreset("STRICT"));
const standard = planSteps(policyFromPreset("STANDARD"));
const off = planSteps(policyFromPreset("OFF"));

const fresh: StepState = {
  ready: true,
  browserBlocked: false,
  secondScreenBlocks: false,
  isExtended: false,
  camera: "idle",
  mic: "idle",
  model: "off",
  faces: null,
  quiet: "idle",
  screen: "idle",
  surface: null,
  lookConfirmed: false,
  rulesAccepted: false,
};
const ticked = { rulesAccepted: true };
const devicesOn: StepState = { ...fresh, camera: "ok", mic: "ok" };
const seen: StepState = { ...devicesOn, model: "ready", faces: 1, quiet: "done" };

describe("the steps a policy needs (skipped ones are not counted)", () => {
  it("STRICT: devices, look, screen, ready", () => {
    expect(strict.steps).toEqual(["devices", "look", "screen", "ready"]);
  });
  it("STANDARD has no screen step", () => {
    expect(standard.steps).toEqual(["devices", "look", "ready"]);
  });
  it("OFF has only the last screen", () => {
    expect(off.steps).toEqual(["ready"]);
  });
  it("a microphone-only policy with the voice signal still measures the room", () => {
    const p = { ...policyFromPreset("OFF"), microphone: true, aiSignals: { face: false, gaze: false, phone: false, voice: true } };
    expect(planSteps(p).steps).toEqual(["devices", "look", "ready"]);
    expect(planSteps({ ...p, aiSignals: { ...p.aiSignals, voice: false } }).steps).toEqual(["devices", "ready"]);
  });
  it("a camera without the face signal still shows the preview", () => {
    const p = { ...policyFromPreset("STANDARD"), aiSignals: { face: false, gaze: false, phone: false, voice: false } };
    const plan = planSteps(p);
    expect(plan.look).toBe(true);
    expect(plan.face).toBe(false);
  });
});

describe("step 1: camera and microphone", () => {
  it("starts with the big open button, with 'Adım 1 / 4' under STRICT", () => {
    expect(checkStep(strict, fresh)).toEqual({ step: "devices", primary: "open", wait: null, issue: null, index: 1, total: 4 });
    expect(checkStep(standard, fresh).total).toBe(3);
  });
  it("waits (button off) while the engine is not ready or the browser is asking", () => {
    expect(primaryEnabled(checkStep(strict, { ...fresh, ready: false }))).toBe(false);
    const asking = checkStep(strict, { ...fresh, camera: "asking", mic: "asking" });
    expect(asking).toMatchObject({ step: "devices", primary: "open", wait: "asking" });
    expect(primaryEnabled(asking)).toBe(false);
  });
  it("denied or lost: one sentence and a retry", () => {
    expect(checkStep(strict, { ...fresh, camera: "denied", mic: "denied" })).toMatchObject({ step: "devices", primary: "retry", issue: "denied" });
    expect(checkStep(strict, { ...devicesOn, camera: "lost" })).toMatchObject({ step: "devices", primary: "retry", issue: "lost" });
    expect(checkStep(strict, { ...devicesOn, mic: "lost" })).toMatchObject({ step: "devices", issue: "lost" });
  });
  it("a browser without camera access has nothing to retry", () => {
    expect(checkStep(strict, { ...fresh, camera: "unsupported", mic: "denied" })).toMatchObject({ primary: null, issue: "unsupported" });
  });
  it("the camera alone is not enough: the microphone must be ok too (the old MICROPHONE row)", () => {
    expect(checkStep(strict, { ...fresh, camera: "ok", mic: "idle" }).step).toBe("devices");
  });
  it("OFF never asks for devices, even when their state is idle", () => {
    expect(checkStep(off, { ...fresh, ...ticked })).toMatchObject({ step: "ready", primary: "start", wait: null, total: 1 });
  });
});

describe("step 2: look (face and quiet measured by themselves)", () => {
  it("opens once the devices are on, and waits for the face model, then one face", () => {
    expect(checkStep(strict, devicesOn)).toMatchObject({ step: "look", wait: "faceLoading", index: 2 });
    expect(checkStep(strict, { ...devicesOn, model: "loading" })).toMatchObject({ wait: "faceLoading" });
    expect(checkStep(strict, { ...devicesOn, model: "ready", faces: null })).toMatchObject({ wait: "faceLoading" });
    expect(checkStep(strict, { ...devicesOn, model: "ready", faces: 0 })).toMatchObject({ wait: "faceNone" });
    expect(checkStep(strict, { ...devicesOn, model: "ready", faces: 2 })).toMatchObject({ wait: "faceMany" });
  });
  it("the room must be measured on STRICT (voice signal) before Devam et", () => {
    const r = checkStep(strict, { ...devicesOn, model: "ready", faces: 1, quiet: "working" });
    expect(r).toMatchObject({ step: "look", primary: "continue", wait: "quietWorking" });
    expect(primaryEnabled(r)).toBe(false);
  });
  it("one face and a measured room enable Devam et", () => {
    expect(primaryEnabled(checkStep(strict, seen))).toBe(true);
  });
  it("STANDARD has no voice signal, so the quiet measurement never waits", () => {
    expect(primaryEnabled(checkStep(standard, { ...devicesOn, model: "ready", faces: 1 }))).toBe(true);
  });
  it("an unavailable face model does not block (the old warning)", () => {
    expect(primaryEnabled(checkStep(standard, { ...devicesOn, model: "unavailable" }))).toBe(true);
  });
  it("a lost camera sends the student back to step 1 even after confirming", () => {
    expect(checkStep(strict, { ...seen, lookConfirmed: true, camera: "lost" })).toMatchObject({ step: "devices", issue: "lost" });
  });
});

describe("step 3: screen share (STRICT only)", () => {
  const confirmed = { ...seen, lookConfirmed: true };
  it("asks for the screen after the student confirmed", () => {
    expect(checkStep(strict, confirmed)).toMatchObject({ step: "screen", primary: "share", wait: null, index: 3, total: 4 });
    expect(checkStep(strict, { ...confirmed, screen: "asking" })).toMatchObject({ step: "screen", wait: "pickScreen" });
  });
  it("a wrong surface or a refusal offers a retry with its own sentence", () => {
    expect(checkStep(strict, { ...confirmed, screen: "denied" })).toMatchObject({ primary: "retry", issue: "screenDenied" });
    expect(checkStep(strict, { ...confirmed, screen: "denied", surface: "WRONG_SURFACE" })).toMatchObject({ primary: "retry", issue: "wrongSurface" });
    expect(checkStep(strict, { ...confirmed, screen: "lost" })).toMatchObject({ step: "screen", issue: "screenDenied" });
  });
  it("STANDARD goes straight to the last screen", () => {
    expect(checkStep(standard, { ...seen, lookConfirmed: true })).toMatchObject({ step: "ready", index: 3, total: 3 });
  });
});

describe("the last screen and what still blocks the start", () => {
  const done = { ...seen, lookConfirmed: true, screen: "ok" as const, ...ticked };
  it("is startable when every required thing is ok", () => {
    expect(primaryEnabled(checkStep(strict, done))).toBe(true);
    expect(checkStep(strict, done)).toMatchObject({ step: "ready", index: 4, total: 4 });
  });
  it("a lost screen share goes back to step 3", () => {
    expect(checkStep(strict, { ...done, screen: "lost" })).toMatchObject({ step: "screen" });
  });
  it("the face leaving the frame keeps the start off, without jumping back", () => {
    const r = checkStep(strict, { ...done, faces: 0 });
    expect(r).toMatchObject({ step: "ready", wait: "faceNone" });
    expect(primaryEnabled(r)).toBe(false);
  });
  it("an unmeasured room keeps the start off", () => {
    expect(primaryEnabled(checkStep(strict, { ...done, quiet: "idle" }))).toBe(false);
  });
  it("an unsupported browser stops everything on a blocked screen", () => {
    expect(checkStep(strict, { ...done, browserBlocked: true })).toMatchObject({ step: "blocked", wait: "browser", primary: null, index: null });
    expect(checkStep(off, { ...fresh, browserBlocked: true }).step).toBe("blocked");
  });
  it("a second screen blocks only where the policy says BLOCK_AT_CHECK", () => {
    expect(checkStep(strict, { ...done, secondScreenBlocks: true, isExtended: true })).toMatchObject({ step: "blocked", wait: "secondScreen" });
    expect(checkStep(strict, { ...done, secondScreenBlocks: true, isExtended: null }).step).toBe("ready");
    expect(checkStep(standard, { ...seen, lookConfirmed: true, secondScreenBlocks: false, isExtended: true }).step).toBe("ready");
  });
  it("OFF is startable at once, but not before the engine is ready", () => {
    expect(primaryEnabled(checkStep(off, { ...fresh, ...ticked }))).toBe(true);
    expect(primaryEnabled(checkStep(off, { ...fresh, ready: false }))).toBe(false);
  });
});

describe("the last screen's tick (Diğer uygulamaları kapattım, kurallara uyacağım)", () => {
  const readyUnticked = { ...seen, lookConfirmed: true, screen: "ok" as const };
  it("keeps the start off until the rules are ticked, with its own wait so the button can say why", () => {
    const r = checkStep(strict, readyUnticked);
    expect(r).toMatchObject({ step: "ready", primary: "start", wait: "rules" });
    expect(primaryEnabled(r)).toBe(false);
    expect(primaryEnabled(checkStep(strict, { ...readyUnticked, ...ticked }))).toBe(true);
  });
  it("applies to every policy that reaches the last screen, OFF included", () => {
    expect(checkStep(off, fresh)).toMatchObject({ step: "ready", wait: "rules" });
    expect(checkStep(standard, { ...seen, lookConfirmed: true })).toMatchObject({ step: "ready", wait: "rules" });
  });
  it("names a fixable problem before it asks for the tick", () => {
    expect(checkStep(strict, { ...readyUnticked, faces: 0 })).toMatchObject({ step: "ready", wait: "faceNone" });
    expect(checkStep(strict, { ...readyUnticked, quiet: "idle" })).toMatchObject({ step: "ready", wait: "quietWorking" });
  });
  it("does not matter on the earlier steps", () => {
    expect(checkStep(strict, fresh)).toMatchObject({ step: "devices", wait: null });
    expect(primaryEnabled(checkStep(strict, seen))).toBe(true);
  });
  it("is not enough on its own: the engine, the browser and the second screen still come first", () => {
    expect(checkStep(strict, { ...readyUnticked, ...ticked, ready: false })).toMatchObject({ wait: "preparing" });
    expect(checkStep(strict, { ...readyUnticked, ...ticked, browserBlocked: true }).step).toBe("blocked");
  });
});

describe("the checklist a policy shows on the last screen", () => {
  it("STRICT: full screen, one screen, the tab, and the recording of camera, sound and screen", () => {
    expect(readyRules(policyFromPreset("STRICT"))).toEqual({ recorded: "cameraAudioScreen", plain: ["fullscreen", "oneScreen", "tab"] });
  });
  it("STANDARD records camera and sound but not the screen", () => {
    expect(readyRules(policyFromPreset("STANDARD"))).toEqual({ recorded: "cameraAudio", plain: ["fullscreen", "oneScreen", "tab"] });
  });
  it("OFF records nothing and asks only for the tab", () => {
    expect(readyRules(policyFromPreset("OFF"))).toEqual({ recorded: null, plain: ["tab"] });
  });
  it("leaves out a rule the policy does not need, as the old pills did", () => {
    const p = { ...policyFromPreset("STRICT"), fullscreen: false, secondScreen: "OFF" as const, microphone: false };
    expect(readyRules(p)).toEqual({ recorded: "cameraScreen", plain: ["tab"] });
    expect(readyRules({ ...p, camera: false })).toEqual({ recorded: "screen", plain: ["tab"] });
  });
});
