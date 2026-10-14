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
 * Soft look: the five sections as a short path of coloured tiles (each section
 * keeps its colour through the exam), what is needed as a small checklist, and
 * the consent as one large tick box. Nothing here says anything about a result.
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

  return (
    <CandidateColumn width={640}>
      <div className="flex items-end justify-between gap-4">
        <Badge tone="mint" size="md">{v("orgPill", { org: state.orgName })}</Badge>
        <Mascot pose="wave" size="spot" className="-mb-2" />
      </div>
      {/* The exam's own name is the heading; the generic kind of exam sits under it. */}
      <h1 className="mt-4 text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{state.examName || title}</h1>
      {state.examName ? <p className="mt-1.5 text-[15px] font-bold text-muted">{title}</p> : null}
      <p className="mt-3.5 text-[16px] leading-[1.65] text-ink-2">{t("lead", { org: state.orgName })}</p>

      <div className="mb-3 mt-9 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-extrabold text-ink">{v("sectionsTitle")}</h2>
        <Badge tone="outline" className="tnum">
          <Clock aria-hidden strokeWidth={2.25} />
          {t("total", { n: state.estimatedMinutes })}
        </Badge>
      </div>
      <ol className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {state.sections.map((s) => (
          <li key={s.section} className="flex items-center gap-4 border-b border-row-line px-4 py-3.5 last:border-b-0 sm:px-5">
            <SectionTile section={s.section} />
            <div className="min-w-0 flex-1">
              <div className="tnum text-[12.5px] font-semibold text-muted">{v("sectionNumber", { n: s.position })}</div>
              <div className="text-[16px] font-bold leading-6 text-ink">{sec(s.section)}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge className="tnum">
                {s.itemsLabel.includes("-")
                  ? t("itemsAdaptive", { range: s.itemsLabel })
                  : s.section === "WRITING" || s.section === "SPEAKING"
                    ? t("tasks", { n: s.itemsLabel })
                    : t("items", { n: s.itemsLabel })}
              </Badge>
              <Badge className="tnum">{t("minutes", { n: s.minutes })}</Badge>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted">{v("sectionsHint")}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface px-5 py-4 shadow-card">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-soft text-sky">
            <ShieldCheck className="size-[18px]" strokeWidth={2} />
          </span>
          <div className="text-[15px] font-bold text-ink">{proctored ? t("proctoredTitle") : t("notProctored")}</div>
        </div>
        {proctored ? (
          <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-[1.6] text-ink-2">
            {[
              ...(p.camera ? [t("proctoredCamera")] : []),
              ...(p.screenShare ? [t("proctoredScreen")] : []),
              ...(p.fullscreen ? [t("proctoredFullscreen")] : []),
              t("proctoredAi"),
              t("proctoredRetention", { days: mediaRetentionDays }),
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-sky-fill" />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
          className="mt-3 inline-flex items-center gap-1 rounded-md text-[13px] font-bold text-ink underline decoration-underline underline-offset-2 hover:decoration-ink"
        >
          {t("details")}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", showDetails && "rotate-180")} strokeWidth={2.25} />
        </button>
        {showDetails ? (
          <p className="mt-3 whitespace-pre-line border-t border-row-line pt-3 text-[13.5px] leading-[1.65] text-ink-2">{consent.body}</p>
        ) : null}
      </div>

      <h2 className="mb-3 mt-8 text-[17px] font-extrabold text-ink">{v("needTitle")}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {needs.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-[14px] leading-[1.45] text-ink-2">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
              <Icon className="size-4" strokeWidth={2} />
            </span>
            <span className={Icon === Clock ? "tnum" : undefined}>{text}</span>
          </li>
        ))}
      </ul>

      <label
        className={cn(
          "mt-8 flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-4 transition-colors motion-reduce:transition-none",
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
        <span className="text-[15px] font-semibold leading-[1.55] text-ink">{t("consentLabel")}</span>
      </label>

      <button
        type="button"
        onClick={start}
        disabled={!accepted || busy}
        aria-describedby={!accepted ? "start-why" : undefined}
        className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-5 h-14 w-full text-[17px]")}
      >
        {busy ? t("starting") : t("start")}
      </button>
      {!accepted ? (
        <p id="start-why" className="mt-2.5 text-center text-[13px] text-muted">
          {v("consentHint")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-4 py-2.5 text-center text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {supportEmail ? (
        <p className="mt-7 text-center text-[13px] text-muted">
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
