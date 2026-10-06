"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Accessibility, AudioLines, CalendarDays, Clock, EyeOff, Headphones, Laptop, Layers, Mic, Video, Wifi } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { FactTiles } from "@/components/visual/fact-tiles";
import { IconRow } from "@/components/visual/icon-row";
import { PathSteps } from "@/components/visual/path-steps";
import { StepFooter } from "@/components/visual/step-footer";
import { StepScreen } from "@/components/visual/step-screen";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { leaveHashStep, pushHash, subscribeHash } from "@/lib/client/hash-step";
import { nextPath } from "@/lib/candidate-routes";
import { pickTextLang } from "@/lib/i18n-text";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";
import type { HiringCandidateState } from "@/solutions/hiring/rules/candidate-state";
import { mailTo } from "./closed";
import { agreeWaitReason, bringList, CONSENT_HASH, consentNote, continueWaitReason, landingStepOf, welcomePath, type LandingState, type LandingStep } from "./landing-model";
import { serverMessage } from "./server-message";
import { useJourney } from "./use-journey";

const SIGNAL_ROW = { VIDEO_ANSWER: { icon: Video, key: "rowVideo" }, AUDIO_ANSWER: { icon: Mic, key: "rowAudio" }, TECHNICAL: { icon: Wifi, key: "rowTechnical" } } as const;
const BRING_ICON = { quiet: Headphones, cameraMic: Video, mic: Mic, computer: Laptop } as const;
const EXTRA = ["0", "25", "50"] as const;

const currentStep = () => landingStepOf(window.location.hash);
const serverStep = (): LandingStep => "welcome";

/**
 * HIRING-VISUAL-FLOW 3.1 and 3.2 (K3): Welcome says who, how long, how it goes
 * and what to have ready, and takes extra time without a reason; Consent says
 * exactly what is recorded (plan 2 monitors nothing: decision 5 of this plan
 * and C24), the fixed promise, the AI line, and the full text one click away.
 * No question is shown before consent. Consent posts to the core route, which
 * records the text frozen on this invitation, only when the candidate presses
 * "Kabul et ve başla". The minutes are the state's total with extra time and
 * any grace (C25). Both steps live in this one component, so going back to
 * Welcome keeps the extra-time choice and the ticked box.
 */
