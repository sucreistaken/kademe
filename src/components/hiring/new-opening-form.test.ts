import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
// The create action is a server module; the flow only calls it on "Alımı oluştur".
vi.mock("@/app/(manager)/hiring/openings/new/actions", () => ({ createOpeningAction: vi.fn() }));
// A server render reads the hash through noHash; the tests set the address the page is opened on.
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));

import { NewOpeningForm, type PositionOption } from "./new-opening-form";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const support: PositionOption = { id: "11111111-1111-4111-8111-111111111111", name: "Destek Uzmanı", hasJobAd: true, competencyCount: 3, weightsEqual: true };

const noAd: PositionOption = { id: "33333333-3333-4333-8333-333333333333", name: "Satış Uzmanı", hasJobAd: false, competencyCount: 0, weightsEqual: true };
const source = "22222222-2222-4222-8222-222222222222";

const render = (props: { initialPositionId?: string | null; initialCopyId?: string | null; hash?: string; positions?: PositionOption[] } = {}, locale: "tr" | "en" = "tr") => {
  address.hash = props.hash ?? "";
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(NewOpeningForm, {
        positions: props.positions ?? [support, noAd],
        sources: [{ id: source, name: "Destek 2025", detail: "Kapalı, 1 Mar 2025 açıldı" }],
        initialPositionId: props.initialPositionId ?? null,
        initialCopyId: props.initialCopyId ?? null,
        templates: [],
      }),
    ),
  );
};

