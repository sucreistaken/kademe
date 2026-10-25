"use client";

import { CirclePlay } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguagePicker } from "@/components/candidate/LanguagePicker";
import { ProctorInfoLine, ProctorNotice } from "@/components/candidate/exam/ProctorNotice";
import { BrandMark } from "@/components/visual/brand-mark";
import { TimerPill } from "@/components/candidate/exam/TimerPill";
import { recordingLabel } from "@/lib/proctor/recording-status";
import { useT } from "@/i18n/candidate-client";
import { isCandidateLocale, type CandidateLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";

/**
 * Which short line the recording chip carries: the screen when it is recorded
 * (the thing a student forgets is visible), otherwise the camera. The full
 * list of what is recorded stays in the chip's tooltip.
 */
export function recordingChipKind(recLabel: ReturnType<typeof recordingLabel>, screenShare: boolean): "screen" | "camera" {
  if (recLabel) return recLabel === "screen" || recLabel === "cameraScreen" || recLabel === "cameraAudioScreen" ? "screen" : "camera";
  return screenShare ? "screen" : "camera";
}

/**
 * The sticky bar over the exam: the brand, the section and question counter
 * while a question is open, the language picker on a section introduction,
 * the time left with the recording chip beside it (where the eyes already
 * are), and the proctor's notices under it.
 */
export function ExamTopBar({
  inQuestion,
  sectionName,
  counter,
  wide,
  showLanguagePicker,
  lang,
  locales,
  proctored,
  recLabel,
  screenShare,
  remainingMs,
  sectionMs,
  token,
  sectionPosition,
  onWatchTutorial,
}: {
  /** A question (or the review) is open: the section, the counter and the clock show. */
  inQuestion: boolean;
  /** The open section's name. */
  sectionName: string;
  /** "Question 3 of 20", "Review" and the like; already translated. */
  counter: string;
  /** Wide reading, group or task layout below: the bar matches its width. */
  wide: boolean;
  /** A section introduction outside the warm-up practice. */
  showLanguagePicker: boolean;
  lang: string;
  locales: CandidateLocale[];
  proctored: boolean;
  /** What the continuous recording captures right now, if it reports it. */
  recLabel: ReturnType<typeof recordingLabel>;
  screenShare: boolean;
  remainingMs: number;
  /** The open section's full length; decides whether the clock has a "low" step. */
  sectionMs: number;
  token: string;
  sectionPosition: number;
  /** Opens the how-it-works video for the open section; the button shows only while a question is on screen. */
  onWatchTutorial?: () => void;
}) {
  const t = useT("exam");
  const rec = useT("recordingSafety");
  const common = useT("common");
  const tt = useTranslations("tutorial");
  const recText = recLabel ? rec(recLabel) : screenShare ? t("recordingOn") : t("cameraOn");
  const chip = proctored ? <RecordingChip text={recordingChipKind(recLabel, screenShare) === "screen" ? t("recordingChipScreen") : t("recordingChipCamera")} full={recText} /> : null;
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
      <ProctorNotice />
      <div className={cn("relative mx-auto flex h-14 items-center justify-between gap-4 px-7", wide ? "max-w-[1200px]" : "max-w-[1000px]")}>
        <div className="flex min-w-0 max-w-[calc(50%-6rem)] items-center gap-3 text-[13.5px]">
          <span className="flex shrink-0 items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em] text-ink">
            <BrandMark />
            {common("brand")}
          </span>
          {inQuestion ? (
            <>
              <span className="h-4 w-px shrink-0 bg-hairline" aria-hidden />
              <span title={sectionName} className="min-w-0 truncate text-label text-ink">{sectionName}</span>
              <span className="tnum shrink-0 whitespace-nowrap text-muted">{counter}</span>
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 max-w-[calc(50%-6rem)] items-center gap-5">
          {showLanguagePicker && isCandidateLocale(lang) ? <LanguagePicker locales={locales} current={lang} /> : null}
          {inQuestion && onWatchTutorial ? (
            <button
              type="button"
              onClick={onWatchTutorial}
              title={tt("howItWorks")}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink xl:px-3.5"
            >
              <CirclePlay aria-hidden className="size-4" strokeWidth={2.25} />
              <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{tt("howItWorks")}</span>
            </button>
          ) : null}
        </div>
        {inQuestion ? (
          <TimerPill key={`${token}.${sectionPosition}`} remainingMs={remainingMs} sectionMs={sectionMs} token={token} sectionPosition={sectionPosition} aside={chip} />
        ) : chip ? (
          // No clock on a section introduction: the chip stands alone in the middle.
          <div className="absolute inset-y-0 start-1/2 flex -translate-x-1/2 items-center rtl:translate-x-1/2">{chip}</div>
        ) : null}
      </div>
      <ProctorInfoLine />
    </header>
  );
}

/**
 * "Something is recording you", next to the clock: a gently breathing red dot
 * (the one place red is allowed besides the brand) and a few words. The full
 * list is the tooltip and, for a screen reader, the hidden text; the visible
 * words are short enough for the middle of a 1366px bar in every language and
 * are cut with an ellipsis rather than ever running into a neighbour.
 */
function RecordingChip({ text, full }: { text: string; full: string }) {
  return (
    <span
      title={full}
      data-recording-chip
      className="hidden h-9 max-w-[230px] items-center gap-2 whitespace-nowrap rounded-full border-2 border-line bg-surface px-3 text-[13px] font-semibold text-ink shadow-lip-soft md:inline-flex"
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-red motion-safe:animate-[rec-pulse_1.6s_ease-in-out_infinite]" />
      <span aria-hidden className="min-w-0 truncate">
        {text}
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
