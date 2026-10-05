import { describe, expect, it } from "vitest";
import { candidateSafe } from "@/lib/candidate-safe";
import { buildCandidateState, type StateInput } from "./candidate-state";
import { activity, content, stage } from "./test-fixtures";

const SECRET = "TEAMSECRET";
const VISIBLE = "LEAKVISIBLE";
const COMP = "77777777-7777-4777-8777-777777777777";
const T0 = new Date("2026-10-05T09:00:00.000Z");

const secretStages = content([
  stage(
    "s1",
    [
      activity("a1", {
        orderIndex: 0,
        prompt: { tr: `${VISIBLE}_PROMPT`, en: "" },
        competencyIds: [COMP],
        internalQuestion: `${SECRET}_purpose`,
        expectedBehaviours: [`${SECRET}_behaviour`],
        redFlags: [`${SECRET}_flag`],
        managerNotes: `${SECRET}_note`,
        answerExamples: { 1: `${SECRET}_one`, 3: `${SECRET}_three`, 5: `${SECRET}_five` },
        config: { textAlternativeEnabled: true },
      }),
      activity("a2", {
        orderIndex: 1,
        type: "SINGLE_CHOICE",
        config: { choices: [{ id: "x", label: { tr: `${VISIBLE}_CHOICE`, en: "" }, correct: true }, { id: "y", label: { tr: "Hayır", en: "" } }] },
      }),
    ],
    { name: { tr: `${VISIBLE}_STAGE`, en: "" }, internalPurpose: `${SECRET}_stage`, durationSeconds: 600 },
  ),
  stage("s2", [activity("b1", { type: "LONG_TEXT", config: {} })], { orderIndex: 1, durationSeconds: 300 }),
]).stages;

function input(over: Partial<StateInput> = {}): StateInput {
  return {
    now: T0,
    orgName: "Örnek A.Ş.",
    contactEmail: "ekip@ornek.com",
    retention: { mediaDays: 180, candidateDays: 730 },
    opening: { status: "OPEN", positionName: "Ürün Tasarımcısı", finishSurveyEnabled: true, feedbackDays: 7, minEvaluations: 2 },
    version: { stages: secretStages, introTitle: null, introBody: null, practiceEnabled: true },
    invitation: {
      candidateName: "Elif Kaya",
      candidateEmail: "elif@example.com",
      extraTimePct: 0,
      reviewers: 3,
      consented: true,
      deviceChecked: true,
      started: false,
      completedAt: null,
      surveyAnswered: false,
    },
    runs: [],
    responses: [],
    ...over,
  };
}

const started = (over: Partial<StateInput> = {}) =>
  input({
    invitation: { ...input().invitation, started: true },
    runs: [{ stageId: "s1", startedAt: T0, deadlineAt: new Date(T0.getTime() + 600_000), submittedAt: null, closedByClock: false }],
    responses: [
      { stageId: "s1", activityId: "a1", payload: {}, takesUsed: 1, answeredAt: null, recording: { ref: "m1", status: "READY", durationMs: 4000 } },
      { stageId: "s1", activityId: "a2", payload: { choiceIds: ["x"] }, takesUsed: 0, answeredAt: null, recording: null },
    ],
    ...over,
  });

describe("the candidate state leaks nothing team-only (spec 7, positive control included)", () => {
  it("shows the visible sentinels and none of the team's", () => {
    const state = buildCandidateState(started());
    // Both the raw state (the builder alone must not leak) and what the last-line filter lets through.
    for (const sent of [JSON.stringify(state), JSON.stringify(candidateSafe(state))]) {
      // Positive control: the same search finds what the candidate must see.
      expect(sent).toContain(`${VISIBLE}_PROMPT`);
      expect(sent).toContain(`${VISIBLE}_STAGE`);
      expect(sent).toContain(`${VISIBLE}_CHOICE`);
      expect(sent).not.toContain(SECRET);
      expect(sent).not.toContain(COMP);
      expect(sent).not.toMatch(/correct|internal|expectedBehaviour|redFlag|managerNote|answerExample|competenc|autoScore/i);
    }
  });

  it("uses no field name the last-line filter would strip, so candidateSafe changes nothing", () => {
    for (const state of [buildCandidateState(input({ invitation: { ...input().invitation, consented: false } })), buildCandidateState(started())]) {
      expect(candidateSafe(state)).toEqual(state);
    }
  });
});

