import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
// The create action is a server module; the flow only calls it on "Alımı oluştur".
vi.mock("@/app/(manager)/hiring/openings/new/actions", () => ({ createOpeningAction: vi.fn() }));

import { NewOpeningForm, type PositionOption } from "./new-opening-form";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const support: PositionOption = { id: "11111111-1111-4111-8111-111111111111", name: "Destek Uzmanı", hasJobAd: true, competencyCount: 3, weightsEqual: true };

const render = (props: { initialPositionId?: string | null; initialCopyId?: string | null } = {}, locale: "tr" | "en" = "tr") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(NewOpeningForm, {
        positions: [support],
        sources: [{ id: "22222222-2222-4222-8222-222222222222", name: "Destek 2025", detail: "Kapalı, 1 Mar 2025 açıldı" }],
        initialPositionId: props.initialPositionId ?? null,
        initialCopyId: props.initialCopyId ?? null,
      }),
    ),
  );

describe("Alım aç on GuidedFlow (4.6, W1-W10)", () => {
  it("opens on the position question with the flow's head, one filled button that waits with its reason, and the way back to the openings", () => {
    const out = render();
    expect(out).toContain("Alım aç");
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Hangi pozisyon için\?<\/h1>/);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*id="new-opening-next"[^>]*disabled=""[^>]*aria-describedby="new-opening-next-why"[^>]*>Devam et<\/button>/);
    expect(out).toMatch(/<p[^>]*id="new-opening-next-why"[^>]*>Pozisyon adını yaz\.<\/p>/);
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings"[^>]*>.*Alımlara dön<\/a>/);
    expect(out).toContain(">Çık<");
    // Nothing chosen yet: the old one-page form's head and blocks are gone.
    expect(out).not.toContain("1. Pozisyon");
    expect(out).not.toContain("Alımı oluştur");
  });

  it("a position from the library is ready: continue works, its profile shows, and the picker's name says the question and the choice", () => {
    const out = render({ initialPositionId: support.id });
    expect(out).toMatch(/<button[^>]*id="new-opening-next"[^>]*>Devam et<\/button>/);
    expect(out).not.toContain("new-opening-next-why");
    expect(out).toContain("3 yetkinlik · ağırlıklar eşit");
    expect(out).toMatch(/role="combobox"[^>]*aria-labelledby="new-opening-position-label new-opening-position-value"/);
    expect(out).toMatch(/id="new-opening-position-label"[^>]*>Hangi pozisyon için\?</);
    expect(out).toMatch(/id="new-opening-position-value"[^>]*>Destek Uzmanı</);
    // A library position has no ad step (plan decision 13): two steps.
    expect(out).toContain("Adım 1 / 2");
    // The preselection from the address is not a change: leaving loses nothing.
    expect(out).toContain(">Çık<");
    expect(out).not.toContain("Kaydetmeden çık");
  });

  it("speaks English on an English page", () => {
    const out = render({}, "en");
    expect(out).toMatch(/<h1[^>]*>Which position is it for\?<\/h1>/);
    expect(out).toContain("Back to openings");
    expect(out).toContain("Step 1 / 2");
    expect(out).toContain(">Continue<");
  });
});
