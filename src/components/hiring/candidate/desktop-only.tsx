"use client";

import { useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { mailTo } from "./closed";
import { candidateLink, copyLink } from "./copy-link";

/**
 * HIRING-VISUAL-FLOW 3.0, the one phone screen: why (the team's choice, no
 * claim about monitoring), how long and until when (so the candidate can plan),
 * two steps, "Linki kopyala". "Linki e-postama gönder" waits for mail sending
 * (K11). A wrong detection is reported through the existing problem route,
 * which records the browser string; nothing else is stored. It receives no
 * stage name and no question (leak rule).
 */
export function DesktopOnlyScreen({
  token,
  minutes,
  deadlineDay,
  contactEmail,
}: {
  token: string;
  minutes: number;
  deadlineDay: string;
  contactEmail: string | null;
}) {
  const t = useT("hiringGate");
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [report, setReport] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  // Ruling C1: the link lives in state, so the hand-copy field never reads a ref during render.
  const [link, setLink] = useState("");
  const sentNote = useStepFocus<HTMLParagraphElement>(report === "sent" ? "sent" : "form");

  async function onCopy() {
    const url = candidateLink(window.location.origin, token);
    setLink(url);
    setCopy(await copyLink(url, navigator.clipboard));
  }

  async function onWrong() {
    setReport("sending");
    try {
      await apiSend(token, "/problem", { area: "DESKTOP_GATE", message: t("reportMessage") });
      setReport("sent");
    } catch {
      setReport("failed");
    }
  }

  return (
    <div className="mx-auto max-w-[560px] pt-8 pb-10">
      <h1 className="mt-6 text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("why")}</p>
      <ul className="tnum mt-4 flex flex-wrap gap-2 text-[14px] text-ink">
        <li className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3">
          <Clock className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          {t("minutes", { minutes })}
        </li>
        <li className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3">
          <CalendarDays className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          {t("deadline", { date: deadlineDay })}
        </li>
      </ul>
      <h2 className="mt-6 text-[16px] font-semibold text-ink">{t("steps")}</h2>
      <ol className="mt-2 space-y-2 text-[16px] leading-[26px] text-ink-2">
        {[t("step1"), t("step2")].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[14px] font-medium text-ink" aria-hidden>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8">
        <Button id="gate-copy" variant="primary" size="lg" className="min-h-12 w-full text-[16px]" onClick={onCopy}>
          {copy === "copied" ? t("copied") : t("copy")}
        </Button>
        <p role="status" className="mt-2 text-[14px] leading-[22px] text-ink">
          {copy === "manual" ? t("manual") : ""}
        </p>
        {copy === "manual" ? (
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("copy")} className="mt-1 h-12 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[16px] text-ink" />
        ) : null}
      </div>
      <div className="mt-6">
        {report === "sent" ? (
          <p ref={sentNote} tabIndex={-1} role="status" className="text-[14px] leading-[22px] text-ink">
            {contactEmail ? t.rich("wrongSentContact", { email: contactEmail, mail: mailTo(contactEmail) }) : t("wrongSent")}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={onWrong}
              disabled={report === "sending"}
              className="inline-flex min-h-11 items-center text-left text-[14px] text-ink underline decoration-underline underline-offset-4 disabled:text-muted"
            >
              {report === "sending" ? t("wrongSending") : t("wrong")}
            </button>
            {report === "failed" ? (
              <p role="alert" className="mt-1 text-[14px] leading-[22px] text-ink">
                {t("wrongFailed")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
