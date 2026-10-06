"use client";

import { useState } from "react";
import { linkRequestHint } from "@/components/candidate/request-wording";
import { sendRightsRequest } from "@/components/candidate/rights-send";
import { StatusScreen } from "@/components/visual/status-screen";
import { StepFooter } from "@/components/visual/step-footer";
import { useStepFocus } from "@/hooks/use-step-focus";
import { apiSend } from "@/lib/client/api";
import { useT } from "@/i18n/candidate-client";
import { mailTo } from "./closed";

/**
 * HIRING-VISUAL-FLOW 3.11 for a served hiring link: expired (ask for a new
 * link, one filled button) or not open yet (no request: the same link works
 * then). The request reports the truth (plan 2b decision 8): "sent" only when
 * the server took it, otherwise the failure and "Tekrar dene"; no reply is
 * promised, the contact is named. Dates arrive formatted on the server.
 */
export function HiringLinkProblem({ token, problem, date, contactEmail }: { token: string; problem: "EXPIRED" | "NOT_YET"; date: string | null; contactEmail: string | null }) {
  const t = useT("hiringProblem");
  const th = useT("hiringRequest");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);
  // The footer's button leaves with the request sent: focus goes to the line that says so.
  const note = useStepFocus<HTMLParagraphElement>(state === "sent" ? "sent" : "form");

  async function ask() {
    setState("sending");
    setReason(null);
    // The rights form's helper: "sent" only when the server took it, the server's own words for a refusal.
    const result = await sendRightsRequest(() => apiSend(token, "/problem", { area: "LINK", message: t("message") }));
    if (result.status === "sent") return setState("sent");
    setReason(result.reason);
    setState("failed");
  }

  if (problem === "NOT_YET") {
    return (
      <StatusScreen illustration="expired" title={t("notYetTitle")} body={date ? t("notYetBodyDated", { date }) : t("notYetBody")}>
        {contactEmail ? <p className="text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: contactEmail, mail: mailTo(contactEmail) })}</p> : null}
      </StatusScreen>
    );
  }

  const hint = linkRequestHint({ sent: state === "sent", noReply: { email: contactEmail } });
  const hintText = hint.namespace === "hiringRequest" ? ("email" in hint ? th.rich(hint.key, { email: hint.email, mail: mailTo(hint.email) }) : th(hint.key)) : null;
  return (
    <>
      <StatusScreen illustration="expired" title={t("expiredTitle")} body={date ? t("expiredBodyDated", { date }) : t("expiredBody")}>
        {state === "sent" ? (
          <p ref={note} tabIndex={-1} role="status" className="text-ink">
            {hintText}
          </p>
        ) : (
          <>
            <p className="text-[14px] leading-[22px] text-muted">{hintText}</p>
            {state === "failed" ? (
              <p role="alert" className="text-ink">
                {reason ?? t("askFailed")}
              </p>
            ) : null}
          </>
        )}
      </StatusScreen>
      {state === "sent" ? null : (
        <StepFooter primary={{ kind: "button", id: "ask-link", label: state === "failed" ? t("retry") : t("ask"), busy: state === "sending", busyLabel: t("asking"), onClick: () => void ask() }} />
      )}
    </>
  );
}
