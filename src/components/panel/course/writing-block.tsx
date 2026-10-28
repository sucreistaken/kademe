import { Dot } from "@/components/panel/bits";
import { Highlighted } from "@/components/panel/result/format";
import { TaskPrompt } from "@/components/panel/result/task-prompt";
import type { managerT } from "@/i18n/manager";
import type { CourseRubricProposal } from "@/lib/exam/course/types";
import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";
import { GradingPanel, type PanelGrading } from "./grading-panel";
import { wordCount } from "./model";

type T = ReturnType<typeof managerT>;

/** The AI's reading of the text beside the sheet's boxes: the Leitpunkt check, the error list and the advice for the teacher. */
function Analysis({ proposal, t }: { proposal: CourseRubricProposal; t: T }) {
  const tone = { YES: "done", PARTLY: "warn", NO: "neutral" } as const;
  return (
    <div className="flex flex-col gap-4">
      {proposal.leitpunkte?.length ? (
        <section aria-labelledby="leitpunkte-title" className="rounded-[14px] border border-line bg-surface p-5">
          <h3 id="leitpunkte-title" className="text-[13.5px] font-semibold text-ink">
            {t("courseResult.leitpunkteTitle")}
          </h3>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{t("courseResult.colLeitpunkt")}</th>
                <th className="px-3 py-1.5 font-medium">{t("courseResult.colDone")}</th>
                <th className="py-1.5 pl-3 font-medium">{t("courseResult.colEvidence")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {proposal.leitpunkte.map((p, i) => (
                <tr key={i}>
                  <td lang="de" className="py-2 pr-3 text-ink">
                    {p.point}
                  </td>
                  <td className="px-3 py-2">
                    <Dot tone={tone[p.done]}>{t(`courseResult.done${p.done}`)}</Dot>
                  </td>
                  <td lang="de" className="py-2 pl-3 italic text-ink-2">
                    {p.evidence || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {proposal.errors?.length ? (
        <section aria-labelledby="errors-title" className="rounded-[14px] border border-line bg-surface p-5">
          <h3 id="errors-title" className="text-[13.5px] font-semibold text-ink">
            {t("courseResult.errorsTitle")}
          </h3>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{t("courseResult.colNo")}</th>
                <th className="px-3 py-1.5 font-medium">{t("courseResult.colOriginal")}</th>
                <th className="px-3 py-1.5 font-medium">{t("courseResult.colCorrection")}</th>
                <th className="py-1.5 pl-3 font-medium">{t("courseResult.colType")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {proposal.errors.map((e, i) => (
                <tr key={i}>
                  <td className="tnum py-2 pr-3 text-muted">{i + 1}</td>
                  <td lang="de" className="px-3 py-2 text-ink">
                    {e.original}
                  </td>
                  <td lang="de" className="px-3 py-2 font-medium text-ink">
                    {e.correction}
                  </td>
                  <td className="py-2 pl-3 text-ink-2">{t(`courseResult.type${e.type}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {proposal.advice ? (
        <section className="rounded-[14px] bg-canvas px-5 py-4">
          <h3 className="text-[12.5px] font-semibold text-muted">{t("courseResult.adviceTitle")}</h3>
          <p lang="de" className="mt-1 text-[14px] leading-[1.6] text-ink">
            {proposal.advice}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Teil 3, Schreiben, as the sheet has it: the task, the text with the AI's
 * error quotes marked and a word count, the Leitpunkt check, the error list and
 * the advice, and on the right the three criteria with their 0-3 pickers and
 * the "Häufigste Fehler" boxes pre-ticked by the AI.
 */
export function WritingBlock({
  t,
  response,
  grading,
  tab,
  canGrade,
  nameOf,
}: {
  t: T;
  response: { id: string; answer: ItemAnswer | null; itemSnapshot: ItemSnapshot };
  grading: PanelGrading | null;
  tab: string;
  canGrade: boolean;
  nameOf: Record<string, string>;
}) {
  const proposal = grading?.courseProposal ?? null;
  const text = response.answer?.text ?? "";
  const words = wordCount(text);
  return (
    <section id={`t-${response.id}`} className="grid scroll-mt-6 gap-5 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <TaskPrompt prompt={response.itemSnapshot.prompt} label={t("result.taskLevel", { level: response.itemSnapshot.level })} />
        <div className="rounded-[14px] border border-line bg-surface p-5">
          {text ? (
            <>
              <Highlighted text={text} quotes={proposal?.errors?.map((e) => e.original) ?? []} />
              <p className="tnum mt-3 text-[12.5px] text-muted">
                {t("result.words", { n: words })}
                {proposal?.wordCount != null && proposal.wordCount !== words ? ` · ${t("courseResult.wordsAi", { n: proposal.wordCount })}` : ""}
              </p>
            </>
          ) : (
            <p className="text-[14px] text-muted">{t("result.noAnswer")}</p>
          )}
        </div>
        {proposal ? <Analysis proposal={proposal} t={t} /> : null}
      </div>
      {grading ? <GradingPanel t={t} grading={grading} section="WRITING" tab={tab} canGrade={canGrade} nameOf={nameOf} /> : null}
    </section>
  );
}
