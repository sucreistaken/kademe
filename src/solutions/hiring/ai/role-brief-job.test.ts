import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/** The HIRING_ROLE_BRIEF job with the model faked: no test reaches Gemini. */
let available = true;
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: () => ({ name: "fake", available, model: "fake-model", completeJson: async () => ({}) }),
}));
const callJson = vi.fn<typeof AiRuns.callJson>();
const recordAiRun = vi.fn<typeof AiRuns.recordAiRun>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  recordAiRun: (...a: Parameters<typeof AiRuns.recordAiRun>) => recordAiRun(...a),
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
}));

import { generateRoleBrief } from "./role-brief-job";

const input = { orgId: "o1", userId: "u1", positionName: "Sürüş eğitmeni", text: "sürüş eğitmeni birini arıyorum", rounds: [] };
const reply = (text: string, runId = "run") => ({
  runId,
  response: { text, model: "gemini-test", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
});
const questions = JSON.stringify({ kind: "questions", questions: [{ key: "ehliyet", text: "Hangi ehliyet sınıfı?", options: ["B", "C"], allowFree: true }], summary: [], jobAd: "" });
const brief = (length: number) => JSON.stringify({ kind: "brief", questions: [], summary: ["B sınıfı", "3 yıl", "Hafta içi"], jobAd: "Sürüş eğitmeni arıyoruz. ".repeat(Math.ceil(length / 25)).slice(0, length) });

beforeEach(() => {
  available = true;
  callJson.mockReset();
  markAiRunError.mockReset();
  markAiRunError.mockResolvedValue(undefined);
  recordAiRun.mockReset();
});

describe("generateRoleBrief", () => {
  it("makes no call without an AI", async () => {
    available = false;
    expect(await generateRoleBrief(input)).toEqual({ status: "UNCONFIGURED" });
    expect(callJson).not.toHaveBeenCalled();
  });

  it("logs one HIRING_ROLE_BRIEF call and returns its questions", async () => {
    callJson.mockResolvedValueOnce(reply(questions));
    const result = await generateRoleBrief(input);
    expect(result).toEqual({ status: "OK", result: { kind: "questions", questions: [{ key: "ehliyet", text: "Hangi ehliyet sınıfı?", options: ["B", "C"], allowFree: true }] } });
    const [schemaName, , messages, meta] = callJson.mock.calls[0];
    expect(schemaName).toBe("kademe_hiring_role_brief");
    expect(meta).toEqual({ orgId: "o1", purpose: "HIRING_ROLE_BRIEF", inputRef: null, requestedBy: "u1" });
    expect(messages[1].content).toContain("sürüş eğitmeni birini arıyorum");
  });

  it("sends a short first ad back once, and accepts the repaired one in the lenient range", async () => {
    callJson.mockResolvedValueOnce(reply(brief(350), "run-1")).mockResolvedValueOnce(reply(brief(350), "run-2"));
    const result = await generateRoleBrief(input);
    expect(result.status).toBe("OK");
    expect(markAiRunError.mock.calls.map((c) => c[0])).toEqual(["run-1"]);
    expect(markAiRunError.mock.calls[0][1]).toMatch(/"jobAd" is 3[45][0-9] characters/);
  });

  it("sends questions back at round six and fails when the repair still asks", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ questions: [{ key: `k${i}`, text: "?", options: [] }], answers: { [`k${i}`]: "x" } }));
    callJson.mockResolvedValueOnce(reply(questions, "run-1")).mockResolvedValueOnce(reply(questions, "run-2"));
    expect(await generateRoleBrief({ ...input, rounds: six })).toEqual({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(callJson).toHaveBeenCalledTimes(2);
  });

  it("reports a failed call as PROVIDER_FAILED", async () => {
    callJson.mockRejectedValueOnce(new Error("HTTP 503"));
    expect(await generateRoleBrief(input)).toEqual({ status: "FAILED", code: "PROVIDER_FAILED" });
  });
});
