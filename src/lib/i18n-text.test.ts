import { describe, expect, it } from "vitest";
import { pickText } from "./i18n-text";

describe("pickText", () => {
  it("prefers the viewer's language and falls back to the other one", () => {
    expect(pickText({ tr: "İletişim", en: "Communication" }, "en")).toBe("Communication");
    expect(pickText({ tr: "İletişim", en: " " }, "en")).toBe("İletişim");
    expect(pickText(null, "tr")).toBe("");
  });
});
