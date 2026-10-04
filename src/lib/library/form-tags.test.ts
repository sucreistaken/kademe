import { describe, expect, it } from "vitest";
import { formTags } from "./form-tags";

describe("formTags", () => {
  it("keys each saved tag by its id, so the next save sends the id back", () => {
    const saved = [{ id: "t1", polarity: "NEGATIVE" as const, label: { tr: "a", en: "b" } }];
    expect(formTags(saved)).toEqual([{ key: "t1", id: "t1", polarity: "NEGATIVE", label: { tr: "a", en: "b" } }]);
  });
});
