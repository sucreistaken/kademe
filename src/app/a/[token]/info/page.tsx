import { CandidateShell, LanguageSwitch } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { InfoForm } from "@/components/candidate/InfoForm";
import { supportedLocales } from "@/lib/candidate-context";
import { enter, headerMeta, type SearchParams } from "@/app/a/[token]/shared";

export const dynamic = "force-dynamic";

export default async function CandidateInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const entry = await enter(token, "INFO", searchParams, `/a/${token}/info`);
  if (entry.kind === "problem") return entry.node;

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
        <InfoForm
          token={token}
          initial={{
            fullName: entry.ctx.candidate.fullName ?? "",
            email: entry.ctx.candidate.email ?? "",
            phone: entry.ctx.candidate.phone ?? "",
            location: entry.ctx.candidate.location ?? "",
          }}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
