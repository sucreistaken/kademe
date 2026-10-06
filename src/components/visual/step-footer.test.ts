import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StepFooter } from "./step-footer";
// The markup these footers drew before the compact layout existed (captured from 5d0c290).
import before from "./step-footer.default-markup.json";

const noop = () => undefined;
const html = (props: ComponentProps<typeof StepFooter>) => renderToStaticMarkup(createElement(StepFooter, props));

/** Footers the candidate screens draw: plain, waiting, busy, two actions, a link, a hint, a note, sticky. */
const CASES: Array<ComponentProps<typeof StepFooter>> = [
  { primary: { kind: "button", id: "go", label: "Kabul et ve başla", onClick: noop, waitReason: "Önce kutuyu işaretle." } },
  { primary: { kind: "button", id: "next", label: "Sonraki soru", busyLabel: "Kaydediliyor", busy: true, onClick: noop }, back: { label: "Geri", onClick: noop } },
  {
    primary: { kind: "button", id: "use", label: "Bu cevabı kullan", onClick: noop },
    secondary: { kind: "button", id: "retry", label: "Tekrar dene", onClick: noop, waitReason: "Tekrar hakkın kalmadı." },
    back: { label: "Geri", href: "/x" },
    journey: { steps: 4, current: 2, label: "Adım 2 / 4" },
    hint: "İpucu",
    note: "Not",
  },
  { primary: { kind: "link", id: "done", label: "Bitir", href: "/done" }, hint: "Hazır", placement: "sticky" },
];

describe("StepFooter's compact layout is opt-in (Task 22 fix round 1)", () => {
  it("draws every default footer exactly as before, byte for byte", () => {
    expect(CASES.map(html)).toEqual(before);
    // The fixture really holds the wide layout.
    expect(before.every((m: string) => m.includes("min-w-[200px]"))).toBe(true);
  });

  it("in a narrow Sheet: full-width buttons without the 200px minimum, the filled one last, the reasons at full width under them", () => {
    const out = html({
      primary: { kind: "button", id: "invite-next", label: "Devam et", onClick: noop, waitReason: "Adayın adını ve soyadını yaz." },
      secondary: { kind: "button", id: "invite-anyway", label: "Yine de davet et", busy: true, busyLabel: "Oluşturuluyor", onClick: noop },
      back: { label: "Geri", onClick: noop },
      journey: { steps: 2, current: 1, label: "Adım 1 / 2" },
      placement: "sticky",
      compact: true,
    });
    expect(out).not.toContain("min-w-[200px]");
    expect(out).not.toContain("max-w-[320px]");
    expect(out).not.toContain("text-right");
    expect(out).toMatch(/<button[^>]*id="invite-anyway"[^>]*class="[^"]*w-full[^"]*"[^>]*aria-disabled="true"/);
    expect(out).toMatch(/<button[^>]*id="invite-next"[^>]*class="[^"]*w-full[^"]*"[^>]*disabled=""[^>]*aria-describedby="invite-next-why"/);
    expect(out.indexOf('id="invite-anyway"')).toBeLessThan(out.indexOf('id="invite-next"'));
    // The reason comes after the buttons, the busy work is said politely, the step label and the way back stay.
    expect(out.indexOf('id="invite-next-why"')).toBeGreaterThan(out.indexOf('id="invite-next"'));
    expect(out).toMatch(/<p id="invite-next-why" class="text-\[14px\] leading-\[22px\] text-ink">Adayın adını ve soyadını yaz\.<\/p>/);
    expect(out).toContain('<p class="sr-only">Oluşturuluyor</p>');
    expect(out).toContain("Adım 1 / 2");
    expect(out).toContain(">Geri</button>");
    expect(out.match(/bg-accent text-white/g)).toHaveLength(1);
  });
});