describe("where the candidate is", () => {
  it("walks consent, details, device check, then the first open stage", () => {
    expect(buildCandidateState(input({ invitation: { ...input().invitation, consented: false } })).step).toBe("CONSENT");
    expect(buildCandidateState(input({ invitation: { ...input().invitation, candidateEmail: null } })).step).toBe("INFO");
    expect(buildCandidateState(input({ invitation: { ...input().invitation, deviceChecked: false } })).step).toBe("CHECK");
    const state = buildCandidateState(input());
    expect(state).toMatchObject({ step: "STAGE", position: 1, path: "/stage/1" });
  });

  it("skips the device check when the version records nothing", () => {
    const textOnly = content([stage("s1", [activity("t", { type: "LONG_TEXT", config: {} })])]).stages;
    const state = buildCandidateState(input({ version: { ...input().version, stages: textOnly }, invitation: { ...input().invitation, deviceChecked: false } }));
    expect(state.step).toBe("STAGE");
    expect(state.devices).toEqual({ camera: false, microphone: false });
  });

  it("stops a candidate who has not started when the opening closes, but lets one inside finish", () => {
    expect(buildCandidateState(input({ opening: { ...input().opening, status: "CLOSED" } })).step).toBe("CLOSED");
    expect(buildCandidateState(started({ opening: { ...input().opening, status: "CLOSED" } })).step).toBe("STAGE");
  });

  it("is DONE once the attempt is complete, with the survey offered once", () => {
    const state = buildCandidateState(input({ invitation: { ...input().invitation, started: true, completedAt: T0 } }));
    expect(state.step).toBe("DONE");
    expect(state.path).toBe("/done");
    expect(state.finished).toEqual({ completedAt: T0.toISOString(), stagesDone: 0, feedbackBy: new Date(T0.getTime() + 7 * 86_400_000).toISOString(), survey: { enabled: true, answered: false } });
  });
});

describe("the running stage", () => {
  it("carries the server clock, the rules, and each answer with its state", () => {
    const state = buildCandidateState(started());
    expect(state.current).toMatchObject({
      position: 1,
      total: 2,
      seconds: 600,
      startedAt: T0.toISOString(),
      deadlineAt: new Date(T0.getTime() + 600_000).toISOString(),
      remainingMs: 600_000,
      autoSubmit: true,
      last: false,
      previous: null,
    });
    expect(state.current?.responses).toEqual([
      { activityId: "a1", text: "", choiceIds: [], usedTextAlternative: false, takesUsed: 1, recording: { ref: "m1", status: "READY", durationMs: 4000 }, file: null, answered: true, closed: false },
      { activityId: "a2", text: "", choiceIds: ["x"], usedTextAlternative: false, takesUsed: 0, recording: null, file: null, answered: true, closed: false },
    ]);
    expect(state.extraTimeLocked).toBe(true);
  });

  it("does not count a failed take as an answer", () => {
    const state = buildCandidateState(
      started({ responses: [{ stageId: "s1", activityId: "a1", payload: {}, takesUsed: 1, answeredAt: null, recording: { ref: "m1", status: "FAILED", durationMs: null } }] }),
    );
    expect(state.current?.responses[0]).toMatchObject({ recording: null, answered: false });
  });

  it("tells the next stage how the previous one ended, and stretches minutes by the extra time", () => {
    const state = buildCandidateState(
      input({
        invitation: { ...input().invitation, started: true, extraTimePct: 50 },
        runs: [{ stageId: "s1", startedAt: T0, deadlineAt: T0, submittedAt: T0, closedByClock: true }],
      }),
    );
    expect(state).toMatchObject({ step: "STAGE", position: 2 });
    expect(state.current).toMatchObject({ previous: { position: 1, closedByClock: true }, last: true, seconds: 450, startedAt: null, remainingMs: null });
    expect(state.stages.map((s) => [s.minutes, s.done])).toEqual([
      [15, true],
      [8, false],
    ]);
    expect(state.totalMinutes).toBe(23);
    expect(state.extraTimeLocked).toBe(false);
  });
});

