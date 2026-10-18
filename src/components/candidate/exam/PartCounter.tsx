"use client";

import { partCounter } from "@/components/candidate/exam/exam-bar";
import type { AnswerProgress } from "@/components/candidate/exam/answer-progress";
import { useT } from "@/i18n/candidate-client";

/**
 * A small chip in a question's header: how many of its own parts are filled in
 * ("1/4"). Only for a question of several parts; says nothing about whether the
 * parts are right.
 */
export function PartCounter({ progress }: { progress: AnswerProgress | null | undefined }) {
  const n = useT("examNav");
  const counter = partCounter(progress);
  if (!counter) return null;
  return (
    <span className="tnum inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-[11.5px] font-semibold normal-case tracking-normal text-ink-2">
      <span aria-hidden>
        {counter.filled}/{counter.total}
      </span>
      <span className="sr-only">{n("partsFilled", { filled: counter.filled, total: counter.total })}</span>
    </span>
  );
}
