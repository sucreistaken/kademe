import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { IntroConsent } from "@/components/candidate/IntroConsent";
import { getConsentText, supportedLocales } from "@/lib/candidate-context";
import { candidateSafe } from "@/lib/candidate-safe";
import { enter, headerMeta, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/**
 * The entry screen: what the exam is, how long it takes and what is watched.
 * No question is shown before consent.
 */
export default async function CandidateEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const entry = await enter(token, "CONSENT", searchParams, `/a/${token}`);
  if (entry.kind === "problem") return entry.node;

  const consent = await getConsentText(entry.ctx);

  return (
    <CandidateIntl locale={entry.locale}>
      <CandidateShell
        locale={entry.locale}
        meta={headerMeta(entry.ctx)}
        language={
          <LanguageSwitch
            locales={supportedLocales(entry.ctx)}
            current={entry.locale}
          />
        }
      >
        <IntroConsent
          token={token}
          locale={entry.locale}
          state={candidateSafe(entry.state)}
          consent={{
            version: consent.version,
            body: consent.body[entry.locale] || consent.body.tr,
          }}
          supportEmail={entry.ctx.contactEmail}
          mediaRetentionDays={entry.ctx.mediaRetentionDays}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
