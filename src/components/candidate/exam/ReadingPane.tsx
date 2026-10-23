"use client";

import { PassageBody } from "@/components/candidate/exam/PassageBody";

/** The reading passage beside its questions: stays in view while the questions scroll. */
export function ReadingPane({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[14px] border border-line bg-surface p-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem-var(--step-footer-space,112px)-var(--step-notice-space,0px))] lg:overflow-y-auto">
      <div lang="de" className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{title}</div>
      <PassageBody text={text} title={title} />
    </article>
  );
}
