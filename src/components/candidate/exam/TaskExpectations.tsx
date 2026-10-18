"use client";

import { useT } from "@/i18n/candidate-client";

type Expectations =
  | { section: "WRITING"; minWords: number; maxWords: number }
  | { section: "SPEAKING"; thinkSeconds: number; answerSeconds: number };

const CRITERIA = {
  WRITING: ["assessTask", "assessOrganised", "assessRange", "assessAccuracy"],
  SPEAKING: ["assessTask", "assessCoherent", "assessRange", "assessAccuracy", "assessFluency", "assessPronunciation"],
} as const;

/**
 * What a writing or speaking task expects, said before the candidate starts:
 * the length or the times, and what the answer is looked at for. The list is
 * the same for every task of the section and comes from the UI dictionary, so
 * it carries no level, score or grader guidance.
 */
export function TaskExpectations(props: Expectations) {
  const t = useT("examItems");
  return (
    <div className="mt-5 rounded-[12px] border border-line bg-surface px-5 py-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t("assessTitle")}</div>
      <p className="tnum mt-2 text-[15px] font-semibold text-ink">
        {props.section === "WRITING"
          ? t("expectLength", { min: props.minWords, max: props.maxWords })
          : t("expectTimes", { think: props.thinkSeconds, answer: props.answerSeconds })}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[15px] leading-[1.5] text-ink marker:text-muted">
        {CRITERIA[props.section].map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
}
