import { describe, expect, it } from "vitest";
import { pickText, pickTextLang } from "./i18n-text";

describe("pickText", () => {
  it("prefers the viewer's language and falls back to the other one", () => {
    expect(pickText({ tr: "İletişim", en: "Communication" }, "en")).toBe("Communication");
    expect(pickText({ tr: "İletişim", en: " " }, "en")).toBe("İletişim");
    expect(pickText(null, "tr")).toBe("");
  });
});

describe("pickTextLang", () => {
  it("says which language the shown text is in, so a fallback can carry its own lang attribute", () => {
    expect(pickTextLang({ tr: "İletişim", en: "Communication" }, "en")).toEqual({ text: "Communication", lang: "en" });
    expect(pickTextLang({ tr: "İletişim", en: " " }, "en")).toEqual({ text: "İletişim", lang: "tr" });
    expect(pickTextLang({ tr: "", en: "Only English" }, "tr")).toEqual({ text: "Only English", lang: "en" });
    expect(pickTextLang(null, "tr")).toEqual({ text: "", lang: "tr" });
  });
});
