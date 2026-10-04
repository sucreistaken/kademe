import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/** The shared call -> parse -> one repair flow, with the model and ai_runs faked. */
const callJson = vi.fn<typeof AiRuns.callJson>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
const recordAiRun = vi.fn<typeof AiRuns.recordAiRun>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
  recordAiRun: (...a: Parameters<typeof AiRuns.recordAiRun>) => recordAiRun(...a),
}));

import { runWithRepair } from "./ai-repair";

const meta = { orgId: "org", purpose: "ANCHOR_DRAFT" as const, inputRef: "comp", requestedBy: "user" };
const reply = (text: string, runId: string) => ({
  runId,
  response: { text, model: "m", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
});
const parse = (text: string) => (text === "good" ? { ok: true as const, value: 42 } : { ok: false as const, problem: `bad: ${text}` });
const run = () => runWithRepair({ schemaName: "s", jsonSchema: {}, messages: [{ role: "user", content: "q" }], meta, parse });

beforeEach(() => {
  callJson.mockReset();
  markAiRunError.mockReset();
  recordAiRun.mockReset();
  markAiRunError.mockResolvedValue(undefined);
});

describe("runWithRepair", () => {
  it("returns a valid first answer with its run id and marks nothing", async () => {
    callJson.mockResolvedValueOnce(reply("good", "r1"));
    expect(await run()).toEqual({ ok: true, value: 42, runId: "r1" });
    expect(callJson).toHaveBeenCalledTimes(1);
    expect(markAiRunError).not.toHaveBeenCalled();
  });

  it("marks the first run invalid, repairs once and returns the repaired answer", async () => {
    callJson.mockResolvedValueOnce(reply("broken", "r1")).mockResolvedValueOnce(reply("good", "r2"));
    expect(await run()).toEqual({ ok: true, value: 42, runId: "r2" });
    expect(markAiRunError.mock.calls).toEqual([["r1", "invalid answer: bad: broken"]]);
    const repair = callJson.mock.calls[1][2];
    expect(repair.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(repair[1].content).toBe("broken");
    expect(repair[2].content).toContain("bad: broken");
    expect(callJson.mock.calls[1][3]).toBe(meta);
  });

  it("marks both runs and inserts no row of its own when the repair is still invalid", async () => {
    callJson.mockResolvedValueOnce(reply("broken", "r1")).mockResolvedValueOnce(reply("worse", "r2"));
    expect(await run()).toEqual({ ok: false, problem: "bad: worse" });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError.mock.calls).toEqual([
      ["r1", "invalid answer: bad: broken"],
      ["r2", "repair still invalid: bad: worse"],
    ]);
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("lets a failed call through; callJson has already logged it", async () => {
    callJson.mockResolvedValueOnce(reply("broken", "r1")).mockRejectedValueOnce(new Error("HTTP 503"));
    await expect(run()).rejects.toThrow("HTTP 503");
    expect(markAiRunError.mock.calls).toEqual([["r1", "invalid answer: bad: broken"]]);
    expect(recordAiRun).not.toHaveBeenCalled();
  });
});
