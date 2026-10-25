import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_BAR_WIDTH, examBarLabelBudget } from "@/components/visual/footer-action";
import type { TypedT } from "@/i18n/candidate-client";
import { edgeFadeMask, nextButtonKind, overflowEdges, partCounter, showSelfView, speakingBarMode, speakingFooter } from "./exam-bar";
import type { SpeakingPhase } from "./speaking-flow";

describe("nextButtonKind", () => {
  it("says next while a page follows and finish on the last one", () => {
    expect(nextButtonKind(5)).toBe("next");
    expect(nextButtonKind(0)).toBe("next");
    expect(nextButtonKind(null)).toBe("finish");
  });
});

describe("partCounter", () => {
  it("counts a question of several parts", () => {
    expect(partCounter({ filled: 1, total: 4 })).toEqual({ filled: 1, total: 4 });
    expect(partCounter({ filled: 0, total: 3 })).toEqual({ filled: 0, total: 3 });
    expect(partCounter({ filled: 4, total: 4 })).toEqual({ filled: 4, total: 4 });
  });

  it("stays out of the way for a single-part or unknown question", () => {
    expect(partCounter({ filled: 1, total: 1 })).toBeNull();
    expect(partCounter({ filled: 0, total: 0 })).toBeNull();
    expect(partCounter(undefined)).toBeNull();
    expect(partCounter(null)).toBeNull();
  });

  it("keeps the numbers inside the range", () => {
    expect(partCounter({ filled: 9, total: 4 })).toEqual({ filled: 4, total: 4 });
    expect(partCounter({ filled: -1, total: 4 })).toEqual({ filled: 0, total: 4 });
  });
});

describe("overflowEdges", () => {
  it("shows no fade when everything fits", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }, false)).toEqual({ left: false, right: false });
  });

  it("fades the far edge at the start and the near edge at the end (left to right)", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: false, right: true });
    expect(overflowEdges({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: true, right: true });
    expect(overflowEdges({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 }, false)).toEqual({ left: true, right: false });
  });

  it("mirrors the edges for right-to-left (negative scroll offsets)", () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 }, true)).toEqual({ left: true, right: false });
    expect(overflowEdges({ scrollLeft: -300, scrollWidth: 600, clientWidth: 300 }, true)).toEqual({ left: false, right: true });
  });
});

describe("edgeFadeMask", () => {
  it("is absent without overflow and fades only the hidden edges", () => {
    expect(edgeFadeMask({ left: false, right: false })).toBeUndefined();
    expect(edgeFadeMask({ left: false, right: true })?.maskImage).toBe("linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)");
    expect(edgeFadeMask({ left: true, right: false })?.maskImage).toBe("linear-gradient(to right, transparent 0, #000 20px, #000 100%)");
  });
});

