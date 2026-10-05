import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Clock, Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ChoiceCardGroup } from "./choice-card";
import { Disclosure } from "./disclosure";
import { FactTiles } from "./fact-tiles";
import { IconRow } from "./icon-row";
import { JourneyProgress } from "./journey-progress";
import { MediaStage } from "./media-stage";
import { PathSteps } from "./path-steps";
import { QuestionProgress } from "./question-progress";
import { StatusScreen } from "./status-screen";
import { StepFooter } from "./step-footer";
import { StepScreen } from "./step-screen";
import { TimerRing } from "./timer-ring";
import { formatCountdown } from "@/lib/timer";

// Each block is rendered with props typed loosely: the tests pass fixtures, the screens are type-checked where they use them.
const html = (type: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(type as never, props as never));
const noop = () => undefined;

describe("StepFooter (G9)", () => {
  it("draws a waiting button grey, with its reason next to it and linked", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "consent-go", label: "Kabul et ve başla", onClick: noop, waitReason: "Önce kutuyu işaretle." } });
    expect(out).toMatch(/<button[^>]*id="consent-go"[^>]*disabled=""/);
    expect(out).toMatch(/<button[^>]*aria-describedby="consent-go-why"/);
    expect(out).toMatch(/<p id="consent-go-why"[^>]*>Önce kutuyu işaretle\.<\/p>/);
    expect(out).toContain("data-step-footer");
  });

  it("writes the reason in ink (it is what to do next) and keeps the journey label quiet", () => {
    const out = html(StepFooter, {
      primary: { kind: "button", id: "go", label: "Devam et", onClick: noop, waitReason: "Bir seçenek seç." },
      journey: { steps: 4, current: 2, label: "Cihaz · Adım 2 / 4" },
    });
    expect(out).toMatch(/<p id="go-why" class="[^"]*\btext-ink\b[^"]*"/);
    expect(out).toMatch(/<span aria-hidden="true" class="[^"]*\btext-muted\b[^"]*">Cihaz · Adım 2 \/ 4<\/span>/);
  });

  it("says why an outline button waits too, next to it and linked", () => {
    const out = html(StepFooter, {
      primary: { kind: "button", id: "go", label: "Devam et", onClick: noop },
      secondary: { kind: "button", id: "again", label: "Tekrar çek", onClick: noop, waitReason: "Tekrar hakkın kalmadı." },
    });
    expect(out).toMatch(/<button[^>]*id="again"[^>]*disabled=""/);
    expect(out).toMatch(/<button[^>]*id="again"[^>]*aria-describedby="again-why"|<button[^>]*aria-describedby="again-why"[^>]*id="again"/);
    expect(out).toMatch(/<p id="again-why"[^>]*>Tekrar hakkın kalmadı\.<\/p>/);
    expect(out).not.toMatch(/<button[^>]*id="go"[^>]*disabled=""/);
  });

  it("keeps a working button filled and aria-disabled, never grey, and says its work in the polite region", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "next", label: "Sonraki soru", busyLabel: "Kaydediliyor", busy: true, onClick: noop } });
    expect(out).toMatch(/<button[^>]*aria-disabled="true"/);
    // aria-busy on the button can hold back what is said about it; the region says it instead.
    expect(out).not.toContain("aria-busy");
    expect(out).toMatch(/<div aria-live="polite"[^>]*>(?:(?!<\/div>)[\s\S])*<p class="sr-only">Kaydediliyor<\/p>/);
    expect(html(StepFooter, { primary: { kind: "button", id: "next", label: "Sonraki soru", onClick: noop } })).not.toContain('class="sr-only">Sonraki soru');
    expect(out).not.toMatch(/<button[^>]*disabled=""/);
    expect(out).toContain("bg-accent");
    expect(out).toContain("Kaydediliyor");
  });

  it("gives a working button one name, its own label: the spinner is hidden and says nothing", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "next", label: "Sonraki soru", busyLabel: "Kaydediliyor", busy: true, onClick: noop } });
    const button = out.match(/<button[^>]*id="next"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(button).not.toMatch(/role="status"|aria-label=/);
    expect(button.replace(/<[^>]+>/g, "")).toBe("Kaydediliyor");
  });

  it("draws a link as a real anchor with the filled look, the way back as a text button, and the journey on its edge", () => {
    const out = html(StepFooter, {
      primary: { kind: "link", id: "practice-ready", label: "Hazırım", href: "/a/t/stage/1" },
      back: { label: "Isınmayı atla", href: "/a/t/stage/1" },
      journey: { steps: 4, current: 3, label: "Isınma · Adım 3 / 4" },
    });
    expect(out).toMatch(/<a[^>]*href="\/a\/t\/stage\/1"[^>]*id="practice-ready"|<a[^>]*id="practice-ready"[^>]*href="\/a\/t\/stage\/1"/);
    expect(out).toContain("Isınmayı atla");
    expect(out).toMatch(/<ol[^>]*aria-label="Isınma · Adım 3 \/ 4"/);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("keeps the one filled button last, in the same place, after the reason and the outline button", () => {
    const out = html(StepFooter, {
      primary: { kind: "button", id: "go", label: "Devam et", onClick: noop, waitReason: "Bir seçenek seç." },
      secondary: { kind: "button", id: "again", label: "Tekrar çek", onClick: noop },
    });
    const why = out.indexOf('id="go-why"');
    const again = out.indexOf('id="again"');
    const go = out.indexOf('id="go"');
    expect(why).toBeGreaterThan(-1);
    expect(why).toBeLessThan(again);
    expect(again).toBeLessThan(go);
    expect(out.match(/bg-accent /g)).toHaveLength(1);
    // The reason's live region is there before any reason is.
    expect(html(StepFooter, { primary: { kind: "button", id: "go", label: "Devam et", onClick: noop } })).toContain('aria-live="polite"');
  });

  it("shows a calm hint only while the button does not wait", () => {
    const hint = "Süre, bastığında başlar.";
    expect(html(StepFooter, { primary: { kind: "button", id: "go", label: "Başla", onClick: noop }, hint })).toContain(hint);
    expect(html(StepFooter, { primary: { kind: "button", id: "go", label: "Başla", onClick: noop, waitReason: "Bekle." }, hint })).not.toContain(hint);
  });

  it("leaves the content uncovered: a spacer the height of the bar comes first", () => {
    expect(html(StepFooter, { primary: null })).toMatch(/^<div aria-hidden="true" class="h-\[112px\]/);
    // The bar measures itself on the client; before that (and on the server) the spacer is 112px.
    expect(html(StepFooter, { primary: null })).toMatch(/^<div[^>]*style="height:var\(--step-footer-space, 112px\)"/);
    expect(html(StepFooter, { primary: null, placement: "sticky" })).not.toContain("h-[112px]");
  });

  it("gives every target at least 44px (the way back 44, the buttons 52)", () => {
    const out = html(StepFooter, { primary: { kind: "button", id: "go", label: "Devam et", onClick: noop }, back: { label: "Geri", onClick: noop } });
    expect(out).toContain("min-h-11");
    expect(out).toContain("h-[52px]");
  });
});

describe("JourneyProgress (G3)", () => {
  it("is a list with one current step and a visible-to-readers label", () => {
    const out = html(JourneyProgress, { steps: 3, current: 2, label: "Cihaz · Adım 2 / 3" });
    expect(out.match(/<li/g)).toHaveLength(3);
    expect(out).toMatch(/<li[^>]*aria-current="step"/);
  });

  it("fills instantly under reduced motion (2.3)", () => {
    expect(html(JourneyProgress, { steps: 2, current: 1, label: "x" })).toContain("motion-reduce:transition-none");
  });
});

describe("QuestionProgress (3.6)", () => {
  it("draws one part per question and stays silent (the words next to it are what a reader hears)", () => {
    const out = html(QuestionProgress, { total: 5, current: 2 });
    expect(out).toMatch(/^<div aria-hidden="true"/);
    expect(out.match(/<span/g)).toHaveLength(5);
  });
});

describe("TimerRing (K4)", () => {
  it("is one image to a screen reader, with the time in words, and shows the digits in tabular figures", () => {
    const out = html(TimerRing, { remainingMs: 18_000, totalMs: 30_000, label: "Düşünme süren 0:18", caption: "düşünme" });
    expect(out).toMatch(/^<div role="img" aria-label="Düşünme süren 0:18"/);
    expect(out).toContain("tnum");
    expect(out).toContain("0:18");
    expect(out).toContain("stroke-dashoffset");
  });

  it("never turns red and never slides, even in the last seconds (3.8)", () => {
    const out = html(TimerRing, { remainingMs: 5_000, totalMs: 30_000, label: "Cevap süren 0:05", caption: "Son saniyeler" });
    expect(out).not.toMatch(/danger|red|warn/i);
    expect(out).toContain("var(--color-accent)");
    expect(out).not.toMatch(/transition/);
  });

  it("speaks its label, which carries the time, at a milestone only, never every second", () => {
    const label = (ms: number) => `Düşünme süren ${formatCountdown(ms)}`;
    const live = (remainingMs: number) => html(TimerRing, { remainingMs, totalMs: 30_000, label: label(remainingMs), caption: "düşünme" }).match(/<p[^>]*aria-live="polite"[^>]*>([^<]*)<\/p>/)?.[1];
    expect(live(10_000)).toBe("Düşünme süren 0:10");
    expect(live(11_000)).toBe("");
    expect(live(30_000)).toBe("");
  });

  it("can stay silent (announce false): then it has no live region at all", () => {
    const out = html(TimerRing, { remainingMs: 10_000, totalMs: 30_000, label: "Cevap süren 0:10", caption: "cevap", announce: false });
    expect(out).not.toContain("aria-live");
    expect(out).toMatch(/^<div role="img" aria-label="Cevap süren 0:10"/);
  });
});

describe("ChoiceCardGroup (G6)", () => {
  it("is native radios in cards, the chosen one checked, letters as marks and keys as a hint", () => {
    const out = html(ChoiceCardGroup, {
      type: "single",
      name: "q1",
      value: ["b"],
      onChange: noop,
      items: [
        { value: "a", label: "Bir", marker: "A", shortcut: "1" },
        { value: "b", label: "İki", marker: "B", shortcut: "2" },
      ],
    });
    expect(out.match(/<input[^>]*type="radio"/g)).toHaveLength(2);
    expect(out).toMatch(/<input[^>]*value="b"[^>]*checked=""|<input[^>]*checked=""[^>]*value="b"/);
    expect(out).toContain("<kbd");
    expect(out).toMatch(/role="radiogroup"/);
  });

  it("uses checkboxes for multiple choice", () => {
    expect(html(ChoiceCardGroup, { type: "multi", name: "q2", value: [], onChange: noop, items: [{ value: "a", label: "Bir" }] })).toMatch(/type="checkbox"/);
  });

  it("is a named group whose disabled cards cannot be chosen, and every card is at least 44px high", () => {
    const out = html(ChoiceCardGroup, {
      type: "multi",
      name: "q3",
      value: [],
      onChange: noop,
      labelledBy: "q3-title",
      describedBy: "q3-why",
      items: [
        { value: "a", label: "Bir" },
        { value: "b", label: "İki", disabled: true },
      ],
    });
    expect(out).toMatch(/^<div role="group" aria-labelledby="q3-title" aria-describedby="q3-why"/);
    const input = (v: string) => out.match(new RegExp(`<input[^>]*value="${v}"[^>]*>`))?.[0] ?? "";
    expect(input("b")).toContain('disabled=""');
    expect(input("a")).not.toContain("disabled");
    expect(out).toContain("min-h-14");
    expect(html(ChoiceCardGroup, { type: "single", name: "s", value: [], onChange: noop, size: "square", items: [{ value: "1", label: "1" }] })).toContain("min-h-16");
  });
});

describe("StatusScreen, IconRow and PathSteps", () => {
  it("StatusScreen leads with a hidden drawing and a heading", () => {
    const out = html(StatusScreen, { illustration: "closed", title: "Bu pozisyon için değerlendirme kapandı", body: "İlgin için teşekkürler." });
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"[\s\S]*<h1[^>]*>Bu pozisyon için değerlendirme kapandı<\/h1>/);
  });

  it("IconRow puts a meaningful icon in a neutral box, hidden from readers", () => {
    const out = html(IconRow, { icon: Clock, title: "Bağlantı ve yükleme sorunları" });
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(out).toContain("bg-secondary");
    expect(out).not.toContain("accent");
  });

  it("PathSteps marks the current step for readers and draws done steps with a check", () => {
    const out = html(PathSteps, { steps: [{ title: "Bir", state: "done" }, { title: "İki", state: "current" }, { title: "Üç" }] });
    expect(out.match(/<li/g)).toHaveLength(3);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("PathSteps says done and still to come in words to readers, in the candidate's language, and nothing for a step without a state", () => {
    const steps = [{ title: "Bir", state: "done" }, { title: "İki", state: "current" }, { title: "Üç", state: "todo" }, { title: "Dört" }];
    const tr = html(PathSteps, { steps });
    expect(tr.match(/<span class="sr-only">[^<]*<\/span>/g)).toEqual(['<span class="sr-only">tamamlandı</span>', '<span class="sr-only">sırada</span>']);
    expect(tr).toMatch(/Bir[\s\S]*tamamlandı[\s\S]*Üç[\s\S]*sırada/);
    const en = html(PathSteps, { steps, locale: "en" });
    expect(en.match(/<span class="sr-only">[^<]*<\/span>/g)).toEqual(['<span class="sr-only">done</span>', '<span class="sr-only">up next</span>']);
  });

  it("StepScreen split puts the title region first and becomes one column below 1024px", () => {
    const out = html(StepScreen, { layout: "split", title: "Merhaba Elif", illustration: "welcome", lead: "Kısa." });
    expect(out).toContain("lg:grid-cols-");
    expect(out).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Merhaba Elif<\/h1>/);
  });

  it("StepScreen moves only on an in-page step change (enter); then it rises when motion is welcome and only fades under reduced motion (2.3)", () => {
    for (const layout of ["split", "single"]) {
      // First load and a route change: no animation at all.
      expect(html(StepScreen, { layout, title: "x" })).not.toContain("animate-");
      const out = html(StepScreen, { layout, title: "x", enter: true });
      expect(out).toContain("motion-safe:animate-[step-in_200ms_ease-out]");
      expect(out).toContain("motion-reduce:animate-[fade-in_200ms_ease-out]");
      expect(out).not.toMatch(/(^|\s)animate-\[step-in/);
    }
  });
});

describe("FactTiles, Disclosure and MediaStage", () => {
  it("FactTiles pairs each value with its meaning in a description list", () => {
    const out = html(FactTiles, { items: [{ icon: Clock, value: "25 dk", label: "Süre" }, { icon: Layers, value: "2", label: "Aşama" }] });
    expect(out.match(/<dt/g)).toHaveLength(2);
    expect(out.match(/<dd/g)).toHaveLength(2);
    expect(out).toContain("25 dk");
  });

  it("Disclosure is a closed button that says what is behind it, 48px high", () => {
    const out = html(Disclosure, { label: "Rıza metninin tamamı", children: "Uzun metin" });
    expect(out).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(out).toContain("Rıza metninin tamamı");
    expect(out).toContain("min-h-12");
  });

  it("MediaStage puts the question first and the picture beside it", () => {
    const out = html(MediaStage, { question: "Soru", preview: "Önizleme", below: "Alt" });
    expect(out.indexOf("Soru")).toBeLessThan(out.indexOf("Önizleme"));
    expect(out).toContain("lg:grid-cols-");
  });
});

describe("globals.css gains only the step motion and the footer's scroll padding (shared with the exam)", () => {
  const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("has the step-in and fade-in keyframes and pads scrolling only on a page with a step footer", () => {
    expect(css).toMatch(/@keyframes step-in \{[\s\S]*?translateY\(8px\)/);
    expect(css).toMatch(/@keyframes fade-in \{/);
    expect(css).toMatch(/html:has\(\[data-step-footer\]\) \{\s*scroll-padding-bottom: calc\(var\(--step-footer-space, 112px\) \+ 8px\);\s*\}/);
    expect(css.match(/scroll-padding/g)).toHaveLength(1);
  });
});
