"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateState } from "@/lib/candidate-flow";
import { useT } from "@/i18n/candidate-client";
import { shortDate } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";

/**
 * Artboard A8. The first screen says what this is, how long it takes, that a
 * recording will be made and that a person reads the answers. What it
 * deliberately does not show is a single question: the candidate consents
 * before seeing anything they could prepare an answer to.
 */
export function IntroConsent({
  token,
  locale,
  state,
  consent,
  supportEmail,
  mediaRetentionDays,
}: {
  token: string;
  locale: Locale;
  state: CandidateState;
  consent: { version: number; body: string };
  supportEmail: string;
  /** The org's real retention. The screen promises this number, not a slogan. */
  mediaRetentionDays: number;
}) {
  const router = useRouter();
  const t = useT("intro");
  const common = useT("common");
  const [accepted, setAccepted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<CandidateState>(token, "/consent", {
        accepted: true,
      });
      router.push(stepPath(token, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : common("somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <CandidateColumn width={600}>
      {/* The organisation only. The position's own name is the manager's
          internal label; what the candidate reads as the heading is the
          version's introTitle, which falls back to that name server side. */}
      <div className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted">
        {state.orgName}
      </div>
      <h1 className="mt-2.5 text-[32px] font-bold leading-[1.2] tracking-[-0.03em] text-ink">
        {state.positionTitle}
      </h1>
      <p className="mt-3.5 text-[15px] leading-[1.65] text-ink-2">
        {state.intro || t("lead")}
      </p>

      <div className="mt-7 flex gap-2.5">
        <Fact label={t("factStages")} value={String(state.stageCount)} />
        <Fact
          label={t("factDuration")}
          value={t("minutes", { count: state.estimatedMinutes })}
        />
        <Fact
          label={t("factDeadline")}
          value={shortDate(new Date(state.expiresAt), locale)}
        />
      </div>

      <h2 className="mb-3.5 mt-[34px] text-[15px] font-semibold text-ink">
        {t("howItWorks")}
      </h2>
      <ol className="flex flex-col gap-3.5">
        <Step n={1} title={t("step1Title")} body={t("step1Body")} />
        <Step n={2} title={t("step2Title")} body={t("step2Body")} />
        <Step n={3} title={t("step3Title")} body={t("step3Body")} />
      </ol>

      <div className="mt-[26px] rounded-[10px] border border-line bg-surface px-[18px] py-4">
        <div className="text-[13.5px] font-semibold text-ink">
          {t("recordingTitle")}
        </div>
        <p className="mt-[5px] text-[13px] leading-[1.6] text-muted">
          {t("recordingBody", {
            months: Math.max(1, Math.round(mediaRetentionDays / 30)),
          })}
        </p>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="mt-2 text-[12.5px] font-semibold text-ink underline decoration-underline underline-offset-2"
          aria-expanded={showDetails}
        >
          {t("howDataProcessed")} {showDetails ? "⌃" : "⌄"}
        </button>
        {showDetails ? (
          <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-[13px] leading-[1.65] text-muted">
            {consent.body}
          </p>
        ) : null}
      </div>

      <label className="mt-[22px] flex cursor-pointer items-start gap-[11px]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 rounded-[4px] border-[1.5px] border-line-mute accent-accent"
        />
        <span className="text-[13.5px] leading-[1.6] text-ink-2">
          {t("consentLabel")}
        </span>
      </label>

      <button
        type="button"
        id="start"
        disabled={!accepted || busy}
        onClick={start}
        aria-describedby={!accepted ? "start-why" : undefined}
        className={
          accepted && !busy
            ? "mt-[22px] w-full rounded-[10px] border border-accent bg-accent px-4 py-[15px] text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
            : "mt-[22px] w-full cursor-not-allowed rounded-[10px] border border-line bg-disabled px-4 py-[15px] text-[14.5px] font-semibold text-ink-3"
        }
      >
        {busy ? t("starting") : t("start")}
      </button>
      {!accepted ? (
        <p id="start-why" className="mt-[9px] text-center text-[12.5px] text-muted">
          {t("consentRequired")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-center text-[13px] text-danger">{error}</p>
      ) : null}

      <p className="mt-[22px] text-center text-[12.5px] leading-[1.6] text-ink-3">
        {t.rich("resumeNote", {
          email: supportEmail,
          mail: (chunks) => (
            <a
              href={`mailto:${supportEmail}`}
              className="text-ink-2 underline decoration-line-strong underline-offset-2"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </CandidateColumn>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-line bg-surface px-[18px] py-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="tnum mt-1.5 text-[22px] font-bold leading-[1.2] text-ink">
        {value}
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="w-[18px] shrink-0 text-[13px] font-semibold text-muted">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <p className="mt-[3px] text-[13.5px] leading-[1.6] text-muted">{body}</p>
      </div>
    </li>
  );
}
