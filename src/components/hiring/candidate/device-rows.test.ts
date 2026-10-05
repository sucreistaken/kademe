import { describe, expect, it } from "vitest";
import { HEARD_AT, deniedKind, deviceBlocker, deviceRows, fixKeyFor, formatMbps, mediaConstraints, peakLevel, uploadSpeed } from "./device-rows";

const base = { camera: true, permission: "idle" as const, heard: false, trial: "none" as const };

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
    expect(deniedKind(Object.assign(new Error("busy"), { name: "NotReadableError" }))).toBe("other");
    expect(deniedKind(Object.assign(new Error("none"), { name: "NotFoundError" }))).toBe("other");
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
