import { describe, expect, it } from "vitest";
import { ANCHOR_DRAFT_JSON_SCHEMA, buildAnchorMessages, mergeAnchorProposal, parseAnchorAnswer, type AnchorProposal } from "./anchor-draft";

const full = {
  level1Tr: "Soruyu cevaplamıyor ve örnek vermiyor.",
  level1En: "Does not answer the question and gives no example.",
  level2Tr: "",
  level2En: "",
  level3Tr: "Ana fikri başta söylüyor ve bir örnek veriyor.",
  level3En: "States the main point first and gives one example.",
  level4Tr: "",
  level4En: "",
  level5Tr: "Dinleyiciye göre ayarlıyor \u2014 ve özetliyor.",
  level5En: "Adjusts to the listener and summarises.",
};

describe("anchor proposals", () => {
  it("asks for every level in both languages and states the limits", () => {
    expect((ANCHOR_DRAFT_JSON_SCHEMA.required as string[]).length).toBe(10);
    const messages = buildAnchorMessages({
      name: { tr: "İletişim", en: "Communication" },
      description: { tr: "", en: "" },
      levels: [{ value: 3, label: { tr: "Beklenen düzeyde", en: "Meets the bar" } }],
    });
    expect(messages[0].content).toMatch(/never score, rank or judge a real person/i);
    expect(messages[1].content).toContain("İletişim");
    expect(messages[1].content).toContain("Beklenen düzeyde");
  });

  it("returns levels 1 to 5 and strips the em dash", () => {
    const parsed = parseAnchorAnswer(JSON.stringify(full));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.anchors[3].tr).toBe(full.level3Tr);
    expect(parsed.anchors[2]).toEqual({ tr: "", en: "" });
    expect(parsed.anchors[5].tr).not.toContain("\u2014");
  });

  it("rejects an answer without a required level", () => {
    const parsed = parseAnchorAnswer(JSON.stringify({ ...full, level3Tr: " ", level3En: "" }));
    expect(parsed.ok).toBe(false);
  });
});

describe("applying a proposal to the form", () => {
  const proposal: AnchorProposal = {
    1: { tr: "AI 1", en: "AI 1 en" },
    2: { tr: "", en: "" },
    3: { tr: "AI 3", en: "" },
    4: { tr: " ", en: "" },
    5: { tr: "AI 5", en: "AI 5 en" },
  };

  it("copies only the levels the AI wrote and keeps what the person typed in empty 2 and 4", () => {
    const current = {
      1: { tr: "benim 1", en: "" },
      2: { tr: "benim 2", en: "my 2" },
      3: { tr: "", en: "" },
      4: { tr: "", en: "my 4" },
      5: { tr: "", en: "" },
    };
    const merged = mergeAnchorProposal(current, proposal);
    expect(merged[1]).toEqual({ tr: "AI 1", en: "AI 1 en" });
    expect(merged[2]).toEqual({ tr: "benim 2", en: "my 2" });
    expect(merged[3]).toEqual({ tr: "AI 3", en: "" });
    expect(merged[4]).toEqual({ tr: "", en: "my 4" });
    expect(merged[5]).toEqual({ tr: "AI 5", en: "AI 5 en" });
  });

  it("does not change the object it was given", () => {
    const current = { 2: { tr: "benim 2", en: "" } };
    mergeAnchorProposal(current, proposal);
    expect(current).toEqual({ 2: { tr: "benim 2", en: "" } });
  });
});