describe("the grace is told, not hidden (C25)", () => {
  const graceStages = content([
    stage("s1", [activity("a1", { type: "LONG_TEXT", config: {} })], { durationSeconds: 600, graceSeconds: 60, onTimeout: "ALLOW_GRACE" }),
    stage("s2", [activity("b1", { type: "LONG_TEXT", config: {} })], { orderIndex: 1, durationSeconds: 300, graceSeconds: 90, onTimeout: "AUTO_SUBMIT" }),
  ]).stages;

  it("counts the grace in the minutes and exposes it on the running stage", () => {
    const state = buildCandidateState(
      input({
        version: { ...input().version, stages: graceStages },
        invitation: { ...input().invitation, started: true },
        runs: [{ stageId: "s1", startedAt: T0, deadlineAt: new Date(T0.getTime() + 660_000), submittedAt: null, closedByClock: false }],
      }),
    );
    expect(state.stages.map((s) => [s.minutes, s.graceSeconds])).toEqual([
      [11, 60],
      [5, 0],
    ]);
    expect(state.totalMinutes).toBe(16);
    // The clock shows the candidate's own seconds; the deadline already has the grace baked in.
    expect(state.current).toMatchObject({ seconds: 600, graceSeconds: 60, remainingMs: 660_000 });
  });

  it("exposes no grace for a stage whose timeout rule is not ALLOW_GRACE", () => {
    const state = buildCandidateState(input({ version: { ...input().version, stages: graceStages }, invitation: { ...input().invitation, started: true, extraTimePct: 25 }, runs: [{ stageId: "s1", startedAt: T0, deadlineAt: T0, submittedAt: T0, closedByClock: false }] }));
    expect(state.current).toMatchObject({ position: 2, graceSeconds: 0 });
  });
});

describe("how many people review the answers (Task 11 review ruling)", () => {
  const reviewersFor = (minEvaluations: number, assigned: number) =>
    buildCandidateState(input({ opening: { ...input().opening, minEvaluations }, invitation: { ...input().invitation, reviewers: assigned } })).reviewers;

  it("promises one person when the opening needs one, however large the panel", () => {
    expect(reviewersFor(1, 3)).toBe(1);
  });

  it("promises the opening's minimum, not the whole panel", () => {
    expect(reviewersFor(2, 4)).toBe(2);
  });

  it("never promises more people than the panel has", () => {
    expect(reviewersFor(3, 2)).toBe(2);
    expect(reviewersFor(2, 0)).toBe(0);
  });
});

describe("what is recorded follows the question types, not the payload (C24)", () => {
  it("lists video and audio from the version and no proctoring signal", () => {
    const state = buildCandidateState(started());
    expect(state.signals).toEqual(["VIDEO_ANSWER", "TECHNICAL"]);
    const textAnswerOnly = buildCandidateState(started({ responses: [{ stageId: "s1", activityId: "a1", payload: { text: "x", file: { name: "f.mp4", bytes: 1 } } as never, takesUsed: 0, answeredAt: null, recording: null }] }));
    expect(textAnswerOnly.signals).toEqual(["VIDEO_ANSWER", "TECHNICAL"]);
    expect(JSON.stringify(state.signals)).not.toMatch(/PROCTOR|SCREEN|FOCUS/i);
  });
});

