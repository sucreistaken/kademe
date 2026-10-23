import { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/candidate.en.json";
import { ScratchPad, type PadMode } from "@/components/candidate/exam/notes/ScratchPad";

const Provider = NextIntlClientProvider as unknown as FC<{ locale: string; messages: Record<string, unknown>; children?: ReactNode }>;

function html(initialMode?: PadMode, collapsible = false) {
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "en", messages: { notes: en.notes, exam: en.exam } },
      createElement(ScratchPad, { token: "t", sectionPosition: 1, padKey: "speaking-3", initialMode, collapsible }),
    ),
  );
}

describe("ScratchPad", () => {
  it("opens in Type mode: a textarea with the umlaut helper, no pen tools", () => {
    const out = html();
    expect(out).toContain("<textarea");
    expect(out).toContain('maxLength="5000"');
    expect(out).toContain("ä");
    expect(out).toContain(">Type<");
    expect(out).toContain(">Draw<");
    expect(out).toContain(en.notes.padHint);
    expect(out).not.toContain('aria-label="Pen"');
  });
  it("shows pen and eraser in Draw mode and no textarea", () => {
    const out = html("draw");
    expect(out).not.toContain("<textarea");
    expect(out).toContain('aria-label="Pen"');
    expect(out).toContain('aria-label="Eraser"');
  });
  it("has a fold toggle only when collapsible", () => {
    expect(html("type", true)).toContain('aria-expanded="true"');
    expect(html("type", false)).not.toContain("aria-expanded");
  });
});
