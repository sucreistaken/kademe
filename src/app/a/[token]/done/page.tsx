import { redirect } from "next/navigation";
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { Finished } from "@/components/candidate/Finished";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { loadState, progressSummary, resolveToken } from "@/lib/exam-flow";
import { stepPath } from "@/lib/candidate-routes";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * The closing screen. Finishing flips the link to COMPLETED, so this page
 * treats that "problem" as the success case, and it stays the page a student
 * comes back to for the result.
 */
export default async function DonePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  const ctx = resolved.ctx;
  const locale = (ctx?.locale as Locale | undefined) ?? DEFAULT_LOCALE;

  if (resolved.ok) {
    const state = await loadState(resolved.ctx);
    if (state.step !== "DONE") redirect(stepPath(token, state));
  }
  if (!ctx || (!resolved.ok && resolved.problem !== "COMPLETED")) {
    const summary = ctx ? await progressSummary(ctx) : undefined;
    return (
      <CandidateIntl locale={locale}>
        <CandidateShell locale={locale} header={false}>
          <LinkProblem
            token={token}
            locale={locale}
            problem={resolved.ok ? "INVALID" : resolved.problem}
            expiresAt={ctx?.link.expiresAt.getTime()}
            notBefore={ctx?.link.notBefore?.getTime()}
            progress={summary ? { completed: summary.done, total: summary.total } : undefined}
            contactEmail={ctx?.contactEmail ?? "okul@kademe.local"}
            contactName={ctx?.contactName ?? null}
          />
        </CandidateShell>
      </CandidateIntl>
    );
  }

  // COMPLETED links resolve with a context; read the finished state from it.
  const state = await loadState(ctx);
  const finished = state.finished;
  return (
    <CandidateIntl locale={locale}>
      <CandidateShell locale={locale} header={false}>
        <Finished
          token={token}
          name={ctx.candidate.fullName ?? ""}
          result={finished?.result ?? { visibility: "NONE", released: false, awaitingTeacher: true }}
          terminated={finished?.terminated ?? false}
          terminationReason={finished?.terminationReason ?? null}
          contactEmail={ctx.contactEmail}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