describe("the response payload leaks no storage detail (spec 7)", () => {
  const fileStages = content([
    stage("s1", [
      activity("f1", { orderIndex: 0, type: "FILE_UPLOAD", config: { acceptedMimeTypes: ["application/pdf"] } }),
      activity("v1", { orderIndex: 1, type: "VIDEO" }),
    ]),
  ]).stages;

  it("shows the candidate's file name and size, the recording reference, and never the mime, asset id or pending upload", () => {
    const state = buildCandidateState(
      started({
        version: { ...input().version, stages: fileStages },
        responses: [
          {
            stageId: "s1",
            activityId: "f1",
            payload: {
              file: { name: "cv.pdf", bytes: 1234, mime: `application/${SECRET}_mime` },
              pendingFile: { assetId: `${SECRET}_asset`, name: "new.pdf", bytes: 99, mime: `application/${SECRET}_pending` },
            },
            takesUsed: 0,
            answeredAt: null,
            recording: null,
          },
          { stageId: "s1", activityId: "v1", payload: {}, takesUsed: 1, answeredAt: null, recording: { ref: "ref-opaque-1", status: "READY", durationMs: 1000 } },
        ],
      }),
    );
    expect(state.current?.responses[0]).toMatchObject({ activityId: "f1", file: { name: "cv.pdf", bytes: 1234 }, answered: true });
    expect(state.current?.responses[1]).toMatchObject({ activityId: "v1", recording: { ref: "ref-opaque-1", status: "READY", durationMs: 1000 } });
    for (const sent of [JSON.stringify(state), JSON.stringify(candidateSafe(state))]) {
      expect(sent).not.toContain(SECRET);
      expect(sent).not.toMatch(/assetId|pendingFile|"mime"/);
    }
    expect(candidateSafe(state)).toEqual(state);
  });
});

describe("how the previous stage ended", () => {
  it("says the clock closed it only when the clock did, not for a late hand submit under ALLOW_LATE", () => {
    const lateStages = content([
      stage("s1", [activity("a1", { type: "LONG_TEXT", config: {} })], { onTimeout: "ALLOW_LATE" }),
      stage("s2", [activity("b1", { type: "LONG_TEXT", config: {} })], { orderIndex: 1 }),
    ]).stages;
    const base = { ...input().invitation, started: true };
    const handLate = buildCandidateState(input({ version: { ...input().version, stages: lateStages }, invitation: base, runs: [{ stageId: "s1", startedAt: T0, deadlineAt: T0, submittedAt: T0, closedByClock: false }] }));
    expect(handLate.current?.previous).toEqual({ position: 1, closedByClock: false });
    const clock = buildCandidateState(input({ version: { ...input().version, stages: lateStages }, invitation: base, runs: [{ stageId: "s1", startedAt: T0, deadlineAt: T0, submittedAt: T0, closedByClock: true }] }));
    expect(clock.current?.previous).toEqual({ position: 1, closedByClock: true });
  });
});

describe("a DRAFT opening is not open", () => {
  it("stops a candidate who has not started, like a closed one, and lets one inside finish", () => {
    expect(buildCandidateState(input({ opening: { ...input().opening, status: "DRAFT" } })).step).toBe("CLOSED");
    expect(buildCandidateState(started({ opening: { ...input().opening, status: "DRAFT" } })).step).toBe("STAGE");
  });
});

describe("DONE always carries the finish (no null screen data)", () => {
  const submitted = (id: string) => ({ stageId: id, startedAt: T0, deadlineAt: T0, submittedAt: new Date(T0.getTime() + (id === "s1" ? 1000 : 5000)), closedByClock: false });

  it("falls back to the latest submit when every stage is done but completedAt is not written yet", () => {
    const state = buildCandidateState(input({ invitation: { ...input().invitation, started: true }, runs: [submitted("s1"), submitted("s2")] }));
    const at = new Date(T0.getTime() + 5000);
    expect(state.step).toBe("DONE");
    expect(state.finished).toEqual({ completedAt: at.toISOString(), stagesDone: 2, feedbackBy: new Date(at.getTime() + 7 * 86_400_000).toISOString(), survey: { enabled: true, answered: false } });
  });

  it("falls back to now for a version with no stages", () => {
    const state = buildCandidateState(input({ version: { ...input().version, stages: [] } }));
    expect(state.step).toBe("DONE");
    expect(state.current).toBeNull();
    expect(state.finished).toEqual({ completedAt: T0.toISOString(), stagesDone: 0, feedbackBy: new Date(T0.getTime() + 7 * 86_400_000).toISOString(), survey: { enabled: true, answered: false } });
  });

  it("is null only while the step is not DONE", () => {
    expect(buildCandidateState(input()).finished).toBeNull();
  });
});

