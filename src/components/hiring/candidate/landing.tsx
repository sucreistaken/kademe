"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mic, Video, Wifi } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiSend } from "@/lib/client/api";
import { nextPath } from "@/lib/candidate-routes";
import { pickTextLang } from "@/lib/i18n-text";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { ActionBar } from "./action-bar";
import { mailTo } from "./closed";
import { serverMessage } from "./server-message";

const ICONS = { VIDEO_ANSWER: Video, AUDIO_ANSWER: Mic, TECHNICAL: Wifi } as const;
const EXTRA = ["0", "25", "50"] as const;


/**
 * HIRING-UX 6.1: before the first question, the candidate knows what this is,
 * how long it takes, who reviews it and how, exactly what is recorded (A3:
 * nothing more, nothing less; plan 2 monitors nothing), what they need, and
 * that they can choose extra time without a reason. No question is shown here.
 *
 * The minutes are the state's total, extra time and any ALLOW_GRACE grace
 * included (C25), so the landing never promises less than the clocks allow;
 * stage minutes are not listed, since rounded per stage they could add up to
 * more than the total. Consent posts to the core route, which records the
 * text frozen on this invitation.
 */
export function Landing({
  token,
  state,
  consentBody,
  consentLang,
  deadline,
  locale,
}: {
  token: string;
  state: HiringCandidateState;
  consentBody: string;
  /** The language the consent text is shown in (the other one when the candidate's is empty). */
  consentLang: Locale;
  deadline: string;
  locale: Locale;
}) {
  const t = useT("hiringLanding");
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(state.extraTimePct);
  const [minutes, setMinutes] = useState(state.totalMinutes);
  const [extra, setExtra] = useState<"idle" | "saving" | "saved">("idle");
  const [extraError, setExtraError] = useState<string | null>(null);
  const recorded = state.devices.microphone;
  const intro = state.intro.body ? pickTextLang(state.intro.body, locale) : null;

  async function chooseExtra(value: string) {
    const before = pct;
    // The choice shows at once; the server's answer settles it (or puts the old one back).
    setPct(Number(value) as HiringCandidateState["extraTimePct"]);
    setExtra("saving");
    setExtraError(null);
    try {
      const updated = await apiSend<HiringCandidateState>(token, "/hiring/extra-time", { pct: Number(value) });
      setPct(updated.extraTimePct);
      setMinutes(updated.totalMinutes);
      setExtra("saved");
    } catch (err) {
      setPct(before);
      setExtraError(serverMessage(err) ?? t("failed"));
      setExtra("idle");
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<HiringCandidateState>(token, "/consent", { accepted: true });
      router.push(nextPath(token, next));
    } catch (err) {
      setError(serverMessage(err) ?? t("failed"));
      setBusy(false);
    }
  }

  const steps = [...(recorded ? [t("howCheck")] : []), ...(state.practice ? [t("howPractice")] : []), `${t("howQuestions")}${recorded ? ` ${t("howThink")}` : ""}`];
  const extraLocked = state.extraTimeLocked;
  const extraNote = extraLocked ? t("extraLocked") : extra === "saving" ? t("extraSaving") : extra === "saved" ? t("extraSaved") : t("extraBody");

  return (
    <div className="mx-auto max-w-[640px] pt-10 pb-6 sm:pt-14">
      <p className="text-[14px] leading-[22px] text-muted">
        {state.orgName} · {state.positionName}
      </p>
      <h1 className="mt-2 text-[28px] leading-9 font-semibold text-ink">{state.candidateName ? t("hello", { name: state.candidateName }) : t("helloNoName")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2" lang={intro?.text && intro.lang !== locale ? intro.lang : undefined}>
        {intro?.text || t("purpose")}
      </p>

      <ul className="tnum mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[16px] leading-[26px] text-ink">
        <li>{t("factStages", { count: state.stages.length })}</li>
        <li>{t("factMinutes", { minutes })}</li>
        <li>{t("factDeadline", { date: deadline })}</li>
      </ul>

      <section className="mt-10" aria-labelledby="landing-how">
        <h2 id="landing-how" className="text-[20px] leading-7 font-semibold text-ink">
          {t("howTitle")}
        </h2>
        <ol className="mt-3 space-y-2 text-[16px] leading-[26px] text-ink-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="tnum font-medium text-ink" aria-hidden>
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="landing-who">
        <h2 id="landing-who" className="text-[20px] leading-7 font-semibold text-ink">
          {t("whoTitle")}
        </h2>
        <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("whoPeople", { count: state.reviewers })}</p>
        <p className="mt-2 text-[16px] leading-[26px] text-ink-2">{recorded ? t("whoAiRecorded") : t("whoAi")}</p>
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-card-candidate" aria-labelledby="landing-recorded">
        <h2 id="landing-recorded" className="text-[20px] leading-7 font-semibold text-ink">
          {t("recordedTitle")}
        </h2>
        <ul className="mt-4 space-y-3 text-[16px] leading-[26px] text-ink">
          {state.signals.map((signal) => {
            const Icon = ICONS[signal];
            return (
              <li key={signal} className="flex gap-3">
                <Icon className="mt-[3px] size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                <span>{t(`signal${signal}`)}</span>
              </li>
            );
          })}
          <li className="pl-8 text-ink-2">{t("notMonitored")}</li>
        </ul>
        <p className="mt-4 text-[16px] leading-[26px] font-medium text-ink">{t("promise")}</p>
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1 rounded-lg text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
            {t("details")}
            <ChevronDown className="size-4 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-3 border-t border-line pt-3 text-[14px] leading-[22px] text-ink-2">
            <p className="whitespace-pre-line" lang={consentLang !== locale ? consentLang : undefined}>
              {consentBody}
            </p>
            <p className="tnum">{t("retentionMedia", { days: state.retention.mediaDays })}</p>
            <p className="tnum">{t("retentionRecord", { days: state.retention.candidateDays })}</p>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="mt-10" aria-labelledby="landing-need">
        <h2 id="landing-need" className="text-[20px] leading-7 font-semibold text-ink">
          {t("needTitle")}
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[16px] leading-[26px] text-ink-2">
          <li>{t("needQuiet")}</li>
          {state.devices.camera ? <li>{t("needCameraMic")}</li> : state.devices.microphone ? <li>{t("needMic")}</li> : null}
          <li className="tnum">{t("needTime", { minutes })}</li>
          <li>{t("needDevice")}</li>
        </ul>
      </section>

      <Collapsible className="mt-8 rounded-2xl border border-line bg-surface">
        <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-5 text-left text-[16px] font-medium text-ink sm:px-card-candidate">
          {t("adjustTitle")}
          <ChevronDown className="size-4 shrink-0 transition-transform duration-[180ms] ease-soft group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 px-5 pb-5 sm:px-card-candidate sm:pb-card-candidate">
          <fieldset>
            <legend id="landing-extra" className="text-[16px] font-medium text-ink">
              {t("extraTitle")}
            </legend>
            <RadioGroup
              value={String(pct)}
              onValueChange={chooseExtra}
              disabled={extraLocked || extra === "saving"}
              className="mt-3 gap-2"
              aria-labelledby="landing-extra"
              aria-describedby="landing-extra-why"
            >
              {EXTRA.map((value) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 text-[16px] text-ink transition-colors duration-[120ms] ease-out hover:bg-canvas has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft has-[:disabled]:cursor-not-allowed"
                >
                  <RadioGroupItem value={value} />
                  <span className="tnum">{value === "0" ? t("extraNone") : value === "25" ? t("extra25") : t("extra50")}</span>
                </label>
              ))}
            </RadioGroup>
            {/* The reason the choice is closed (C15), or what the choice did. */}
            <p id="landing-extra-why" className="mt-2 text-[14px] leading-[22px] text-muted" role="status">
              {extraNote}
            </p>
            {extraError ? (
              <p role="alert" className="mt-1 text-[14px] leading-[22px] text-ink">
                {extraError}
              </p>
            ) : null}
          </fieldset>
          <div>
            <a
              href={`/a/${encodeURIComponent(token)}/rights?type=accommodation`}
              className="inline-flex min-h-11 items-center rounded-lg text-[16px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
            >
              {t("otherAdjustment")}
            </a>
            <p className="text-[14px] leading-[22px] text-muted">{t("otherBody")}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-8 flex items-start gap-3">
        <Checkbox id="landing-consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-[3px] size-5 after:-inset-3" />
        <label htmlFor="landing-consent" className="min-h-11 cursor-pointer text-[16px] leading-[26px] text-ink">
          {t("consentLabel")}
        </label>
      </div>

      <ActionBar>
        <Button
          id="landing-start"
          variant="primary"
          size="lg"
          className="w-full text-[16px]"
          disabled={!accepted || busy}
          disabledReason={!accepted ? t("consentRequired") : undefined}
          onClick={start}
        >
          {busy ? t("starting") : t("start")}
        </Button>
        {!accepted ? (
          <DisabledReason id="landing-start-why" className="mt-2 text-center text-[14px]">
            {t("consentRequired")}
          </DisabledReason>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-center text-[14px] text-ink">
            {error}
          </p>
        ) : null}
      </ActionBar>

      <p className="mt-6 text-center text-[14px] leading-[22px] text-muted">
        {t("resume")}{" "}
        <a href={`/a/${encodeURIComponent(token)}/rights`} className="inline-flex min-h-11 items-center text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
          {t("rights")}
        </a>
      </p>
      {state.contactEmail ? <p className="mt-1 text-center text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null}
    </div>
  );
}
