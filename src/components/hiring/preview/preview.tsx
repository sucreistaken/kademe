"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTimeZone } from "next-intl";
import { ChevronLeft, MicOff, Upload, VideoOff } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ManagerIntl } from "@/components/manager/Intl";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { pickTextLang } from "@/lib/i18n-text";
import { useStepFocus } from "@/hooks/use-step-focus";
import type { CandidateActivity, CandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { markPreviewedAction } from "@/app/(manager)/hiring/openings/[id]/assessment/preview/actions";
import { announcementOf, primaryOf, progressOf, stepsOf, type Step } from "./steps";

/** A language picker names each language in itself. */
const LANGUAGE_NAMES: Record<Locale, string> = { tr: "Türkçe", en: "English" };

/** Whole minutes for a duration, never "0" for a short but real one. */
const minutesOf = (seconds: number) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "application/zip": "ZIP",
};
const mimeLabel = (mime: string) => MIME_LABELS[mime] ?? (mime.split("/")[1] ?? mime).toUpperCase();

/** A version text in the frame's language; one shown through the other-language fallback carries its own lang. */
function Text({ value, lang }: { value: { tr: string; en: string }; lang: Locale }) {
  const shown = pickTextLang(value, lang);
  return shown.lang === lang ? <>{shown.text}</> : <span lang={shown.lang}>{shown.text}</span>;
}
const hasText = (value: { tr: string; en: string }, lang: Locale) => pickTextLang(value, lang).text !== "";

type Props = {
  openingId: string;
  /** The draft to mark "Önizleme yapıldı", or null (a live version, a reviewer's visit, nothing to preview). */
  stampVersionId: string | null;
  mode: "draft" | "live";
  number: number;
  companyName: string;
  positionName: string;
  version: CandidateVersion;
  locales: Locale[];
  defaultLocale: Locale;
};

/**
 * HIRING-UX 5.8: the candidate's flow, built only from the candidate view
 * (toCandidateVersion through candidateSafe), so "what the candidate sees" is
 * shown, not claimed. Nothing is saved, the camera never starts, no file is
 * uploaded and no attempt exists. The strip above is the manager's (their
 * language, no filled button); the frame below is the candidate's, in the
 * language picked in the strip, with the one filled button of the screen.
 */
export function Preview({ openingId, stampVersionId, mode, number, companyName, positionName, version, locales, defaultLocale }: Props) {
  const t = useMT("hiringPreview");
  // The candidate frame keeps the manager tree's zone (ORG_TIMEZONE from the server), only the language changes.
  const timeZone = useTimeZone() ?? ORG_TIMEZONE;
  const [index, setIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [lang, setLang] = useState<Locale>(locales.includes(defaultLocale) ? defaultLocale : locales[0]);
  const stamped = useRef<string | null>(null);
  const all = stepsOf(version);
  const step = all[Math.min(index, all.length - 1)];

  useEffect(() => {
    // Once per draft shown (React may run an effect twice in development).
    if (!stampVersionId || stamped.current === stampVersionId) return;
    stamped.current = stampVersionId;
    // The stamp is a side effect of looking; a refusal or a lost request changes nothing on screen.
    markPreviewedAction(openingId, stampVersionId).catch(() => undefined);
  }, [openingId, stampVersionId]);

  const builderHref = `/hiring/openings/${openingId}/assessment/edit`;

  return (
    <div className="mt-section space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5">
        <p className="text-[13px] font-medium text-ink">{t("strip")}</p>
        <p className="tnum text-[13px] text-muted">{mode === "draft" ? t("versionDraft", { number }) : t("versionLive", { number })}</p>
        <label className="flex min-h-8 items-center gap-2 text-[13px] text-ink">
          <Switch checked={mobile} onCheckedChange={setMobile} />
          {t("mobile")}
        </label>
        {locales.length > 1 ? (
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <span id="preview-language">{t("language")}</span>
            <div role="group" aria-labelledby="preview-language" className="inline-flex rounded-lg border border-line p-0.5">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[13px] transition-colors duration-[120ms] ease-out",
                    lang === l ? "bg-brand-soft font-medium text-accent" : "text-muted hover:text-ink",
                  )}
                >
                  {LANGUAGE_NAMES[l]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            {t("language")}: {LANGUAGE_NAMES[lang]}
          </p>
        )}
        <div className="ml-auto flex items-center gap-4">
          {index > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
              {t("previous")}
            </Button>
          ) : null}
          <Link href={builderHref} className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
            {t("back")}
          </Link>
        </div>
      </div>

      <div className={cn("rounded-2xl bg-canvas", mobile ? "px-2 py-6" : "p-0")}>
        {/* The candidate's frame speaks the candidate's language, not the manager's. */}
        <ManagerIntl locale={lang} timeZone={timeZone}>
          <Frame
            lang={lang}
            mobile={mobile}
            version={version}
            step={step}
            index={index}
            total={all.length}
            companyName={companyName}
            positionName={positionName}
            positionLang={defaultLocale}
            builderHref={builderHref}
            onNext={() => setIndex((i) => Math.min(all.length - 1, i + 1))}
            onRestart={() => setIndex(0)}
          />
        </ManagerIntl>
      </div>
    </div>
  );
}