describe("the exam bar's labels fit its fixed buttons in every candidate language", () => {
  const LOCALES = ["tr", "en", "de", "es", "ar"] as const;
  type Messages = { examNav: Record<string, string>; cheatWarning: Record<string, string> };
  const messages = (l: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), `src/i18n/messages/candidate.${l}.json`), "utf8")) as Messages;
  // What ExamRunner puts in the bar (the busy "saving" label is screen-reader only there).
  const slots = [
    { slot: "back", width: EXAM_BAR_WIDTH.back, icon: true, labels: (m: Messages) => [m.examNav.back] },
    { slot: "flag", width: EXAM_BAR_WIDTH.flag, icon: true, labels: (m: Messages) => [m.examNav.flag, m.cheatWarning.flagSet] },
    { slot: "primary", width: EXAM_BAR_WIDTH.primary, icon: false, labels: (m: Messages) => [m.examNav.next, m.examNav.finish] },
  ];

  it("gives every slot a budget the longest label of the five languages stays within", () => {
    for (const { slot, width, icon, labels } of slots) {
      const budget = examBarLabelBudget(width, icon);
      for (const l of LOCALES) {
        for (const label of labels(messages(l))) {
          expect(label.length, `${l} ${slot} "${label}" (budget ${budget})`).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  it("works out the budget from the width, the padding, the border and the icon", () => {
    expect(examBarLabelBudget(112, true)).toBe(6);
    expect(examBarLabelBudget(168, true)).toBe(11);
    expect(examBarLabelBudget(176, false)).toBe(14);
  });
});

describe("speakingBarMode", () => {
  it("waits while the student prepares or records, offers the way on once it is saved", () => {
    const modes: Array<[SpeakingPhase | null, ReturnType<typeof speakingBarMode>]> = [
      ["THINKING", "prepare"],
      ["RECORDING", "recording"],
      ["UPLOADING", "saving"],
      ["DONE", "next"],
      ["FAILED", "answer"],
      [null, "answer"],
    ];
    for (const [phase, mode] of modes) expect(speakingBarMode(phase), String(phase)).toBe(mode);
  });
});

describe("speakingFooter", () => {
  // The bar's words are the dictionary keys here; the real strings are checked in the render tests.
  const t = ((key: string) => key) as unknown as TypedT<"exam">;
  const base = { filled: false, hasNext: true, busy: false, t, onSkip: () => {}, onSave: () => {} };
  const button = (a: ReturnType<typeof speakingFooter>["primary"] | null) => (a && a.kind === "button" ? a : null);

  it("never shows 'leave blank' or 'give an answer first' while the student prepares or records", () => {
    for (const mode of ["prepare", "recording"] as const) {
      const bar = speakingFooter({ ...base, mode });
      expect(bar.secondary, mode).toBeNull();
      const primary = button(bar.primary)!;
      expect(primary.label).toBe("speakingNext");
      expect(primary.waitReason, mode).toBe(mode === "prepare" ? "speakingWaitPrepare" : "speakingWaitRecording");
      expect(primary.waitReason).not.toBe("answerFirst");
    }
  });

  it("is a busy 'saving' button while the take uploads, with no skip", () => {
    const bar = speakingFooter({ ...base, mode: "saving", filled: true });
    expect(bar.secondary).toBeNull();
    const primary = button(bar.primary)!;
    expect(primary.busy).toBe(true);
    expect(primary.busyLabel).toBe("saving");
  });

  it("offers 'next task' once the take is saved, 'continue' on the last task", () => {
    const next = button(speakingFooter({ ...base, mode: "next", filled: true }).primary)!;
    expect(next.label).toBe("speakingNext");
    expect(next.waitReason ?? null).toBeNull();
    expect(next.busy).toBeFalsy();
    const last = button(speakingFooter({ ...base, mode: "next", filled: true, hasNext: false }).primary)!;
    expect(last.label).toBe("speakingContinue");
  });

  it("keeps the old guard: a saved screen with an empty answer still asks for one", () => {
    expect(button(speakingFooter({ ...base, mode: "next", filled: false }).primary)!.waitReason).toBe("answerFirst");
  });

  it("keeps the usual pair after a failed recording, so the student can skip or type", () => {
    const bar = speakingFooter({ ...base, mode: "answer" });
    expect(button(bar.secondary)!.label).toBe("skip");
    const primary = button(bar.primary)!;
    expect(primary.label).toBe("saveNext");
    expect(primary.waitReason).toBe("answerFirst");
    expect(button(speakingFooter({ ...base, mode: "answer", filled: true }).primary)!.waitReason).toBeNull();
  });

  it("hands the clicks to the caller", () => {
    const calls: string[] = [];
    const bar = speakingFooter({ ...base, mode: "answer", onSkip: () => calls.push("skip"), onSave: () => calls.push("save") });
    button(bar.secondary)!.onClick();
    button(bar.primary)!.onClick();
    expect(calls).toEqual(["skip", "save"]);
  });

  it("keeps the same button id through the phases, so the focus stays on it", () => {
    for (const mode of ["answer", "prepare", "recording", "saving", "next"] as const) {
      expect(button(speakingFooter({ ...base, mode }).primary)!.id, mode).toBe("save-next");
    }
  });
});

describe("showSelfView", () => {
  it("shows the floating camera over proctored questions that have a camera stream", () => {
    expect(showSelfView({ proctored: true, hasStream: true, itemKind: "CHOICE" })).toBe(true);
    expect(showSelfView({ proctored: true, hasStream: true, itemKind: "WRITING" })).toBe(true);
    expect(showSelfView({ proctored: true, hasStream: true, itemKind: undefined })).toBe(true);
  });

  it("never shows it over a speaking question, whose recorder panel has the camera", () => {
    expect(showSelfView({ proctored: true, hasStream: true, itemKind: "SPEAKING" })).toBe(false);
  });

  it("stays away when the exam is not proctored or there is no stream", () => {
    expect(showSelfView({ proctored: false, hasStream: true, itemKind: "CHOICE" })).toBe(false);
    expect(showSelfView({ proctored: true, hasStream: false, itemKind: "CHOICE" })).toBe(false);
  });
});
