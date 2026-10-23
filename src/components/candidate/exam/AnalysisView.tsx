import type { CandidateMessages } from "@/i18n/candidate";
import { SectionTile } from "@/components/visual/section-look";
import type { StudentResult } from "@/lib/exam-flow";
import type { Section } from "@/lib/exam/types";
import { cn } from "@/lib/cn";

/**
 * The student's analysis, shared by the finish screen and the print page: the
 * level only when the teacher allowed it, one row per section with counts, the
 * topics to practise, the topics that went well and the approved note. Counts
 * are plain ink pills (never red or green, no percentages) and nothing here
 * carries a question, an answer or a key. Pure markup: the caller passes the
 * translators, so it renders in a client component and in a server page alike.
 */
type Tr = (key: keyof CandidateMessages["analysis"] & string, values?: Record<string, string | number>) => string;

const STRONG_MAX = 6;

const pill = "tnum inline-flex items-center rounded-full bg-subtle px-2.5 py-0.5 text-[12.5px] font-semibold text-ink";
const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13.5px] font-semibold text-ink";

export function AnalysisView({
  result,
  t,
  sectionName,
  className,
}: {
  result: StudentResult;
  /** Translator for the `analysis` namespace. */
  t: Tr;
  sectionName: (section: Section) => string;
  className?: string;
}) {
  const analysis = result.analysis;
  if (!analysis) return null;
  const feedback = result.feedback;
  const levelBySection = new Map((result.skills ?? []).map((s) => [s.section, s.level]));
  const strong = analysis.strongTopics.slice(0, STRONG_MAX);
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {result.levelShown && result.overall ? (
        <div className="flex items-center gap-4 rounded-xl bg-mint-soft px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-mint">{t("levelLabel")}</div>
            {result.outcome ? <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{t(`outcome${result.outcome}`)}</p> : null}
          </div>
          <div className="tnum text-[40px] font-black leading-none text-ink">{result.overall}</div>
        </div>
      ) : null}

      <section>
        <h3 className="text-[13px] font-bold text-muted">{t("sectionsTitle")}</h3>
        <ul className="mt-2 flex flex-col gap-2.5">
          {analysis.sections.map((s) => {
            const level = result.levelShown ? levelBySection.get(s.section) : null;
            return (
              <li key={s.section} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14.5px]">
                <SectionTile section={s.section} className="size-8 rounded-md [&>svg]:size-4" />
                <span className="min-w-[7rem] flex-1 font-semibold text-ink-2">{sectionName(s.section)}</span>
                {level ? <span className={pill}>{level}</span> : null}
                {s.teacherAssessed ? (
                  <span className="text-[13px] text-muted">{t("teacherAssessed")}</span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    <span className={pill}>{t("right", { count: s.right })}</span>
                    <span className={pill}>{t("wrong", { count: s.wrong })}</span>
                    <span className={pill}>{t("blank", { count: s.blank })}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {analysis.missedTopics.length ? (
        <section>
          <h3 className="text-[13px] font-bold text-muted">{t("practiceTitle")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {analysis.missedTopics.map((m) => (
              <li key={m.topic} className={chip}>
                <span>{m.label}</span>
                <span className="tnum text-[12.5px] font-medium text-muted">{t("missedOf", { missed: m.missed, asked: m.asked })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strong.length ? (
        <section>
          <h3 className="text-[13px] font-bold text-muted">{t("strongTitle")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {strong.map((s) => (
              <li key={s.topic} className={chip}>
                {s.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feedback ? (
        <section className="flex flex-col gap-3 rounded-xl bg-paper px-4 py-4 text-[14.5px] leading-[1.6] text-ink-2">
          {feedback.strengths.length ? (
            <div>
              <h3 className="text-[13px] font-bold text-muted">{t("feedbackStrengths")}</h3>
              <ul className="mt-1 list-disc ps-5">
                {feedback.strengths.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {feedback.improve.length ? (
            <div>
              <h3 className="text-[13px] font-bold text-muted">{t("feedbackImprove")}</h3>
              <ul className="mt-1 list-disc ps-5">
                {feedback.improve.map((x) => (
                  <li key={x.topic}>
                    <span className="font-semibold text-ink">{x.topic}</span>
                    {x.why ? `: ${x.why}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {feedback.nextStep ? (
            <div>
              <h3 className="text-[13px] font-bold text-muted">{t("feedbackNext")}</h3>
              <p className="mt-1">{feedback.nextStep}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="text-[12.5px] leading-[1.5] text-muted">{t("note")}</p>
    </div>
  );
}
