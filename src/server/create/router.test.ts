import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiJsonResponse } from "@/lib/ai";
import type * as AiRuns from "@/lib/ai-runs";
import type { Creator, CreatorValidation } from "@/solutions/types";

/** The router with the model faked: no test reaches a provider. */
const callJson = vi.fn<typeof AiRuns.callJson>();
const markAiRunError = vi.fn<typeof AiRuns.markAiRunError>();
vi.mock("@/lib/ai-runs", () => ({
  callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a),
  markAiRunError: (...a: Parameters<typeof AiRuns.markAiRunError>) => markAiRunError(...a),
}));

import { buildRouterMessages, decide, MAX_ROUNDS, parseRouterAnswer, routeRequest, routerJsonSchema, roundsAsked, type RouterAnswer } from "./router";

type Minutes = { minutes: number };
/** Has a documented default (40) once the rounds are used up. */
const exam: Creator<Minutes, Minutes> = {
  kind: "EXAM",
  capability: "blueprint:write",
  aiPurpose: null,
  label: { tr: "Sınav", en: "Exam" },
  routerGuide: "minutes (required): total minutes; 0 when not given.",
  paramsJsonSchema: { type: "object", additionalProperties: false, required: ["minutes"], properties: { minutes: { type: "integer" } } },
  validate(raw, _locale, opts): CreatorValidation<Minutes> {
    const minutes = (raw as { minutes?: unknown } | null)?.minutes;
    if (typeof minutes === "number" && minutes > 0) return { ok: true, params: { minutes } };
    if (opts.useDefaults) return { ok: true, params: { minutes: 40 } };
    return { ok: false, questions: [{ id: "minutes", text: "Kaç dakika?", choices: ["15", "40"] }] };
  },
  async draft(_ctx, params) {
    return { ok: true, draft: params };
  },
  async apply() {
    return { ok: false, code: "INVALID" };
  },
  async renderReview() {
    return null;
  },
};
type Named = { name: string };
/** Has no default for its required value. */
const position: Creator<Named, Named> = {
  kind: "POSITION",
  capability: "library:write",
  aiPurpose: null,
  label: { tr: "Pozisyon", en: "Position" },
  routerGuide: "name (required): the role.",
  paramsJsonSchema: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string" } } },
  validate(raw): CreatorValidation<Named> {
    const name = (raw as { name?: unknown } | null)?.name;
    if (typeof name === "string" && name.trim()) return { ok: true, params: { name } };
    return { ok: false, questions: [{ id: "name", text: "Pozisyonun adı ne?", choices: [] }] };
  },
  async draft(_ctx, params) {
    return { ok: true, draft: params };
  },
  async apply() {
    return { ok: false, code: "INVALID" };
  },
  async renderReview() {
    return null;
  },
};
const creators = [exam, position] as Creator[];

const answer = (over: Partial<RouterAnswer> = {}): RouterAnswer => ({ kind: "EXAM", params: {}, questions: [], summary: "B1 sınavı", ...over });
const reply = (body: unknown, runId = "run") => ({
  runId,
  response: { text: JSON.stringify(body), model: "fake", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } satisfies AiJsonResponse,
});
const call = { orgId: "o1", userId: "u1", draftId: "d1", request: "B1 sınavı", rounds: [], locale: "tr" as const, creators };

beforeEach(() => {
  callJson.mockReset();
  markAiRunError.mockReset();
  markAiRunError.mockResolvedValue(undefined);
});

