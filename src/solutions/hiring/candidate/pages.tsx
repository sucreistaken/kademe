import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CandidateIntl } from "@/components/candidate/Intl";
import { InfoForm } from "@/components/candidate/InfoForm";
import { LinkProblem } from "@/components/candidate/LinkProblem";
import { UnknownLink } from "@/components/candidate/UnknownLink";
import { ClosedCard } from "@/components/hiring/candidate/closed";
import { DeviceCheck } from "@/components/hiring/candidate/device-check";
import { Done } from "@/components/hiring/candidate/done";
import { HiringFrame } from "@/components/hiring/candidate/frame";
import { Landing } from "@/components/hiring/candidate/landing";
import { Practice } from "@/components/hiring/candidate/practice";
import { StageRunner } from "@/components/hiring/candidate/stage-runner";
import { shortDate } from "@/i18n/dates";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { setAssessmentLocale, type CandidateContext, type LinkProblem as Problem } from "@/lib/candidate-context";
import { candidateSafe } from "@/lib/candidate-safe";
import { pickTextLang } from "@/lib/i18n-text";
import { ORG_TIMEZONE, orgDay, zoneLabel } from "@/lib/org-timezone";
import type { CandidatePageInput, CandidatePageSlot } from "@/solutions/types";
import { loadHiringContext, loadHiringState } from "../server/candidate";
import { formatInviteDeadline } from "../rules/invitation";
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

/**
 * The hiring frame (organisation, language, Help) around a screen. Only for an
 * invitation hiring serves: the organisation's name is never shown to a token
 * it does not (that one gets the core UnknownLink card, the leak rule).
 */
function framed(token: string, locale: Locale, orgName: string, children: ReactNode): ReactNode {
  return (
    <CandidateIntl locale={locale} timeZone={ORG_TIMEZONE}>
      <HiringFrame locale={locale} orgName={orgName} token={token}>
        {children}
      </HiringFrame>
    </CandidateIntl>
  );
}

/** An expired or not-yet link of a served invitation: the core card inside the frame. */
function problemCard(token: string, locale: Locale, problem: Problem, ctx: CandidateContext): ReactNode {
  return (
    <LinkProblem
      token={token}
      locale={locale}
      problem={problem}
      expiresAt={ctx.link.expiresAt.getTime()}
      notBefore={ctx.link.notBefore?.getTime()}
      contactEmail={ctx.contactEmail ?? "destek@kademe.local"}
      contactName={ctx.contactName ?? null}
    />
  );
}

export async function renderHiringPage(slot: CandidatePageSlot, input: CandidatePageInput): Promise<ReactNode> {
  const { token, resolved, searchParams, params } = input;
  const base = `/a/${encodeURIComponent(token)}`;
  // The core asks only for an invitation hiring serves; should the terms be gone by now, it is an unknown token.
  const h = await loadHiringContext(resolved.ctx);
  if (!h) return <UnknownLink token={token} />;
  // `?lang=` is applied once, written to the invitation and taken out of the address.
  const wanted = one(searchParams.lang);
  if (isLocale(wanted)) {
    if (wanted !== h.locale) await setAssessmentLocale(h, wanted);
    redirect(`${base}${suffixOf(slot, params)}`);
  }

  // A finished link is the candidate's way back to /done (and the survey). Expired and not-yet
  // cards keep the frame, so the organisation, the language and Help stay in reach.
  if (!resolved.ok && resolved.problem !== "COMPLETED") {
    const locale = isLocale(resolved.ctx.locale) ? resolved.ctx.locale : DEFAULT_LOCALE;
    return framed(token, locale, resolved.ctx.orgName, problemCard(token, locale, resolved.problem, resolved.ctx));
  }

  const state = await loadHiringState(h);
  const practiceAllowed = state.step === "STAGE" && state.position === 1 && !state.current?.startedAt && state.practice;
  if (slot === "practice" ? !practiceAllowed : state.path !== suffixOf(slot, params)) redirect(`${base}${state.path}`);

  const locale: Locale = isLocale(h.locale) ? h.locale : DEFAULT_LOCALE;
  // Ruling C10: nothing below reads `state` directly; the client gets the stripped copy.
  const safe = candidateSafe(state);
  const frame = (children: ReactNode) => framed(token, locale, safe.orgName, children);

  switch (slot) {
    case "landing": {
      // A closed opening stops only a candidate who has not started (Task 5); the state says CLOSED then.
      if (safe.step === "CLOSED") return frame(<ClosedCard contactEmail={safe.contactEmail} />);
      // The text frozen on this invitation, never the organisation's newest one.
      // Shown in the other language (with its own lang) when this one is empty.
      const consent = pickTextLang((await loadConsentText(h.assessment.orgId, h.hiring.consentTextId)).body, locale);
      // The deadline in the invitation e-mail's words: the end of the org's day, the zone named.
      const deadline = formatInviteDeadline(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale, zoneLabel(locale, ORG_TIMEZONE));
      return frame(<Landing token={token} state={safe} consentBody={consent.text} consentLang={consent.lang} deadline={deadline} locale={locale} />);
    }
    case "info":
      return frame(
        <InfoForm
          token={token}
          initial={{ fullName: h.candidate.fullName ?? "", email: h.candidate.email ?? "", phone: h.candidate.phone ?? "", location: h.candidate.location ?? "" }}
        />,
      );
    case "check":
      // Two flags and the page's language: no question, stage or team text reaches the device check.
      return frame(<DeviceCheck token={token} camera={safe.devices.camera} practice={safe.practice} locale={locale} />);
    case "stage":
      // Keyed by the stage, so the next stage starts from a fresh runner. The runner gets the
      // stripped candidate state only (no team field, no right answer: C10); the deadline in
      // the same words as the landing and the invitation e-mail.
      return frame(
        <StageRunner
          key={safe.position ?? 0}
          token={token}
          initial={safe}
          deadline={formatInviteDeadline(orgDay(h.link.expiresAt, ORG_TIMEZONE), locale, zoneLabel(locale, ORG_TIMEZONE))}
          locale={locale}
        />,
      );
    case "practice":
      // HIRING-UX 6.4: the camera flag and the page's language only; the warm-up's question is its own, nothing of the version reaches it.
      return frame(<Practice token={token} camera={safe.devices.camera} locale={locale} />);
    case "done": {
      // Only a finished invitation lives on /done (the path check above), and Task 5 builds every
      // DONE state with its finish; a DONE without one is a broken invariant, not a page to guess.
      const finished = safe.finished;
      if (!finished) throw new Error("hiring: a DONE state without its finish");
      // HIRING-UX 6.13 and A9: the team's reply promise as a day in the organisation's zone.
      const feedbackBy = shortDate(new Date(finished.feedbackBy), locale, ORG_TIMEZONE);
      return frame(<Done token={token} state={{ ...safe, finished }} feedbackBy={feedbackBy} />);
    }
  }
}
