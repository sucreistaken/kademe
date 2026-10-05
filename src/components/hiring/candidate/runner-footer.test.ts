import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StepFooter } from "@/components/visual/step-footer";
import { keepsStage, requiredKey, runnerPrimary, undoFocus, type RunnerFooterState } from "./runner-footer";

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
