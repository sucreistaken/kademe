import type { AnswerProgress } from "@/components/candidate/exam/answer-progress";

/**
 * Pure choices of the exam's bottom bar, kept apart from the markup so they can
 * be tested: which word the primary button carries and when a question shows
 * its own fill counter.
 */

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
