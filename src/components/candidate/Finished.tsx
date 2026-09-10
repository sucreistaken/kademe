"use client";

import { useState } from "react";
import Link from "next/link";
import { CandidateColumn } from "@/components/candidate/Shell";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { dateTime, shortDate } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";

/**
 * Artboard A12, the left card. The end of the flow is still a screen with a
 * next action on it: what happens now, who to contact, and how to ask for the
 * data back or deleted.
 */
export function Finished({
  token,
  locale,
  name,
  stageCount,
  submittedAt,
  responseByAt,
  orgName,
  contactEmail,
}: {
  token: string;
  locale: Locale;
  name: string;
  stageCount: number;
  submittedAt: number;
  /** When the hiring team promises to have written back. */
  responseByAt: number | null;
  orgName: string;
  contactEmail: string;
}) {
  const t = useT("done");
  const [copyState, setCopyState] = useState<"idle" | "sent">("idle");

  async function requestCopy() {
    await apiSend(token, "/rights", {
      kind: "COPY",
      message: t("copyMessage"),
    }).catch(() => undefined);
    setCopyState("sent");
  }

  const firstName = name.split(" ")[0];

  return (
    <CandidateColumn width={490} padding="px-[34px] pt-11 pb-[46px]">
      <div className="flex size-[34px] items-center justify-center rounded-full border-[1.5px] border-ink text-sm font-semibold text-ink">
        ✓
      </div>
      <h1 className="mt-[18px] text-2xl font-bold leading-[1.25] tracking-[-0.02em] text-ink">
        {firstName ? t("title", { name: firstName }) : t("titleNoName")}
      </h1>
      <p className="mt-2.5 text-sm leading-[1.65] text-ink-2">
        {t("body", { count: stageCount, org: orgName })}
      </p>

      <div className="mt-[22px] rounded-[10px] border border-line bg-surface px-4 py-3.5">
        <Row label={t("sentAt")} value={dateTime(new Date(submittedAt), locale)} />
        {/* Artboard A12 promises a date, and a promise with no date is not one.
            Shown only when there is a real submission to count from. */}
        {responseByAt ? (
          <Row
            label={t("responseBy")}
            value={t("responseByValue", {
              date: shortDate(new Date(responseByAt), locale),
            })}
            divider
          />
        ) : null}
        <Row label={t("contact")} value={contactEmail} divider />
      </div>

      <p className="mt-[18px] text-[13px] leading-[1.6] text-muted">
        {t("nextStep")}
      </p>

      <button
        type="button"
        disabled={copyState === "sent"}
        onClick={requestCopy}
        className="mt-[18px] rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:border-line disabled:text-ink-3"
      >
        {copyState === "sent" ? t("requestSent") : t("requestCopy")}
      </button>
      <div className="mt-3">
        <Link
          href={`/a/${encodeURIComponent(token)}/rights`}
          className="text-[12.5px] text-muted underline decoration-line underline-offset-2"
        >
          {t("rightsLink")}
        </Link>
      </div>
    </CandidateColumn>
  );
}

function Row({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      className={
        divider
          ? "flex items-center justify-between border-t border-row-line py-1.5"
          : "flex items-center justify-between py-1.5"
      }
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}
