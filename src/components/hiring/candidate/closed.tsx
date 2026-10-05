"use client";

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

/** HIRING-UX 6.14 "Alım kapandı": thanks, and a person to write to. */
export function ClosedCard({ contactEmail }: { contactEmail: string | null }) {
  const t = useT("hiringClosed");
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <h1 className="text-[28px] leading-9 font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{t("body")}</p>
      {contactEmail ? (
        <p className="mt-6 text-[14px] leading-[22px] text-muted">
          {t.rich("contact", { email: contactEmail, mail: mailTo(contactEmail) })}
        </p>
      ) : null}
    </div>
  );
}