describe("router schema and prompt", () => {
  it("offers only the creators given, plus UNSUPPORTED, with one params object per creator", () => {
    const schema = routerJsonSchema([exam] as Creator[]) as { properties: { kind: { enum: string[] }; params: { properties: Record<string, unknown>; required: string[] } } };
    expect(schema.properties.kind.enum).toEqual(["EXAM", "UNSUPPORTED"]);
    expect(Object.keys(schema.properties.params.properties)).toEqual(["EXAM"]);
    expect(schema.properties.params.required).toEqual(["EXAM"]);
  });

  it("quotes the request, the answers and the changes, and names a fixed kind", () => {
    const messages = buildRouterMessages({
      request: "B1 sınavı",
      rounds: [
        { questions: [{ id: "minutes", text: "Kaç dakika?", choices: [] }, { id: "skills", text: "Hangi beceriler?", choices: [] }], answers: { minutes: "40" } },
        { questions: [], answers: {}, change: "dinlemeyi çıkar" },
      ],
      locale: "tr",
      creators,
      fixedKind: "EXAM",
    });
    expect(messages[0].content).toContain(exam.routerGuide);
    expect(messages[0].content).toContain(position.routerGuide);
    expect(messages[1].content).toContain('"""\nB1 sınavı\n"""');
    expect(messages[1].content).toContain("- [minutes] Kaç dakika? -> 40");
    expect(messages[1].content).toContain("- [skills] Hangi beceriler? -> (no answer)");
    expect(messages[1].content).toContain("- dinlemeyi çıkar");
    expect(messages[1].content).toContain("The kind is fixed: EXAM.");
    expect(JSON.stringify(messages)).not.toContain("\u2014");
  });

  it("counts only rounds that asked something", () => {
    expect(roundsAsked([{ questions: [{ id: "a", text: "a", choices: [] }], answers: {} }, { questions: [], answers: {}, change: "x" }])).toBe(1);
  });
});

describe("parseRouterAnswer", () => {
  it("refuses a kind that was not offered", () => {
    const parsed = parseRouterAnswer(JSON.stringify({ kind: "QUESTION_SET", params: {}, questions: [], summary: "" }), creators);
    expect(parsed).toEqual({ ok: false, problem: "kind QUESTION_SET is not one of EXAM, POSITION, UNSUPPORTED" });
  });

  it("keeps the chosen kind's params, at most 3 questions and no em dash", () => {
    const parsed = parseRouterAnswer(
      JSON.stringify({
        kind: "EXAM",
        params: { EXAM: { minutes: 40 }, POSITION: { name: "" } },
        questions: [1, 2, 3, 4].map((i) => ({ id: `q${i}`, text: `Soru ${i} \u2014 kısa`, choices: ["a", "b", "c", "d", "e"] })),
        summary: "B1 \u2014 40 dk",
      }),
      creators,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.params).toEqual({ minutes: 40 });
    expect(parsed.value.questions).toHaveLength(3);
    expect(parsed.value.questions[0]).toEqual({ id: "q1", text: "Soru 1, kısa", choices: ["a", "b", "c", "d"] });
    expect(parsed.value.summary).toBe("B1, 40 dk");
  });
});

