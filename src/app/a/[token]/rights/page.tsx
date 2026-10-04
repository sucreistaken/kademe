import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { RightsForm, type RightsKind } from "@/components/candidate/RightsForm";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { resolveToken } from "@/lib/candidate-context";
import type { PageSearchParams } from "@/lib/candidate-pages";
import { servingSolution } from "@/solutions/registry.server";
import { candidateT } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

const DATA_RIGHTS: RightsKind[] = ["ACCESS", "COPY", "DELETE"];

/**
 * Data rights stay reachable on a link that has expired or already been
 * completed: those are exactly the moments a candidate wants their answers back
 * or deleted. Only an invalid token gets an error screen here.
 *
 * An invitation no live module serves is treated as an invalid token, the same
 * rule the candidate API applies by default: the page must not reveal the
 * person's name or language for a token no module answers. A solution that
 * reads accommodation requests (hiring) offers that request first;
 * `?type=accommodation` (the landing's "Başka düzenleme") preselects it.
 */
export default async function CandidateRightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PageSearchParams;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  const served = resolved.ctx ? await servingSolution(resolved.ctx) : null;
  const ctx = served ? resolved.ctx : undefined;

  if (!ctx || !served) return <UnknownLink token={token} />;

  const locale = ctx.locale as Locale;
  const t = candidateT(locale);
  const kinds: RightsKind[] = served.accommodationRequests ? ["ACCOMMODATION", ...DATA_RIGHTS] : DATA_RIGHTS;
  const sp = searchParams ? await searchParams : {};
  const initialKind: RightsKind | null = served.accommodationRequests && sp.type === "accommodation" ? "ACCOMMODATION" : null;

  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell
        locale={locale}
        meta={t("header.rights", {
          name: ctx.candidate.fullName ?? t("header.candidate"),
        })}
      >
        <RightsForm token={token} kinds={kinds} initialKind={initialKind} />
      </CandidateShell>
    </CandidateIntl>
  );
}
