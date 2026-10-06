import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { frozenMarkup } from "./frozen-markup";
import { StepScreen } from "./step-screen";

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(StepScreen as never, props as never));

/** The candidate side's and the panel's step screens before the "flow" drawing size (captured at the commit before Task 2). */
const CASES: Array<Record<string, unknown>> = [
  { layout: "split", title: "Merhaba Elif", illustration: "welcome", lead: "Kısa." },
  { layout: "single", width: 640, title: "Link hazır", illustration: "inviteReady", illustrationSize: "spot", kicker: "Aday davet et", children: createElement("p", null, "gövde") },
  { layout: "split", width: 1000, title: "Yayına hazır mı?", aside: createElement("p", null, "yan"), enter: true, children: createElement("p", null, "satırlar") },
  { layout: "single", width: 1000, title: "Tek" },
];

describe("StepScreen", () => {
  it("draws every existing case exactly as before", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/step-screen.default-markup.json", now));
  });

  it("draws a 'flow' drawing above the title at the guided flow's size (manager mockup 3, 6)", () => {
    const out = html({ layout: "split", title: "Hangi pozisyon için?", illustration: "emptyOpenings", illustrationSize: "flow" });
    expect(out).toMatch(/<svg[^>]*class="h-auto shrink-0 w-\[200px\] xl:w-\[260px\] mb-6"/);
    expect(out.indexOf("<svg")).toBeLessThan(out.indexOf("Hangi pozisyon için?"));
  });
});
