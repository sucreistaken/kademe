import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/**
 * The QUESTION_CHECK job with the model faked: no test reaches Gemini. The
 * spies are the logged call (`callJson`), the error mark on an existing run
 * (`markAiRunError`) and `recordAiRun`, which this job never calls itself
 * (no ai_runs row without a model call).
 */
let available = true;
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: () => ({
    name: "fake",
    available,
    model: "fake-model",
    completeJson: async () => {
      throw new Error("not used");
    },
  }),
}));
const callJson = vi.fn<typeof AiRuns.callJson>();
const recordAiRun = vi.fn<typeof AiRuns.recordAiRun>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  recordAiRun: (...a: Parameters<typeof AiRuns.recordAiRun>) => recordAiRun(...a),
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
}));

import { runQuestionCheck } from "./question-check-job";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OPENING = "33333333-3333-4333-8333-333333333333";
const A1 = "44444444-4444-4444-8444-444444444444";

const input = {
  orgId: ORG,
  userId: USER,
  openingId: OPENING,
  activities: [{ id: A1, prompt: { tr: "Bu harika ürünü neden seviyorsun ve ekibe nasıl uyarsın?", en: "" } }],
  teamLocale: "tr" as const,
};

const reply = (text: string, runId = "run-1") => ({
  response: { text, model: "fake-model", inputTokens: 10, outputTokens: 5, costUsd: 0, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
  runId,
});
const good = JSON.stringify({ findings: [{ activityId: A1, kind: "LEADING", excerpt: "Bu harika ürünü", note: "Övgüyü çıkar." }] });

beforeEach(() => {
  available = true;
  callJson.mockReset();
  recordAiRun.mockReset();
  markAiRunError.mockReset();
});

describe("runQuestionCheck", () => {
  it("answers UNCONFIGURED without any call or ai_runs row when no AI is connected", async () => {
    available = false;
    expect(await runQuestionCheck(input)).toEqual({ status: "UNCONFIGURED" });
    expect(callJson).not.toHaveBeenCalled();
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("does not call the model when there is no question with text", async () => {
    expect(await runQuestionCheck({ ...input, activities: [] })).toEqual({ status: "OK", findings: [] });
    expect(callJson).not.toHaveBeenCalled();
  });

  it("makes one logged QUESTION_CHECK call for this opening and user, in the team language", async () => {
    callJson.mockResolvedValueOnce(reply(good));
    const result = await runQuestionCheck({ ...input, teamLocale: "en" });
    expect(result).toEqual({ status: "OK", findings: [{ activityId: A1, kind: "LEADING", excerpt: "Bu harika ürünü", note: "Övgüyü çıkar.", source: "AI" }] });
    expect(callJson).toHaveBeenCalledTimes(1);
    const [schemaName, , messages, meta] = callJson.mock.calls[0];
    expect(schemaName).toBe("kademe_question_check");
    expect(meta).toEqual({ orgId: ORG, purpose: "QUESTION_CHECK", inputRef: OPENING, requestedBy: USER });
    expect(messages[1].content).toMatch(/Team language: English/);
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(markAiRunError).not.toHaveBeenCalled();
  });

  it("sends an unusable answer back once and marks that run, without a row of its own", async () => {
    callJson.mockResolvedValueOnce(reply("no json here", "run-1")).mockResolvedValueOnce(reply(good, "run-2"));
    const result = await runQuestionCheck(input);
    expect(result.status).toBe("OK");
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError).toHaveBeenCalledTimes(1);
    expect(markAiRunError.mock.calls[0][0]).toBe("run-1");
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("answers SCHEMA_FAILED after one repair, and marks both runs", async () => {
    callJson.mockResolvedValueOnce(reply("{}", "run-1")).mockResolvedValueOnce(reply("{}", "run-2"));
    expect(await runQuestionCheck(input)).toEqual({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError.mock.calls.map((c) => c[0])).toEqual(["run-1", "run-2"]);
  });

  it("answers PROVIDER_FAILED when the call throws (callJson has logged it)", async () => {
    callJson.mockRejectedValueOnce(new Error("gemini 503"));
    expect(await runQuestionCheck(input)).toEqual({ status: "FAILED", code: "PROVIDER_FAILED" });
    expect(callJson).toHaveBeenCalledTimes(1);
    expect(recordAiRun).not.toHaveBeenCalled();
  });
});
