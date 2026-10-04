"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { pickText } from "@/lib/i18n-text";
import type { CandidateActivity, CandidateVersion } from "@/solutions/hiring/rules/candidate-view";
import { markPreviewedAction } from "@/app/(manager)/hiring/openings/[id]/assessment/preview/actions";

type Step = { kind: "intro" } | { kind: "stage"; stage: number } | { kind: "activity"; stage: number; activity: number } | { kind: "done" };

function steps(version: CandidateVersion): Step[] {
  return [
    { kind: "intro" },
    ...version.stages.flatMap((s, si): Step[] => [{ kind: "stage", stage: si }, ...s.activities.map((_, ai): Step => ({ kind: "activity", stage: si, activity: ai }))]),
    { kind: "done" },
  ];
}

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
  const [index, setIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [lang, setLang] = useState<Locale>(locales.includes(defaultLocale) ? defaultLocale : locales[0]);
  const stamped = useRef<string | null>(null);
  const all = steps(version);
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
        <ManagerIntl locale={lang}>
          <Frame
            lang={lang}
            mobile={mobile}
            version={version}
            step={step}
            index={index}
            total={all.length}
            companyName={companyName}
            positionName={positionName}
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
  builderHref: string;
  onNext: () => void;
  onRestart: () => void;
}) {
  const t = useMT("hiringPreview");
  const text = (v: { tr: string; en: string }) => pickText(v, lang);
  const stages = version.stages;
  const empty = stages.length === 0;

  let primary: string | null = null;
  if (!empty && step.kind === "intro") primary = t("start");
  else if (step.kind === "stage") primary = stages[step.stage].activities.length ? t("stageStart") : t("next");
  else if (step.kind === "activity") {
    const lastInStage = step.activity === stages[step.stage].activities.length - 1;
    primary = !lastInStage ? t("next") : step.stage === stages.length - 1 ? t("finish") : t("finishStage");
  }

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
            <h1 className="text-[28px] leading-9 font-semibold text-ink">{positionName}</h1>
            <p className="text-[16px] leading-[26px] text-ink-2">{t("introPurpose")}</p>
            <p className="tnum text-[16px] leading-[26px] text-ink">
              {t("introBody", { stages: stages.length, minutes: minutesOf(version.totalSeconds) })}
            </p>
          </div>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {stages.map((s, i) => (
              <li key={s.id} className="tnum flex items-baseline justify-between gap-4 px-4 py-3 text-[16px] text-ink">
                <span>
                  {i + 1}. {text(s.name)}
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
          <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("doneTitle")}</h1>
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
          <p className="tnum text-[14px] text-muted">{t("stageOf", { n: step.stage + 1, total: stages.length })}</p>
          <h1 className="text-[28px] leading-9 font-semibold text-ink">{text(stage.name)}</h1>
          {text(stage.description) ? <p className="text-[16px] leading-[26px] text-ink-2">{text(stage.description)}</p> : null}
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
        position={{ stage: step.stage + 1, stages: stages.length, n: step.activity + 1, total: stage.activities.length }}
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
        <p className="text-[13px] font-medium text-muted">{companyName}</p>
        <div className="h-1 rounded-full bg-hairline" aria-hidden>
          <div className="h-1 rounded-full bg-ink-3 transition-[width] duration-[180ms] ease-out" style={{ width: `${Math.round((index / Math.max(1, total - 1)) * 100)}%` }} />
        </div>
      </div>
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

function ActivityView({ activity, lang, position }: { activity: CandidateActivity; lang: Locale; position: { stage: number; stages: number; n: number; total: number } }) {
  const t = useMT("hiringPreview");
  const text = (v: { tr: string; en: string }) => pickText(v, lang);
  const [written, setWritten] = useState("");
  const recorded = activity.type === "VIDEO" || activity.type === "AUDIO";
  const prompt = text(activity.prompt);
  const promptId = `preview-prompt-${activity.id}`;
  const mb = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format((activity.maxFileBytes ?? 0) / 1024 / 1024);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="tnum text-[14px] text-muted">{t("questionOf", position)}</p>
        <p className="text-[13px] text-muted">
          {t(`type${activity.type}`)}
          {!activity.required ? ` · ${t("optional")}` : ""}
        </p>
      </div>
      <p id={promptId} className={cn("whitespace-pre-line text-ink", recorded ? "text-[22px] leading-8 font-medium" : "text-[18px] leading-7")}>
        {prompt}
      </p>
      {text(activity.note) ? <p className="whitespace-pre-line text-[16px] leading-[26px] text-ink-2">{text(activity.note)}</p> : null}

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
              {text(c.label)}
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
              {text(c.label)}
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
