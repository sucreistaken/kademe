import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ABOVE_FOOTER, EXAM_BAR_WIDTH, noticeSpace } from "./footer-action";
import { frozenMarkup } from "./frozen-markup";
import { StepFooter } from "./step-footer";

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
    // The wide layout as drawn before the compact one existed (5d0c290), recaptured
    // once for the soft look (2026-10-14: button classes only, the layout is the same).
    const now = CASES.map(html);
    const before = frozenMarkup("src/components/visual/step-footer.default-markup.json", now);
    expect(now).toEqual(before);
    // The fixture really holds the wide layout.
    expect(before.every((m: string) => m.includes("min-w-[200px]"))).toBe(true);
  });

  it("wide: the bar and its note are 1200px like the wide exam screens, and nothing else changes", () => {
    const props: ComponentProps<typeof StepFooter> = {
      primary: { kind: "button", id: "next", label: "Sonraki görev", onClick: noop, waitReason: "Kayıt bitince devam edebilirsiniz." },
      note: "Bölümü şimdi bitir",
    };
    const normal = html(props);
    const wide = html({ ...props, wide: true });
    expect(normal).not.toContain("max-w-[1200px]");
    expect(normal.match(/max-w-\[1000px\]/g)).toHaveLength(2);
    expect(wide).not.toContain("max-w-[1000px]");
    expect(wide.match(/max-w-\[1200px\]/g)).toHaveLength(2);
    expect(wide.replaceAll("max-w-[1200px]", "max-w-[1000px]")).toBe(normal);
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
    expect(out.match(/bg-brand text-on-brand/g)).toHaveLength(1);
  });
});

describe("StepFooter's exam bar (one fixed row)", () => {
  const flag = { kind: "button", id: "flag-item", label: "Mark", onClick: noop } as const;
  const next = { kind: "button", id: "next-item", label: "Next", onClick: noop } as const;

  it("is one row that never wraps, with the way back always present (disabled on the first question)", () => {
    const out = html({ exam: true, primary: next, secondary: flag, back: { label: "Back", disabled: true, onClick: noop }, note: "strip" });
    expect(out).not.toContain("flex-wrap ");
    expect(out).toContain("flex-nowrap");
    expect(out).toContain("h-[65px]");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Back<\/button>/);
  });

  it("keeps the flag slot's width when there is no flag (a listening page)", () => {
    const withFlag = html({ exam: true, primary: next, secondary: flag, back: { label: "Back", onClick: noop } });
    const without = html({ exam: true, primary: next, back: { label: "Back", onClick: noop } });
    expect(withFlag).toContain("w-[168px]");
    expect(without).toContain('<div aria-hidden="true" class="w-[168px] shrink-0"></div>');
  });

  it("draws its buttons at the widths EXAM_BAR_WIDTH names", () => {
    const out = html({ exam: true, primary: next, secondary: flag, back: { label: "Back", onClick: noop } });
    for (const w of Object.values(EXAM_BAR_WIDTH)) expect(out).toContain(`w-[${w}px]`);
  });

  it("shows only the spinner while the primary button works and says the work to screen readers", () => {
    const out = html({ exam: true, primary: { ...next, busy: true, busyLabel: "Wird gespeichert" }, secondary: flag });
    const button = out.match(/<button[^>]*id="next-item"[^>]*>([^]*?)<\/button>/)![1];
    expect(button).toContain('data-slot="spinner"');
    expect(button).toContain('<span class="sr-only">Wird gespeichert</span>');
    expect(button.replace(/<[^>]*>[^<]*<\/span>/, "")).not.toContain("Wird gespeichert");
    // Outside the exam bar a working button keeps its visible label.
    expect(html({ primary: { ...next, busy: true, busyLabel: "Saving" } })).toMatch(/<\/svg>Saving<\/button>/);
  });

  it("draws no hint or reason inside the bar, only a screen-reader status", () => {
    const out = html({ exam: true, primary: next, hint: "Hint text", status: "Saved" });
    expect(out).not.toContain("Hint text");
    expect(out).toContain('<div aria-live="polite" class="sr-only"><p>Saved</p></div>');
  });

  it("puts a notice in a layer on the bar's top edge, outside its height", () => {
    const out = html({ exam: true, primary: next, notice: "Leave anyway?" });
    expect(out).toMatch(/data-step-footer-notice="true" class="[^"]*absolute[^"]*bottom-full[^"]*"/);
    expect(out).toContain("Leave anyway?");
    expect(html({ exam: true, primary: next })).not.toContain("data-step-footer-notice");
  });

  it("leaves room for a notice in the spacer while one shows (the bar keeps its height)", () => {
    const withNotice = html({ exam: true, primary: next, notice: "Save failed" });
    expect(withNotice).toMatch(/^<div aria-hidden="true" class="h-\[112px\]" style="height:calc\(var\(--step-footer-space, 112px\) \+ var\(--step-notice-space, 0px\)\)"/);
    expect(withNotice).toContain("h-[65px]");
    expect(html({ exam: true, primary: next })).toMatch(/^<div aria-hidden="true" class="h-\[112px\]" style="height:var\(--step-footer-space, 112px\)"/);
  });

  it("gives the default footer the same notice layer, and nothing extra without one", () => {
    expect(html({ primary: next, notice: "Save failed" })).toContain("data-step-footer-notice");
    expect(html({ primary: next })).not.toContain("data-step-footer-notice");
  });
});

describe("the room a notice takes", () => {
  it("is its measured height rounded up, 0 when there is none", () => {
    expect(noticeSpace(57.2)).toBe("58px");
    expect(noticeSpace(0)).toBe("0px");
    expect(noticeSpace(null)).toBe("0px");
    expect(noticeSpace(Number.NaN)).toBe("0px");
  });

  it("is added to the bar's room for anything pinned above the bar", () => {
    expect(ABOVE_FOOTER).toBe("calc(var(--step-footer-space, 112px) + var(--step-notice-space, 0px))");
  });
});

describe("StepFooter's contained placement and measure flag are opt-in", () => {
  const primary = { kind: "button" as const, id: "go", label: "Start", onClick: noop };

  it("contained: a relative bar with no fixed or sticky position and no spacer", () => {
    for (const extra of [{}, { compact: true }, { exam: true }]) {
      const out = html({ primary, placement: "contained", ...extra });
      expect(out).toMatch(/<div[^>]*data-step-footer="true"[^>]*class="relative"/);
      expect(out).not.toContain("fixed inset-x-0");
      expect(out).not.toContain("sticky bottom-0");
      expect(out).not.toContain('aria-hidden="true" class="h-[112px]"');
    }
  });

  it("the default and sticky placements keep their classes, and measure=false changes no markup", () => {
    expect(html({ primary })).toContain("fixed inset-x-0 bottom-0 z-30");
    expect(html({ primary, placement: "sticky" })).toContain("sticky bottom-0 z-20");
    expect(html({ primary, measure: false })).toEqual(html({ primary }));
  });
});
