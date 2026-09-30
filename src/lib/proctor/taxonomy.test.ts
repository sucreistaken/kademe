import { describe, it, expect } from "vitest";
import {
  PROCTOR_EVENT_TYPES,
  TAXONOMY,
  effectiveSeverity,
  isProctorEventType,
} from "./taxonomy";

describe("taxonomy table", () => {
  it("has exactly one entry per event type", () => {
    expect(Object.keys(TAXONOMY).sort()).toEqual([...PROCTOR_EVENT_TYPES].sort());
    expect(new Set(PROCTOR_EVENT_TYPES).size).toBe(PROCTOR_EVENT_TYPES.length);
  });

  it("assigns sources by group", () => {
    const bySource = (s: string) =>
      PROCTOR_EVENT_TYPES.filter((t) => TAXONOMY[t].source === s).length;
    expect(bySource("BROWSER")).toBe(22);
    expect(bySource("MODEL")).toBe(6);
    expect(bySource("SERVER")).toBe(5);
  });

  it("marks exactly the duration-bearing types as intervals", () => {
    const intervals = PROCTOR_EVENT_TYPES.filter((t) => TAXONOMY[t].interval).sort();
    expect(intervals).toEqual(
      [
        "FULLSCREEN_EXIT",
        "TAB_HIDDEN",
        "FOCUS_LOST",
        "SCREEN_SHARE_STOPPED",
        "CAMERA_LOST",
        "MIC_LOST",
        "OFFLINE",
        "NO_FACE",
        "MULTIPLE_FACES",
        "GAZE_AWAY",
        "VOICE_DETECTED",
      ].sort(),
    );
  });

  it("sends only visual, reviewable signals to the AI second look", () => {
    const reviewed = PROCTOR_EVENT_TYPES.filter((t) => TAXONOMY[t].aiReview).sort();
    expect(reviewed).toEqual(
      [
        "NO_FACE",
        "MULTIPLE_FACES",
        "PHONE_DETECTED",
        "TAB_HIDDEN",
        "FOCUS_LOST",
        "SECOND_SCREEN_DETECTED",
      ].sort(),
    );
    expect(TAXONOMY.VOICE_DETECTED.aiReview).toBe(false);
    expect(TAXONOMY.GAZE_AWAY.aiReview).toBe(false);
  });

  it("treats model unavailability as a coverage gap, not misconduct", () => {
    const coverage = PROCTOR_EVENT_TYPES.filter((t) => TAXONOMY[t].coverage);
    expect(coverage).toEqual(["PROCTOR_MODEL_UNAVAILABLE"]);
    expect(TAXONOMY.PROCTOR_MODEL_UNAVAILABLE.severity).toBe("INFO");
  });

  it("uses the agreed default severities", () => {
    expect(TAXONOMY.TAB_HIDDEN.severity).toBe("HIGH");
    expect(TAXONOMY.PHONE_DETECTED.severity).toBe("HIGH");
    expect(TAXONOMY.DUPLICATE_TAB.severity).toBe("MEDIUM");
    expect(TAXONOMY.FOCUS_LOST.severity).toBe("LOW");
    expect(TAXONOMY.OFFLINE.severity).toBe("INFO");
    expect(TAXONOMY.RESUMED.severity).toBe("INFO");
    expect(TAXONOMY.TERMINATED.severity).toBe("HIGH");
    expect(TAXONOMY.SCREEN_SHARE_WRONG_SURFACE.severity).toBe("MEDIUM");
  });
});

describe("isProctorEventType", () => {
  it("accepts known types and rejects everything else", () => {
    expect(isProctorEventType("PHONE_DETECTED")).toBe(true);
    expect(isProctorEventType("phone_detected")).toBe(false);
    expect(isProctorEventType("toString")).toBe(false);
    expect(isProctorEventType(42)).toBe(false);
    expect(isProctorEventType(null)).toBe(false);
  });
});

describe("effectiveSeverity", () => {
  it("escalates a long focus loss to MEDIUM", () => {
    expect(effectiveSeverity("FOCUS_LOST", 10_000)).toBe("LOW");
    expect(effectiveSeverity("FOCUS_LOST", 10_001)).toBe("MEDIUM");
  });

  it("escalates a long missing face to HIGH", () => {
    expect(effectiveSeverity("NO_FACE", 30_000)).toBe("MEDIUM");
    expect(effectiveSeverity("NO_FACE", 30_001)).toBe("HIGH");
  });

  it("keeps the default for open intervals and other types", () => {
    expect(effectiveSeverity("FOCUS_LOST", null)).toBe("LOW");
    expect(effectiveSeverity("GAZE_AWAY", 600_000)).toBe("LOW");
    expect(effectiveSeverity("TAB_HIDDEN", 1)).toBe("HIGH");
  });
});
