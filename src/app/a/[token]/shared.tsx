import { redirect } from "next/navigation";
import { CandidateShell } from "@/components/candidate/Shell";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import {
  loadState,
  progressSummary,
  resolveExamToken,
  type CandidateState,
  type ExamCandidateContext,
} from "@/lib/exam-flow";
import { setAssessmentLocale, supportedLocales } from "@/lib/candidate-context";
import { stepPath } from "@/lib/candidate-routes";
import { candidateT } from "@/i18n/candidate";
import { shortDate } from "@/i18n/dates";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/locale";

/**
 * Every student page starts the same way: resolve the token on the server,
 * settle the language, and either render the error screen or send the student
 * to the one screen their state belongs on. The client is never asked where it
 * thinks it is.
 */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type PageEntry =
  | { kind: "problem"; node: React.ReactNode }
  | { kind: "ok"; ctx: ExamCandidateContext; state: CandidateState; locale: Locale };

function readLang(params: Record<string, string | string[] | undefined>) {
  const raw = params.lang;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isLocale(value) ? value : null;
}

/**
 * `?lang=` is the manual override. It is applied once, written to the
 * assessment and then stripped from the URL, so the rest of the flow carries
 * the choice without every link having to repeat it.
 */
async function settleLocale(
  ctx: ExamCandidateContext,
  searchParams: SearchParams | undefined,
  path: string,
) {
  if (!searchParams) return;
  const params = await searchParams;
  const wanted = readLang(params);
  if (!wanted) return;
  if (supportedLocales(ctx).includes(wanted) && wanted !== ctx.locale) {
    await setAssessmentLocale(ctx, wanted);
  }
  redirect(path);
}

export async function enter(
  token: string,
  expected: CandidateState["step"] | CandidateState["step"][],
  searchParams?: SearchParams,
  path?: string,
): Promise<PageEntry> {
  const resolved = await resolveExamToken(token);

  // A finished exam's link is the student's way back to the result.
  if (!resolved.ok && resolved.problem === "COMPLETED" && resolved.ctx) redirect(`/a/${token}/done`);

  if (!resolved.ok) {
    const ctx = resolved.ctx;
    const locale = (ctx?.locale as Locale | undefined) ?? DEFAULT_LOCALE;
    const summary = ctx ? await progressSummary(ctx) : undefined;
    const progress = summary ? { completed: summary.done, total: summary.total } : undefined;
    return {
      kind: "problem",
      node: (
        <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
          <CandidateShell locale={locale} header={false}>
            <LinkProblem
              token={token}
              locale={locale}
              problem={resolved.problem}
              expiresAt={ctx?.link.expiresAt.getTime()}
              notBefore={ctx?.link.notBefore?.getTime()}
              progress={progress}
              contactEmail={ctx?.contactEmail ?? "okul@kademe.local"}
            contactName={ctx?.contactName ?? null}
            />
          </CandidateShell>
        </CandidateIntl>
      ),
    };
  }

  await settleLocale(resolved.ctx, searchParams, path ?? `/a/${token}`);

  const state = await loadState(resolved.ctx);
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(state.step)) redirect(stepPath(token, state));
  return {
    kind: "ok",
    ctx: resolved.ctx,
    state,
    locale: resolved.ctx.locale as Locale,
  };
}

/** The line in the top bar: who this was prepared for and until when. */
export function headerMeta(ctx: ExamCandidateContext) {
  const locale = ctx.locale as Locale;
  const t = candidateT(locale);
  const date = shortDate(ctx.link.expiresAt, locale);
  return ctx.candidate.fullName
    ? t("header.preparedFor", { name: ctx.candidate.fullName, date })
    : t("header.validUntil", { date });
}
