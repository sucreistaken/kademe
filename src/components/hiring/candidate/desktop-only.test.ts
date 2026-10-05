import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";

vi.mock("@/lib/client/api", () => ({ apiSend: async () => ({}) }));

import { DesktopOnlyScreen } from "./desktop-only";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string }) => ReactNode;

const render = (locale: Locale, stageRunning: boolean) =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(DesktopOnlyScreen, { token: "tok", minutes: 15, deadlineDay: "19 Eki", contactEmail: null, stageRunning }),
    ),
  );

describe("the desktop-only screen (HIRING-VISUAL-FLOW 3.0)", () => {
  it("lets the candidate plan before a stage: the minutes and the last day, no running note", () => {
    const html = render("tr", false);
    expect(html).toContain("~15 dk");
    expect(html).toContain("Son gün 19 Eki");
    expect(html).not.toContain("süresi işliyor");
  });

  it("says a started stage's clock is running and drops the minutes chip (fix round M7)", () => {
    const tr = render("tr", true);
    expect(tr).toContain("Bir aşaman başladı ve süresi işliyor; bilgisayarından aynı linkle devam et.");
    expect(tr).not.toContain("~15 dk");
    expect(tr).toContain("Son gün 19 Eki");
    const en = render("en", true);
    expect(en).toContain("One of your stages has started and its clock is running; continue on your computer with the same link.");
    expect(en).not.toContain("~15 min");
  });
});
