import { CandidateIntl } from "@/components/candidate/Intl";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { CandidateShell } from "@/components/candidate/Shell";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";

/** The invalid-link card in the default language: what any page shows for a token it does not serve. */
export function UnknownLink({ token }: { token: string }) {
  return (
    <CandidateIntl locale={DEFAULT_LOCALE} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={DEFAULT_LOCALE} header={false}>
        <LinkProblem token={token} locale={DEFAULT_LOCALE} problem="INVALID" contactEmail="destek@kademe.local" />
      </CandidateShell>
    </CandidateIntl>
  );
}
