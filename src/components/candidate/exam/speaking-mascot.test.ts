import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/i18n/candidate-client", () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}(${Object.values(values).join(",")})` : key),
}));
vi.mock("next-intl", () => ({ useLocale: () => "en" }));

import type { CandidateItem } from "@/lib/exam/safe";
import { SpeakingItem } from "./MediaItems";
import { SpeakingMascot } from "./SpeakingMascot";

/**
 * The mascot on the speaking task of a course test (spec 2026-10-28). The server render is the
 * first frame a visitor gets: nothing typed yet, the whole bubble already laid out.
 */

const LINE = "Stellen Sie sich bitte vor.";

const item = (over: Partial<CandidateItem> = {}): CandidateItem =>
  ({
    sequence: 7,
    stimulus: null,
    answer: null,
    section: "SPEAKING",
    type: "SPEAKING_PROMPT",
    prompt: `${LINE} Sagen Sie Ihren Namen und woher Sie kommen.`,
    content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 },
    ...over,
  }) as CandidateItem;

const bubble = (talk: boolean, line = LINE) => renderToStaticMarkup(createElement(SpeakingMascot, { line, talk }));
const screen = (props: { courseTest?: boolean; item?: CandidateItem } = {}) =>
  renderToStaticMarkup(
    createElement(SpeakingItem, { token: "t", sectionPosition: 5, item: props.item ?? item(), answer: {}, onChange: () => {}, engine: null, ...(props.courseTest === undefined ? {} : { courseTest: props.courseTest }) }),
  );

describe("the speech bubble", () => {
  it("is decoration: hidden from assistive technology, because the card beside it has the same sentence", () => {
    const html = bubble(true);
    expect(html).toMatch(/^<div data-speaking-mascot="true" aria-hidden="true"/);
    expect(html).toContain('lang="de"');
    // The mascot drawing is the talk pose.
    expect(html).toContain('data-pose="talk"');
  });

  it("while it is typed in has the whole bubble laid out from the first frame: nothing typed yet, the rest invisible", () => {
    const html = bubble(true);
    expect(html).toContain(`<span></span><span class="invisible">${LINE}</span>`);
    // The mouth moves from the first letter.
    expect(html).toContain('data-talking="true"');
    expect(html).toContain("motion-safe:animate-[mascot-talk_");
  });

  it("shows the whole sentence and a closed mouth when it is not to be typed (opened later, or recording)", () => {
    const html = bubble(false);
    expect(html).toContain(`<span>${LINE}</span><span class="invisible"></span>`);
    expect(html).not.toContain("data-talking");
    expect(html).not.toContain("animate");
  });

  it("is drawn in logical directions: the mascot turns round for a right-to-left page, the tail stays on the start side", () => {
    const html = bubble(true);
    expect(html).toContain("rtl:-scale-x-100");
    expect(html).toContain("-start-[7px]");
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
  });

  it("sits in the flow: nothing fixed, absolute or sticky around the mascot, so it cannot cover the recorder or the clock", () => {
    const row = bubble(true).match(/^<div[^>]*class="([^"]*)"/)?.[1] ?? "";
    expect(row).not.toMatch(/\b(?:fixed|absolute|sticky|z-)/);
  });
});

describe("the speaking task screen of a course test", () => {
  it("puts the mascot at the top of the task column, before the card, and not in the recorder column", () => {
    const html = screen({ courseTest: true });
    const mascot = html.indexOf("data-speaking-mascot");
    expect(mascot).toBeGreaterThan(-1);
    expect(html.match(/data-speaking-mascot/g)).toHaveLength(1);
    // Inside the split, before the task card and the recorder.
    expect(html.indexOf("lg:grid-cols-2")).toBeLessThan(mascot);
    expect(mascot).toBeLessThan(html.indexOf('data-role="task"'));
    expect(mascot).toBeLessThan(html.indexOf('data-speaking-phase="'));
    // The recorder column has none of it.
    expect(html.slice(html.indexOf('data-speaking-phase="'))).not.toContain("data-speaking-mascot");
  });

  it("says the first sentence of the task, and the card still shows the whole task", () => {
    const html = screen({ courseTest: true });
    expect(html).toContain(`<span class="invisible">${LINE}</span>`);
    expect(html).toContain("Sagen Sie Ihren Namen und woher Sie kommen.");
  });

  it("keeps the recorder as it was: one camera, the big start button, the prepare step", () => {
    const html = screen({ courseTest: true });
    expect(html.match(/<video/g)).toHaveLength(1);
    expect(html).toContain('data-speaking-phase="THINKING"');
    expect(html).toContain("speakingStart");
    expect(html).toContain('role="timer"');
  });

  it("opened again after the answer was recorded, the line is whole and the mouth is closed", () => {
    const html = screen({ courseTest: true, item: item({ takesUsed: 1 } as Partial<CandidateItem>) });
    expect(html).toContain('data-speaking-phase="DONE"');
    expect(html).toContain(`<span>${LINE}</span><span class="invisible"></span>`);
    expect(html).not.toContain("data-talking");
  });

  it("shows no mascot when the prompt has no sentence to say", () => {
    expect(screen({ courseTest: true, item: item({ prompt: "  " }) })).not.toContain("data-speaking-mascot");
  });
});

describe("every other exam", () => {
  it("has no mascot on the speaking task, whether the flag is off or not given, and is drawn exactly as before", () => {
    const plain = screen();
    expect(plain).not.toContain("data-speaking-mascot");
    expect(plain).not.toContain('data-pose="talk"');
    expect(screen({ courseTest: false })).toBe(plain);
  });

  it("differs from a course test's screen only by the mascot row", () => {
    const withMascot = screen({ courseTest: true });
    const row = withMascot.slice(withMascot.indexOf("<div data-speaking-mascot"), withMascot.indexOf("</svg>") + 6);
    expect(row.length).toBeGreaterThan(0);
    // Cut the row out: what is left is the plain screen.
    const bubbleEnd = withMascot.indexOf("</p></div></div>", withMascot.indexOf("<div data-speaking-mascot")) + "</p></div></div>".length;
    const without = withMascot.slice(0, withMascot.indexOf("<div data-speaking-mascot")) + withMascot.slice(bubbleEnd);
    expect(without).toBe(screen());
  });
});
