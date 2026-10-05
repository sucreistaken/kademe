import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { FlushRegistry } from "@/lib/client/flush-registry";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";
import { FileActivity, fileInputId } from "./file-activity";

/**
 * HIRING-VISUAL-FLOW G2 (Task 11): the first paint of the file question,
 * rendered without a browser. What the picker does on "Dosya seç", a real drop
 * and the focus ring are checked on a real device.
 */
const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string }) => ReactNode;
const wrap = (locale: Locale, child: ReactNode) => renderToStaticMarkup(createElement(Provider, { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" }, child));

const activity = {
  id: "q-file",
  type: "FILE_UPLOAD",
  prompt: { tr: "CV'ni yükle.", en: "Upload your CV." },
  note: { tr: "", en: "" },
  required: true,
  acceptedMimeTypes: ["application/pdf"],
  maxFileBytes: 1024 * 1024,
} as never;

const render = (existing: { name: string; bytes: number } | null, locale: Locale = "tr", over: { disabled?: boolean; reasonId?: string } = {}) =>
  wrap(
    locale,
    createElement(FileActivity, {
      token: "tok",
      position: 1,
      run: "run-1",
      activity,
      initial: {},
      locale,
      headingRef: null,
      flushes: new FlushRegistry(),
      onChange: () => {},
      disabled: over.disabled ?? false,
      reasonId: over.reasonId,
      existing,
      uploads: new FlushRegistry(),
    }),
  );

const input = (html: string) => html.match(/<input[^>]*>/)?.[0] ?? "";

describe("the file input's id (G2)", () => {
  it("is built from the question's id, so the footer's 'Dosya seç' can find it", () => {
    expect(fileInputId("q-file")).toBe("file-input-q-file");
    expect(render(null)).toContain('id="file-input-q-file"');
  });
});

describe("the file question with no file yet (G2, 3.9)", () => {
  const html = render(null);

  it("shows the file-up chip icon, the drop words and the limits as chips, and no button of its own", () => {
    expect(html).toContain("lucide-file-up");
    expect(html).toContain("Dosya yükleme");
    expect(html).toContain("Dosyanı buraya bırak");
    expect(html).toContain(">PDF</span>");
    expect(html).toContain("En fazla 1 MB");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<label");
  });

  it("keeps the input out of the tab order, names it, and describes it with the limits that are on screen (C5)", () => {
    const tag = input(html);
    expect(tag).toContain('tabindex="-1"');
    expect(tag).toContain('aria-label="Bilgisayarından dosya seç"');
    const limits = tag.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(limits).not.toBe("");
    expect(html).toContain(`id="${limits}"`);
    expect(tag).not.toContain("disabled");
  });

  it("says it in English too", () => {
    const en = render(null, "en");
    expect(en).toContain("Drop your file here");
    expect(input(en)).toContain('aria-label="Choose a file from your computer"');
  });
});

describe("the file question with a file (G2)", () => {
  const html = render({ name: "cv.pdf", bytes: 340 * 1024 });

  it("shows the file card: the file-check icon, the name, the size line and a real 'Değiştir' button", () => {
    expect(html).toContain("lucide-file-check");
    expect(html).toContain("cv.pdf");
    expect(html).toContain("340 KB · yüklendi");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Değiştir<\/button>/);
    expect(html).not.toContain("<label");
    expect(html).not.toContain("Dosyanı buraya bırak");
  });

  it("points the input's aria-describedby at nothing that is not on screen (C5, the brief's correction)", () => {
    const tag = input(html);
    expect(tag).toContain('tabindex="-1"');
    expect(tag).not.toContain("aria-describedby");
    expect(html).not.toMatch(/id="[^"]*-limits"/);
  });

  it("while the runner holds the inputs, 'Değiştir' is aria-disabled and points at the runner's reason, never disabled", () => {
    const off = render({ name: "cv.pdf", bytes: 10 }, "tr", { disabled: true, reasonId: "stage-time-up" });
    const button = off.match(/<button[^>]*>Değiştir<\/button>/)?.[0] ?? "";
    expect(button).toContain('aria-disabled="true"');
    expect(button).toContain('aria-describedby="stage-time-up"');
    expect(button).not.toMatch(/\sdisabled(=|\s|>)/);
  });
});
