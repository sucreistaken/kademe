import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

// The actions are a server module; the flow only calls them on "Davet linkini oluştur".
vi.mock("@/app/(manager)/hiring/invite/actions", () => ({ inviteCandidateAction: vi.fn(), inviteManyAction: vi.fn() }));
// A server render reads the hash through noHash; the tests set the address the page is opened on.
const address = vi.hoisted(() => ({ hash: "" }));
vi.mock("@/lib/client/hash-step", async (original) => ({ ...(await original<typeof import("@/lib/client/hash-step")>()), noHash: () => address.hash }));

import { InviteForm } from "./invite-form";
import type { InviteOpening } from "./form-rules";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const designer: InviteOpening = { id: "11111111-1111-4111-8111-111111111111", name: "Tasarımcı · Ekim", live: true, evaluators: 2, deadlineDay: "2026-10-19" };
const support: InviteOpening = { id: "22222222-2222-4222-8222-222222222222", name: "Destek Uzmanı · Ekim", live: true, evaluators: 1, deadlineDay: null };

const render = (
  props: { openings?: InviteOpening[]; initialOpeningId?: string | null; container?: "page" | "sheet"; hash?: string } = {},
  locale: "tr" | "en" = "tr",
) => {
  address.hash = props.hash ?? "";
  const openings = props.openings ?? [designer];
  return renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(InviteForm, {
        openings,
        initialOpeningId: props.initialOpeningId ?? null,
        today: "2026-10-05",
        zone: "Türkiye saati",
        container: props.container,
        onDone: props.container === "sheet" ? () => undefined : undefined,
      }),
    ),
  );
};

describe("the invite as a guided flow on /hiring/invite (4.9, D11, W1-W10)", () => {
  it("with one opening opens on the person, names the opening in the head (C19), and its one filled button waits with its reason", () => {
    const out = render();
    expect(out).toContain("Aday davet et · Tasarımcı · Ekim");
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Kimi davet ediyorsun\?<\/h1>/);
    expect(out).toContain("adaya e-postayla ya da mesajla sen gönderirsin");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<button[^>]*id="invite-next"[^>]*disabled=""[^>]*aria-describedby="invite-next-why"[^>]*>Devam et<\/button>/);
    expect(out).toMatch(/<p[^>]*id="invite-next-why"[^>]*>Adayın adını ve soyadını yaz\.<\/p>/);
    expect(out).toContain("Adım 1 / 2");
    expect(out).toContain(">Tek aday<");
    expect(out).toContain(">Liste yapıştır<");
    expect(out).toMatch(/<a[^>]*href="\/hiring\/openings"[^>]*>.*Alımlara dön<\/a>/);
    expect(out).toContain(">Çık<");
    // The old one-page form is gone: no opening select, no "Alım:" line, no create button before the summary.
    expect(out).not.toContain("Alım seç");
    expect(out).not.toContain("Davet linkini oluştur");
  });

  it("with more than one opening asks which one first, a card per opening with its last day", () => {
    const out = render({ openings: [designer, support] });
    expect(out).toMatch(/<h1[^>]*>Hangi alım için\?<\/h1>/);
    expect(out).toContain("Adım 1 / 3");
    expect(out).toContain("Tasarımcı · Ekim");
    expect(out).toContain("Destek Uzmanı · Ekim");
    expect(out).toContain("Son tarih yok");
    expect(out).toMatch(/<p[^>]*id="invite-next-why"[^>]*>Önce bir alım seç\.<\/p>/);
    // Nothing chosen yet: the head names only the flow.
    expect(out).toMatch(/>Aday davet et<\/p>/);
  });

  it("names the preselected opening in the head (?opening=)", () => {
    const out = render({ openings: [designer, support], initialOpeningId: support.id });
    expect(out).toContain("Aday davet et · Destek Uzmanı · Ekim");
    expect(out).not.toContain("invite-next-why");
  });

  it("a reload or a copied link on #summary before the person is ready shows the person step (W3)", () => {
    const out = render({ hash: "#summary" });
    expect(out).toMatch(/<h1[^>]*>Kimi davet ediyorsun\?<\/h1>/);
    expect(out).not.toContain("Her şey doğru mu?");
  });

  it("a hash naming a step this page does not have opens the first step (#opening with a single opening)", () => {
    const out = render({ hash: "#opening" });
    expect(out).toMatch(/<h1[^>]*>Kimi davet ediyorsun\?<\/h1>/);
    expect(out).not.toContain("Hangi alım için?");
  });

  it("speaks English on an English page", () => {
    const out = render({}, "en");
    expect(out).toMatch(/<h1[^>]*>Who are you inviting\?<\/h1>/);
    expect(out).toContain("Step 1 / 2");
    expect(out).toContain(">Paste a list<");
    expect(out).toContain(">Continue<");
    expect(out).toContain("Invite a candidate · Tasarımcı · Ekim");
  });
});

describe("the invite in the Sheet (4.9: steps in memory, the Sheet's own close button)", () => {
  it("ignores the page's hash (the overview owns it) and opens on the person", () => {
    const out = render({ container: "sheet", hash: "#summary" });
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Kimi davet ediyorsun\?<\/h2>/);
    expect(out).toContain("Adım 1 / 2");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });

  it("fits its footer in the 480px Sheet: full-width buttons, the reason under them (Task 22 fix round 1)", () => {
    const out = render({ container: "sheet" });
    expect(out).not.toContain("min-w-[200px]");
    expect(out).toMatch(/<button[^>]*id="invite-next"[^>]*class="[^"]*w-full[^"]*"[^>]*disabled=""[^>]*aria-describedby="invite-next-why"[^>]*>Devam et<\/button>/);
    expect(out.indexOf('id="invite-next-why"')).toBeGreaterThan(out.indexOf('id="invite-next"'));
    expect(out).not.toMatch(/id="invite-next-why"[^>]*text-right/);
    // The page keeps the wide footer.
    expect(render()).toContain("min-w-[200px]");
  });

  it("draws no page head and no exit link: the Sheet's title and close button are those", () => {
    const out = render({ container: "sheet" });
    expect(out).not.toContain(">Çık<");
    expect(out).not.toContain("Aday davet et · ");
    expect(out).not.toContain("Alımlara dön");
  });
});
