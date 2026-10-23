import { describe, expect, it } from "vitest";
import { candidateSafe, INTERNAL_FIELDS } from "./candidate-safe";

describe("candidateSafe and bank pictures", () => {
  it("lists storageKey in both spellings", () => {
    expect(INTERNAL_FIELDS).toContain("storageKey");
    expect(INTERNAL_FIELDS).toContain("storage_key");
  });

  it("strips a picture's storage key wherever it hides and keeps the rest of the picture", () => {
    const body = {
      content: {
        options: [{ id: "o1", text: "", image: { slot: "o1", w: 960, h: 640, alt: "Eine Katze.", storageKey: "bank/images/0123456789abcdef.webp" } }],
        images: [{ slot: "p0", w: 1, h: 1, alt: "x", storage_key: "bank/images/0123456789abcdef.webp" }],
      },
    };
    const safe = candidateSafe(body);
    expect(JSON.stringify(safe)).not.toMatch(/storageKey|storage_key|bank\/images/);
    expect(safe.content.options[0].image).toEqual({ slot: "o1", w: 960, h: 640, alt: "Eine Katze." });
  });
});
