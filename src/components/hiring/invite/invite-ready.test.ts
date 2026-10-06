import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";
import { InviteReady } from "./invite-ready";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const noop = () => undefined;

const render = (props: Record<string, unknown> = {}, locale: "tr" | "en" = "tr") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(InviteReady as never, {
        container: "sheet",
        headingRef: { current: null },
        name: "Elif Kaya",
        url: "https://kademe.app/a/BhLlRdoH",
        expires: "20 Eki",
        language: "Türkçe",
        message: "Merhaba Elif",
        onAnother: noop,
        links: createElement("a", { href: "/hiring/openings/o1/candidates" }, "Adaylara git"),
        ...props,
      } as never),
    ),
  );
const primary = (out: string) => out.match(/<button[^>]*data-variant="primary"[\s\S]*?<\/button>/g) ?? [];

describe("the invite's ready view (mockup 7)", () => {
  it("in the Sheet: the drawing, '<name> için link hazır', the once-only note, the link, its language and last day, and one filled 'Linki kopyala'", () => {
    const out = render();
    // inviteReady's tint circle.
    expect(out).toContain('cx="26" cy="26" r="9"');
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Elif Kaya için link hazır<\/h2>/);
    expect(out).toContain("Bu link bir daha gösterilmez; kapatmadan önce kopyala.");
    const input = out.match(/<input id="invite-link"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('value="https://kademe.app/a/BhLlRdoH"');
    expect(input).toMatch(/readOnly=""|readonly=""/);
    expect(input).toContain("font-mono");
    expect(out).toContain("lucide-languages");
    expect(out).toContain("Türkçe");
    expect(out).toContain("lucide-calendar");
    expect(out).toContain("Son tarih 20 Eki");
    expect(out).toContain("Hazır mesajı gör");
    const filled = primary(out);
    expect(filled).toHaveLength(1);
    expect(filled[0]!).toContain("lucide-copy");
    expect(filled[0]!.replace(/<[^>]+>/g, "")).toBe("Linki kopyala");
    expect(out).toContain("lucide-user-plus");
    expect(out).toContain("Başka aday davet et");
    expect(out).toContain('href="/hiring/openings/o1/candidates"');
  });

  it("on the page: the same parts under the page's h1", () => {
    const out = render({ container: "page" });
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Elif Kaya için link hazır<\/h1>/);
    expect(primary(out)).toHaveLength(1);
  });

  it("speaks English", () => {
    const out = render({ language: "English" }, "en");
    expect(out).toContain("The link for Elif Kaya is ready");
    expect(out).toContain("Copy the link");
  });
});
