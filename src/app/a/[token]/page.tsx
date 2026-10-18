import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { IntroConsent } from "@/components/candidate/IntroConsent";
import { getConsentText, supportedLocales } from "@/lib/candidate-context";
import { consentIsFallback, consentShownLocale } from "@/lib/consent-locale";
import { candidateSafe } from "@/lib/candidate-safe";
import { solutionPage } from "@/lib/candidate-pages";
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
  const hosted = await solutionPage(token, "landing", searchParams);
  if (hosted !== undefined) return hosted;
  const entry = await enter(token, "CONSENT", searchParams, `/a/${token}`);
  if (entry.kind === "problem") return entry.node;

  // The core consent read is the exam's alone: another solution's invitation
  // was answered by solutionPage above or stopped at enter() as an unknown token.
  const consent = await getConsentText(entry.ctx);
  const shown = consentShownLocale(entry.locale, consent.body);

  return (
    <CandidateIntl locale={entry.locale} timeZone={ORG_TIMEZONE}>
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
            body: consent.body[shown],
            shown,
            // Only the languages without a consent text of their own read English, with a way to the Turkish text.
            turkishBody: consentIsFallback(entry.locale) && shown === "en" && consent.body.tr ? consent.body.tr : null,
          }}
          supportEmail={entry.ctx.contactEmail}
          mediaRetentionDays={entry.ctx.mediaRetentionDays}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
