import { describe, expect, it } from "vitest";
import { toCandidateVersion } from "./candidate-view";
import { devicesNeeded, estimatedMinutes, recordedSignals } from "./disclosure";
import { activity, content, stage } from "./test-fixtures";

const version = (types: Array<"VIDEO" | "AUDIO" | "LONG_TEXT">) =>
  toCandidateVersion(content([stage("s1", types.map((type, i) => activity(`a${i}`, { type, orderIndex: i })), { durationSeconds: 601 })]));

describe("what the landing says is recorded (HIRING-UX 7.2, A3)", () => {
  it("names video and audio answers only when the version has them, and always the technical log", () => {
    expect(recordedSignals(version(["VIDEO", "LONG_TEXT"]))).toEqual(["VIDEO_ANSWER", "TECHNICAL"]);
    expect(recordedSignals(version(["AUDIO"]))).toEqual(["AUDIO_ANSWER", "TECHNICAL"]);
    expect(recordedSignals(version(["LONG_TEXT"]))).toEqual(["TECHNICAL"]);
  });

  it("asks for the camera only for video and the microphone for video or audio", () => {
    expect(devicesNeeded(version(["VIDEO"]))).toEqual({ camera: true, microphone: true });
    expect(devicesNeeded(version(["AUDIO"]))).toEqual({ camera: false, microphone: true });
    expect(devicesNeeded(version(["LONG_TEXT"]))).toEqual({ camera: false, microphone: false });
  });

  it("estimates whole minutes with the chosen extra time", () => {
    expect(estimatedMinutes(version(["LONG_TEXT"]), 0)).toBe(11);
    expect(estimatedMinutes(version(["LONG_TEXT"]), 50)).toBe(16);
  });

  it("adds the grace of a stage that grants it, and only that stage (C25)", () => {
    const v = version(["LONG_TEXT"]);
    expect(estimatedMinutes(v, 0, { s1: 60 })).toBe(12);
    expect(estimatedMinutes(v, 50, { s1: 60 })).toBe(17);
    expect(estimatedMinutes(v, 0, { other: 600 })).toBe(11);
  });

  it("reflects the media kinds of the questions, never proctoring (C24)", () => {
    expect(recordedSignals(version(["VIDEO", "AUDIO", "LONG_TEXT"]))).toEqual(["VIDEO_ANSWER", "AUDIO_ANSWER", "TECHNICAL"]);
    const allTypes = recordedSignals(version(["VIDEO", "AUDIO", "LONG_TEXT"]));
    expect(allTypes.every((s) => ["VIDEO_ANSWER", "AUDIO_ANSWER", "TECHNICAL"].includes(s))).toBe(true);
    expect(JSON.stringify(allTypes)).not.toMatch(/PROCTOR|SCREEN|FULLSCREEN|FOCUS|PHOTO|FACE/i);
  });

  it("still names the recording when the team allows a written alternative", () => {
    const v = toCandidateVersion(content([stage("s1", [activity("a", { type: "VIDEO", config: { textAlternativeEnabled: true } })])]));
    expect(recordedSignals(v)).toEqual(["VIDEO_ANSWER", "TECHNICAL"]);
  });
});
