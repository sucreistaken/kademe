import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { SystemCheck } from "@/components/candidate/proctor/SystemCheck";
import { supportedLocales } from "@/lib/candidate-context";
import { candidateT } from "@/i18n/candidate";
import { enter, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/** The system check: every device and permission proved before the first clock starts. */
export default async function CandidateCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const entry = await enter(token, "CHECK", searchParams, `/a/${token}/check`);
  if (entry.kind === "problem") return entry.node;

  return (
    <CandidateIntl locale={entry.locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell
        locale={entry.locale}
        meta={candidateT(entry.locale)("header.preparing")}
        language={
          <LanguageSwitch
            locales={supportedLocales(entry.ctx)}
            current={entry.locale}
          />
        }
      >
        <SystemCheck token={token} policy={entry.state.proctoring} />
      </CandidateShell>
    </CandidateIntl>
  );
}
