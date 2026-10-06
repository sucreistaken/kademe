import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FileText, Headset, Plus } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ChoiceCardGroup } from "./choice-card";
import { frozenMarkup } from "./frozen-markup";

const noop = () => undefined;
const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(ChoiceCardGroup as never, props as never));

/** What the candidate screens and the panel drew before the panel looks existed (captured at dd1f34e). */
const CASES: Array<Record<string, unknown>> = [
  { type: "single", name: "q1", value: ["b"], onChange: noop, items: [{ value: "a", label: "Birinci", marker: "A", shortcut: "1" }, { value: "b", label: "İkinci", marker: "B", shortcut: "2", description: "Açıklama" }] },
  { type: "multi", name: "q2", value: ["x"], onChange: noop, labelledBy: "l", describedBy: "d", items: [{ value: "x", label: "Kadir Ay", marker: "KA", description: "Sahip" }, { value: "y", label: "Ece", disabled: true }] },
  { type: "single", name: "q3", value: [], onChange: noop, columns: 2, items: [{ value: "AI", label: "İlan", marker: FileText, description: "Gövde" }] },
  { type: "single", name: "q4", value: ["3"], onChange: noop, size: "square", columns: 5, items: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })) },
  { type: "single", name: "q5", value: [], onChange: noop, disabled: true, items: [{ value: "a", label: "Kapalı" }] },
];

describe("ChoiceCardGroup's default look stays as it was", () => {
  it("draws every default case exactly as before the panel looks", () => {
    const now = CASES.map(html);
    expect(now).toEqual(frozenMarkup("src/components/visual/choice-card.default-markup.json", now));
  });
});

describe("ChoiceCardGroup's panel looks (manager mockup 3, 4, 6)", () => {
  it("panel: an accent-soft icon tile, the radio mark at the right, the chosen card in accent with a soft ring", () => {
    const out = html({
      type: "single",
      name: "p",
      value: ["a"],
      onChange: noop,
      look: "panel",
      items: [
        { value: "a", label: "Müşteri Destek Uzmanı", description: "3 yetkinlik · ilan metni var", marker: Headset },
        { value: "new", label: "Yeni bir pozisyon", description: "Adını yaz", marker: Plus, tone: "new" },
      ],
    });
    expect(out).toContain("bg-accent-soft text-accent");
    expect(out).toContain("lucide-headset");
    expect(out).toContain("has-[:checked]:border-accent has-[:checked]:bg-accent-soft");
    expect(out).toContain("has-[:checked]:shadow-[0_0_0_3px_rgb(14_106_87/0.08)]");
    expect(out.match(/rounded-full peer-checked:border-\[6px\] peer-checked:border-accent/g)).toHaveLength(2);
    // React writes an input's attributes in its own order, so the checks do not depend on it.
    const input = out.match(/<input[^>]*value="a"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('type="radio"');
    expect(input).toContain('name="p"');
    expect(input).toContain('checked=""');
    expect(input).toContain('class="peer sr-only"');
    // The card that adds something new is dashed, its tile too.
    expect(out).toContain("border-dashed border-line bg-transparent");
    expect(out).toContain("border-[1.5px] border-dashed border-underline text-muted");
    // The panel cards offer no key hint.
    expect(out).not.toContain("<kbd");
  });

  it("panel, multi: initials in a round soft tile and a checkbox mark with its check", () => {
    const out = html({ type: "multi", name: "m", value: ["x"], onChange: noop, look: "panel", items: [{ value: "x", label: "Kadir Ay", marker: "KA", description: "Sahip" }] });
    expect(out).toMatch(/rounded-full bg-accent-soft font-bold text-accent[^"]*">KA</);
    expect(out).toContain("peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white");
    expect(out).toContain("lucide-check");
    const box = out.match(/<input[^>]*value="x"[^>]*>/)?.[0] ?? "";
    expect(box).toContain('type="checkbox"');
    expect(box).toContain('name="m"');
    expect(box).toContain('checked=""');
  });

  it("panel-lg: the big 52px tile, a 16px title and the radio at the top right", () => {
    const out = html({ type: "single", name: "s", value: [], onChange: noop, look: "panel-lg", items: [{ value: "AI", label: "İlan metninden öneri al", description: "Sorular önerilir.", marker: FileText }] });
    expect(out).toContain("size-[52px] rounded-xl");
    expect(out).toContain("lucide-file-text");
    expect(out).toContain("block font-semibold text-[16px] leading-6");
    expect(out).toContain("items-start rounded-2xl");
  });
});
