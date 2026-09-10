import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { DeviceCheck } from "@/components/candidate/DeviceCheck";
import { supportedLocales } from "@/lib/candidate-flow";
import { candidateT } from "@/i18n/candidate";
import { enter, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

/** Nothing is recorded on this screen, and the header says so. */
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
    <CandidateIntl locale={entry.locale}>
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
        <DeviceCheck token={token} />
      </CandidateShell>
    </CandidateIntl>
  );
}
