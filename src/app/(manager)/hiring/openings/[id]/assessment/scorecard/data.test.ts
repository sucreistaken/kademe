import { describe, expect, it, vi } from "vitest";
import { managerT } from "@/i18n/manager";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import { matrixOf, pickVersion, viewContent } from "./data";

/**
 * Which version the scorecard shows (review Important 1): the draft by
 * default, the live version on ?version=live while a draft exists, and the
 * live view always reads the live version's own questions.
 */
const v = (id: string, number: number, status: "DRAFT" | "PUBLISHED") => ({ id, number, status, publishedAt: null, previewedAt: null });
const LIVE = v("v1", 1, "PUBLISHED");
const DRAFT = v("v2", 2, "DRAFT");

describe("pickVersion", () => {
  it("shows the draft by default and offers the live version beside it", () => {
    expect(pickVersion({ draft: DRAFT, live: LIVE }, undefined)).toEqual({ mode: "draft", version: DRAFT, draft: DRAFT, live: LIVE });
  });

  it("?version=live shows the live version while a draft exists", () => {
    expect(pickVersion({ draft: DRAFT, live: LIVE }, "live")).toEqual({ mode: "live", version: LIVE, draft: DRAFT, live: LIVE });
  });

  it("without a draft it is the live version, whatever the parameter; without a live version it is the draft", () => {
    expect(pickVersion({ draft: null, live: LIVE }, undefined)).toMatchObject({ mode: "live", version: LIVE });
    expect(pickVersion({ draft: DRAFT, live: null }, "live")).toMatchObject({ mode: "draft", version: DRAFT });
    expect(pickVersion({ draft: null, live: null }, "live")).toBeNull();
  });
});

describe("viewContent", () => {
  const draftContent = content([stage("s2", [activity("a2")])]);
  const liveContent = content([stage("s1", [activity("a1")])]);

  it("the live view while a draft exists loads the live version's content, never the draft's", async () => {
    const load = vi.fn(async () => liveContent);
    const pick = pickVersion({ draft: DRAFT, live: LIVE }, "live")!;
    await expect(viewContent(pick, draftContent, load)).resolves.toBe(liveContent);
    expect(load).toHaveBeenCalledWith("v1");
  });

  it("the draft view, and the live view without a draft, use the content already loaded", async () => {
    const load = vi.fn(async () => liveContent);
    await expect(viewContent(pickVersion({ draft: DRAFT, live: LIVE }, undefined)!, draftContent, load)).resolves.toBe(draftContent);
    await expect(viewContent(pickVersion({ draft: null, live: LIVE }, undefined)!, liveContent, load)).resolves.toBe(liveContent);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("matrixOf", () => {
  const c = content([
    stage("s1", [
      activity("a1", { prompt: { tr: "Son projeni anlat.", en: "Tell us about your last project." }, competencyIds: ["c1", "c2"] }),
      activity("a2", { orderIndex: 1, type: "SINGLE_CHOICE", prompt: { tr: "Hangisi?", en: "Which?" }, competencyIds: [] }),
      activity("a3", { orderIndex: 2, prompt: { tr: "", en: "" }, competencyIds: ["c1"] }),
    ]),
  ]);

  it("numbers the measuring questions in screen order, names each in full for a screen reader, and leaves choice questions out", () => {
    const m = matrixOf(c, "tr", managerT("tr"));
    expect(m.columns.map((col) => col.label)).toEqual(["1.1", "1.3"]);
    expect(m.columns[0]).toMatchObject({ id: "a1", prompt: "Son projeni anlat.", srName: "Aşama 1, soru 1: Son projeni anlat." });
    expect(m.columns[1].prompt).toBe("Soru metni yok");
    expect(m.choiceCount).toBe(1);
    expect(m.measuredBy("c1")).toEqual(["a1", "a3"]);
    expect(m.measuredBy("c2")).toEqual(["a1"]);
  });

  it("speaks the viewer's language", () => {
    expect(matrixOf(c, "en", managerT("en")).columns[0].srName).toBe("Stage 1, question 1: Tell us about your last project.");
  });
});