function Frame({
  lang,
  mobile,
  version,
  step,
  index,
  total,
  companyName,
  positionName,
  positionLang,
  builderHref,
  onNext,
  onRestart,
}: {
  lang: Locale;
  mobile: boolean;
  version: CandidateVersion;
  step: Step;
  index: number;
  total: number;
  companyName: string;
  positionName: string;
  /** A position name is stored in one language: the organisation's, taken as the version's default. */
  positionLang: Locale;
  builderHref: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const t = useMT("hiringPreview");
  const stages = version.stages;
  const empty = stages.length === 0;
  // Focus follows the screen: the new heading takes it whenever the step changes (never on first render).
  const heading = useStepFocus<HTMLHeadingElement>(index);
  const primaryKey = primaryOf(version, step);
  const primary = primaryKey ? t(primaryKey) : null;
  const progress = progressOf(version, step);
  const announcement = announcementOf(version, step);
  const headingClass = "text-[28px] leading-9 font-semibold text-ink";

  function body(): React.ReactNode {
    if (empty) {
      return (
        <div className="space-y-3">
          <p className="text-[16px] leading-[26px] text-ink">{t("empty")}</p>
          <Link href={builderHref} className="inline-block text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
            {t("back")}
          </Link>
        </div>
      );
    }
    if (step.kind === "intro") {
      return (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 ref={heading} tabIndex={-1} lang={positionLang !== lang ? positionLang : undefined} className={headingClass}>
              {positionName}
            </h2>
            <p className="text-[16px] leading-[26px] text-ink-2">{t("introPurpose")}</p>
            <p className="tnum text-[16px] leading-[26px] text-ink">
              {t("introBody", { stages: stages.length, minutes: minutesOf(version.totalSeconds) })}
            </p>
          </div>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {stages.map((s, i) => (
              <li key={s.id} className="tnum flex items-baseline justify-between gap-4 px-4 py-3 text-[16px] text-ink">
                <span>
                  {i + 1}. <Text value={s.name} lang={lang} />
                </span>
                <span className="shrink-0 text-[14px] text-muted">{t("stageMinutes", { minutes: minutesOf(s.durationSeconds) })}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    if (step.kind === "done") {
      return (
        <div className="space-y-3">
          <h2 ref={heading} tabIndex={-1} className={headingClass}>
            {t("doneTitle")}
          </h2>
          <p className="text-[16px] leading-[26px] text-ink-2">{t("doneBody")}</p>
          <div className="pt-3">
            <Button variant="secondary" onClick={onRestart}>
              {t("restart")}
            </Button>
          </div>
        </div>
      );
    }
    const stage = stages[step.stage];
    if (step.kind === "stage") {
      return (
        <div className="space-y-3">
          <h2 ref={heading} tabIndex={-1} className={headingClass}>
            <Text value={stage.name} lang={lang} />
          </h2>
          {hasText(stage.description, lang) ? (
            <p className="text-[16px] leading-[26px] text-ink-2">
              <Text value={stage.description} lang={lang} />
            </p>
          ) : null}
          <p className="tnum text-[16px] leading-[26px] text-ink">
            {t("stageTime", { minutes: minutesOf(stage.durationSeconds) })} · {t("stageQuestions", { count: stage.activities.length })}
          </p>
          {stage.activities.length ? <p className="text-[14px] text-muted">{t("stageClock")}</p> : null}
        </div>
      );
    }
    return (
      <ActivityView
        key={stage.activities[step.activity].id}
        activity={stage.activities[step.activity]}
        lang={lang}
        headingRef={heading}
      />
    );
  }

  const recorded = step.kind === "activity" && ["VIDEO", "AUDIO"].includes(stages[step.stage].activities[step.activity].type);

  return (
    <div
      lang={lang}
      className={cn(
        "mx-auto flex flex-col rounded-2xl border border-line bg-paper",
        mobile ? "min-h-[720px] w-[390px] max-w-full" : "max-w-[1000px]",
      )}
    >
      <div className={cn("space-y-3", mobile ? "px-5 pt-5" : "px-card-candidate pt-card-candidate")}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px] font-medium text-muted">{companyName}</p>
          {/* HIRING-UX 6: progress is the thin bar plus "Aşama 2 / 3", nothing else. */}
          {progress ? <p className="tnum shrink-0 text-[13px] text-muted">{t("stageOf", progress)}</p> : null}
        </div>
        {/* The bar repeats the text above for the eye; the live region below speaks the position. */}
        <div className="h-1 rounded-full bg-hairline" aria-hidden>
          <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-[180ms] ease-out" style={{ width: `${Math.round((index / Math.max(1, total - 1)) * 100)}%` }} />
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {empty || !announcement ? "" : t(announcement.key, announcement.values)}
      </p>
      <div className={cn("flex-1", mobile ? "px-5 py-8" : "px-card-candidate py-10")}>
        <div className={cn("mx-auto", recorded ? "max-w-[960px]" : "max-w-[640px]")}>{body()}</div>
      </div>
      {primary ? (
        <div className={cn(mobile ? "border-t border-line px-5 pt-3 pb-5" : "px-card-candidate pb-card-candidate")}>
          <div className={cn("mx-auto flex", mobile ? "" : cn("justify-end", recorded ? "max-w-[960px]" : "max-w-[640px]"))}>
            <Button variant="primary" size="lg" className={cn("max-sm:w-full", mobile && "w-full")} onClick={onNext}>
              {primary}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActivityView({ activity, lang, headingRef }: { activity: CandidateActivity; lang: Locale; headingRef: React.Ref<HTMLHeadingElement> }) {
  const t = useMT("hiringPreview");
  const [written, setWritten] = useState("");
  const recorded = activity.type === "VIDEO" || activity.type === "AUDIO";
  const promptId = `preview-prompt-${activity.id}`;
  const mb = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format((activity.maxFileBytes ?? 0) / 1024 / 1024);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        {t(`type${activity.type}`)}
        {!activity.required ? ` · ${t("optional")}` : ""}
      </p>
      {/* The question is the screen's heading: it takes focus when the screen opens. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        id={promptId}
        className={cn("whitespace-pre-line text-ink", recorded ? "text-[22px] leading-8 font-medium" : "text-[18px] leading-7 font-normal")}
      >
        <Text value={activity.prompt} lang={lang} />
      </h2>
      {hasText(activity.note, lang) ? (
        <p className="whitespace-pre-line text-[16px] leading-[26px] text-ink-2">
          <Text value={activity.note} lang={lang} />
        </p>
      ) : null}

      {recorded ? (
        <div className="space-y-3">
          <div className="flex h-[200px] w-full max-w-[640px] flex-col items-center justify-center gap-2 rounded-xl border border-line bg-canvas px-4 text-center text-[14px] text-muted">
            {activity.type === "AUDIO" ? <MicOff className="size-5" strokeWidth={1.5} aria-hidden /> : <VideoOff className="size-5" strokeWidth={1.5} aria-hidden />}
            {activity.type === "AUDIO" ? t("micOff") : t("cameraOff")}
          </div>
          <ul className="tnum space-y-1 text-[14px] leading-[22px] text-ink">
            {activity.thinkSeconds > 0 ? (
              <li>{activity.flexibleThink ? t("thinkFlexible", { seconds: activity.thinkSeconds }) : t("thinkStrict", { seconds: activity.thinkSeconds })}</li>
            ) : null}
            {activity.answerSeconds ? <li>{t("answer", { seconds: activity.answerSeconds })}</li> : null}
            <li>{activity.maxTakes > 1 ? t("takes", { count: activity.maxTakes - 1 }) : t("takesNone")}</li>
          </ul>
          {activity.textAlternativeEnabled ? <p className="text-[14px] text-ink-2">{t("textAlternative")}</p> : null}
        </div>
      ) : null}

      {activity.type === "LONG_TEXT" || activity.type === "SHORT_TEXT" ? (
        <div className="space-y-1.5">
          <Textarea
            rows={activity.type === "LONG_TEXT" ? 8 : 3}
            aria-labelledby={promptId}
            maxLength={activity.maxChars ?? undefined}
            value={written}
            onChange={(e) => setWritten(e.target.value)}
            className={cn("bg-surface px-3 py-2.5 text-[16px] leading-[26px] md:text-[16px]", activity.type === "LONG_TEXT" ? "min-h-48" : "min-h-24")}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[13px] text-muted">
            <span>
              {activity.maxChars
                ? activity.minChars
                  ? t("chars", { min: activity.minChars, max: activity.maxChars })
                  : t("charsMax", { max: activity.maxChars })
                : null}
            </span>
            {activity.maxChars ? <span className="tnum">{t("charCount", { count: written.length, max: activity.maxChars })}</span> : null}
          </div>
        </div>
      ) : null}

      {activity.type === "SINGLE_CHOICE" && activity.choices ? (
        <RadioGroup aria-labelledby={promptId} className="gap-2">
          {activity.choices.map((c) => (
            <label
              key={c.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-[16px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft"
            >
              <RadioGroupItem value={c.id} />
              <Text value={c.label} lang={lang} />
            </label>
          ))}
        </RadioGroup>
      ) : null}

      {activity.type === "MULTI_CHOICE" && activity.choices ? (
        <div role="group" aria-labelledby={promptId} className="space-y-2">
          <p className="text-[14px] text-muted">{t("multiHint")}</p>
          {activity.choices.map((c) => (
            <label
              key={c.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-[16px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft"
            >
              <Checkbox />
              <Text value={c.label} lang={lang} />
            </label>
          ))}
        </div>
      ) : null}

      {activity.type === "FILE_UPLOAD" ? (
        <div className="space-y-3 rounded-xl border border-dashed border-line-strong bg-surface px-5 py-6">
          <div className="flex items-start gap-3">
            <Upload className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
            <div className="space-y-0.5">
              <p className="text-[16px] text-ink">{t("fileDrop")}</p>
              <p className="tnum text-[14px] text-muted">
                {t("fileLimits", { types: (activity.acceptedMimeTypes ?? []).map(mimeLabel).join(", ") || "-", mb })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button id={`preview-file-${activity.id}`} variant="secondary" disabled disabledReason={t("pickFileWhy")}>
              {t("pickFile")}
            </Button>
            <DisabledReason id={`preview-file-${activity.id}-why`}>{t("pickFileWhy")}</DisabledReason>
          </div>
        </div>
      ) : null}
    </div>
  );
}
