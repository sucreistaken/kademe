import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("next-intl", async (orig) => ({ ...(await orig<typeof import("next-intl")>()), useLocale: () => "en" }));

import type { CandidateItem } from "@/lib/exam/safe";
import { ImageSrcContext } from "./ExamImage";
import { ItemView } from "./ItemView";

const img = (slot: string, alt: string) => ({ slot, w: 640, h: 480, alt });

const render = (item: CandidateItem) =>
  renderToStaticMarkup(
    createElement(ImageSrcContext.Provider, { value: { token: "tok en", position: 2 } }, createElement(ItemView, { item, answer: {}, onChange: () => {} })),
  );

function choice(options: Array<{ id: string; text: string; image?: ReturnType<typeof img> }>): CandidateItem {
  return {
    sequence: 7,
    section: "READING",
    type: "SINGLE_CHOICE",
    prompt: "Welches Bild passt?",
    content: { kind: "CHOICE", multiple: false, options },
    stimulus: null,
    answer: null,
  } as CandidateItem;
}

describe("picture choice", () => {
  const three = choice([
    { id: "oa1", text: "Bild A", image: img("oa1", "Ein roter Bus") },
    { id: "ob2", text: "Bild B", image: img("ob2", "Ein Fahrrad") },
    { id: "oc3", text: "Bild C", image: img("oc3", "Ein Zug") },
  ]);

  it("draws a three column grid of picture cards with alt text and slot URLs", () => {
    const html = render(three);
    expect(html).toContain("grid-cols-2 sm:grid-cols-3");
    expect(html).toContain('aria-label="A: Ein roter Bus"');
    expect(html).toContain('aria-label="C: Ein Zug"');
    expect(html).toContain('alt="Ein roter Bus"');
    expect(html).toContain('width="640" height="480"');
    expect(html).toContain("/api/c/tok%20en/exam/image/2/7/oa1");
    expect(html).not.toMatch(/storage|key=|\.webp/);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
  });

  it("does not print a bare 'Bild X' label under the picture", () => {
    expect(render(three)).not.toContain("Bild A");
  });

  it("prints real option text and uses two columns for four options", () => {
    const html = render(
      choice([1, 2, 3, 4].map((n) => ({ id: `o${n}`, text: n === 1 ? "Am Bahnhof" : `Bild ${"ABCD"[n - 1]}`, image: img(`o${n}`, `Bild ${n}`) }))),
    );
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("Am Bahnhof");
  });

  it("leaves a text-only choice item as the plain list", () => {
    const html = render(choice([{ id: "o1", text: "Der Bus" }, { id: "o2", text: "Der Zug" }]));
    expect(html).toContain("flex flex-col gap-2");
    expect(html).not.toContain("grid-cols");
    expect(html).not.toContain("<img");
  });
});

describe("picture matching", () => {
  const item = {
    sequence: 3,
    section: "READING",
    type: "MATCHING",
    prompt: "Welches Bild passt?",
    content: {
      kind: "MATCHING",
      left: [{ id: "l1", text: "Sie sucht ein Fahrrad." }],
      right: [
        { id: "oa1", text: "Bild A", image: img("oa1", "Ein Fahrrad") },
        { id: "ob2", text: "Bild B", image: img("ob2", "Ein Bus") },
      ],
    },
    stimulus: null,
    answer: null,
  } as CandidateItem;

  it("shows a lettered gallery above one dropdown button per row, with no letter chips", () => {
    const html = render(item);
    expect(html).toContain('alt="Ein Fahrrad"');
    expect(html).toContain("/api/c/tok%20en/exam/image/2/3/ob2");
    expect(html).not.toContain("Bild A");
    expect(html).not.toContain('role="radio"');
    expect(html.match(/aria-haspopup="listbox"/g)).toHaveLength(1);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("aria-haspopup"));
  });
});

describe("task pictures", () => {
  it("puts writing pictures above the task card", () => {
    const html = render({
      sequence: 4,
      section: "WRITING",
      type: "WRITING_PROMPT",
      prompt: "Beschreiben Sie das Bild.",
      content: { kind: "WRITING", minWords: 20, maxWords: 80, images: [img("p0", "Ein Park"), img("p1", "Ein See")] },
      stimulus: null,
      answer: null,
    } as CandidateItem);
    expect(html).toContain("/api/c/tok%20en/exam/image/2/4/p0");
    expect(html).toContain("/api/c/tok%20en/exam/image/2/4/p1");
    expect(html).toContain('alt="Ein Park"');
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("Beschreiben"));
  });
});

describe("tick-n live region", () => {
  it("renders an empty polite region for the 'full' announcement next to the counter", () => {
    const item = { ...choice([1, 2, 3].map((n) => ({ id: `o${n}`, text: `Text ${n}` }))) } as CandidateItem;
    (item as { content: { multiple: boolean; pick?: number } }).content = { ...(item.content as object), kind: "CHOICE", multiple: true, pick: 2, options: [1, 2, 3].map((n) => ({ id: `o${n}`, text: `Text ${n}` })) } as never;
    const html = render(item);
    expect(html).toContain('<span aria-live="polite" class="sr-only"></span>');
    expect(html).toContain("0/2");
  });
});