export function Landing({
  token,
  state,
  consentBody,
  consentLang,
  deadline,
  deadlineWhen,
  deadlineZone,
  locale,
}: {
  token: string;
  /** The landing's projection (landingStateOf): counts and the candidate's own facts, no stage name. */
  state: LandingState;
  consentBody: string;
  /** The language the consent text is shown in (the other one when the candidate's is empty). */
  consentLang: Locale;
  /** The full deadline in the e-mail's words (Consent's details); the tile shows the same words in two parts. */
  deadline: string;
  deadlineWhen: string;
  deadlineZone: string;
  locale: Locale;
}) {
  const t = useT("hiringLanding");
  const router = useRouter();
  const step = useSyncExternalStore(subscribeHash, currentStep, serverStep);
  // True once the candidate has moved between the steps on this page (Continue, Back, the
  // browser's buttons). Only then does the new step fade in and take the focus (2.3); the first
  // load, a reload on #consent included, does neither.
  const [moved, setMoved] = useState(false);
  useEffect(() => subscribeHash(() => setMoved(true)), []);
  const heading = useStepFocus<HTMLHeadingElement>(moved ? step : "load");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState(state.extraTimePct);
  const [minutes, setMinutes] = useState(state.totalMinutes);
  const [extra, setExtra] = useState<"idle" | "saving" | "saved">("idle");
  const [extraError, setExtraError] = useState<string | null>(null);
  const recorded = state.devices.microphone;
  const intro = state.introBody ? pickTextLang(state.introBody, locale) : null;
  const journey = useJourney("prep", { device: recorded, warmup: state.practice });

  async function chooseExtra(value: string) {
    // One choice at a time. The cards stay enabled while it saves, so a keyboard user keeps the
    // focus on the card they chose (a disabled radio drops it to the page).
    if (extra === "saving") return;
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

  async function agree() {
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

  if (step === "welcome") {
    const extraLocked = state.extraTimeLocked;
    const extraNote = extraLocked ? t("extraLocked") : extra === "saving" ? t("extraSaving") : extra === "saved" ? t("extraSaved") : t("extraShort");
    const path = welcomePath({ device: recorded, warmup: state.practice });
    const continueWhy = continueWaitReason(extra);
    return (
      <>
        <StepScreen
          key="welcome"
          layout="split"
          illustration="welcome"
          kicker={`${state.orgName} · ${state.positionName}`}
          title={state.candidateName ? t("hello", { name: state.candidateName }) : t("helloNoName")}
          titleRef={heading}
          enter={moved}
          lead={<p lang={intro?.text && intro.lang !== locale ? intro.lang : undefined}>{intro?.text || t("subline")}</p>}
        >
          <div className="space-y-8">
            <FactTiles
              items={[
                { icon: Clock, value: t("factMinutesValue", { minutes }), label: t("factMinutesLabel") },
                { icon: Layers, value: t("factStagesValue", { count: state.stageCount }), label: t("factStagesLabel") },
                { icon: CalendarDays, value: deadlineWhen, label: t("factDeadlineZone", { zone: deadlineZone }) },
              ]}
            />
            <section aria-labelledby="landing-path">
              <h2 id="landing-path" className="mb-3 text-[18px] leading-7 font-semibold text-ink">
                {t("pathTitle")}
              </h2>
              <PathSteps
                locale={locale}
                steps={path.map((p) =>
                  p === "device"
                    ? { title: t("pathDevice"), detail: t("pathDeviceDetail") }
                    : p === "warmup"
                      ? { title: t("pathWarmup"), detail: t("pathWarmupDetail") }
                      : p === "questions"
                        ? { title: t("pathQuestions"), detail: t("pathQuestionsDetail") }
                        : { title: t("pathTeam"), detail: t("whoShort", { count: state.reviewers }) },
                )}
              />
            </section>
            <section aria-labelledby="landing-bring">
              <h2 id="landing-bring" className="mb-3 text-[18px] leading-7 font-semibold text-ink">
                {t("bringTitle")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {bringList(state.devices).map((item) => {
                  const Icon = BRING_ICON[item];
                  const label = item === "quiet" ? t("bringQuiet") : item === "cameraMic" ? t("bringCameraMic") : item === "mic" ? t("bringMic") : t("needDevice");
                  return (
                    <li key={item} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] text-ink">
                      <Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
                      {label}
                    </li>
                  );
                })}
              </ul>
            </section>
            <Disclosure label={t("adjustRow")} icon={Accessibility}>
              <fieldset className="space-y-3">
                <legend id="landing-extra" className="text-[16px] font-medium text-ink">
                  {t("extraTitle")}
                </legend>
                <ChoiceCardGroup
                  type="single"
                  name="extra-time"
                  value={[String(pct)]}
                  onChange={([v]) => void chooseExtra(v)}
                  labelledBy="landing-extra"
                  describedBy="landing-extra-why"
                  disabled={extraLocked}
                  columns={3}
                  items={EXTRA.map((value) => ({ value, label: <span className="tnum">{value === "0" ? t("extraNone") : value === "25" ? t("extra25") : t("extra50")}</span> }))}
                />
                {/* The reason the choice is closed (C15), or what the choice did. */}
                <p id="landing-extra-why" role="status" className="text-[14px] leading-[22px] text-muted">
                  {extraNote}
                </p>
                {extraError ? (
                  <p role="alert" className="text-[14px] leading-[22px] text-ink">
                    {extraError}
                  </p>
                ) : null}
                <div>
                  <a
                    href={`/a/${encodeURIComponent(token)}/rights?type=accommodation`}
                    className="inline-flex min-h-11 items-center rounded-lg text-[16px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
                  >
                    {t("otherAdjustment")}
                  </a>
                  <p className="text-[14px] leading-[22px] text-muted">{t("otherBody")}</p>
                </div>
              </fieldset>
            </Disclosure>
            <p className="text-[14px] leading-[22px] text-muted">{t("footnote")}</p>
          </div>
        </StepScreen>
        <StepFooter
          journey={journey}
          primary={{
            kind: "button",
            id: "landing-continue",
            label: t("continue"),
            waitReason: continueWhy ? t(continueWhy) : null,
            onClick: () => {
              // A new, marked history entry on the same page: the browser's back button returns to Welcome.
              pushHash(CONSENT_HASH);
              window.scrollTo({ top: 0 });
            },
          }}
        />
      </>
    );
  }

  const why = agreeWaitReason(accepted, extra === "saving");
  const extraNote = consentNote(extraError !== null);
  return (
    <>
      <StepScreen
        key="consent"
        layout="split"
        illustration="consent"
        illustrationSize="spot"
        title={t("consentTitle")}
        titleRef={heading}
        enter={moved}
        lead={<p className="text-[18px] leading-7 font-semibold text-ink">{t("promise")}</p>}
        aside={
          <div className="space-y-1">
            <a
              href={`/a/${encodeURIComponent(token)}/rights`}
              className="inline-flex min-h-11 items-center text-[14px] text-ink underline decoration-underline underline-offset-4 hover:decoration-ink"
            >
              {t("rights")}
            </a>
            {state.contactEmail ? <p className="text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: state.contactEmail, mail: mailTo(state.contactEmail) })}</p> : null}
          </div>
        }
      >
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-card-candidate" aria-labelledby="consent-recorded">
            <h2 id="consent-recorded" className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
              {t("groupRecorded")}
            </h2>
            {state.signals.map((signal) => (
              <IconRow key={signal} icon={SIGNAL_ROW[signal].icon} title={t(SIGNAL_ROW[signal].key)} detail={signal === "TECHNICAL" ? t("rowTechnicalDetail") : undefined} />
            ))}
            <div className="border-t border-line pt-4">
              <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{t("groupNotRecorded")}</h2>
              <div className="mt-4">
                <IconRow icon={EyeOff} tone="negative" title={t("rowNotMonitored")} />
              </div>
            </div>
          </section>
          <div className="rounded-2xl border border-line bg-surface p-card-candidate">
            <IconRow icon={AudioLines} title={t("aiTitle")} detail={recorded ? t("aiDetailRecorded") : t("aiDetail")} />
          </div>
          <Disclosure label={t("detailsLong")}>
            <div className="space-y-3 text-[14px] leading-[22px] text-ink-2">
              <p>{t("whoPeople", { count: state.reviewers })}</p>
              {state.signals.map((signal) => (
                <p key={signal}>{t(`signal${signal}`)}</p>
              ))}
              <p className="whitespace-pre-line" lang={consentLang !== locale ? consentLang : undefined}>
                {consentBody}
              </p>
              <p className="tnum">{t("retentionMedia", { days: state.retention.mediaDays })}</p>
              <p className="tnum">{t("retentionRecord", { days: state.retention.candidateDays })}</p>
              <p className="tnum">{t("deadlineFull", { date: deadline })}</p>
            </div>
          </Disclosure>
          {/* The whole card ticks the box (3.2); the box keeps its own focus ring inside the card's. */}
          <label
            htmlFor="landing-consent"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-brand-soft"
          >
            <Checkbox id="landing-consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-[3px] size-5" />
            <span className="text-[16px] leading-[26px] text-ink">{t("consentLabel")}</span>
          </label>
        </div>
      </StepScreen>
      <StepFooter
        journey={journey}
        // Back in history when Welcome pushed this entry (a reload keeps the mark); on a page opened on #consent, swap to Welcome instead of leaving.
        back={{ label: t("back"), onClick: leaveHashStep }}
        primary={{ kind: "button", id: "landing-agree", label: t("agree"), busy, busyLabel: t("starting"), waitReason: why ? t(why) : null, onClick: () => void agree() }}
        note={
          error || extraNote ? (
            <div className="space-y-1">
              {extraNote ? <p className="text-[14px] text-ink">{t(extraNote)}</p> : null}
              {error ? (
                <p role="alert" className="text-[14px] text-ink">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null
        }
      />
    </>
  );
}
