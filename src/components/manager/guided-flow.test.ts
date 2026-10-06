import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { managerMessagesFor } from "@/i18n/manager";

// next/link renders the same <a> as a plain anchor on the server; mark it so a test can tell them apart.
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => h("a", { ...rest, href, "data-next-link": "" }, children) };
});

import { GuidedFlow } from "./guided-flow";
import { SummaryRows } from "./summary-rows";

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string; children?: ReactNode }) => ReactNode;
const noop = () => undefined;

const flow = (props: Record<string, unknown>, locale: "tr" | "en" = "tr") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      { locale, messages: managerMessagesFor(locale), timeZone: "Europe/Istanbul" },
      createElement(GuidedFlow as never, {
        kicker: "Ekip ve kurallar · Ekip",
        step: { id: "team-decider", title: "Kararı kim verecek?", layout: "split", body: createElement("p", null, "kartlar"), primary: { kind: "button", id: "flow-next", label: "Devam et", onClick: noop } },
        journey: { steps: 4, current: 2 },
        back: { label: "Geri", onClick: noop },
        exit: { dirty: false, onClick: noop },
        ...props,
      } as never),
    ),
  );

describe("GuidedFlow (K12, W1-W10)", () => {
  it("asks one question with one filled button, the heading ready to take the focus, and says where the step is", () => {
    const out = flow({});
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Kararı kim verecek\?<\/h1>/);
    expect(out).toContain("Adım 2 / 4");
    expect(out).toContain("Ekip ve kurallar · Ekip");
    expect(out).toContain(">Çık<");
  });

  it("says 'Kaydetmeden çık' while values changed, and never asks (no dialog)", () => {
    const out = flow({ exit: { dirty: true, href: "/hiring/openings" } });
    expect(out).toContain("Kaydetmeden çık");
    expect(out).not.toContain(">Çık<");
    expect(out).not.toMatch(/role="(alert)?dialog"/);
  });

  it("in a Sheet: a compact heading, no exit link of its own (the Sheet's close button is the exit)", () => {
    const out = flow({ container: "sheet", exit: null });
    expect(out).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Kararı kim verecek\?<\/h2>/);
    expect(out).not.toContain(">Çık<");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });

  it("a waiting button says why next to it, linked by aria-describedby (W10, RULES 5)", () => {
    const out = flow({ step: { id: "team-members", title: "Kim değerlendirecek?", layout: "split", body: null, primary: { kind: "button", id: "flow-next", label: "Devam et", onClick: noop, waitReason: "En az bir kişi seç." } } });
    expect(out).toMatch(/<button[^>]*id="flow-next"[^>]*disabled=""[^>]*aria-describedby="flow-next-why"/);
    expect(out).toMatch(/<p[^>]*id="flow-next-why"[^>]*>En az bir kişi seç\.<\/p>/);
  });

  it("an exit to an address with a hash is a plain anchor (the page hears the hash change); any other is a client link", () => {
    const hash = flow({ exit: { dirty: false, href: "/hiring/openings/o/settings#team-members" } });
    expect(hash).toMatch(/<a href="\/hiring\/openings\/o\/settings#team-members"[^>]*>Çık<\/a>/);
    expect(hash).not.toContain("data-next-link");
    const plain = flow({ exit: { dirty: false, href: "/hiring/openings/o" } });
    expect(plain).toMatch(/<a[^>]*href="\/hiring\/openings\/o"[^>]*data-next-link=""[^>]*>Çık<\/a>/);
  });

  it("speaks English on an English page, and says no position for a step outside the path", () => {
    const out = flow({ exit: { dirty: true, onClick: noop } }, "en");
    expect(out).toContain("Step 2 / 4");
    expect(out).toContain("Leave without saving");
    const off = flow({ journey: { steps: 2, current: 0 } });
    expect(off).not.toContain("Adım");
  });
});

describe("SummaryRows (W5, P8)", () => {
  const rows = [
    { id: "team", icon: Users, label: "Ekip", value: "Kadir Ay · Ece Yıldız", changed: true, edit: { onClick: noop } },
    { id: "min", label: "Kaç değerlendirme", value: "2", edit: { href: "/hiring/openings/o/settings#team-min" } },
  ];
  const render = (readOnly: boolean) => renderToStaticMarkup(createElement(SummaryRows, { rows, readOnly, changeLabel: "Değiştir", changedLabel: "değişti" }));

  it("marks a changed row and offers 'Değiştir' per row, a hash link as a plain anchor", () => {
    const out = render(false);
    expect(out.match(/· değişti/g)).toHaveLength(1);
    expect(out.match(/Değiştir<span class="sr-only">/g)).toHaveLength(2);
    expect(out).toContain('href="/hiring/openings/o/settings#team-min"');
    expect(out).not.toContain("data-next-link");
  });

  it("read only: the same values, no 'Değiştir'", () => {
    const out = render(true);
    expect(out).toContain("Kadir Ay · Ece Yıldız");
    expect(out).not.toContain("Değiştir");
  });

  it("hides the row icons from screen readers (the label says it)", () => {
    expect(render(false)).toMatch(/<span aria-hidden="true"[^>]*><svg/);
  });
});
