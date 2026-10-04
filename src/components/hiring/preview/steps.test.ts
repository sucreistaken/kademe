import { describe, expect, it } from "vitest";
import type { CandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { announcementOf, primaryOf, progressOf, stepsOf } from "./steps";

/**
 * The candidate flow as a list of screens (HIRING-UX 6): what the one filled
 * button says, the progress text ("Aşama 2 / 3" only, beside the thin bar),
 * and what a screen reader hears when the screen changes.
 */
const t = (tr: string) => ({ tr, en: "" });
const activity = (id: string) => ({ id }) as CandidateVersion["stages"][number]["activities"][number];
const version = {
  totalSeconds: 1500,
  stages: [
    { id: "s1", name: t("Tanışma"), description: t(""), durationSeconds: 600, activities: [activity("a1"), activity("a2")] },
    { id: "s2", name: t("Vaka"), description: t(""), durationSeconds: 900, activities: [activity("b1")] },
  ],
} as CandidateVersion;

describe("candidate flow steps", () => {
  it("lists intro, each stage intro with its questions, and the end", () => {
    expect(stepsOf(version).map((s) => (s.kind === "activity" ? `q${s.stage}.${s.activity}` : s.kind === "stage" ? `s${s.stage}` : s.kind))).toEqual([
      "intro",
      "s0",
      "q0.0",
      "q0.1",
      "s1",
      "q1.0",
      "done",
    ]);
  });

  it("names the one filled button per screen; the end screen has none", () => {
    const labels = stepsOf(version).map((s) => primaryOf(version, s));
    expect(labels).toEqual(["start", "stageStart", "next", "finishStage", "stageStart", "finish", null]);
    expect(primaryOf({ stages: [], totalSeconds: 0 }, { kind: "intro" })).toBeNull();
  });

  it("shows progress as the stage only, and only inside a stage", () => {
    expect(stepsOf(version).map((s) => progressOf(version, s))).toEqual([null, { n: 1, total: 2 }, { n: 1, total: 2 }, { n: 1, total: 2 }, { n: 2, total: 2 }, { n: 2, total: 2 }, null]);
  });

  it("tells a screen reader where it is now: the stage and, on a question, which question", () => {
    expect(announcementOf(version, { kind: "intro" })).toEqual({ key: "announceIntro", values: {} });
    expect(announcementOf(version, { kind: "stage", stage: 1 })).toEqual({ key: "announceStage", values: { n: 2, total: 2 } });
    expect(announcementOf(version, { kind: "activity", stage: 0, activity: 1 })).toEqual({ key: "questionOf", values: { stage: 1, stages: 2, n: 2, total: 2 } });
    expect(announcementOf(version, { kind: "done" })).toEqual({ key: "doneTitle", values: {} });
  });
});
