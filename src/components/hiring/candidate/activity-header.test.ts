import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityHeader } from "./activity-header";

const SHORT_CLASS = "text-[24px] leading-[34px] font-medium whitespace-pre-line text-ink outline-none";
const LONG_CLASS = "text-[18px] leading-normal font-medium whitespace-pre-line text-ink outline-none";

const header = (prompt: { tr: string; en: string }) =>
  renderToStaticMarkup(
    createElement(ActivityHeader, {
      activity: { id: "q1", prompt, note: { tr: "", en: "" } },
      locale: "tr",
      kicker: "Video",
      headingRef: null,
    }),
  );

describe("ActivityHeader", () => {
  it("keeps the 24/34 heading for a short question", () => {
    const out = header({ tr: "Kendini tanıt.", en: "Introduce yourself." });
    expect(out).toContain(`<h2 tabindex="-1" id="prompt-q1" class="${SHORT_CLASS}">Kendini tanıt.</h2>`);
  });

  it("sets a long work-sample prompt at 18px with normal leading and keeps its line breaks", () => {
    const tr = `${"Bir müşteri kasaya doğru yürüyor. ".repeat(7)}\n\nRafta şunlar var:\n- Koşu çorabı: 250 TL`;
    expect(tr.length).toBeGreaterThan(200);
    const out = header({ tr, en: "Short in English." });
    expect(out).toContain(`class="${LONG_CLASS}"`);
    expect(out).not.toContain("text-[24px]");
    expect(out).toContain("\n\nRafta şunlar var:\n- Koşu çorabı");
  });

  it("measures the text in the shown language", () => {
    const out = header({ tr: "Kısa.", en: "x".repeat(400) });
    expect(out).toContain(`class="${SHORT_CLASS}"`);
  });
});
