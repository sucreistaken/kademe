import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/**
 * The anchor draft job with the model faked: no test reaches Gemini. The spies
 * are the logged call (`callJson`), the error mark on an existing run
 * (`markAiRunError`) and `recordAiRun`, which this job must never call itself.
 */
let available = true;
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: () => ({ name: "fake", available, model: "fake-model", completeJson: async () => { throw new Error("not used"); } }),
}));
const callJson = vi.fn<typeof AiRuns.callJson>();
const recordAiRun = vi.fn<typeof AiRuns.recordAiRun>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  recordAiRun: (...a: Parameters<typeof AiRuns.recordAiRun>) => recordAiRun(...a),
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
}));

import { draftAnchors } from "./anchor-draft-job";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const COMP = "33333333-3333-4333-8333-333333333333";
const request = { name: { tr: "İletişim", en: "Communication" }, description: { tr: "", en: "" }, levels: [] };
const answer = (over: Record<string, string> = {}) =>
  JSON.stringify({
    level1Tr: "Soruyu cevaplamıyor.",
    level1En: "Does not answer.",
    level2Tr: "",
    level2En: "",
    level3Tr: "Ana fikri söylüyor.",
    level3En: "States the point.",
    level4Tr: "",
    level4En: "",
    level5Tr: "Özetliyor.",
    level5En: "Summarises.",
    ...over,
  });
const reply = (text: string, runId = "run") => ({
  runId,
  response: { text, model: "gemini-test", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
});

beforeEach(() => {
  available = true;
  callJson.mockReset();
  recordAiRun.mockReset();
  recordAiRun.mockResolvedValue("row");
  markAiRunError.mockReset();
  markAiRunError.mockResolvedValue(undefined);
});

describe("draftAnchors", () => {
  it("makes no call and writes no ai_runs row when no AI is connected", async () => {
    available = false;
    expect(await draftAnchors(ORG, USER, COMP, request)).toEqual({ status: "UNCONFIGURED" });
    expect(callJson).not.toHaveBeenCalled();
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("returns the proposal of one logged ANCHOR_DRAFT call", async () => {
    callJson.mockResolvedValueOnce(reply(answer()));
    const result = await draftAnchors(ORG, USER, COMP, request);
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.anchors[3]).toEqual({ tr: "Ana fikri söylüyor.", en: "States the point." });
    expect(callJson).toHaveBeenCalledTimes(1);
    const [schemaName, , messages, meta] = callJson.mock.calls[0];
    expect(schemaName).toBe("kademe_anchor_draft");
    expect(messages[1].content).toContain("İletişim");
    expect(meta).toEqual({ orgId: ORG, purpose: "ANCHOR_DRAFT", inputRef: COMP, requestedBy: USER });
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("repairs once with the broken answer and the reason, and marks the broken run", async () => {
    callJson.mockResolvedValueOnce(reply("not json", "run-1")).mockResolvedValueOnce(reply(answer(), "run-2"));
    expect((await draftAnchors(ORG, USER, COMP, request)).status).toBe("OK");
    expect(markAiRunError.mock.calls).toEqual([["run-1", "invalid answer: no JSON object in the answer"]]);
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(callJson).toHaveBeenCalledTimes(2);
    const repair = callJson.mock.calls[1][2];
    expect(repair.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(repair[2].content).toBe("not json");
    expect(repair[3].content).toContain("no JSON object");
  });

  it("gives up after the repair, marks both runs invalid and inserts no row without a call", async () => {
    callJson
      .mockResolvedValueOnce(reply(answer({ level3Tr: "", level3En: "" }), "run-1"))
      .mockResolvedValueOnce(reply(answer({ level5Tr: "", level5En: "" }), "run-2"));
    expect(await draftAnchors(ORG, USER, COMP, request)).toEqual({ status: "FAILED" });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(markAiRunError.mock.calls).toEqual([
      ["run-1", "invalid answer: levels 3 are empty"],
      ["run-2", "repair still invalid: levels 5 are empty"],
    ]);
  });

  it("reports a failed call as FAILED; callJson has already logged it", async () => {
    callJson.mockRejectedValueOnce(new Error("HTTP 503"));
    expect(await draftAnchors(ORG, USER, COMP, request)).toEqual({ status: "FAILED" });
    expect(callJson).toHaveBeenCalledTimes(1);
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(markAiRunError).not.toHaveBeenCalled();
  });
});
