import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  PRESETS,
  isProctored,
  parsePolicy,
  policyFromPreset,
  proctoringPolicySchema,
  requiredChecks,
  safeParsePolicy,
} from "./policy";

describe("presets", () => {
  it("are all valid against the schema", () => {
    for (const p of Object.values(PRESETS)) {
      expect(() => proctoringPolicySchema.parse(p)).not.toThrow();
    }
  });

  it("never enable automatic termination by default", () => {
    for (const p of Object.values(PRESETS)) expect(p.termination.enabled).toBe(false);
  });

  it("OFF turns every sensor off", () => {
    const p = PRESETS.OFF;
    expect([p.camera, p.microphone, p.screenShare, p.fullscreen, p.clipboardBlock]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(Object.values(p.aiSignals).every((v) => !v)).toBe(true);
    expect(p.secondScreen).toBe("OFF");
  });

  it("STANDARD is camera and fullscreen without screen sharing", () => {
    const p = PRESETS.STANDARD;
    expect(p.camera && p.microphone && p.fullscreen).toBe(true);
    expect(p.screenShare).toBe(false);
    expect(p.secondScreen).toBe("WARN");
    expect(p.aiSignals).toEqual({ face: true, gaze: false, phone: true, voice: false });
    expect(p.snapshots).toEqual({ webcamSeconds: 30, screenSeconds: 45 });
    expect(p.maxAiReviewsPerAttempt).toBe(30);
  });

  it("STRICT turns everything on and requires Chromium", () => {
    const p = PRESETS.STRICT;
    expect(p.screenShare).toBe(true);
    expect(p.secondScreen).toBe("BLOCK_AT_CHECK");
    expect(p.browserPolicy).toBe("CHROMIUM_ONLY");
    expect(Object.values(p.aiSignals).every(Boolean)).toBe(true);
  });

  it("policyFromPreset returns a copy that does not alias the preset", () => {
    const p = policyFromPreset("STANDARD");
    p.aiSignals.gaze = true;
    p.termination.enabled = true;
    expect(PRESETS.STANDARD.aiSignals.gaze).toBe(false);
    expect(PRESETS.STANDARD.termination.enabled).toBe(false);
  });
});

describe("parsing", () => {
  it("parsePolicy throws a ZodError on invalid input", () => {
    expect(() => parsePolicy({ preset: "STRICT" })).toThrow(ZodError);
    const bad = { ...policyFromPreset("STRICT"), snapshots: { webcamSeconds: 5, screenSeconds: 30 } };
    expect(() => parsePolicy(bad)).toThrow(ZodError);
  });

  it("parsePolicy round-trips a valid policy", () => {
    const p = policyFromPreset("STRICT");
    expect(parsePolicy(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it("safeParsePolicy falls back to STANDARD, never to OFF", () => {
    expect(safeParsePolicy(null)).toEqual(PRESETS.STANDARD);
    expect(safeParsePolicy({ preset: "OFF" })).toEqual(PRESETS.STANDARD);
    expect(safeParsePolicy(PRESETS.OFF)).toEqual(PRESETS.OFF);
  });
});

describe("isProctored", () => {
  it("is false for OFF even if a switch was flipped", () => {
    expect(isProctored(PRESETS.OFF)).toBe(false);
    expect(isProctored({ ...PRESETS.OFF, camera: true })).toBe(false);
  });

  it("needs camera, screen share or fullscreen", () => {
    expect(isProctored(PRESETS.STANDARD)).toBe(true);
    const micOnly = {
      ...PRESETS.STANDARD,
      camera: false,
      fullscreen: false,
      screenShare: false,
    };
    expect(isProctored(micOnly)).toBe(false);
  });
});

describe("requiredChecks", () => {
  it("orders STRICT checks and requires all but CONNECTION", () => {
    expect(requiredChecks(PRESETS.STRICT)).toEqual([
      { id: "BROWSER", required: true },
      { id: "SINGLE_SCREEN", required: true },
      { id: "CAMERA", required: true },
      { id: "MICROPHONE", required: true },
      { id: "FACE", required: true },
      { id: "SCREEN_SHARE", required: true },
      { id: "CONNECTION", required: false },
    ]);
  });

  it("shows SINGLE_SCREEN as informational under WARN", () => {
    const checks = requiredChecks(PRESETS.STANDARD);
    expect(checks.find((c) => c.id === "SINGLE_SCREEN")).toEqual({
      id: "SINGLE_SCREEN",
      required: false,
    });
    expect(checks.some((c) => c.id === "SCREEN_SHARE")).toBe(false);
  });

  it("skips FACE without a camera", () => {
    const p = { ...PRESETS.STRICT, camera: false };
    expect(requiredChecks(p).some((c) => c.id === "FACE")).toBe(false);
  });

  it("OFF leaves only the browser and connection checks", () => {
    expect(requiredChecks(PRESETS.OFF).map((c) => c.id)).toEqual(["BROWSER", "CONNECTION"]);
  });
});
