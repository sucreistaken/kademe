"use client";

import { useState } from "react";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { dateTime, shortDate } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";
import type { LinkProblem as Problem } from "@/lib/candidate-context";

/**
 * Artboard A12, the right card, in four variants. None of the four ways a link
 * can fail is a dead end: each says what happened, what is already saved, and
 * what the candidate can do next.
 */
export function LinkProblem({
  token,
  locale,
  problem,
  expiresAt,
  notBefore,
  progress,
  contactEmail,
  contactName,
}: {
  token: string;
  locale: Locale;
  problem: Problem;
  expiresAt?: number;
  notBefore?: number;
  progress?: { completed: number; total: number };
  contactEmail: string;
  /** The recruiter who sent the link. Named on the card, as on artboard A12,
   *  because "goes to the hiring team" reads like it goes nowhere. */
  contactName?: string | null;
}) {
  const t = useT("linkProblem");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function askForNewLink() {
    setBusy(true);
    await apiSend(token, "/problem", {
      area: "LINK",
      message: t("requestMessage"),
    }).catch(() => undefined);
    setSent(true);
    setBusy(false);
  }

  const copy = {
    INVALID: { mark: "!", title: t("invalidTitle"), body: t("invalidBody") },
    NOT_YET: {
      mark: "•",
      title: t("notYetTitle"),
      body: notBefore
        ? t("notYetBodyDated", { date: dateTime(new Date(notBefore), locale) })
        : t("notYetBody"),
    },
    EXPIRED: {
      mark: "!",
      title: t("expiredTitle"),
      body: expiresAt
        ? t("expiredBodyDated", { date: shortDate(new Date(expiresAt), locale) })
        : t("expiredBody"),
    },
    COMPLETED: {
      mark: "✓",
      title: t("completedTitle"),
      body: t("completedBody"),
    },
  }[problem];

  /** Only a link that can be reopened is worth telling about saved progress. */
  const canAsk = problem === "EXPIRED" || problem === "NOT_YET";

  return (
    <CandidateColumn width={490} padding="px-[34px] pt-11 pb-[46px]">
      <div className="flex size-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-ink-3 text-[15px] font-semibold text-muted">
        {copy.mark}
      </div>
      <h1 className="mt-[18px] text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">
        {copy.title}
      </h1>
      <p className="mt-2.5 text-sm leading-[1.65] text-ink-2">{copy.body}</p>

      {canAsk && progress && progress.completed > 0 && progress.completed < progress.total ? (
        <div className="mt-[22px] rounded-[10px] border border-line bg-surface px-4 py-3.5">
          <div className="text-[13px] font-semibold text-ink">
            {t("savedTitle")}
          </div>
          <p className="mt-[5px] text-[13px] leading-[1.6] text-muted">
            {t("savedBody", {
              completed: progress.completed,
              next: progress.completed + 1,
            })}
          </p>
        </div>
      ) : null}

      {canAsk ? (
        <>
          <button
            type="button"
            disabled={sent || busy}
            onClick={askForNewLink}
            className={
              sent || busy
                ? "mt-[18px] w-full cursor-not-allowed rounded-[9px] bg-disabled px-4 py-3.5 text-sm font-semibold text-ink-3"
                : "mt-[18px] w-full rounded-[9px] bg-accent px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            }
          >
            {sent
              ? t("requestSent")
              : busy
                ? t("requestSending")
                : t("requestNewLink")}
          </button>
          <p className="mt-3 text-center text-[12.5px] leading-[1.6] text-muted">
            {sent
              ? t("requestSentHint")
              : contactName
                ? t("requestHintNamed", { name: contactName })
                : t("requestHint")}
          </p>
        </>
      ) : (
        <p className="mt-[18px] text-[13px] leading-[1.6] text-muted">
          {t.rich("contactHint", {
            email: contactEmail,
            mail: (chunks) => (
              <a
                href={`mailto:${contactEmail}`}
                className="text-ink-2 underline decoration-line-strong underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      )}
    </CandidateColumn>
  );
}
