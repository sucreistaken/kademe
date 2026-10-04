import { describe, expect, it } from "vitest";
import { buildRepairMessages, parseModelJson, withoutEmDash } from "./ai-json";

describe("model JSON packaging", () => {
  it("unwraps a code fence and trims chatter around the object", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseModelJson('Here you go: {"a":2} hope it helps')).toEqual({ ok: true, value: { a: 2 } });
  });

  it("reports an answer with no object at all", () => {
    expect(parseModelJson("no json here").ok).toBe(false);
  });

  it("replaces the em dash, which this product never prints", () => {
    expect(withoutEmDash("Somut \u2014 ölçülebilir")).toBe("Somut, ölçülebilir");
  });

  it("sends the broken answer back once with the reason", () => {
    const messages = buildRepairMessages([{ role: "user", content: "q" }], "broken", "missing level3Tr");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[2].content).toContain("missing level3Tr");
  });
});
