import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_BAR_WIDTH, examBarLabelBudget } from "@/components/visual/footer-action";
import { edgeFadeMask, nextButtonKind, overflowEdges, partCounter } from "./exam-bar";

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
