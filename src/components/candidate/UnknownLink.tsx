import { CandidateIntl } from "@/components/candidate/Intl";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { CandidateShell } from "@/components/candidate/Shell";
import { visitorLocale } from "@/i18n/visitor-locale";
import { ORG_TIMEZONE } from "@/lib/org-timezone";

/** The invalid-link card in the browser's language: what any page shows for a token it does not serve. */
export async function UnknownLink({ token }: { token: string }) {
  const locale = await visitorLocale();
  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={locale} header={false}>
        <LinkProblem token={token} locale={locale} problem="INVALID" contactEmail="destek@kademe.local" />
      </CandidateShell>
    </CandidateIntl>
  );
}
