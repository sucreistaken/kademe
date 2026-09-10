import { redirect } from "next/navigation";
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { Finished } from "@/components/candidate/Finished";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import {
  completionInfo,
  loadState,
  progressSummary,
  resolveToken,
} from "@/lib/candidate-flow";
import { stepPath } from "@/lib/candidate-routes";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * The closing screen. Finishing flips the link to COMPLETED, so this page has
 * to treat that "problem" as the success case rather than as an error, which is
 * exactly why it does its own resolve instead of going through `enter()`.
 */
export default async function CandidateDonePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  const ctx = resolved.ctx;
  const locale = (ctx?.locale as Locale | undefined) ?? DEFAULT_LOCALE;

  const finished = resolved.ok
    ? (await loadState(resolved.ctx)).step === "DONE"
    : resolved.problem === "COMPLETED";

  if (!ctx || !finished) {
    if (resolved.ok) {
      redirect(stepPath(token, await loadState(resolved.ctx)));
    }
    const problemCtx = resolved.ok ? null : resolved.ctx;
    return (
      <CandidateIntl locale={locale}>
        <CandidateShell locale={locale} header={false}>
          <LinkProblem
            token={token}
            locale={locale}
            problem={resolved.ok ? "INVALID" : resolved.problem}
            expiresAt={problemCtx?.link.expiresAt.getTime()}
            notBefore={problemCtx?.link.notBefore?.getTime()}
            progress={problemCtx ? await progressSummary(problemCtx) : undefined}
            contactEmail={problemCtx?.contactEmail ?? "destek@kademe.local"}
            contactName={problemCtx?.contactName ?? null}
          />
        </CandidateShell>
      </CandidateIntl>
    );
  }

  const info = await completionInfo(ctx);

  return (
    <CandidateIntl locale={locale}>
      <CandidateShell locale={locale} header={false}>
        <Finished
          token={token}
          locale={locale}
          name={ctx.candidate.fullName ?? ""}
          stageCount={info.stageCount}
          submittedAt={(info.completedAt ?? new Date()).getTime()}
          responseByAt={info.responseByAt?.getTime() ?? null}
          orgName={ctx.orgName}
          contactEmail={ctx.contactEmail}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