/** The radio input of one start card, as rendered. */
const radio = (out: string, value: string) => out.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`))?.[0] ?? "";

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

  it("a position from the library is ready: its card is chosen, continue works, two steps", () => {
    const out = render({ initialPositionId: support.id });
    expect(out).toMatch(/<button[^>]*id="new-opening-next"[^>]*>Devam et<\/button>/);
    expect(out).not.toContain("new-opening-next-why");
    expect(radio(out, support.id)).toContain('checked=""');
    // A library position has no ad step (plan decision 13): two steps.
    expect(out).toContain("Adım 1 / 2");
    // The preselection from the address is not a change: leaving loses nothing.
    expect(out).toContain(">Çık<");
    expect(out).not.toContain("Kaydetmeden çık");
  });

  it("shows the library positions as big cards with their role's tile and facts, and a dashed card for a new one (mockup 3)", () => {
    const out = render();
    expect(out).toMatch(/role="radiogroup" aria-labelledby="new-opening-position-label"/);
    expect(out).toMatch(/id="new-opening-position-label"[^>]*>Hangi pozisyon için\?</);
    expect(out).toContain("3 yetkinlik · ilan metni var");
    expect(out).toContain("Yetkinlik yok · ilan metni yok");
    expect(out).toContain("lucide-headset");
    expect(out).toContain("lucide-handshake");
    expect(out).toContain("Yeni bir pozisyon");
    expect(out).toContain("Adını yaz, gerisini birlikte kuralım.");
    expect(radio(out, "__new__")).not.toContain('checked=""');
    // The name field opens only once "Yeni bir pozisyon" is chosen; the old combobox is gone.
    expect(out).not.toContain('id="new-opening-name"');
    expect(out).not.toContain('role="combobox"');
    // The step's drawing (emptyOpenings) above the question.
    expect(out).toContain('cx="134" cy="26" r="13"');
    // Two positions need no search.
    expect(out).not.toContain('placeholder="Pozisyon ara"');
  });

  it("offers a search above the cards once the library has more than six positions", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...support, id: `0000000${i}-1111-4111-8111-111111111111`, name: `Pozisyon ${i}` }));
    expect(render({ positions: many })).toContain('placeholder="Pozisyon ara"');
  });

  it("speaks English on an English page", () => {
    const out = render({}, "en");
    expect(out).toMatch(/<h1[^>]*>Which position is it for\?<\/h1>/);
    expect(out).toContain("Back to openings");
    expect(out).toContain("Step 1 / 2");
    expect(out).toContain(">Continue<");
  });

  it("a reload or a copied link on #start before a position is set shows the position step, not the last one (W3)", () => {
    const out = render({ hash: "#start" });
    expect(out).toMatch(/<h1[^>]*>Hangi pozisyon için\?<\/h1>/);
    expect(out).not.toContain("Nasıl başlayalım?");
    expect(out).toContain("Adım 1 / 2");
    // The address is then rewritten to the shown step (useFlowStep, flowHashFix "" here), so naming a position does not jump ahead.
  });

  it("never asks a library position for its ad: #ad opens the position step", () => {
    const out = render({ initialPositionId: support.id, hash: "#ad" });
    expect(out).toMatch(/<h1[^>]*>Hangi pozisyon için\?<\/h1>/);
    expect(out).not.toContain("İlan metnin var mı?");
  });

  it("the last step: four big cards in the mockup's order, the summary pill, \"Alımı oluştur\" as the one filled button, and \"Geri\" one step back", () => {
    const out = render({ initialPositionId: support.id, hash: "#start" });
    expect(out).toMatch(/<h1[^>]*>Nasıl başlayalım\?<\/h1>/);
    expect(out).toContain("Sonra her şeyi değiştirebilirsin.");
    expect(out).toMatch(/role="radiogroup" aria-labelledby="new-opening-start-label"/);
    expect(out.indexOf('value="TEMPLATE"')).toBeLessThan(out.indexOf('value="COPY"'));
    expect(out.indexOf('value="COPY"')).toBeLessThan(out.indexOf('value="AI"'));
    expect(out.indexOf('value="AI"')).toBeLessThan(out.indexOf('value="BLANK"'));
    expect(out).toContain("Hazır şablondan başla");
    expect(out).toContain("Bu rol için hazır aşamalar, sorular ve puan kartı. Hepsini sonra değiştirebilirsin.");
    expect(out).toContain("İlan metninden öneri al");
    expect(out).toContain("Önceki bir alımdan kopyala");
    expect(out).toContain("Boş başla");
    expect(out).toContain("size-[52px] rounded-xl");
    expect(out).toContain("lucide-layout-template");
    // Less AI: no sparkles; the one badge is the ready template's, and it sits on that card.
    expect(out).not.toContain("lucide-sparkles");
    expect(out.match(/Önerilen/g)).toHaveLength(1);
    expect(out).toMatch(/Hazır şablondan başla <span[^>]*rounded-full[^>]*>Önerilen<\/span>/);
    expect(out.indexOf("Önerilen")).toBeLessThan(out.indexOf('value="COPY"'));
    expect(out).toContain("lucide-file-text");
    // The decisions in one line, as a pill with a check under the lead (no start is chosen yet, R1).
    expect(out).toMatch(/bg-accent-soft[^"]*text-accent[^"]*"><svg[^>]*lucide-check[\s\S]*?Destek Uzmanı · ilan metni var<\/p>/);
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*id="new-opening-create"[^>]*>Alımı oluştur<\/button>/);
    expect(out).toContain("Adım 2 / 2");
    expect(out).toMatch(/<button type="button"[^>]*>.*Geri<\/button>/);
  });

  it("the job ad preselects nothing (less AI): no start card is checked and \"Alımı oluştur\" waits with its reason", () => {
    const out = render({ initialPositionId: support.id, hash: "#start" });
    for (const value of ["COPY", "AI", "BLANK"]) expect(radio(out, value)).toMatch(/^<input(?![^>]*checked="")/);
    expect(radio(out, "AI")).not.toContain('disabled=""');
    const button = out.match(/<button[^>]*id="new-opening-create"[^>]*>/)?.[0] ?? "";
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-describedby="new-opening-create-why"');
    expect(out).toMatch(/<p[^>]*id="new-opening-create-why"[^>]*>Nasıl başlayacağını seç\.<\/p>/);
    // Nothing chosen is not a change: leaving loses nothing.
    expect(out).toContain(">Çık<");
    expect(out).not.toContain("Kaydetmeden çık");
  });

  it("says the start's wait reason in English too", () => {
    const out = render({ initialPositionId: support.id, hash: "#start" }, "en");
    expect(out).toMatch(/<p[^>]*id="new-opening-create-why"[^>]*>Pick how to start\.<\/p>/);
    expect(out).toContain("Suggest from the job ad");
  });

  it("a library position without an ad: the job-ad card is closed with its reason and the way to add the ad, and no start is chosen", () => {
    const out = render({ initialPositionId: noAd.id, hash: "#start" });
    expect(radio(out, "AI")).toContain('disabled=""');
    expect(out).toContain("İlan metni ekleyince açılır.");
    expect(out).toContain(`href="/library/positions/${noAd.id}"`);
    for (const value of ["COPY", "AI", "BLANK"]) expect(radio(out, value)).toMatch(/^<input(?![^>]*checked="")/);
    expect(out).toContain("Satış Uzmanı · ilan metni yok</p>");
    expect(out).toContain("Nasıl başlayacağını seç.");
  });

  it("?copy= preselects copying from that opening, and the summary names it; nothing counts as changed", () => {
    const out = render({ initialPositionId: support.id, initialCopyId: source, hash: "#start" });
    expect(radio(out, "COPY")).toContain('checked=""');
    expect(radio(out, "AI")).not.toContain('checked=""');
    expect(out).toContain('id="new-opening-copy"');
    expect(out).toContain("Destek Uzmanı · ilan metni var · Destek 2025 kopyası");
    expect(out).not.toContain("new-opening-create-why");
    expect(out).toContain(">Çık<");
  });

  it("?copy= of an opening not in this organisation's list preselects nothing", () => {
    const out = render({ initialPositionId: support.id, initialCopyId: "44444444-4444-4444-8444-444444444444", hash: "#start" });
    for (const value of ["COPY", "AI", "BLANK"]) expect(radio(out, value)).toMatch(/^<input(?![^>]*checked="")/);
    expect(out).not.toContain('id="new-opening-copy"');
  });
});
