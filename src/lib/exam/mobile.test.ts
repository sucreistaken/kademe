import { describe, expect, it } from "vitest";
import { PRESETS, policyFromPreset } from "@/lib/proctor/policy";
import { section, type BlueprintConfig } from "./blueprint";
import { COURSE_EXAM_TEMPLATES } from "./course/templates";
import { mobileAllowed } from "./mobile";
import { EXAM_TEMPLATES, webCheckTemplate } from "./templates";

/** A grammar-only, unwatched exam that asks for phones: the shape of the web check. */
const phoneExam = (over: Partial<BlueprintConfig> = {}): BlueprintConfig => ({
  version: 1,
  sections: [section("GRAMMAR", 25), section("WRITING", 10, { enabled: false }), section("SPEAKING", 6, { enabled: false })],
  difficultyOffset: 0,
  resultVisibility: "OVERALL",
  autoRelease: true,
  passRules: { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 },
  proctoring: policyFromPreset("OFF"),
  listening: { maxPlays: 2 },
  allowMobile: true,
  ...over,
});

describe("mobileAllowed (desktop only unless the exam asks and a phone can take it)", () => {
  it("lets an unwatched exam without writing or speaking that asks for phones run on one", () => {
    expect(mobileAllowed(phoneExam())).toBe(true);
  });

  it("is desktop only without the flag, or with it set to false", () => {
    expect(mobileAllowed(phoneExam({ allowMobile: undefined }))).toBe(false);
    expect(mobileAllowed(phoneExam({ allowMobile: false }))).toBe(false);
  });

  it("is desktop only for a watched exam, whatever the flag says", () => {
    expect(mobileAllowed(phoneExam({ proctoring: policyFromPreset("STANDARD") }))).toBe(false);
    expect(mobileAllowed(phoneExam({ proctoring: policyFromPreset("STRICT") }))).toBe(false);
    // The OFF label with a switch turned back on still watches.
    for (const on of ["camera", "microphone", "screenShare", "fullscreen"] as const) {
      expect(mobileAllowed(phoneExam({ proctoring: { ...policyFromPreset("OFF"), [on]: true } })), on).toBe(false);
    }
  });

  it("is desktop only once a writing or speaking section is enabled", () => {
    expect(mobileAllowed(phoneExam({ sections: [section("GRAMMAR", 25), section("WRITING", 10)] }))).toBe(false);
    expect(mobileAllowed(phoneExam({ sections: [section("GRAMMAR", 25), section("SPEAKING", 6)] }))).toBe(false);
    // Reading and listening are fine on a phone.
    expect(mobileAllowed(phoneExam({ sections: [section("READING", 18), section("LISTENING", 13)] }))).toBe(true);
  });

  it("only the web check runs on phones: every other ready exam stays desktop only", () => {
    expect(mobileAllowed(webCheckTemplate().config)).toBe(true);
    for (const t of [...EXAM_TEMPLATES, ...COURSE_EXAM_TEMPLATES]) expect(mobileAllowed(t.config), t.key).toBe(false);
    for (const t of [...EXAM_TEMPLATES, ...COURSE_EXAM_TEMPLATES]) expect(t.config.allowMobile, t.key).toBeUndefined();
  });

  it("the quick screen with the flag would still be desktop only: it watches the camera", () => {
    const quick = EXAM_TEMPLATES.find((t) => t.key === "quick-screen")!;
    expect(quick.config.proctoring).toEqual(PRESETS.STANDARD);
    expect(mobileAllowed({ ...quick.config, allowMobile: true })).toBe(false);
  });
});
