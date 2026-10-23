import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/candidate.en.json";
import { emptyNotes } from "@/components/candidate/exam/notes/notes-model";
import { NotesToolbar } from "@/components/candidate/exam/notes/NotesToolbar";
import type { NotesController } from "@/components/candidate/exam/notes/use-notes";

const noop = () => {};
const controller = (over: Partial<NotesController>): NotesController => ({
  supported: true,
  data: emptyNotes(),
  setData: noop,
  tool: "none",
  setTool: noop,
  color: "yellow",
  setColor: noop,
  canUndo: false,
  clear: noop,
  undo: noop,
  ...over,
});

function html(c: NotesController, pen = true) {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, { locale: "en", messages: { notes: en.notes }, children: createElement(NotesToolbar, { controller: c, pen }) }),
  );
}

describe("NotesToolbar", () => {
  it("renders every tool as a labelled toggle button", () => {
    const out = html(controller({}));
    for (const label of ["Yellow highlighter", "Green highlighter", "Pink highlighter", "Underline", "Pen", "Eraser", "Clear notes"]) {
      expect(out).toContain(`aria-label="${label}"`);
    }
    expect(out).toContain('role="toolbar"');
    expect(out).not.toContain("aria-pressed=\"true\"");
  });
  it("marks only the active tool as pressed", () => {
    const out = html(controller({ tool: "highlight", color: "green" }));
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-label="Green highlighter"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Green highlighter"/);
  });
  it("leaves the pen out when asked and shows Undo after a clear", () => {
    const out = html(controller({ canUndo: true }), false);
    expect(out).not.toContain('aria-label="Pen"');
    expect(out).toContain("Undo");
  });
  it("renders nothing when the browser has no Highlight API", () => {
    expect(html(controller({ supported: false }))).toBe("");
    expect(html(controller({ supported: null }))).toBe("");
  });
});
