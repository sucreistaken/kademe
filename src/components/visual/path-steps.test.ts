import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { frozenMarkup } from "./frozen-markup";
import { PathSteps } from "./path-steps";

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(PathSteps as never, props as never));

/** The candidate side's paths and the panel's before the setup look (captured at the commit before Task 7). */
const CASES: Array<Record<string, unknown>> = [
  { label: "Yol", steps: [{ title: "Bir", state: "done" }, { title: "İki", state: "current", detail: "Ayrıntı", action: createElement("a", { href: "/x" }, "Git") }, { title: "Üç", state: "todo" }, { title: "Dört" }] },
  { locale: "en", steps: [{ title: "One", state: "done" }, { title: "Two", state: "current" }] },
];

describe("PathSteps", () => {
  it("draws the list look exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/path-steps.default-markup.json", now));
  });

  it("setup look: numbered 30px circles, done in the accent with a check, the current row on accent-soft with its action at the right (mockup 5)", () => {
    const out = html({ look: "setup", label: "Yayına hazırlık", steps: [{ title: "Değerlendirmeyi kur", state: "done", detail: "8 soru" }, { title: "Ekibi ata", state: "current", action: createElement("a", { href: "/t" }, "Ekibe ekle") }, { title: "Yayınla", state: "todo" }] });
    expect(out).toContain('<ol aria-label="Yayına hazırlık"');
    expect(out).toContain("border-accent bg-accent text-white");
    expect(out).toContain("lucide-check");
    expect(out).toMatch(/<li aria-current="step" class="[^"]*bg-accent-soft[^"]*">/);
    expect(out).toContain("border-accent bg-surface text-accent");
    expect(out).toMatch(/<div class="shrink-0"><a href="\/t">Ekibe ekle<\/a><\/div><\/li>/);
    expect(out).toContain('<span class="sr-only">tamamlandı</span>');
    expect(out).toContain('<span class="sr-only">sırada</span>');
  });
});
