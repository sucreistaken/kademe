import { redirect } from "next/navigation";
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { Finished } from "@/components/candidate/Finished";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { loadState, progressSummary, resolveExamToken } from "@/lib/exam-flow";
import { stepPath } from "@/lib/candidate-routes";
import { solutionPage, type PageSearchParams } from "@/lib/candidate-pages";
import { visitorLocale } from "@/i18n/visitor-locale";
import { hasExamFeedback } from "@/server/exam-feedback";

export const dynamic = "force-dynamic";

/**
 * The closing screen. Finishing flips the link to COMPLETED, so this page
 * treats that "problem" as the success case, and it stays the page a student
 * comes back to for the result.
 */
export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: PageSearchParams;
}) {
  const { token } = await params;
  const hosted = await solutionPage(token, "done", searchParams);
  if (hosted !== undefined) return hosted;
  const resolved = await resolveExamToken(token);
  const ctx = resolved.ctx;
  const locale = ctx?.locale ?? (await visitorLocale());

  if (resolved.ok) {
    const state = await loadState(resolved.ctx);
    if (state.step !== "DONE") redirect(stepPath(token, state));
  }
  if (!ctx || (!resolved.ok && resolved.problem !== "COMPLETED")) {
    const summary = ctx ? await progressSummary(ctx) : undefined;
    return (
      <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
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
  // The server knows whether the experience survey is answered, so a reload does not offer it again.
  const feedbackAnswered = await hasExamFeedback(ctx.assessment.orgId, ctx.assessment.id);
  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={locale} header={false}>
        <Finished
          token={token}
          name={ctx.candidate.fullName ?? ""}
          result={finished?.result ?? { visibility: "NONE", released: false, awaitingTeacher: true, levelShown: false }}
          terminated={finished?.terminated ?? false}
          terminationReason={finished?.terminationReason ?? null}
          contactEmail={ctx.contactEmail}
          feedbackAnswered={feedbackAnswered}
          sections={state.sections.map((s) => s.section)}
          mode={state.mode}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}
