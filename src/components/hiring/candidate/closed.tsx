"use client";

import { StatusScreen } from "@/components/visual/status-screen";
import { useArrivalFocus } from "@/hooks/use-step-focus";
import { useT } from "@/i18n/candidate-client";

/** `<mail>` in a message: the address as a link that opens the candidate's mail app. */
export function mailTo(email: string) {
  return function MailLink(chunks: React.ReactNode) {
    return (
      <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center text-ink underline decoration-underline underline-offset-4 hover:decoration-ink">
        {chunks}
      </a>
    );
  };
}

/** HIRING-UX 6.14 "Alım kapandı", HIRING-VISUAL-FLOW 3.11: the closed door, thanks, and a person to write to. */
export function ClosedCard({ contactEmail }: { contactEmail: string | null }) {
  const t = useT("hiringClosed");
  // Task 13 minor (final wave): reached by a client navigation, the card lands on its title once.
  const title = useArrivalFocus<HTMLHeadingElement>();
  return (
    <StatusScreen illustration="closed" title={t("title")} titleRef={title} body={t("body")}>
      {contactEmail ? <p className="text-[14px] leading-[22px] text-muted">{t.rich("contact", { email: contactEmail, mail: mailTo(contactEmail) })}</p> : null}
    </StatusScreen>
  );
}
