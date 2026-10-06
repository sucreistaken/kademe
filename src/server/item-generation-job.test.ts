import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AiRuns from "@/lib/ai-runs";

const fake = vi.hoisted(() => ({ results: [] as unknown[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("@/db", async () => ({ db: (await import("@/server/create/test-fake-db")).proxyDb(fake) }));
const callJson = vi.fn<typeof AiRuns.callJson>();
vi.mock("@/lib/ai-runs", () => ({ callJson: (...a: Parameters<typeof AiRuns.callJson>) => callJson(...a) }));
vi.mock("@/lib/exam/item-generation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exam/item-generation")>()),
  buildGenerationMessages: () => [],
  parseGeneratedBatch: () => ({
    ok: true,
    warnings: [],
    itemErrors: [{ index: 2, problems: ["bad"] }],
    batch: {
      stimulus: null,
      items: [1, 2].map((n) => ({
        prompt: `Ich ___ müde (${n}).`,
        content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] },
        key: { kind: "CHOICE", correct: ["a"] },
        skillTag: "grammar.verb",
        explanation: "",
        within: "MID",
      })),
    },
  }),
}));

import { generateItems } from "./item-generation-job";

beforeEach(() => {
  fake.results = [];
  fake.calls = [];
  callJson.mockReset();
  callJson.mockResolvedValue({ runId: "r1", response: { text: "{}", model: "fake", inputTokens: 1, outputTokens: 1, costUsd: null, attempts: 1, transientErrors: [], fellBackTo: null } });
});

describe("generateItems", () => {
  it("returns the ids of the DRAFT items it wrote", async () => {
    // examples, earlier topics, then the items insert's returning()
    fake.results = [[], [], [{ id: "i1" }, { id: "i2" }]];
    const r = await generateItems("o1", "u1", { section: "GRAMMAR", level: "B1", itemType: "SINGLE_CHOICE", count: 2, withStimulus: false });
    expect(r).toEqual({ ok: true, created: 2, rejected: 1, stimulusId: null, itemIds: ["i1", "i2"] });
    const rows = fake.calls.find(([op]) => op === "values")![1][0] as Array<{ status: string; origin: string }>;
    expect(rows.map((x) => [x.status, x.origin])).toEqual([["DRAFT", "AI"], ["DRAFT", "AI"]]);
  });
});
