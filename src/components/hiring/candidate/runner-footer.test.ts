import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeKind, refocusAfterTimeUp } from "./recorded-footer";
import { StepFooter } from "@/components/visual/step-footer";
import { fileFooterPlan, keepsStage, skipFocus, needsFileChoice, requiredKey, runnerPrimary, undoFocus, type RunnerFooterState } from "./runner-footer";

/**
 * STATUS item 23 ("soluk, nedensiz"): before Task 10 the runner's own button was
 * `disabled={busy || why !== null}` with no reason while busy, so a save turned
 * it grey for a moment with nothing next to it. The live reproduction needs a
 * browser (not available in this session); this is the static proof that no
 * runner footer state draws a natively disabled button without its reason, and
 * that a working one stays filled and aria-disabled.
 */
const words = {
  label: "Sonraki soru",
  retry: "Tekrar dene",
  busy: "Kaydediliyor",
  sending: "Gönderiliyor. Vazgeçersen Geri al düğmesine bas.",
  timeUp: "Süre doldu. Cevapların kaydediliyor.",
  uploading: "Dosya yüklenince devam edebilirsin.",
  required: "Önce cevabını yaz.",
};
const idle: RunnerFooterState = { retrying: false, busy: false, delayed: false, locked: false, uploading: false, required: true, answered: true };
const noop = () => undefined;
const render = (state: RunnerFooterState) => renderToStaticMarkup(createElement(StepFooter, { primary: { ...runnerPrimary({ state, words }), onClick: noop } }));
const button = (html: string) => html.match(/<button[^>]*id="activity-next"[^>]*>/)?.[0] ?? "";

const states: Record<string, RunnerFooterState> = {
  ready: idle,
  saving: { ...idle, busy: true },
  "saving at time up": { ...idle, busy: true, locked: true },
  "saving with nothing answered": { ...idle, busy: true, answered: false },
  retrying: { ...idle, retrying: true },
  "retrying at time up": { ...idle, retrying: true, locked: true },
  "waiting for an answer": { ...idle, answered: false },
  "waiting for an upload": { ...idle, uploading: true },
  "waiting for the send strip": { ...idle, delayed: true },
  "time up": { ...idle, locked: true },
};

describe("the runner's footer button (STATUS item 23, plan decision 4)", () => {
  for (const [name, state] of Object.entries(states)) {
    it(`never draws a disabled button without its reason next to it: ${name}`, () => {
      const html = render(state);
      const tag = button(html);
      expect(tag).not.toBe("");
      if (tag.includes('disabled=""')) {
        expect(tag).toContain('aria-describedby="activity-next-why"');
        expect(html).toMatch(/<p id="activity-next-why"[^>]*>[^<]+<\/p>/);
      }
    });
  }

  it("keeps a saving button filled, focusable and aria-disabled, with its work on it and no grey", () => {
    for (const state of [states.saving, states["saving at time up"], states["saving with nothing answered"]]) {
      const html = render(state);
      const tag = button(html);
      expect(tag).toContain('aria-disabled="true"');
      expect(tag).not.toContain('disabled=""');
      expect(tag).toContain("bg-accent");
      expect(html).toContain("Kaydediliyor");
      expect(html).not.toContain("activity-next-why");
    }
  });

  it("says each reason it waits for, the send strip and the time first", () => {
    // Positive control for the loop above: a waiting state really is a disabled button.
    expect(button(render(states["waiting for an answer"]))).toContain('disabled=""');
    expect(render(states["waiting for an answer"])).toContain(words.required);
    expect(render(states["waiting for an upload"])).toContain(words.uploading);
    expect(render({ ...idle, delayed: true, answered: false })).toContain(words.sending);
    expect(render({ ...idle, locked: true, uploading: true, answered: false })).toContain(words.timeUp);
  });

  it("an optional question that is empty, or one that is answered, does not wait", () => {
    expect(button(render({ ...idle, required: false, answered: false }))).not.toContain('disabled=""');
    expect(button(render(idle))).not.toContain('disabled=""');
  });

  it("after a failed submit it offers the retry, ready, even at time up", () => {
    const html = render(states["retrying at time up"]);
    expect(html).toContain("Tekrar dene");
    expect(button(html)).not.toContain('disabled=""');
  });

  it("names the right thing a required question waits for", () => {
    expect(requiredKey("SINGLE_CHOICE")).toBe("requiredChoice");
    expect(requiredKey("MULTI_CHOICE")).toBe("requiredChoice");
    expect(requiredKey("LONG_TEXT")).toBe("requiredText");
    expect(requiredKey("SHORT_TEXT")).toBe("requiredText");
    expect(requiredKey("FILE_UPLOAD")).toBe("requiredReason");
    expect(requiredKey(null)).toBe("requiredReason");
  });
});

