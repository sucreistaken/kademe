"use client";

import { useT } from "@/i18n/candidate-client";

type Expectations = (
  | { section: "WRITING"; minWords: number; maxWords: number }
  | { section: "SPEAKING"; thinkSeconds: number; answerSeconds: number }
) & {
  /** So the answer field can point at the box (aria-describedby). */
  id?: string;
};

const CRITERIA = {
  WRITING: ["assessTask", "assessOrganised", "assessRange", "assessAccuracy"],
  SPEAKING: ["assessTask", "assessCoherent", "assessRange", "assessAccuracy", "assessFluency", "assessPronunciation"],
} as const;

/**
 * What a writing or speaking task expects, said before the candidate starts:
 * the length or the times, and what the answer is looked at for. The list is
 * the same for every task of the section and comes from the UI dictionary, so
 * it carries no level, score or grader guidance. It is the quietest box of the
 * task screen (13 to 14px, no border, two columns), so the task above it
 * keeps the eye.
 */
export function TaskExpectations(props: Expectations) {
  const t = useT("examItems");
  return (
    <div id={props.id} className="mt-5 rounded-[12px] bg-canvas px-4 py-3" data-role="assessment">
      <div className="text-overline uppercase text-muted">{t("assessTitle")}</div>
      <p className="tnum mt-1.5 text-[14px] font-semibold text-ink">
        {props.section === "WRITING"
          ? t("expectLength", { min: props.minWords, max: props.maxWords })
          : t("expectTimes", { think: props.thinkSeconds, answer: props.answerSeconds })}
      </p>
      <ul role="list" className="mt-1.5 grid list-disc gap-x-6 gap-y-0.5 ps-4 text-[13.5px] leading-[1.5] text-ink-2 marker:text-muted sm:grid-cols-2">
        {CRITERIA[props.section].map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
}
