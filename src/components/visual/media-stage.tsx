// kademe-owned
import type { ReactNode } from "react";

/** 3.4, 3.8: the question and its clock on the left, the candidate's own picture (or its place) on the right; one column below 1024px. */
export function MediaStage({ question, preview, below }: { question: ReactNode; preview: ReactNode; below?: ReactNode }) {
  return (
    <section className="grid gap-8 pt-8 pb-6 lg:grid-cols-[minmax(0,400px)_minmax(0,520px)] lg:justify-between">
      <div className="min-w-0 space-y-6">{question}</div>
      <div className="min-w-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-canvas">{preview}</div>
        {below ? <div className="mt-4">{below}</div> : null}
      </div>
    </section>
  );
}
