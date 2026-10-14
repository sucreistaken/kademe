import { describe, expect, it } from "vitest";
import { policyFromPreset } from "@/lib/proctor/policy";
import { BUDGETED_REVIEW_STATUSES, countsAgainstBudget, reviewClaim, shouldQueueReview } from "./review-gate";
import { CLAIMS } from "@/lib/exam/proctor-review";
import { PROCTOR_EVENT_TYPES, TAXONOMY } from "./taxonomy";

describe("reviewClaim", () => {
  it("knows what every reviewable flag needs to be seen, and nothing else is reviewed", () => {
    for (const type of PROCTOR_EVENT_TYPES) {
      if (TAXONOMY[type].aiReview) expect(reviewClaim(type), type).not.toBeNull();
      else expect(reviewClaim(type), type).toBeNull();
    }
  });

  it("agrees with the claims the reviewer prompt makes (screen frame or webcam frame)", () => {
    for (const type of PROCTOR_EVENT_TYPES) {
      const claim = reviewClaim(type);
      if (!claim) continue;
      expect(CLAIMS[type], type).toContain(claim === "SCREEN" ? "screen frame" : "webcam frame");
    }
  });
});

describe("shouldQueueReview", () => {
  it("under STANDARD (no screen share) reviews only what the camera can show", () => {
    const standard = policyFromPreset("STANDARD");
    expect(shouldQueueReview("TAB_HIDDEN", standard)).toBe(false);
    expect(shouldQueueReview("FOCUS_LOST", standard)).toBe(false);
    expect(shouldQueueReview("SECOND_SCREEN_DETECTED", standard)).toBe(false);
    expect(shouldQueueReview("PHONE_DETECTED", standard)).toBe(true);
    expect(shouldQueueReview("MULTIPLE_FACES", standard)).toBe(true);
    expect(shouldQueueReview("NO_FACE", standard)).toBe(true);
  });

  it("under STRICT reviews both kinds", () => {
    const strict = policyFromPreset("STRICT");
    expect(shouldQueueReview("TAB_HIDDEN", strict)).toBe(true);
    expect(shouldQueueReview("PHONE_DETECTED", strict)).toBe(true);
  });

  it("reviews no person claim without a camera, nothing without the second look, and never a flag that is not reviewable", () => {
    const screenOnly = { ...policyFromPreset("STRICT"), camera: false };
    expect(shouldQueueReview("PHONE_DETECTED", screenOnly)).toBe(false);
    expect(shouldQueueReview("TAB_HIDDEN", screenOnly)).toBe(true);
    expect(shouldQueueReview("PHONE_DETECTED", { ...policyFromPreset("STRICT"), aiSecondLook: false })).toBe(false);
    expect(shouldQueueReview("VOICE_DETECTED", policyFromPreset("STRICT"))).toBe(false);
  });
});

describe("the review budget", () => {
  it("counts reviews that made or may make a model call, not one skipped without frames", () => {
    expect(BUDGETED_REVIEW_STATUSES).toEqual(["QUEUED", "DONE", "FAILED"]);
    expect(countsAgainstBudget("QUEUED")).toBe(true);
    expect(countsAgainstBudget("DONE")).toBe(true);
    expect(countsAgainstBudget("FAILED")).toBe(true);
    expect(countsAgainstBudget("SKIPPED")).toBe(false);
  });
});
