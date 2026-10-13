import { describe, expect, it } from "vitest";
import { policyFromPreset } from "@/lib/proctor/policy";
import {
  recordingRetentionDays,
  MAX_SEGMENT_MS,
  UPLOAD_GRACE_MS,
  kindAllowed,
  megabytesPerHour,
  parseSegmentMeta,
  recordingMime,
  sniffMedia,
  uploadWindow,
} from "./recording-rules";

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);
const q = (o: Record<string, string>) => new URLSearchParams(o);
const good = { kind: "CAMERA", run: "0b6f2a4e-9c1d-4f7a-8e2b-1a2b3c4d5e6f", seq: "3", at: String(NOW - 20_000), dur: "15000" };

describe("parseSegmentMeta", () => {
  it("reads a well formed segment", () => {
    expect(parseSegmentMeta(q(good), NOW)).toEqual({
      kind: "CAMERA",
      runId: good.run,
      sequence: 3,
      startedAt: NOW - 20_000,
      durationMs: 15_000,
    });
  });

  it.each([
    ["an unknown kind", { kind: "AUDIO" }],
    ["a run id that could walk a path", { run: "../../etc/passwd" }],
    ["a run id with a slash", { run: "abcdefgh/ij" }],
    ["a short run id", { run: "abc" }],
    ["a negative sequence", { seq: "-1" }],
    ["a fractional sequence", { seq: "1.5" }],
    ["a missing start", { at: "" }],
    ["a start from yesterday", { at: String(NOW - 13 * 3600_000) }],
    ["a start in the future", { at: String(NOW + 5 * 60_000) }],
    ["a zero duration", { dur: "0" }],
    ["a duration past the cap", { dur: String(MAX_SEGMENT_MS + 1) }],
  ])("refuses %s", (_label, patch) => {
    expect(parseSegmentMeta(q({ ...good, ...patch }), NOW)).toBeNull();
  });
});

describe("kindAllowed", () => {
  it("records the camera under STANDARD and both under STRICT", () => {
    expect(kindAllowed("CAMERA", policyFromPreset("STANDARD"))).toBe(true);
    expect(kindAllowed("SCREEN", policyFromPreset("STANDARD"))).toBe(false);
    expect(kindAllowed("CAMERA", policyFromPreset("STRICT"))).toBe(true);
    expect(kindAllowed("SCREEN", policyFromPreset("STRICT"))).toBe(true);
  });

  it("records nothing when proctoring is off, whatever the switches say", () => {
    expect(kindAllowed("CAMERA", { ...policyFromPreset("STRICT"), preset: "OFF" })).toBe(false);
  });
});

describe("recordingMime and sniffMedia", () => {
  it("accepts the recorder's own content types and nothing else", () => {
    expect(recordingMime("video/webm;codecs=vp8,opus")).toBe("video/webm");
    expect(recordingMime("video/mp4")).toBe("video/mp4");
    expect(recordingMime("text/html")).toBeNull();
    expect(recordingMime(null)).toBeNull();
  });

  it("checks the first bytes against the claimed container", () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
    const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69]);
    const html = new TextEncoder().encode("<html><script>");
    expect(sniffMedia(webm, "video/webm")).toBe(true);
    expect(sniffMedia(mp4, "video/mp4")).toBe(true);
    expect(sniffMedia(html, "video/webm")).toBe(false);
    expect(sniffMedia(webm, "video/mp4")).toBe(false);
  });
});

describe("uploadWindow", () => {
  const base = { deviceCheckedAt: new Date(NOW - 3600_000), startedAt: new Date(NOW - 3500_000), completedAt: null, terminatedAt: null };

  it("is open while the attempt runs", () => {
    expect(uploadWindow(base, NOW)).toBe("OPEN");
  });

  it("is not open before the system check", () => {
    expect(uploadWindow({ ...base, deviceCheckedAt: null, startedAt: null }, NOW)).toBe("NOT_STARTED");
  });

  it("stays open for the grace period after the finish, then closes", () => {
    const completedAt = new Date(NOW - UPLOAD_GRACE_MS + 1000);
    expect(uploadWindow({ ...base, completedAt }, NOW)).toBe("OPEN");
    expect(uploadWindow({ ...base, completedAt: new Date(NOW - UPLOAD_GRACE_MS - 1000) }, NOW)).toBe("CLOSED");
  });

  it("counts the grace period from the earlier of completion and termination", () => {
    const terminatedAt = new Date(NOW - UPLOAD_GRACE_MS - 1000);
    expect(uploadWindow({ ...base, terminatedAt, completedAt: new Date(NOW) }, NOW)).toBe("CLOSED");
  });
});

describe("megabytesPerHour", () => {
  it("is what the target bitrates add up to (the figures in docs/PROCTORING.md)", () => {
    expect(megabytesPerHour("CAMERA")).toBeCloseTo(74.7, 1);
    expect(megabytesPerHour("SCREEN")).toBeCloseTo(67.5, 1);
  });
});

describe("recordingRetentionDays", () => {
  it("keeps a recording no longer than 30 days, and no longer than the evidence", () => {
    expect(recordingRetentionDays(90)).toBe(30);
    expect(recordingRetentionDays(14)).toBe(14);
  });
});