describe("the state a last commit hands the runner (Task 10 fix round 1, Minor 2)", () => {
  it("is taken only while it is still this stage; the next stage or no stage at all is left to the submit", () => {
    expect(keepsStage({ current: { position: 2 } } as never, 2)).toBe(true);
    expect(keepsStage({ current: { position: 3 } } as never, 2)).toBe(false);
    expect(keepsStage({ current: null } as never, 2)).toBe(false);
  });
});

describe("where focus goes after Geri al (Task 9 carry)", () => {
  const target = (name: string, log: string[]) => ({ focus: () => void log.push(name) });

  it("returns to the runner's own button when it is there", () => {
    const log: string[] = [];
    undoFocus((id) => (id === "activity-next" || id === "record-use" ? target(id, log) : null), target("heading", log));
    expect(log).toEqual(["activity-next"]);
  });

  it("on a recorded question returns to its use button, or the written send, and else to the heading", () => {
    const log: string[] = [];
    undoFocus((id) => (id === "record-use" ? target(id, log) : null), target("heading", log));
    undoFocus((id) => (id === "send-written" ? target(id, log) : null), target("heading", log));
    undoFocus(() => null, target("heading", log));
    expect(log).toEqual(["record-use", "send-written", "heading"]);
  });
});

describe("the file question's footer (Task 11, G2)", () => {
  const free = { type: "FILE_UPLOAD" as const, answered: false, uploading: false, inputsOff: false, retrying: false };

  it("asks for a file only on a file question that has none and is open", () => {
    expect(needsFileChoice(free)).toBe(true);
    expect(needsFileChoice({ ...free, type: "LONG_TEXT" })).toBe(false);
    expect(needsFileChoice({ ...free, answered: true })).toBe(false);
    expect(needsFileChoice({ ...free, uploading: true })).toBe(false);
    expect(needsFileChoice({ ...free, inputsOff: true })).toBe(false);
    expect(needsFileChoice({ ...free, retrying: true })).toBe(false);
  });

  it("puts the filled button on 'Dosya seç' and, on an optional question, passes with the outline 'Sonraki soru'", () => {
    expect(fileFooterPlan({ choosing: true, required: false })).toEqual({ primary: "choose", secondary: "skip" });
    expect(fileFooterPlan({ choosing: true, required: true })).toEqual({ primary: "choose", secondary: null });
  });

  it("leaves the runner's own button alone when a file is there or the question is waiting", () => {
    expect(fileFooterPlan({ choosing: false, required: true })).toEqual({ primary: "next", secondary: null });
    expect(fileFooterPlan({ choosing: false, required: false })).toEqual({ primary: "next", secondary: null });
  });

  it("returns focus to the skip button too after Geri al", () => {
    const log: string[] = [];
    undoFocus((id) => (id === "activity-skip" ? { focus: () => void log.push(id) } : null), { focus: () => void log.push("heading") });
    expect(log).toEqual(["activity-skip"]);
  });
});

describe("focus around the file question's footer (Task 11 fix round 1, Important 1 and 2)", () => {
  it("keeps 'Dosya seç' or 'Sonraki soru' (skip) on a failure that leaves the question open: the pressed button is back", () => {
    expect(skipFocus({ pressedOn: "q1", activityId: "q1", busy: false, active: "body" })).toBe("focus");
    expect(skipFocus({ pressedOn: "q1", activityId: "q1", busy: false, active: "disabled-control" })).toBe("focus");
  });

  it("waits while the close is working, and forgets once the question moved on (the new heading took focus)", () => {
    expect(skipFocus({ pressedOn: "q1", activityId: "q1", busy: true, active: "body" })).toBe("wait");
    expect(skipFocus({ pressedOn: "q1", activityId: "q2", busy: false, active: "body" })).toBe("drop");
    expect(skipFocus({ pressedOn: "q1", activityId: null, busy: false, active: "body" })).toBe("drop");
  });

  it("does nothing when skip was never pressed, or focus went somewhere on purpose", () => {
    expect(skipFocus({ pressedOn: null, activityId: "q1", busy: false, active: "body" })).toBe("drop");
    expect(skipFocus({ pressedOn: "q1", activityId: "q1", busy: false, active: "other" })).toBe("drop");
  });

  it("an upload that starts from the card or from 'Dosya seç' takes focus to the heading only from nothing or a disabled button", () => {
    // the card with the focused "Değiştir" unmounted (body), or the footer button turned into a waiting one
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: activeKind(null, {}) })).toBe(true);
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: activeKind({ tagName: "BUTTON", disabled: true }, {}) })).toBe(true);
    // a focused, working control (an aria-disabled button) or a field keeps its focus
    expect(refocusAfterTimeUp({ timeUp: true, wasTimeUp: false, active: activeKind({ tagName: "BUTTON", disabled: false }, {}) })).toBe(false);
  });
});
