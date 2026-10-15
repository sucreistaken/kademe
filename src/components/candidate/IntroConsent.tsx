"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronDown, Clock, Laptop, ShieldCheck, VolumeX, type LucideIcon } from "lucide-react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { MobileBlock, isMobileDevice } from "@/components/candidate/MobileBlock";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/visual/mascot";
import { SectionTile } from "@/components/visual/section-look";
import { apiSend } from "@/lib/client/api";
import { stepPath } from "@/lib/candidate-routes";
import { cn } from "@/lib/cn";
import type { CandidateState } from "@/lib/exam-flow";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";

/**
 * The first screen: what this exam is, how long it takes, and exactly what is
 * watched and why, before a single question is shown. Honest disclosure first;
 * the one button comes after the student has read it.
 *
 * Soft look: the sections as one row of coloured tiles (each section keeps its
 * colour through the exam), what is needed as a small checklist, and the
 * consent as one large tick box, all on one laptop screen without scrolling
 * (user request 2026-10-15). Nothing here says anything about a result.
 *
 * The exam is desktop only (user decision 2026-10-14): a phone or tablet gets
 * the MobileBlock instead, whatever the proctoring, with the real reasons for
 * this exam.
 */
export function IntroConsent({
  token,
  state,
  consent,
  supportEmail,
  mediaRetentionDays,
}: {
  token: string;
  locale: Locale;
  state: CandidateState;
  consent: { version: number; body: string };
  supportEmail: string | null;
  mediaRetentionDays: number;
}) {
  const router = useRouter();
  const t = useT("exam");
  const nav = useT("examNav");
  const sec = useT("section");
  const common = useT("common");
  const res = useT("result");
  const v = useT("visual");
  const [accepted, setAccepted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const p = state.proctoring;
  const proctored = p.preset !== "OFF";

  useEffect(() => {
    // Read once after mount: the server cannot know the device.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(isMobileDevice());
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CandidateState>(token, "/consent", { accepted: true });
      router.push(stepPath(token, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : common("somethingWrong"));
      setBusy(false);
    }
  }

  if (mobile) {
    return (
      <MobileBlock
        token={token}
        need={{
          camera: proctored && p.camera,
          screenShare: proctored && p.screenShare,
          writing: state.sections.some((s) => s.section === "WRITING"),
        }}
      />
    );
  }

  const title =
    state.mode === "LEVEL_VERIFICATION" && state.claimedLevel
      ? t("titleVerification", { level: state.claimedLevel })
      : t("titlePlacement");

  // What to bring: a computer always (desktop only), a camera when the exam watches.
  const needs: Array<{ icon: LucideIcon; text: string }> = [
    { icon: Laptop, text: t("needComputer") },
    ...(proctored && p.camera ? [{ icon: Camera, text: t("needCamera") }] : []),
    { icon: VolumeX, text: t("needQuiet") },
    { icon: Clock, text: t("needTime", { n: state.estimatedMinutes }) },
  ];

  // The amount line on a section tile: "10 soru", "6 metin", "2 görev".
  const amount = (s: CandidateState["sections"][number]) =>
    s.itemsLabel.includes("-")
      ? t("itemsAdaptive", { range: s.itemsLabel })
      : s.section === "WRITING" || s.section === "SPEAKING"
        ? t("tasks", { n: s.itemsLabel })
        : s.cTestOnly
          ? nav("texts", { n: s.itemsLabel })
          : t("items", { n: s.itemsLabel });

  return (
    <CandidateColumn width={1000} padding="px-7 pt-5 pb-5">
      {/* One screen, no scrolling at 1366x768: the header, the sections as one
          row of tiles, then the disclosure on the left and preparation, consent
          and the one button on the right. */}
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <Badge tone="mint" size="md">{v("orgPill", { org: state.orgName })}</Badge>
          {/* The exam's own name is the heading; the generic kind of exam sits under it. */}
          <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{state.examName || title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {state.examName ? <p className="text-[15px] font-bold text-muted">{title}</p> : null}
            <Badge tone="outline" className="tnum">
              <Clock aria-hidden strokeWidth={2.25} />
              {t("total", { n: state.estimatedMinutes })}
            </Badge>
          </div>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">{t("lead", { org: state.orgName })}</p>
        </div>
        <Mascot pose="wave" size="small" className="-mb-1 hidden sm:block" />
      </div>

      <h2 className="sr-only">{v("sectionsTitle")}</h2>
      <ol
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {/* The order reads left to right; the section number stays for screen readers. */}
        {state.sections.map((s) => (
          <li key={s.section} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
            <SectionTile section={s.section} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-5 text-ink">
                <span className="sr-only">{v("sectionNumber", { n: s.position })}: </span>
                {sec(s.section)}
              </div>
              <div className="tnum truncate text-[12.5px] font-semibold text-ink-2">
                {amount(s)} · {t("minutes", { n: s.minutes })}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface px-5 py-4 shadow-card">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-soft text-sky">
              <ShieldCheck className="size-[17px]" strokeWidth={2} />
            </span>
            <h2 className="text-[15px] font-bold text-ink">{proctored ? t("proctoredTitle") : t("notProctored")}</h2>
          </div>
          {proctored ? (
            <ul className="mt-2.5 flex flex-col gap-1.5 text-[13.5px] leading-[1.5] text-ink-2">
              {[
                ...(p.camera ? [t("proctoredCamera")] : []),
                ...(p.screenShare ? [t("proctoredScreen")] : []),
                ...(p.fullscreen ? [t("proctoredFullscreen")] : []),
                t("proctoredAi"),
                t("proctoredRetention", { days: mediaRetentionDays }),
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full bg-sky-fill" />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
            className="mt-2.5 inline-flex items-center gap-1 rounded-md text-[13px] font-bold text-ink underline decoration-underline underline-offset-2 hover:decoration-ink"
          >
            {t("details")}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", showDetails && "rotate-180")} strokeWidth={2.25} />
          </button>
          {/* The full text scrolls inside the card, so opening it never pushes the button off the screen. */}
          {showDetails ? (
            <p className="mt-2.5 max-h-[28vh] overflow-y-auto whitespace-pre-line border-t border-row-line pr-1 pt-2.5 text-[13px] leading-[1.6] text-ink-2">
              {consent.body}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-[15px] font-extrabold text-ink">{v("needTitle")}</h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {needs.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-[13px] leading-[1.35] text-ink-2">
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                  <Icon className="size-[15px]" strokeWidth={2} />
                </span>
                <span className={Icon === Clock ? "tnum" : undefined}>{text}</span>
              </li>
            ))}
          </ul>

          <label
            className={cn(
              "mt-3 flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors motion-reduce:transition-none",
              accepted ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className="mt-px grid size-6 shrink-0 place-items-center rounded-sm border-2 border-line-mute bg-surface text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none"
            >
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="text-[15px] font-semibold leading-[1.5] text-ink">{t("consentLabel")}</span>
          </label>

          <button
            type="button"
            onClick={start}
            disabled={!accepted || busy}
            aria-describedby={!accepted ? "start-why" : undefined}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-3 h-12 w-full text-[16px]")}
          >
            {busy ? t("starting") : t("start")}
          </button>
          {!accepted ? (
            <p id="start-why" className="mt-2 text-center text-[13px] text-muted">
              {v("consentHint")}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2.5 rounded-lg bg-danger-soft px-4 py-2.5 text-center text-[13.5px] font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {supportEmail ? (
        <p className="mt-4 text-center text-[13px] text-muted">
          <a className="underline decoration-underline underline-offset-2 hover:text-ink" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          {" · "}
          <a className="underline decoration-underline underline-offset-2 hover:text-ink" href={`/a/${encodeURIComponent(token)}/rights`}>
            {res("rights")}
          </a>
        </p>
      ) : null}
    </CandidateColumn>
  );
}
