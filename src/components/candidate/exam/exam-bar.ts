import type { AnswerProgress } from "@/components/candidate/exam/answer-progress";
import type { SpeakingPhase } from "@/components/candidate/exam/speaking-flow";
import type { FooterAction } from "@/components/visual/footer-action";
import type { TypedT } from "@/i18n/candidate-client";

/**
 * Pure choices of the exam's bottom bar, kept apart from the markup so they can
 * be tested: which word the primary button carries and when a question shows
 * its own fill counter.
 */

/**
 * What the bottom bar of a speaking question offers, by the recorder's phase.
 * While the student prepares or records, "leave blank" and "give an answer
 * first" make no sense: the answer is on its way, so the bar only waits and
 * says why. After the recording it offers the way on. A failed recording (or
 * no recorder yet) keeps the usual pair, so the student can still skip or
 * type the answer.
 */
export type SpeakingBarMode = "answer" | "prepare" | "recording" | "saving" | "next";

export function speakingBarMode(phase: SpeakingPhase | null): SpeakingBarMode {
  switch (phase) {
    case "THINKING":
      return "prepare";
    case "RECORDING":
      return "recording";
    case "UPLOADING":
      return "saving";
    case "DONE":
      return "next";
    default:
      return "answer";
  }
}

/** The two buttons of a speaking question's bar for a mode: the exam and the tutorial's demo bar share them. */
export function speakingFooter(o: {
  mode: SpeakingBarMode;
  /** The answer has something in it (a recording or typed text). */
  filled: boolean;
  /** Another task follows in this section. */
  hasNext: boolean;
  busy: boolean;
  t: TypedT<"exam">;
  onSkip: () => void;
  onSave: () => void;
}): { secondary: FooterAction | null; primary: FooterAction } {
  const { t } = o;
  if (o.mode === "answer") {
    return {
      secondary: { kind: "button", id: "skip-item", label: t("skip"), onClick: o.onSkip },
      primary: { kind: "button", id: "save-next", label: t("saveNext"), busy: o.busy, busyLabel: t("saving"), waitReason: o.filled ? null : t("answerFirst"), onClick: o.onSave },
    };
  }
  const waiting = o.mode === "prepare" ? t("speakingWaitPrepare") : o.mode === "recording" ? t("speakingWaitRecording") : null;
  return {
    secondary: null,
    primary: {
      kind: "button",
      id: "save-next",
      label: o.hasNext ? t("speakingNext") : t("speakingContinue"),
      busy: o.busy || o.mode === "saving",
      busyLabel: t("saving"),
      waitReason: waiting ?? (o.filled ? null : t("answerFirst")),
      onClick: o.onSave,
    },
  };
}

/**
 * The floating camera picture sits over every proctored question except a
 * speaking one: its recorder panel already shows the camera, and the camera
 * never shows twice.
 */
export function showSelfView(o: { proctored: boolean; hasStream: boolean; itemKind: string | undefined }): boolean {
  return o.proctored && o.hasStream && o.itemKind !== "SPEAKING";
}

/** "next" while another page follows; the last page's button says "finish" and opens the review step. */
export function nextButtonKind(next: number | null): "next" | "finish" {
  return next === null ? "finish" : "next";
}

/**
 * The counter chip of one question's header: its own fill progress, only for a
 * question made of several parts (statements, gaps, matching rows). A
 * single-part question has nothing to count. Never says right or wrong.
 */
export function partCounter(progress: AnswerProgress | null | undefined): { filled: number; total: number } | null {
  if (!progress || progress.total <= 1) return null;
  const filled = Math.min(Math.max(progress.filled, 0), progress.total);
  return { filled, total: progress.total };
}

/** Which physical edges of a scrolling strip still hide cells (so they fade out). Right-to-left strips scroll with negative offsets. */
export function overflowEdges(strip: { scrollLeft: number; scrollWidth: number; clientWidth: number }, rtl: boolean) {
  const max = strip.scrollWidth - strip.clientWidth;
  if (max <= 1) return { left: false, right: false };
  const fromStart = Math.abs(strip.scrollLeft);
  const moreAtStart = fromStart > 1;
  const moreAtEnd = fromStart < max - 1;
  return rtl ? { left: moreAtEnd, right: moreAtStart } : { left: moreAtStart, right: moreAtEnd };
}

/** The strip's own edge fade: 20px of the cells at each hidden edge dissolve, which says "more this way". */
export function edgeFadeMask({ left, right }: { left: boolean; right: boolean }): { maskImage: string; WebkitMaskImage: string } | undefined {
  if (!left && !right) return undefined;
  const stops = [left ? "transparent 0, #000 20px" : "#000 0", right ? "#000 calc(100% - 20px), transparent 100%" : "#000 100%"];
  const mask = `linear-gradient(to right, ${stops.join(", ")})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}
