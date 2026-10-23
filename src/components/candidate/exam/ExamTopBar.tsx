"use client";

import { LanguagePicker } from "@/components/candidate/LanguagePicker";
import { useProctor } from "@/components/candidate/proctor/ProctorProvider";
import { BrandMark } from "@/components/visual/brand-mark";
import { formatCountdown } from "@/lib/timer";
import { recordingLabel } from "@/lib/proctor/recording-status";
import { useT } from "@/i18n/candidate-client";
import { isCandidateLocale, type CandidateLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";

/**
 * The sticky bar over the exam: the brand, the section and question counter
 * while a question is open, the language picker on a section introduction,
 * the recording indicator and the time left.
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
}) {
  const t = useT("exam");
  const rec = useT("recordingSafety");
  const common = useT("common");
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
      <div className={cn("mx-auto flex h-14 items-center justify-between gap-4 px-7", wide ? "max-w-[1200px]" : "max-w-[1000px]")}>
        <div className="flex items-center gap-3 text-[13.5px]">
          <span className="flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em] text-ink">
            <BrandMark />
            {common("brand")}
          </span>
          {inQuestion ? (
            <>
              <span className="h-4 w-px bg-hairline" aria-hidden />
              <span className="text-label text-ink">{sectionName}</span>
              <span className="tnum text-muted">{counter}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-5">
          {showLanguagePicker && isCandidateLocale(lang) ? <LanguagePicker locales={locales} current={lang} /> : null}
          {proctored ? (
            <span className="hidden items-center gap-2 text-[12.5px] text-muted md:flex">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              {recLabel ? rec(recLabel) : screenShare ? t("recordingOn") : t("cameraOn")}
            </span>
          ) : null}
          {inQuestion ? (
            <span className="flex items-baseline gap-2">
              <span className="sr-only">{t("timeLeft")}</span>
              {remainingMs < 120_000 ? <span className="text-[12px] text-muted">{t("lastMinutes")}</span> : null}
              <span className="tnum text-[18px] font-bold text-accent">{formatCountdown(remainingMs)}</span>
            </span>
          ) : null}
        </div>
      </div>
      <Banner />
    </header>
  );
}

/** Non-modal, calm, under the header. Never an alert(). */
function Banner() {
  const p = useT("proctor");
  const { snap } = useProctor();
  const b = snap?.banner;
  if (!b || b.kind === "recover") return null;
  return (
    <div role="status" className="border-t border-hairline bg-canvas">
      <p className="mx-auto max-w-[1000px] px-7 py-2 text-[13px] text-ink-2">{p(b.reason)}</p>
    </div>
  );
}
