"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { MobileBlock, isMobileDevice } from "@/components/candidate/MobileBlock";
import { apiSend } from "@/lib/client/api";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/exam-flow";
import { useT } from "@/i18n/candidate-client";
import type { Locale } from "@/i18n/locale";

/**
 * The first screen: what this exam is, how long it takes, and exactly what is
 * watched and why, before a single question is shown. Honest disclosure first;
 * the one button comes after the student has read it.
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
    setMobile(proctored && (p.screenShare || p.camera) && isMobileDevice());
  }, [proctored, p.screenShare, p.camera]);

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

  if (mobile) return <MobileBlock token={token} />;

  const title =
    state.mode === "LEVEL_VERIFICATION" && state.claimedLevel
      ? t("titleVerification", { level: state.claimedLevel })
      : t("titlePlacement");

  return (
    <CandidateColumn width={640}>
      <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">{state.orgName}</div>
      <h1 className="mt-2.5 text-[32px] font-bold leading-[1.2] tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-3.5 text-[15px] leading-[1.65] text-ink-2">{t("lead", { org: state.orgName })}</p>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-ink">{t("sectionsTitle")}</h2>
      <ul className="divide-y divide-line rounded-[10px] border border-line bg-surface">
        {state.sections.map((s) => (
          <li key={s.section} className="flex items-baseline justify-between gap-4 px-[18px] py-3">
            <span className="text-sm font-medium text-ink">
              <span className="tnum mr-2 text-muted">{s.position}</span>
              {sec(s.section)}
            </span>
            <span className="tnum text-[13px] text-muted">
              {s.itemsLabel.includes("-")
                ? t("itemsAdaptive", { range: s.itemsLabel })
                : s.section === "WRITING" || s.section === "SPEAKING"
                  ? t("tasks", { n: s.itemsLabel })
                  : t("items", { n: s.itemsLabel })}
              {" · "}
              {t("minutes", { n: s.minutes })}
            </span>
          </li>
        ))}
      </ul>
      <p className="tnum mt-2 text-[13px] text-muted">{t("total", { n: state.estimatedMinutes })}</p>

      <div className="mt-7 rounded-[10px] border border-line bg-surface px-[18px] py-4">
        <div className="text-[13.5px] font-semibold text-ink">{proctored ? t("proctoredTitle") : t("notProctored")}</div>
        {proctored ? (
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[1.6] text-ink-2">
            {p.camera ? <li>{t("proctoredCamera")}</li> : null}
            {p.screenShare ? <li>{t("proctoredScreen")}</li> : null}
            {p.fullscreen ? <li>{t("proctoredFullscreen")}</li> : null}
            <li>{t("proctoredAi")}</li>
            <li>{t("proctoredRetention", { days: mediaRetentionDays })}</li>
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="mt-2 text-[12.5px] font-semibold text-ink underline decoration-underline underline-offset-2"
        >
          {t("details")}
        </button>
        {showDetails ? (
          <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-[13px] leading-[1.65] text-muted">{consent.body}</p>
        ) : null}
      </div>

      <h2 className="mb-2 mt-7 text-[15px] font-semibold text-ink">{t("needTitle")}</h2>
      <ul className="flex flex-col gap-1 text-[13.5px] text-ink-2">
        <li>{t("needComputer")}</li>
        {p.camera ? <li>{t("needCamera")}</li> : null}
        <li>{t("needQuiet")}</li>
        <li className="tnum">{t("needTime", { n: state.estimatedMinutes })}</li>
      </ul>

      <label className="mt-7 flex cursor-pointer items-start gap-[11px]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 rounded-[4px] border-[1.5px] border-line-mute accent-accent"
        />
        <span className="text-[13.5px] leading-[1.6] text-ink-2">{t("consentLabel")}</span>
      </label>

      <button
        type="button"
        onClick={start}
        disabled={!accepted || busy}
        aria-describedby={!accepted ? "start-why" : undefined}
        className="mt-5 h-12 w-full rounded-[10px] bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {busy ? t("starting") : t("start")}
      </button>
      {!accepted ? (
        <p id="start-why" className="mt-[9px] text-center text-[12.5px] text-muted">
          {t("consentRequired")}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-center text-[13px] text-danger">{error}</p> : null}
      {supportEmail ? (
        <p className="mt-6 text-center text-[12.5px] text-ink-3">
          <a className="underline decoration-line-strong underline-offset-2" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          {" · "}
          <a className="underline decoration-line-strong underline-offset-2" href={`/a/${encodeURIComponent(token)}/rights`}>
            {res("rights")}
          </a>
        </p>
      ) : null}
    </CandidateColumn>
  );
}
