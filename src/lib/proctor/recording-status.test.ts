import { describe, expect, it } from "vitest";
import { finishUploadPhase, recordingLabel } from "./recording-status";

describe("recordingLabel (the exam header)", () => {
  it("names everything that is recorded, the sound included", () => {
    expect(recordingLabel({ camera: true, audio: true, screen: true })).toBe("cameraAudioScreen");
    expect(recordingLabel({ camera: true, audio: false, screen: true })).toBe("cameraScreen");
    // STANDARD: camera and microphone the whole time, no screen.
    expect(recordingLabel({ camera: true, audio: true, screen: false })).toBe("cameraAudio");
    expect(recordingLabel({ camera: true, audio: false, screen: false })).toBe("camera");
    expect(recordingLabel({ camera: false, audio: false, screen: true })).toBe("screen");
  });

  it("says nothing about recording when nothing records (old consent, proctoring off)", () => {
    expect(recordingLabel(null)).toBeNull();
    expect(recordingLabel({ camera: false, audio: false, screen: false })).toBeNull();
  });
});

describe("finishUploadPhase (the last screen)", () => {
  const base = { recorded: true, stopped: true, pending: 0, timedOut: false };

  it("has nothing to say when this tab recorded nothing", () => {
    expect(finishUploadPhase({ ...base, recorded: false, stopped: false, pending: 3 })).toBe("none");
  });

  it("asks to keep the tab open while the last segments are cut and uploaded", () => {
    // The engine is still cutting the last segment: not done even with an empty queue.
    expect(finishUploadPhase({ ...base, stopped: false })).toBe("sending");
    expect(finishUploadPhase({ ...base, pending: 2 })).toBe("sending");
  });

  it("says the upload is slow once the bounded wait ran out, and done once the queue is empty", () => {
    expect(finishUploadPhase({ ...base, pending: 2, timedOut: true })).toBe("slow");
    // The queue keeps going after the wait: when it empties, the screen says so.
    expect(finishUploadPhase({ ...base, pending: 0, timedOut: true })).toBe("done");
    expect(finishUploadPhase(base)).toBe("done");
  });
});
