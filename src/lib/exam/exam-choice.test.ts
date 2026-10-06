import { describe, expect, it } from "vitest";
import { examChoiceValue, parseExamChoice } from "./exam-choice";

describe("exam choice", () => {
  it("round-trips a template and an own exam", () => {
    for (const c of [{ kind: "template", key: "level-check" }, { kind: "blueprint", id: "7d0f2c1e-0000-4000-8000-000000000001" }] as const) {
      expect(parseExamChoice(examChoiceValue(c))).toEqual(c);
    }
  });

  it.each(["", "level-check", "template:", "blueprint:", "other:x", ":x"])("rejects %j", (raw) => {
    expect(parseExamChoice(raw)).toBeNull();
  });
});
