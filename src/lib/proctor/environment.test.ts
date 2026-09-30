import { describe, it, expect } from "vitest";
import {
  evaluateEnvironment,
  verifyDisplaySurface,
  type EnvironmentFeatures,
} from "./environment";
import { PRESETS } from "./policy";

const desktop: EnvironmentFeatures = {
  mobile: false,
  getDisplayMedia: true,
  isExtendedSupported: true,
  isExtended: false,
  fullscreenEnabled: true,
  mediaRecorder: true,
  wasm: true,
  chromium: true,
};

describe("evaluateEnvironment", () => {
  it("passes a capable single-screen Chromium desktop under STRICT", () => {
    expect(evaluateEnvironment(desktop, PRESETS.STRICT)).toEqual({
      ok: true,
      blockers: [],
      warnings: [],
    });
  });

  it("blocks mobile whenever camera or screen share is on", () => {
    const phone = { ...desktop, mobile: true };
    expect(evaluateEnvironment(phone, PRESETS.STANDARD).blockers).toContain("MOBILE");
    expect(evaluateEnvironment(phone, PRESETS.STRICT).blockers).toContain("MOBILE");
    expect(evaluateEnvironment(phone, PRESETS.OFF).blockers).not.toContain("MOBILE");
  });

  it("blocks non-Chromium only under CHROMIUM_ONLY", () => {
    const firefox = { ...desktop, chromium: false };
    expect(evaluateEnvironment(firefox, PRESETS.STRICT).blockers).toContain(
      "BROWSER_NOT_SUPPORTED",
    );
    expect(evaluateEnvironment(firefox, PRESETS.STANDARD).ok).toBe(true);
  });

  it("blocks missing screen share, fullscreen and recorder only when needed", () => {
    const bare = { ...desktop, getDisplayMedia: false, fullscreenEnabled: false, mediaRecorder: false };
    expect(evaluateEnvironment(bare, PRESETS.STRICT).blockers).toEqual([
      "NO_SCREEN_SHARE",
      "NO_FULLSCREEN",
      "NO_RECORDER",
    ]);
    expect(evaluateEnvironment(bare, PRESETS.STANDARD).blockers).toEqual([
      "NO_FULLSCREEN",
      "NO_RECORDER",
    ]);
    expect(evaluateEnvironment(bare, PRESETS.OFF).ok).toBe(true);
  });

  it("blocks an extended display under BLOCK_AT_CHECK and warns under WARN", () => {
    const twoScreens = { ...desktop, isExtended: true };
    const strict = evaluateEnvironment(twoScreens, PRESETS.STRICT);
    expect(strict.ok).toBe(false);
    expect(strict.blockers).toEqual(["SECOND_SCREEN"]);
    const standard = evaluateEnvironment(twoScreens, PRESETS.STANDARD);
    expect(standard.ok).toBe(true);
    expect(standard.warnings).toEqual(["SECOND_SCREEN"]);
    expect(evaluateEnvironment(twoScreens, PRESETS.OFF).warnings).toEqual([]);
  });

  it("warns, never blocks, when the second screen cannot be checked", () => {
    const unsupported = { ...desktop, isExtendedSupported: false, isExtended: null };
    const r = evaluateEnvironment(unsupported, PRESETS.STRICT);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual(["SECOND_SCREEN_UNVERIFIABLE"]);
    const unreadable = { ...desktop, isExtended: null };
    expect(evaluateEnvironment(unreadable, PRESETS.STRICT).warnings).toEqual([
      "SECOND_SCREEN_UNVERIFIABLE",
    ]);
  });

  it("warns about missing WebAssembly only when vision signals are wanted", () => {
    const noWasm = { ...desktop, wasm: false };
    expect(evaluateEnvironment(noWasm, PRESETS.STANDARD).warnings).toEqual(["NO_WASM"]);
    expect(evaluateEnvironment(noWasm, PRESETS.OFF).warnings).toEqual([]);
    const noVision = {
      ...PRESETS.STANDARD,
      aiSignals: { face: false, gaze: false, phone: false, voice: true },
    };
    expect(evaluateEnvironment(noWasm, noVision).warnings).toEqual([]);
  });
});

describe("verifyDisplaySurface", () => {
  const screen = { width: 1440, height: 900, dpr: 2 };

  it("accepts a whole monitor at the expected size", () => {
    expect(
      verifyDisplaySurface({ displaySurface: "monitor", width: 2880, height: 1800 }, screen),
    ).toEqual({ surface: "MONITOR", wrongMonitor: false });
  });

  it("flags a tab or window share", () => {
    expect(verifyDisplaySurface({ displaySurface: "browser" }, screen).surface).toBe(
      "WRONG_SURFACE",
    );
    expect(verifyDisplaySurface({ displaySurface: "window" }, screen).surface).toBe(
      "WRONG_SURFACE",
    );
  });

  it("is UNVERIFIED when the browser does not report the surface", () => {
    expect(verifyDisplaySurface({ width: 2880, height: 1800 }, screen)).toEqual({
      surface: "UNVERIFIED",
      wrongMonitor: false,
    });
  });

  it("suspects the wrong monitor only when both dimensions are off by over 15%", () => {
    const other = verifyDisplaySurface({ displaySurface: "monitor", width: 1920, height: 1080 }, screen);
    expect(other).toEqual({ surface: "MONITOR", wrongMonitor: true });
    // Width off by 33%, height within 15%: a downscaled or letterboxed share.
    const oneOff = verifyDisplaySurface({ displaySurface: "monitor", width: 1920, height: 1700 }, screen);
    expect(oneOff.wrongMonitor).toBe(false);
    // Just inside the tolerance.
    const close = verifyDisplaySurface({ displaySurface: "monitor", width: 2500, height: 1560 }, screen);
    expect(close.wrongMonitor).toBe(false);
  });

  it("does not guess without a track size", () => {
    expect(verifyDisplaySurface({ displaySurface: "monitor" }, screen)).toEqual({
      surface: "MONITOR",
      wrongMonitor: false,
    });
  });
});
