import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CandidateIntl } from "@/components/candidate/Intl";
import { InfoForm } from "@/components/candidate/InfoForm";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { CandidateShell } from "@/components/candidate/Shell";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { Landing } from "@/components/hiring/candidate/landing";
import { shortDate } from "@/i18n/dates";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { setAssessmentLocale, type CandidateContext, type LinkProblem as Problem } from "@/lib/candidate-context";
import { candidateSafe } from "@/lib/candidate-safe";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import type { CandidatePageInput, CandidatePageSlot } from "@/solutions/types";
import { loadHiringContext, loadHiringState } from "../server/candidate";
import { loadConsentText } from "../server/consent";

/**
 * Every hiring candidate page (HIRING-UX 4.4, 6). Like the exam's `enter()`:
 * the token is resolved on the server, the language is settled, and the
 * candidate is sent to the one page their state lives on; the client is never
 * asked where it thinks it is. Client components get only candidateSafe values
 * built from the candidate view (Task 5), and dates already formatted in the
 * organisation's zone.
 */

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined);

/** The page a slot lives on, relative to /a/[token]. */
function suffixOf(slot: CandidatePageSlot, params: Record<string, string>): string {
  switch (slot) {
    case "landing":
      return "";
    case "info":
      return "/info";
    case "check":
      return "/check";
    case "practice":
      return "/practice";
    case "stage":
      return `/stage/${params.n ?? ""}`;
    case "done":
      return "/done";
  }
}

/** A link problem, or a page not built yet: the core's invalid, expired and not-yet cards. */
function problemPage(token: string, locale: Locale, problem: Problem, ctx?: CandidateContext): ReactNode {
  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <CandidateShell locale={locale} header={false}>
        <LinkProblem
          token={token}
          locale={locale}
          problem={problem}
          expiresAt={ctx?.link.expiresAt.getTime()}
          notBefore={ctx?.link.notBefore?.getTime()}
          contactEmail={ctx?.contactEmail ?? "destek@kademe.local"}
          contactName={ctx?.contactName ?? null}
        />
      </CandidateShell>
    </CandidateIntl>
  );
}

export async function renderHiringPage(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode> {
  const { token, resolved, searchParams, params } = input;
  const base = `/a/${encodeURIComponent(token)}`;
  // A finished link is the candidate's way back to /done (and the survey); every other problem has its card.
  if (!resolved.ok && resolved.problem !== "COMPLETED") {
    const locale = isLocale(resolved.ctx.locale) ? resolved.ctx.locale : DEFAULT_LOCALE;
    return problemPage(token, locale, resolved.problem, resolved.ctx);
  }
  const h = await loadHiringContext(resolved.ctx);
  if (!h) return problemPage(token, DEFAULT_LOCALE, "INVALID");

  // `?lang=` is applied once, written to the invitation and taken out of the address.
  const wanted = one(searchParams.lang);
  if (isLocale(wanted)) {
    if (wanted !== h.locale) await setAssessmentLocale(h, wanted);
    redirect(`${base}${suffixOf(slot, params)}`);
  }

  const state = await loadHiringState(h);
  const practiceAllowed = state.step === "STAGE" && state.position === 1 && !state.current?.startedAt && state.practice;
  if (slot === "practice" ? !practiceAllowed : state.path !== suffixOf(slot, params)) redirect(`${base}${state.path}`);

  const locale: Locale = isLocale(h.locale) ? h.locale : DEFAULT_LOCALE;
  // Ruling C10: nothing below reads `state` directly; the client gets the stripped copy.
  const safe = candidateSafe(state);
  const frame = (children: ReactNode) => (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <HiringFrame locale={locale} orgName={safe.orgName} token={token}>
        {children}
      </HiringFrame>
    </CandidateIntl>
  );

  switch (slot) {
    case "landing": {
      // A closed opening stops only a candidate who has not started (Task 5); the state says CLOSED then.
      if (safe.step === "CLOSED") return frame(<ClosedCard contactEmail={safe.contactEmail} />);
      // The text frozen on this invitation, never the organisation's newest one.
      const consent = await loadConsentText(h.assessment.orgId, h.hiring.consentTextId);
      return frame(
        <Landing
          token={token}
          state={safe}
          consentBody={consent.body[locale] || consent.body.tr}
          deadline={shortDate(h.link.expiresAt, locale, ORG_TIMEZONE)}
          locale={locale}
        />,
      );
    }
    case "info":
      return frame(
        <InfoForm
          token={token}
          initial={{ fullName: h.candidate.fullName ?? "", email: h.candidate.email ?? "", phone: h.candidate.phone ?? "", location: h.candidate.location ?? "" }}
        />,
      );
    // Replaced by Tasks 12 (check), 13 (stage), 14 (practice) and 16 (done).
    case "check":
    case "stage":
    case "practice":
    case "done":
      return problemPage(token, locale, "INVALID");
  }
}
