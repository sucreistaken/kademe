import { SpeakingEvidence } from "@/components/panel/result/speaking-evidence";
import { TaskPrompt } from "@/components/panel/result/task-prompt";
import type { TranscriptWord } from "@/db/schema/types";
import type { managerT } from "@/i18n/manager";
import type { ItemAnswer, ItemSnapshot } from "@/lib/exam/types";
import { GradingPanel, type PanelGrading } from "./grading-panel";

type T = ReturnType<typeof managerT>;

/**
 * One speaking task of a course test: the card, the recording with its
 * transcript (the player the other exams use), and on the right the five
 * criteria with their 0-4 pickers. AUSSPRACHE usually comes back "not
 * assessable" from a transcript, so the teacher sets it from the recording.
 */
export function SpeakingBlock({
  t,
  response,
  grading,
  tab,
  canGrade,
  nameOf,
  index,
  total,
  studentName,
  recording,
}: {
  t: T;
  response: { id: string; answer: ItemAnswer | null; itemSnapshot: ItemSnapshot };
  grading: PanelGrading | null;
  tab: string;
  canGrade: boolean;
  nameOf: Record<string, string>;
  /** 1-based position among the section's tasks. */
  index: number;
  total: number;
  studentName: string;
  /** The recording's signed link and transcript, when the student recorded one. */
  recording: { src: string; words: TranscriptWord[]; text: string; noSpeech: boolean } | null;
}) {
  const typed = !!response.answer?.usedTextAlternative;
  return (
    <section id={`t-${response.id}`} className="grid scroll-mt-6 gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <p className="tnum text-[12.5px] font-semibold text-muted">{t("courseResult.taskOf", { n: index, total })}</p>
        <TaskPrompt prompt={response.itemSnapshot.prompt} label={t("result.taskLevel", { level: response.itemSnapshot.level })} />
        <div className="mt-4 rounded-[14px] border border-line bg-surface p-5">
          {typed ? (
            <>
              <p className="mb-2 text-[12.5px] text-muted">{t("result.typedAlternative")}</p>
              {response.answer?.text ? (
                <p lang="de" className="whitespace-pre-line text-[15px] leading-[1.75] text-ink">
                  {response.answer.text}
                </p>
              ) : (
                <p className="text-[14px] text-muted">{t("result.noAnswer")}</p>
              )}
            </>
          ) : recording ? (
            <SpeakingEvidence src={recording.src} words={recording.words} text={recording.text} noSpeech={recording.noSpeech} name={studentName} />
          ) : (
            <p className="text-[14px] text-muted">{t("result.noRecording")}</p>
          )}
        </div>
      </div>
      {grading ? <GradingPanel t={t} grading={grading} section="SPEAKING" tab={tab} canGrade={canGrade} nameOf={nameOf} /> : null}
    </section>
  );
}
