import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/** The HIRING_REVISE jobs with the model faked: no test reaches Gemini. */
let available = true;
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: () => ({ name: "fake", available, model: "fake-model", completeJson: async () => ({}) }),
}));
const callJson = vi.fn<typeof AiRuns.callJson>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  recordAiRun: async () => "row",
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
}));

import { reviseHiringActivity, reviseHiringDraft } from "./revise-job";

const KEPT = "11111111-1111-4111-8111-111111111111";
const reply = (text: string, runId = "run") => ({
  runId,
  response: { text, model: "gemini-test", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
});
const activity = (over: Record<string, unknown> = {}) => ({
  key: "s1q1",
  type: "VIDEO",
  promptTr: "Trafik kurallarını bir öğrenciye nasıl anlatırsın?",
  promptEn: "",
  purpose: "",
  expectedBehaviours: [],
  redFlags: [],
  example1: "",
  example3: "",
  example5: "",
  competencyKeys: ["c1"],
  thinkSeconds: 60,
  answerSeconds: 120,
  quote: "",
  ...over,
});
const competency = { key: "c1", libraryId: KEPT, nameTr: "İletişim", nameEn: "", descriptionTr: "", descriptionEn: "", anchor1Tr: "", anchor1En: "", anchor3Tr: "", anchor3En: "", anchor5Tr: "", anchor5En: "", quote: "" };
const draft = (duration = 480) => ({
  stages: [{ key: "s1", nameTr: "Anlatım", nameEn: "", descriptionTr: "", descriptionEn: "", purpose: "", durationSeconds: duration, quote: "", activities: [activity()] }],
  competencies: [competency],
});
const context = {
  orgId: "o1",
  userId: "u1",
  openingId: "op1",
  positionName: "Sürüş eğitmeni",
  jobAd: "İlan.",
  instruction: "Trafik kuralları sorusu ekle",
  locales: ["tr" as const],
  teamLocale: "tr" as const,
  // The draft measures KEPT although it is no longer in the active library list: it stays allowed.
  library: [],
};

beforeEach(() => {
  available = true;
  callJson.mockReset();
  markAiRunError.mockReset();
  markAiRunError.mockResolvedValue(undefined);
});

describe("reviseHiringDraft", () => {
  it("logs a HIRING_REVISE call against the opening and needs no quote from the ad", async () => {
    callJson.mockResolvedValueOnce(reply(JSON.stringify(draft())));
    const result = await reviseHiringDraft({ ...context, current: draft() as never });
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.draft.competencies[0].libraryId).toBe(KEPT);
    expect(callJson.mock.calls[0][3]).toEqual({ orgId: "o1", purpose: "HIRING_REVISE", inputRef: "op1", requestedBy: "u1" });
  });

  it("sends a revision over the time budget back once", async () => {
    const long = { ...draft(), stages: [0, 1, 2].map((i) => ({ ...draft(900).stages[0], key: `s${i}` })) };
    callJson.mockResolvedValueOnce(reply(JSON.stringify(long), "run-1")).mockResolvedValueOnce(reply(JSON.stringify(draft()), "run-2"));
    expect(await reviseHiringDraft({ ...context, current: draft() as never })).toMatchObject({ status: "OK", budgetWarning: null });
    expect(markAiRunError.mock.calls[0][0]).toBe("run-1");
  });

  it("makes no call without an AI", async () => {
    available = false;
    expect(await reviseHiringDraft({ ...context, current: draft() as never })).toEqual({ status: "UNCONFIGURED" });
    expect(callJson).not.toHaveBeenCalled();
  });
});

describe("reviseHiringActivity", () => {
  it("returns the one question and the competencies it measures", async () => {
    callJson.mockResolvedValueOnce(reply(JSON.stringify({ activity: activity({ promptTr: "Daha kolay soru" }), competencies: [competency] })));
    const result = await reviseHiringActivity({ ...context, stageName: "Anlatım", activity: activity() as never, competencies: [competency] });
    expect(result).toMatchObject({ status: "OK", revision: { activity: { promptTr: "Daha kolay soru", competencyKeys: ["c1"] }, competencies: [{ libraryId: KEPT }] } });
    expect(callJson.mock.calls[0][0]).toBe("kademe_hiring_revise_activity");
    expect(callJson.mock.calls[0][3]).toMatchObject({ purpose: "HIRING_REVISE" });
  });

  it("fails after one repair on a choice question", async () => {
    const bad = JSON.stringify({ activity: activity({ type: "SINGLE_CHOICE" }), competencies: [] });
    callJson.mockResolvedValueOnce(reply(bad, "r1")).mockResolvedValueOnce(reply(bad, "r2"));
    expect(await reviseHiringActivity({ ...context, stageName: "", activity: activity() as never, competencies: [] })).toEqual({ status: "FAILED", code: "SCHEMA_FAILED" });
  });
});