describe("decide", () => {
  it("turns a missing value into a question even when the AI asked none", () => {
    expect(decide(answer(), creators, { roundsAsked: 0, locale: "tr" })).toEqual({
      status: "ASKING",
      kind: "EXAM",
      questions: [{ id: "minutes", text: "Kaç dakika?", choices: ["15", "40"] }],
      summary: "B1 sınavı",
    });
  });

  it("puts the validator's questions first, drops repeats and keeps at most 3", () => {
    const ai = [
      { id: "minutes", text: "Süre?", choices: [] },
      { id: "a", text: "A?", choices: [] },
      { id: "b", text: "B?", choices: [] },
      { id: "c", text: "C?", choices: [] },
    ];
    const decision = decide(answer({ questions: ai }), creators, { roundsAsked: 1, locale: "tr" });
    expect(decision.status).toBe("ASKING");
    if (decision.status !== "ASKING") return;
    expect(decision.questions.map((q) => q.id)).toEqual(["minutes", "a", "b"]);
    expect(decision.questions[0].text).toBe("Kaç dakika?");
  });

  it("asks what the AI found unclear while rounds are left, even when the params are valid", () => {
    const decision = decide(answer({ params: { minutes: 40 }, questions: [{ id: "topic", text: "Konu?", choices: [] }] }), creators, { roundsAsked: 0, locale: "tr" });
    expect(decision.status).toBe("ASKING");
  });

  it("is ready when the params are valid and nothing is asked", () => {
    expect(decide(answer({ params: { minutes: 40 } }), creators, { roundsAsked: 0, locale: "tr" })).toEqual({ status: "READY", kind: "EXAM", params: { minutes: 40 }, summary: "B1 sınavı" });
  });

  it("takes the documented default after round 2 and asks nothing more", () => {
    const decision = decide(answer({ questions: [{ id: "topic", text: "Konu?", choices: [] }] }), creators, { roundsAsked: MAX_ROUNDS, locale: "tr" });
    expect(decision).toEqual({ status: "READY", kind: "EXAM", params: { minutes: 40 }, summary: "B1 sınavı" });
  });

  it("stops with what it needs after round 2 when the value has no default", () => {
    expect(decide(answer({ kind: "POSITION" }), creators, { roundsAsked: MAX_ROUNDS, locale: "tr" })).toEqual({
      status: "STUCK",
      kind: "POSITION",
      missing: [{ id: "name", text: "Pozisyonun adı ne?", choices: [] }],
      summary: "B1 sınavı",
    });
  });

  it("passes UNSUPPORTED through without a retry", () => {
    expect(decide(answer({ kind: "UNSUPPORTED" }), creators, { roundsAsked: 0, locale: "tr" })).toEqual({ status: "UNSUPPORTED", summary: "B1 sınavı" });
  });
});

describe("routeRequest", () => {
  it("logs one CREATE_ROUTER call against the draft and decides", async () => {
    callJson.mockResolvedValueOnce(reply({ kind: "EXAM", params: { EXAM: { minutes: 40 }, POSITION: { name: "" } }, questions: [], summary: "B1, 40 dk" }));
    expect(await routeRequest(call)).toEqual({ status: "READY", kind: "EXAM", params: { minutes: 40 }, summary: "B1, 40 dk" });
    expect(callJson).toHaveBeenCalledTimes(1);
    const [schemaName, , , meta] = callJson.mock.calls[0];
    expect(schemaName).toBe("kademe_create_router");
    expect(meta).toEqual({ orgId: "o1", purpose: "CREATE_ROUTER", inputRef: "creation_draft:d1", requestedBy: "u1" });
  });

  it("repairs once, then gives up as FAILED with both runs marked", async () => {
    callJson.mockResolvedValueOnce(reply({ kind: "NOPE" }, "r1")).mockResolvedValueOnce(reply({ kind: "NOPE" }, "r2"));
    expect(await routeRequest(call)).toEqual({ status: "FAILED" });
    expect(callJson).toHaveBeenCalledTimes(2);
    expect(markAiRunError.mock.calls.map(([runId]) => runId)).toEqual(["r1", "r2"]);
  });

  it("answers AI_UNAVAILABLE when no provider is configured", async () => {
    callJson.mockRejectedValueOnce(new Error("AI_UNAVAILABLE"));
    expect(await routeRequest(call)).toEqual({ status: "AI_UNAVAILABLE" });
  });

  it("answers FAILED when the provider call throws", async () => {
    callJson.mockRejectedValueOnce(new Error("HTTP 500"));
    expect(await routeRequest(call)).toEqual({ status: "FAILED" });
  });

  it("never opens a question round for a fixed kind (a change request)", async () => {
    callJson.mockResolvedValueOnce(reply({ kind: "EXAM", params: { EXAM: { minutes: 0 } }, questions: [{ id: "x", text: "X?", choices: [] }], summary: "s" }));
    expect(await routeRequest({ ...call, creators: [exam] as Creator[], fixedKind: "EXAM" })).toEqual({ status: "READY", kind: "EXAM", params: { minutes: 40 }, summary: "s" });
  });
});
