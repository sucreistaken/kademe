import { describe, expect, it } from "vitest";
import { HEARD_AT, QUIET_AFTER_MS, deniedKind, deviceBlocker, deviceRows, fixKeyFor, formatMbps, isQuiet, mediaConstraints, peakLevel, uploadSpeed } from "./device-rows";

const base = { camera: true, permission: "idle" as const, heard: false, quiet: false, trial: "none" as const };

describe("the device check rows (HIRING-UX 6.3)", () => {
  it("opens one row at a time: camera, microphone, trial; connection is information only", () => {
    expect(deviceRows(base)).toEqual([
      { id: "camera", state: "active" },
      { id: "microphone", state: "waiting" },
      { id: "trial", state: "waiting" },
      { id: "connection", state: "info" },
    ]);
    expect(deviceRows({ ...base, permission: "granted" }).map((r) => r.state)).toEqual(["done", "active", "waiting", "info"]);
    expect(deviceRows({ ...base, permission: "granted", heard: true }).map((r) => r.state)).toEqual(["done", "done", "active", "info"]);
    expect(deviceRows({ ...base, permission: "granted", heard: true, trial: "played" }).map((r) => r.state)).toEqual(["done", "done", "done", "info"]);
  });

  it("shows no camera row for an audio-only assessment", () => {
    expect(deviceRows({ ...base, camera: false }).map((r) => r.id)).toEqual(["microphone", "trial", "connection"]);
    expect(deviceRows({ ...base, camera: false })[0].state).toBe("active");
  });

  it("names the one thing the button waits for, and never the connection", () => {
    expect(deviceBlocker(base)).toBe("permission");
    expect(deviceBlocker({ ...base, camera: false })).toBe("permissionMic");
    expect(deviceBlocker({ ...base, permission: "granted" })).toBe("sound");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true })).toBe("trialNone");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "recording" })).toBe("trialRecording");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "ready" })).toBe("trialListen");
    expect(deviceBlocker({ ...base, permission: "granted", heard: true, trial: "played" })).toBeNull();
  });

  it("keeps a denied or pending permission blocking, whatever else happened", () => {
    for (const permission of ["asking", "denied"] as const) {
      expect(deviceBlocker({ ...base, permission, heard: true, trial: "played" })).toBe("permission");
      expect(deviceRows({ ...base, permission }).map((r) => r.state)).toEqual(["active", "waiting", "waiting", "info"]);
    }
  });

  it("gives step-by-step help for the browser in hand", () => {
    expect(fixKeyFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBe("chrome");
    expect(fixKeyFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15")).toBe("safariMac");
    expect(fixKeyFor("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1")).toBe("ios");
    expect(fixKeyFor("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36")).toBe("android");
    expect(fixKeyFor("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("firefox");
    expect(fixKeyFor("curl/8")).toBe("other");
  });

  it("sends in-app browsers to Safari or Chrome", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
    expect(fixKeyFor(`${iphone} [FBAN/FBIOS;FBAV/480.0.0]`)).toBe("inApp");
    expect(fixKeyFor(`${iphone} Instagram 350.0.0`)).toBe("inApp");
    expect(fixKeyFor(`${iphone} LinkedInApp/9.30`)).toBe("inApp");
    expect(fixKeyFor(`${iphone} GSA/380.0`)).toBe("inApp");
    expect(fixKeyFor(`${iphone} Safari Line/14.10.0`)).toBe("inApp");
    expect(fixKeyFor("Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0 Mobile Safari/537.36")).toBe("inApp");
  });

  it("gives other iPhone browsers the iOS settings of their own app", () => {
    const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
    expect(fixKeyFor(`${ios} CriOS/141.0 Mobile/15E148 Safari/604.1`)).toBe("iosOther");
    expect(fixKeyFor(`${ios} FxiOS/140.0 Mobile/15E148 Safari/605.1.15`)).toBe("iosOther");
    expect(fixKeyFor(`${ios} EdgiOS/141.0 Mobile/15E148 Safari/605.1.15`)).toBe("iosOther");
  });

  it("tells an iPad that says Macintosh from a Mac by its touch points", () => {
    const desktopSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
    expect(fixKeyFor(desktopSafari, 5)).toBe("ios");
    expect(fixKeyFor(desktopSafari, 0)).toBe("safariMac");
    expect(fixKeyFor(desktopSafari)).toBe("safariMac");
  });
});

describe("a microphone the check cannot hear (Task 12 review ruling: the sound gate has an escape)", () => {
  const granted = { ...base, permission: "granted" as const };

  it("folds the microphone into Hazır once a voice is heard", () => {
    expect(isQuiet({ heard: true, listenedMs: 60_000, suspendedMs: 60_000 })).toBe(false);
    expect(deviceRows({ ...granted, heard: true }).map((r) => r.state)).toEqual(["done", "done", "active", "info"]);
    expect(deviceBlocker({ ...granted, heard: true })).toBe("trialNone");
  });

  it("keeps waiting for a voice for 8 seconds: still blocked, trial still closed", () => {
    expect(QUIET_AFTER_MS).toBe(8000);
    const quiet = isQuiet({ heard: false, listenedMs: QUIET_AFTER_MS - 1, suspendedMs: 0 });
    expect(quiet).toBe(false);
    expect(deviceBlocker({ ...granted, quiet })).toBe("sound");
    expect(deviceRows({ ...granted, quiet }).map((r) => r.state)).toEqual(["done", "active", "waiting", "info"]);
  });

  it("after 8 seconds unheard, keeps the microphone open with a hint and unlocks the trial as the proof", () => {
    const quiet = isQuiet({ heard: false, listenedMs: QUIET_AFTER_MS, suspendedMs: 0 });
    expect(quiet).toBe(true);
    expect(deviceRows({ ...granted, quiet }).map((r) => r.state)).toEqual(["done", "quiet", "active", "info"]);
    expect(deviceBlocker({ ...granted, quiet })).toBe("trialNone");
    expect(deviceBlocker({ ...granted, quiet, trial: "ready" })).toBe("trialListen");
    expect(deviceBlocker({ ...granted, quiet, trial: "played" })).toBeNull();
    // Audio only: the same escape.
    expect(deviceRows({ ...granted, camera: false, quiet }).map((r) => r.state)).toEqual(["quiet", "active", "info"]);
  });

  it("does not wait 8 seconds for a sound context the browser keeps suspended", () => {
    expect(isQuiet({ heard: false, listenedMs: 1000, suspendedMs: 999 })).toBe(false);
    expect(isQuiet({ heard: false, listenedMs: 1000, suspendedMs: 1000 })).toBe(true);
  });

  it("never unlocks anything before the permission", () => {
    expect(deviceBlocker({ ...base, quiet: true })).toBe("permission");
    expect(deviceRows({ ...base, quiet: true }).map((r) => r.state)).toEqual(["active", "waiting", "waiting", "info"]);
  });
});

describe("what the device check asks the browser for", () => {
  it("asks for the camera only when a video question exists", () => {
    expect(mediaConstraints(true).video).toBeTruthy();
    expect(mediaConstraints(true).audio).toBeTruthy();
    expect(mediaConstraints(false).video).toBeUndefined();
    expect(mediaConstraints(false).audio).toBeTruthy();
  });

  it("tells a refused permission from a device it could not reach", () => {
    expect(deniedKind(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe("notAllowed");
    expect(deniedKind({ name: "SecurityError" })).toBe("notAllowed");
    expect(deniedKind(Object.assign(new Error("busy"), { name: "NotReadableError" }))).toBe("busy");
    expect(deniedKind(Object.assign(new Error("busy"), { name: "AbortError" }))).toBe("busy");
    expect(deniedKind(Object.assign(new Error("none"), { name: "NotFoundError" }))).toBe("notFound");
    expect(deniedKind(Object.assign(new Error("none"), { name: "OverconstrainedError" }))).toBe("notFound");
    // No mediaDevices at all (an insecure address) throws a TypeError.
    expect(deniedKind(new TypeError("undefined is not an object"))).toBe("other");
    expect(deniedKind("nonsense")).toBe("other");
  });

  it("hears a voice from the loudest sample, and silence as nothing", () => {
    expect(peakLevel(new Uint8Array(256).fill(128))).toBe(0);
    const voice = new Uint8Array(256).fill(128);
    voice[40] = 192;
    voice[41] = 100;
    expect(peakLevel(voice)).toBe(0.5);
    expect(peakLevel(voice)).toBeGreaterThan(HEARD_AT);
    const hum = new Uint8Array(256).fill(128);
    hum[3] = 131;
    expect(peakLevel(hum)).toBeLessThan(HEARD_AT);
  });
});

describe("the connection row (advice, never a blocker)", () => {
  it("measures upload speed in megabits and calls 2 Mbps enough", () => {
    // 512 KiB in one second = 4.19 Mbps.
    expect(uploadSpeed(512 * 1024, 1000)).toEqual({ state: "ok", mbps: 4.2 });
    expect(uploadSpeed(512 * 1024, 4000)).toEqual({ state: "low", mbps: 1 });
    expect(uploadSpeed(512 * 1024, 100)).toEqual({ state: "ok", mbps: 42 });
    expect(uploadSpeed(250_000, 1000).state).toBe("ok");
    expect(uploadSpeed(249_000, 1000).state).toBe("low");
  });

  it("never divides by a zero duration", () => {
    expect(Number.isFinite(uploadSpeed(512 * 1024, 0).mbps)).toBe(true);
  });

  it("writes the number the candidate's way (Turkish decimal comma)", () => {
    expect(formatMbps(4.2, "tr")).toBe("4,2");
    expect(formatMbps(4.2, "en")).toBe("4.2");
    expect(formatMbps(42, "tr")).toBe("42");
  });
});
