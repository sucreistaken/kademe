import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";

/**
 * The HIRING_DRAFT job with the model faked: no test reaches Gemini. The spies
 * are the logged call (`callJson`), the error mark on an existing run
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

import { generateHiringDraft } from "./draft-job";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OPENING = "33333333-3333-4333-8333-333333333333";
const LIB = "44444444-4444-4444-8444-444444444444";
const AD = "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz. Paydaşlara bulguları sade bir dille anlatabilmelisin. Veriyle karar verirsin.";

const input = {
  orgId: ORG,
  userId: USER,
  openingId: OPENING,
  positionName: "Ürün Tasarımcısı",
  jobAd: AD,
  locales: ["tr" as const],
  teamLocale: "tr" as const,
  library: [{ id: LIB, name: "İletişim", inProfile: true }],
};

const activity = (over: Record<string, unknown> = {}) => ({
  key: "a1",
  type: "VIDEO",
  promptTr: "Bir araştırma bulgusunu paydaşlara nasıl anlattığını anlat.",
  promptEn: "",
  purpose: "Bulguyu sade anlatma",
  expectedBehaviours: ["Ana bulguyu başta söyler"],
  redFlags: ["Jargona saklanır"],
  example1: "Bulguyu sıralamadan anlatır.",
  example3: "Bulguyu ve bir örneği verir.",
  example5: "Dinleyiciye göre ayarlar ve özetler.",
  competencyKeys: ["comm"],
  thinkSeconds: 60,
  answerSeconds: 120,
  quote: "Paydaşlara bulguları sade bir dille anlatabilmelisin",
  ...over,
});
const answer = (stageOver: Record<string, unknown> = {}, stages = 1) =>
  JSON.stringify({
    stages: Array.from({ length: stages }, (_, i) => ({
      key: `s${i}`,
      nameTr: "Araştırma",
      nameEn: "",
      descriptionTr: "",
      descriptionEn: "",
      purpose: "",
      durationSeconds: 480,
      quote: "kullanıcı araştırmasını yönetecek bir tasarımcı",
      activities: [activity()],
      ...stageOver,
    })),
    competencies: [
      {
        key: "comm",
        libraryId: LIB,
        nameTr: "İletişim",
        nameEn: "",
        descriptionTr: "",
        descriptionEn: "",
        anchor1Tr: "",
        anchor1En: "",
        anchor3Tr: "",
        anchor3En: "",
        anchor5Tr: "",
        anchor5En: "",
        quote: "",
      },
    ],
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

describe("generateHiringDraft", () => {
  it("takes an inputRef in place of an opening (Advanced create)", async () => {
    callJson.mockResolvedValueOnce(reply(answer()));
    const result = await generateHiringDraft({ ...input, openingId: undefined, inputRef: "creation_draft:d1" });
    expect(result.status).toBe("OK");
    expect(callJson.mock.calls[0][3]).toEqual({ orgId: ORG, purpose: "HIRING_DRAFT", inputRef: "creation_draft:d1", requestedBy: USER });
  });

  it("makes no call and writes no ai_runs row when no AI is connected", async () => {
    available = false;
    expect(await generateHiringDraft(input)).toEqual({ status: "UNCONFIGURED" });
    expect(callJson).not.toHaveBeenCalled();
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("returns the normalised draft of one logged HIRING_DRAFT call", async () => {
    callJson.mockResolvedValueOnce(reply(answer()));
    const result = await generateHiringDraft(input);
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.budgetWarning).toBeNull();
    expect(result.draft.stages[0].activities[0].competencyKeys).toEqual(["comm"]);
    expect(callJson).toHaveBeenCalledTimes(1);
    const [schemaName, schema, messages, meta] = callJson.mock.calls[0];
    expect(schemaName).toBe("kademe_hiring_draft");
    expect(schema).toHaveProperty("properties.stages");
    expect(messages[1].content).toContain(AD);
    expect(messages[1].content).toContain(LIB);
    expect(meta).toEqual({ orgId: ORG, purpose: "HIRING_DRAFT", inputRef: OPENING, requestedBy: USER });
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(markAiRunError).not.toHaveBeenCalled();
  });

  it("sends a draft over the time budget back once with the reason, and marks that run", async () => {
    callJson.mockResolvedValueOnce(reply(answer({ durationSeconds: 900 }, 3), "run-1")).mockResolvedValueOnce(reply(answer(), "run-2"));
    const result = await generateHiringDraft(input);
    expect(result).toMatchObject({ status: "OK", budgetWarning: null });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError).toHaveBeenCalledTimes(1);
    expect(markAiRunError.mock.calls[0][0]).toBe("run-1");
    expect(markAiRunError.mock.calls[0][1]).toMatch(/^invalid answer: Toplam süre 45 dakika/);
    const repair = callJson.mock.calls[1][2];
    expect(repair.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(repair[3].content).toContain("Toplam süre");
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("shows a repaired draft that is still over the budget, with the note, instead of throwing it away", async () => {
    const long = answer({ durationSeconds: 900 }, 3);
    callJson.mockResolvedValueOnce(reply(long, "run-1")).mockResolvedValueOnce(reply(long, "run-2"));
    const result = await generateHiringDraft(input);
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.budgetWarning).toMatch(/Toplam süre 45 dakika/);
    expect(result.draft.stages).toHaveLength(3);
    expect(markAiRunError.mock.calls.map((c) => c[0])).toEqual(["run-1"]);
  });

  it("asks again once when no stage quotes the job ad", async () => {
    callJson.mockResolvedValueOnce(reply(answer({ quote: "Bu cümle ilanda yok" }), "run-1")).mockResolvedValueOnce(reply(answer(), "run-2"));
    expect((await generateHiringDraft(input)).status).toBe("OK");
    expect(markAiRunError.mock.calls).toEqual([["run-1", "invalid answer: No stage quotes the job ad word for word. Copy each quote exactly from the job ad text."]]);
  });

  it("never accepts a choice question from the model", async () => {
    callJson.mockResolvedValueOnce(reply(answer({ activities: [activity({ type: "SINGLE_CHOICE" })] }), "run-1")).mockResolvedValueOnce(reply(answer({ activities: [activity({ type: "MULTI_CHOICE" })] }), "run-2"));
    expect(await generateHiringDraft(input)).toEqual({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(markAiRunError.mock.calls.map((c) => c[0])).toEqual(["run-1", "run-2"]);
    expect(markAiRunError.mock.calls[1][1]).toMatch(/^repair still invalid: stages\.0\.activities\.0\.type/);
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("gives up after one repair and inserts no row without a call", async () => {
    callJson.mockResolvedValueOnce(reply("not json", "run-1")).mockResolvedValueOnce(reply(JSON.stringify({ stages: [], competencies: [] }), "run-2"));
    expect(await generateHiringDraft(input)).toEqual({ status: "FAILED", code: "SCHEMA_FAILED" });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError.mock.calls).toEqual([
      ["run-1", "invalid answer: no JSON object in the answer"],
      ["run-2", expect.stringMatching(/^repair still invalid: stages/)],
    ]);
    expect(recordAiRun).not.toHaveBeenCalled();
  });

  it("reports a failed call as PROVIDER_FAILED; callJson has already logged it", async () => {
    callJson.mockRejectedValueOnce(new Error("HTTP 503"));
    expect(await generateHiringDraft(input)).toEqual({ status: "FAILED", code: "PROVIDER_FAILED" });
    expect(callJson).toHaveBeenCalledTimes(1);
    expect(recordAiRun).not.toHaveBeenCalled();
    expect(markAiRunError).not.toHaveBeenCalled();
  });
});
