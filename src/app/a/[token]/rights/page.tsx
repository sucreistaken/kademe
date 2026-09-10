import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { RightsForm } from "@/components/candidate/RightsForm";
import { resolveToken } from "@/lib/candidate-flow";
import { candidateT } from "@/i18n/candidate";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * Data rights stay reachable on a link that has expired or already been
 * completed: those are exactly the moments a candidate wants their answers back
 * or deleted. Only an invalid token gets an error screen here.
 */
export default async function CandidateRightsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  const ctx = resolved.ctx;
  const locale = (ctx?.locale as Locale | undefined) ?? DEFAULT_LOCALE;
  const t = candidateT(locale);

  if (!ctx) {
    return (
      <CandidateIntl locale={locale}>
        <CandidateShell locale={locale} header={false}>
          <LinkProblem
            token={token}
            locale={locale}
            problem="INVALID"
            contactEmail="destek@kademe.local"
          />
        </CandidateShell>
      </CandidateIntl>
    );
  }

  return (
    <CandidateIntl locale={locale}>
      <CandidateShell
        locale={locale}
        meta={t("header.rights", {
          name: ctx.candidate.fullName ?? t("header.candidate"),
        })}
      >
        <RightsForm token={token} />
      </CandidateShell>
    </CandidateIntl>
  );
}
