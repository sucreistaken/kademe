import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
// The actions are a server module; the flow only calls them on "Devam" and on a start.
vi.mock("@/app/(manager)/hiring/openings/new/actions", () => ({ createOpeningAction: vi.fn(), clarifyRoleAction: vi.fn() }));
// A server render reads the hash through noHash; the tests set the address the page is opened on.
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));

import { NewOpeningForm, type PositionOption } from "./new-opening-form";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const support: PositionOption = { id: "11111111-1111-4111-8111-111111111111", name: "Destek Uzmanı", hasJobAd: true, competencyCount: 3, weightsEqual: true };
const sales: PositionOption = { id: "33333333-3333-4333-8333-333333333333", name: "Satış Uzmanı", hasJobAd: false, competencyCount: 0, weightsEqual: true };
const source = "22222222-2222-4222-8222-222222222222";

const render = (props: { initialPositionId?: string | null; hash?: string; sources?: boolean } = {}, locale: "tr" | "en" = "tr") => {
  address.hash = props.hash ?? "";
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(NewOpeningForm, {
        positions: [support, sales],
        sources: props.sources === false ? [] : [{ id: source, name: "Destek 2025", detail: "Kapalı, 1 Mar 2025 açıldı" }],
        initialPositionId: props.initialPositionId ?? null,
        initialCopyId: null,
        templates: [],
      }),
    ),
  );
};

describe("step 1 'Rolü anlat' (HIRING-UX 5.20)", () => {
  it("asks who you are looking for: a name, one short text box, one filled 'Devam' that waits for the name, and 'Adım 1 / 3'", () => {
    const out = render();
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Kimi arıyorsun\?<\/h1>/);
    expect(out).toContain("Adım 1 / 3");
    expect(out).toMatch(/<input[^>]*id="wizard-position"/);
    expect(out).toMatch(/<textarea[^>]*id="wizard-role-text"[^>]*placeholder="Sürüş eğitmeni arıyorum, hafta içi çalışacak\."/);
    expect(out).toContain("Birkaç kelime yeter.");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*id="wizard-next"[^>]*disabled=""[^>]*>Devam et<\/button>/);
    expect(out).toMatch(/id="wizard-next-why"[^>]*>Pozisyon adını yaz\.</);
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings"[^>]*>.*Alımlara dön<\/a>/);
  });

  it("offers the library positions as chips under the name", () => {
    const out = render();
    expect(out).toContain("Kütüphanendeki pozisyonlar");
    expect(out).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Destek Uzmanı<\/button>/);
    expect(out).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Satış Uzmanı<\/button>/);
  });

  it("a position from the library (?position=) fills the name and lets 'Devam' go", () => {
    const out = render({ initialPositionId: support.id });
    expect(out).toMatch(/<input[^>]*id="wizard-position"[^>]*value="Destek Uzmanı"/);
    expect(out).toContain("Kütüphanendeki bu pozisyon kullanılacak.");
    expect(out).toMatch(/<button[^>]*id="wizard-next"[^>]*>Devam et<\/button>/);
    expect(out).not.toContain("wizard-next-why");
  });

  it("puts the other starts under it as plain, named links; copying only when there is a source; no 'recommended' and no static 'ready for this role'", () => {
    const out = render();
    expect(out).toContain("Başka bir yoldan başlamak istersen");
    expect(out).toMatch(/id="wizard-alt-template"[^>]*>Hazır bir rol şablonundan başla/);
    expect(out).toMatch(/id="wizard-alt-copy"[^>]*>Önceki bir alımın sorularını kopyala/);
    expect(out).toMatch(/id="wizard-alt-blank"[^>]*>Soruları kendim yazacağım/);
    expect(out).not.toMatch(/Önerilen|Bu rol için hazır/);
    expect(render({ sources: false })).not.toContain("wizard-alt-copy");
  });

  it("'Soruları kendim yazacağım' waits for the name too, and says so", () => {
    expect(render()).toMatch(/<button[^>]*id="wizard-alt-blank"[^>]*disabled=""[^>]*aria-describedby="wizard-alt-blank-why"/);
    expect(render({ initialPositionId: support.id })).not.toMatch(/id="wizard-alt-blank"[^>]*disabled=""/);
  });

  it("the template gallery is still step 1, with its own filled button and the way back", () => {
    const out = render({ hash: "#template" });
    expect(out).toMatch(/<h1[^>]*>Hangi şablon\?<\/h1>/);
    expect(out).toContain("Adım 1 / 3");
    expect(out).toMatch(/<button[^>]*id="wizard-next"[^>]*disabled=""[^>]*>Bu şablonla devam et<\/button>/);
    expect(out).toContain("Geri");
  });

  it("the copy screen asks which hiring, and is not offered without a source", () => {
    expect(render({ hash: "#copy" })).toMatch(/<h1[^>]*>Hangi alımın soruları\?<\/h1>/);
    expect(render({ hash: "#copy", sources: false })).toMatch(/<h1[^>]*>Kimi arıyorsun\?<\/h1>/);
  });

  it("speaks English on an English page", () => {
    const out = render({}, "en");
    expect(out).toContain("Who are you looking for?");
    expect(out).toContain("Step 1 / 3");
    expect(out).toContain("I&#x27;ll write the questions myself");
  });
});
