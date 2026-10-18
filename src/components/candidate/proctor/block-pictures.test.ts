import { describe, expect, it } from "vitest";
import { ILLUSTRATION_NAMES } from "@/components/visual/illustrations";
import { checkPicture, RECOVER_PICTURE } from "./block-pictures";

describe("block screen pictures", () => {
  it("a connected second screen shows the unplugged monitor", () => {
    expect(checkPicture("blocked", "secondScreen", null)).toBe("secondScreen");
  });

  it("an unsupported browser has no fitting picture, and so no mascot either", () => {
    expect(checkPicture("blocked", "browser", null)).toBeNull();
    expect(checkPicture("devices", null, "unsupported")).toBeNull();
  });

  it("camera and microphone problems show the camera frame", () => {
    expect(checkPicture("devices", null, "denied")).toBe("cameraFrame");
    expect(checkPicture("devices", null, "lost")).toBe("cameraFrame");
  });

  it("a wrong or refused screen share shows the share dialog", () => {
    expect(checkPicture("screen", null, "wrongSurface")).toBe("shareEntireScreen");
    expect(checkPicture("screen", null, "screenDenied")).toBe("shareEntireScreen");
  });

  it("steps that are going well show no block picture", () => {
    expect(checkPicture("devices", "asking", null)).toBeNull();
    expect(checkPicture("look", "faceNone", null)).toBeNull();
    expect(checkPicture("screen", "pickScreen", null)).toBeNull();
    expect(checkPicture("ready", null, null)).toBeNull();
  });

  it("every recover reason has a drawing that exists", () => {
    for (const name of Object.values(RECOVER_PICTURE)) expect(ILLUSTRATION_NAMES).toContain(name);
    expect(RECOVER_PICTURE).toEqual({ FULLSCREEN: "fullscreen", SCREEN: "shareEntireScreen", CAMERA: "cameraFrame" });
  });
});
