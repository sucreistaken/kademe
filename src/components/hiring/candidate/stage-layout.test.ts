import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlushRegistry } from "@/lib/client/flush-registry";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";
import type { CurrentStage } from "@/solutions/hiring/rules/candidate-state";
import type { CandidateActivity } from "@/solutions/hiring/rules/candidate-view";
import { ChoiceActivity } from "./choice-activity";
import { StageIntro } from "./stage-intro";
import { TextActivity, type ActivityProps } from "./text-activity";

/**
 * HIRING-VISUAL-FLOW 3.5-3.7 (Task 10): the first paint of a stage's intro, a
 * written question and a choice question, rendered without a browser. The
 * layout at 1024/1280/1440, the keys and the focus moves are browser checks.
 */
let width = 1280;
vi.mock("./desktop-gate", async (original) => ({ ...(await original<typeof import("./desktop-gate")>()), useWindowWidth: () => width }));
afterEach(() => {
  width = 1280;
});

const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string }) => ReactNode;
const wrap = (locale: Locale, child: ReactNode) => renderToStaticMarkup(createElement(Provider, { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" }, child));

const question = (over: Partial<CandidateActivity>): CandidateActivity => ({
  id: "q1",
  type: "LONG_TEXT",
  required: true,
  prompt: { tr: "LEAKVISIBLE_PROMPT bir sorunu nasıl çözdün?", en: "How did you solve a problem?" },
  note: { tr: "", en: "" },
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  choices: null,
  minChars: null,
  maxChars: null,
  acceptedMimeTypes: null,
  maxFileBytes: null,
  textAlternativeEnabled: false,
  ...over,
});

const current = (over: Partial<CurrentStage> = {}): CurrentStage => ({
  position: 1,
  total: 2,
  stage: {
    id: "s1",
    name: { tr: "Tanışma", en: "Introductions" },
    description: { tr: "Kısa bir tanışma.", en: "A short introduction." },
    durationSeconds: 600,
    activities: [question({ id: "q1" }), question({ id: "q2", type: "VIDEO" }), question({ id: "q3", type: "SINGLE_CHOICE" })],
  },
  seconds: 600,
  startedAt: null,
  deadlineAt: null,
  serverNow: "2026-10-06T10:00:00.000Z",
  remainingMs: null,
  backNavigation: false,
  graceSeconds: 0,
  autoSubmit: true,
  rules: [{ kind: "think", seconds: 30 }, { kind: "takes", count: 1 }, { kind: "noBack" }],
  responses: [],
  previous: null,
  last: false,
  ...over,
});

const intro = (over: Partial<CurrentStage> = {}, locale: Locale = "tr") =>
  wrap(locale, createElement(StageIntro, { current: current(over), deadline: "19 Ekim 23:59", locale, busy: false, error: null, lostPrevious: null, onStart: () => undefined, headingRef: null }));

describe("the stage intro (3.5)", () => {
  it("names the stage under its kicker, with the facts as tiles and the rules as icon rows", () => {
    const html = intro();
    expect(html).toContain("Aşama 1 / 2");
    expect(html).toMatch(/<h1[^>]*>Tanışma<\/h1>/);
    expect(html).toContain("Kısa bir tanışma.");
    expect(html).toContain("10 dk");
    expect(html).toContain("3 soru");
    expect(html).toContain("1 tekrar");
    expect(html).toContain("her cevapta");
    expect(html).toContain("Her soruda 30 sn düşünme süren var");
    expect(html).toContain("Bu aşamada önceki sorulara geri dönülmez.");
    expect(html).toContain("Son tarih 19 Ekim 23:59.");
  });

  it("puts the clock line next to the one filled start button in the footer", () => {
    const html = intro();
    expect(html.match(/id="stage-start"/g)).toHaveLength(1);
    expect(html).toContain("Aşamayı başlat");
    expect(html).toContain("Süre, başlata bastığında işlemeye başlar.");
    expect(html).toContain("data-step-footer");
    expect(html).not.toMatch(/<button[^>]*id="stage-start"[^>]*disabled=""/);
  });

  it("shows no question of the stage before it starts (leak rule: no question on a preparation screen)", () => {
    const html = intro();
    expect(html).not.toContain("LEAKVISIBLE_PROMPT");
    expect(html).not.toContain("How did you solve");
  });

  it("drops the takes tile when no retake count applies, and flags the last stage", () => {
    const html = intro({ rules: [{ kind: "noRetake" }], last: true });
    expect(html).not.toContain("her cevapta");
    expect(html).toContain("Son aşama.");
  });

  it("below 640px the start waits with its reason next to it (3.0)", () => {
    width = 600;
    const html = intro();
    expect(html).toMatch(/<button[^>]*id="stage-start"[^>]*disabled=""/);
    expect(html).toMatch(/<p id="stage-start-why"[^>]*>Pencereni büyüt, sonra başla\.<\/p>/);
    expect(html).not.toContain("Süre, başlata bastığında işlemeye başlar.");
  });

  it("while it starts the button stays filled and says so", () => {
    const html = wrap("tr", createElement(StageIntro, { current: current(), deadline: "x", locale: "tr", busy: true, error: null, lostPrevious: null, onStart: () => undefined, headingRef: null }));
    expect(html).toMatch(/<button[^>]*id="stage-start"[^>]*aria-disabled="true"/);
    expect(html).toContain("Başlatılıyor");
  });

  it("says in English how the previous stage ended, calmly, above the intro", () => {
    const html = intro({ previous: { position: 1, closedByClock: true }, position: 2 }, "en");
    expect(html).toContain("Time ran out for stage 1.");
    expect(html).toContain("10 min");
    expect(html).toContain("3 questions");
  });
});

const props = (activity: CandidateActivity, over: Partial<ActivityProps> = {}): ActivityProps => ({
  token: "tok",
  position: 1,
  run: "run",
  activity,
  initial: {},
  locale: "tr",
  headingRef: null,
  flushes: new FlushRegistry(),
  onChange: () => undefined,
  disabled: false,
  ...over,
});

describe("a written question (3.6)", () => {
  it("has the pen chip, the question as its heading and a 280px field; the idle line says nothing (it moved to Help)", () => {
    const html = wrap("tr", createElement(TextActivity, props(question({}))));
    expect(html).toContain("Yazılı cevap");
    expect(html).toContain("lucide-pen-line");
    expect(html).toMatch(/<h2[^>]*id="prompt-q1"/);
    expect(html).toContain("min-h-[280px]");
    expect(html).not.toContain("Sekmeyi kapatsan bile yazdığın kalır.");
  });

  it("a short answer keeps its small field", () => {
    const html = wrap("tr", createElement(TextActivity, props(question({ type: "SHORT_TEXT" }))));
    expect(html).toContain("Kısa cevap");
    expect(html).toContain("min-h-24");
    expect(html).not.toContain("min-h-[280px]");
  });
});

describe("a choice question (3.7)", () => {
  const choices = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: { tr: `Seçenek metni ${i + 1}`, en: `Choice ${i + 1}` } }));

  it("draws letter cards with native radios hidden, a key hint each and a spoken letter", () => {
    const html = wrap("tr", createElement(ChoiceActivity, props(question({ type: "SINGLE_CHOICE", choices: choices(3) }))));
    expect(html).toContain("Tek seçim");
    expect(html).toContain("lucide-list-checks");
    expect(html).toMatch(/role="radiogroup" aria-labelledby="prompt-q1"/);
    expect(html.match(/<input[^>]*type="radio"[^>]*class="peer sr-only"/g)).toHaveLength(3);
    expect(html.match(/<kbd/g)).toHaveLength(3);
    expect(html).toContain('<span class="sr-only">Seçenek A: </span>');
    expect(html).not.toContain("Klavyede 1-");
    // Three options sit in one column.
    expect(html).not.toContain("sm:grid-cols-2");
  });

  it("lays more than four options in two columns and lets multiple choice pick several", () => {
    const html = wrap("tr", createElement(ChoiceActivity, props(question({ type: "MULTI_CHOICE", choices: choices(5) }))));
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("Birden fazla seçebilirsin.");
    expect(html.match(/type="checkbox"/g)).toHaveLength(5);
  });

  it("a closed group offers no key, and points at the reason the runner shows", () => {
    const html = wrap("tr", createElement(ChoiceActivity, props(question({ type: "SINGLE_CHOICE", choices: choices(2) }), { disabled: true, reasonId: "closed-q1" })));
    expect(html).not.toContain("<kbd");
    expect(html).toMatch(/aria-describedby="closed-q1"/);
    expect(html.match(/<input[^>]*disabled=""/g)).toHaveLength(2);
  });
});
