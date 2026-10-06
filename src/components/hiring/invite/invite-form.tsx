"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ClipboardPaste, UserRoundPlus } from "lucide-react";
import { flowJourney } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { firstInviteLines, formatInviteDay, MAX_INVITE_ROWS, parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteCandidateAction, inviteManyAction, type InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { CopyField } from "./copy-field";
import { InviteReady } from "./invite-ready";
import {
  INVITE_STEPS,
  deadlineInputValue,
  deadlineRow,
  inviteFirstInvalid,
  inviteReason,
  inviteStepOf,
  invitePath,
  refusalMove,
  panelShortfall,
  personWait,
  sheetLocked,
  type InviteOpening,
  type InviteStep,
} from "./form-rules";

type Ready = Extract<InviteOneResult, { ok: true }>;
type Refusal = Extract<InviteOneResult, { ok: false }>;
type Done =
  | { kind: "one"; result: Ready }
  | {
      kind: "many";
      ok: Array<{ line: number; fullName: string; email: string; result: Ready }>;
      failed: Array<{ line: number; fullName: string; result: Refusal }>;
    };

const LINK = "underline decoration-underline underline-offset-4";

/**
 * HIRING-UX 5.11 as HIRING-VISUAL-FLOW 4.9 (K12, D11): the invite as a guided
 * flow. The opening (on the page, when more than one is invitable), then the
 * person (one candidate or a pasted list), then a summary where the language
 * and the last day already hold their defaults and open their own step with
 * "Değiştir". The summary's "Davet linkini oluştur" calls the same actions
 * with the same refusals; a refusal opens the step it is about
 * (inviteStepOf). On success the link is shown once with "Linki kopyala" as
 * the filled button and the ready message behind a disclosure; a pasted list
 * keeps its own ready view. Both end with "Adaylara git" (C13). On the page
 * the step lives in the address's hash (every hash it reads is a step of this
 * flow); in a Sheet the steps live in memory and the address is never
 * written (the Sheet's page owns the hash), and `onLockChange` keeps the
 * Sheet open while a request runs or links are shown (sheetLocked).
 */
export function InviteForm({
  openings,
  initialOpeningId,
  today,
  zone,
  onDone,
  onLockChange,
  container = "page",
}: {
  openings: InviteOpening[];
  initialOpeningId: string | null;
  today: string;
  zone: string;
  onDone?: () => void;
  onLockChange?: (locked: boolean) => void;
  container?: "page" | "sheet";
}) {
  const t = useMT("hiringInvite");
  const common = useMT("hiringCommon");
  const flow = useMT("flow");
  const appLocale = useLocale();
  const uiLocale: Locale = isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
  const [openingId, setOpeningId] = useState<string>(
    initialOpeningId && openings.some((o) => o.id === initialOpeningId) ? initialOpeningId : openings.length === 1 ? openings[0].id : "",
  );
  const opening = openings.find((o) => o.id === openingId) ?? null;
  const [mode, setMode] = useState<"single" | "many">("single");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [locale, setLocale] = useState<Locale>("tr");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fromSummary, setFromSummary] = useState(false);
  // True once "Başka aday davet et" brought the flow back in place of the ready view.
  const [returned, setReturned] = useState(false);
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<{ result: Refusal; name: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const parsed = useMemo(() => parseInviteRows(text), [text]);
  const reason = inviteReason({ opening, mode, fullName, email, rows: parsed.rows, deadline, today });
  const short = panelShortfall(opening);
  // The day the server will use (linkExpiryDay): the chosen one held to the opening's deadline, else the deadline, else 14 days.
  const openingDeadline = opening?.deadlineDay && opening.deadlineDay >= today ? opening.deadlineDay : null;
  const day = deadlineRow({ opening, deadline, today });
  const doneHeading = useRef<HTMLHeadingElement>(null);

  // The opening is a step only on the page and only when there is a choice to make.
  const pickOpening = container === "page" && openings.length > 1;
  const path = invitePath({ pickOpening });
  // Every step this flow can show, so the hash (page) only ever names one of them.
  const steps = pickOpening ? INVITE_STEPS : INVITE_STEPS.filter((s) => s !== "opening");
  const nav = useFlowStep({ steps, firstInvalid: inviteFirstInvalid({ opening, pickOpening, mode, fullName, email, rows: parsed.rows }), mode: container === "page" ? "hash" : "memory" });
  const step = nav.step;
  const dirty = fullName !== "" || email !== "" || text !== "" || deadline !== null || locale !== "tr";

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  const locked = sheetLocked({ pending, done: done !== null });
  useEffect(() => {
    onLockChange?.(locked);
  }, [locked, onLockChange]);

  /** A change to what is being sent retires the last refusal: it spoke about the previous input. */
  function edit(change: () => void) {
    setRefusal(null);
    change();
  }

  function reset() {
    setDone(null);
    setRefusal(null);
    setFullName("");
    setEmail("");
    setText("");
    setFromSummary(false);
    setReturned(true);
    // "Başka aday davet et" goes back to the person and keeps the opening and the language (4.9); no second entry when it is already there.
    if (step !== "person") nav.go("person");
  }

  /** W8: the step a refusal belongs to; the opening step exists only where it was offered. */
  const refusalStep = (code: Refusal["code"]): InviteStep => {
    const at = inviteStepOf(code);
    return at === "opening" && !pickOpening ? "summary" : at;
  };

  /** Every refusal and failure goes through here, so its sentence shows on the step it belongs to (W8). */
  function refuse(result: Refusal, name: string) {
    setRefusal({ result, name });
    const to = refusalMove(result.code, { step, pickOpening });
    if (to !== null) nav.go(to);
  }

  function submit(allowDuplicate = false) {
    // "Yine de davet et" keeps the duplicate note (and its own busy button) until the answer comes.
    if (!allowDuplicate) setRefusal(null);
    const name = fullName;
    start(async () => {
      try {
        if (mode === "single") {
          const result = await inviteCandidateAction({ openingId, fullName, email: email.trim(), locale, deadline, allowDuplicate });
          if (result.ok) {
            setRefusal(null);
            setDone({ kind: "one", result });
          } else refuse(result, name);
          return;
        }
        // Only the rows that are read travel (the server cuts the same way).
        const { results } = await inviteManyAction({ openingId, text: firstInviteLines(text), locale, deadline });
        // Line 0 is a refusal of the whole list (role, opening, day) or malformed input.
        const whole = results.find((r) => r.line === 0);
        if (whole && !whole.result.ok) {
          refuse(whole.result, "");
          return;
        }
        if (results.length === 0) {
          refuse({ ok: false, code: "FAILED" }, "");
          return;
        }
        setDone({
          kind: "many",
          ok: results.flatMap((r) => (r.result.ok ? [{ line: r.line, fullName: r.fullName, email: r.email, result: r.result }] : [])),
          failed: results.flatMap((r) => (r.result.ok ? [] : [{ line: r.line, fullName: r.fullName, result: r.result }])),
        });
      } catch {
        // A dropped connection or a server error: the calm message, never the raw one, on the summary.
        refuse({ ok: false, code: "FAILED" }, "");
      }
    });
  }

  // C13: the way to the opening's Candidates tab after a link is shown; from a Sheet it also closes the Sheet.
  const toCandidates = openingId ? (
    <Link href={`/hiring/openings/${openingId}/candidates`} onClick={onDone} className={`inline-flex min-h-11 items-center text-[14px] font-medium text-ink ${LINK}`}>
      {t("toCandidates")}
    </Link>
  ) : null;
  const after = (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={reset} className={`min-h-11 text-[14px] font-medium text-ink ${LINK}`}>
        {t("another")}
      </button>
      {toCandidates}
      {onDone ? (
        <Button variant="ghost" onClick={onDone}>
          {t("close")}
        </Button>
      ) : null}
    </div>
  );

  if (done?.kind === "one") {
    return (
      <InviteReady
        container={container}
        headingRef={doneHeading}
        name={done.result.name}
        url={done.result.url}
        expires={done.result.expires}
        language={t(locale)}
        message={done.result.message.body}
        onAnother={reset}
        links={
          <>
            {toCandidates}
            {onDone ? (
              <button type="button" onClick={onDone} className={`min-h-11 text-[14px] font-medium text-ink ${LINK}`}>
                {t("close")}
              </button>
            ) : null}
          </>
        }
      />
    );
  }

  if (done?.kind === "many") {
    const all = done.ok.map((r) => `${r.fullName}\t${r.email}\t${r.result.url}`).join("\n");
    const duplicates = done.failed.some((f) => f.result.code === "DUPLICATE");
    // The same heading level as the single ready view: the page's h1, the Sheet's h2 under its title.
    const Heading = container === "page" ? "h1" : "h2";
    const view = (
      <div className="space-y-5">
        <div>
          <Heading ref={doneHeading} tabIndex={-1} className={`tnum font-semibold text-ink outline-none ${container === "page" ? "text-[28px] leading-9" : "text-[20px] leading-7"}`}>
            {t("manyReady", { count: done.ok.length })}
          </Heading>
          {done.failed.length ? <p className="tnum mt-1 text-[14px] text-ink">{t("manyFailed", { count: done.failed.length })}</p> : null}
        </div>
        {done.failed.length ? (
          <div className="space-y-1">
            <ul className="space-y-1 text-[13px] leading-5 text-ink">
              {done.failed.map((f) => (
                <li key={f.line}>
                  {f.result.code === "DUPLICATE"
                    ? t("rowDuplicateResult", { line: f.line, name: f.fullName, date: f.result.existing?.invitedAt ?? "" })
                    : t("rowErrorResult", { line: f.line, name: f.fullName, error: t(`err${f.result.code}`) })}
                </li>
              ))}
            </ul>
            {duplicates ? <p className="text-[13px] text-muted">{t("manyDuplicateNote")}</p> : null}
          </div>
        ) : null}
        {done.ok.length ? (
          <>
            <CopyField id="invite-all" label={t("allLinks")} value={all} multiline primary copyLabel={t("copyAll")} />
            <ul className="space-y-4">
              {done.ok.map((r) => (
                <li key={r.line} className="space-y-3 rounded-xl border border-line p-4">
                  <p className="text-[14px] text-ink">
                    <span className="font-medium">{r.fullName}</span> <span className="text-muted">{r.email}</span>
                  </p>
                  <CopyField id={`invite-link-${r.line}`} label={t("linkFor", { name: r.fullName })} value={r.result.url} copyLabel={t("copyLink")} />
                  <details className="group">
                    <summary className="min-h-10 cursor-pointer py-2 text-[13px] font-medium text-ink">{t("messageFor", { name: r.fullName })}</summary>
                    <CopyField id={`invite-message-${r.line}`} label={t("messageLabel")} value={r.result.message.body} multiline copyLabel={t("copyMessage")} />
                  </details>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted">{t("onceNoteMany")}</p>
          </>
        ) : null}
        {after}
      </div>
    );
    return container === "page" ? <section className="mx-auto max-w-[640px] pt-10 pb-8">{view}</section> : <div className="pt-2 pb-8">{view}</div>;
  }

  // W8: a refusal in its existing words, on the step it is about. A duplicate's
  // "Yine de davet et" is the step's outlined second button (the footer's one
  // filled button stays "Devam et"), so its work is said like the footer's.
  const refusalHere = refusal && refusalStep(refusal.result.code) === step ? refusal : null;
  const duplicateHere = refusalHere?.result.code === "DUPLICATE" ? refusalHere : null;
  const refusalNote = refusalHere ? (
    <div role="alert" className="space-y-1 text-[14px] text-ink">
      {duplicateHere ? (
        <>
          <p className="font-medium">{t("duplicate", { name: duplicateHere.name.replace(/\s+/g, " ").trim(), date: duplicateHere.result.existing?.invitedAt ?? "" })}</p>
          <p className="text-muted">{t("duplicateHelp")}</p>
        </>
      ) : (
        <p className="font-medium">{t(`err${refusalHere.result.code}`)}</p>
      )}
    </div>
  ) : null;
  // The opening's own blockers on the summary come with the way to fix them: the
  // team and the deadline open their step of team and rules (KG3; a plain anchor, so that page hears the hash).
  const fixLink =
    reason === "notPublished" && opening ? (
      <Link href={`/hiring/openings/${opening.id}/assessment`} className={`text-[14px] font-medium text-ink ${LINK}`}>
        {t("goAssessment")}
      </Link>
    ) : (reason === "noEvaluators" || reason === "openingDeadline") && opening ? (
      <a href={`/hiring/openings/${opening.id}/settings#${reason === "noEvaluators" ? "team-members" : "contact-deadline"}`} className={`text-[14px] font-medium text-ink ${LINK}`}>
        {t("goTeam")}
      </a>
    ) : null;
  const toSummary = () => {
    setFromSummary(false);
    nav.go("summary");
  };
  const change = (to: InviteStep) => () => {
    setFromSummary(true);
    nav.go(to);
  };
  const personReason = personWait({ mode, fullName, email, rows: parsed.rows });
  const dayText = day.kind === "pickOpening" ? t("pickOpeningFirst") : t("deadlineValue", { date: formatInviteDay(day.day, uiLocale), zone });

  const screens: Record<InviteStep, FlowStep> = {
    opening: {
      id: "opening",
      title: t("stepOpeningTitle"),
      layout: "split",
      primary: { kind: "button", id: "invite-next", label: fromSummary ? flow("backToSummary") : flow("continue"), waitReason: opening ? null : t("reasonnoOpening"), onClick: () => (fromSummary ? toSummary() : nav.go("person")) },
      note: refusalNote,
      body: (
        <>
          <p id="invite-opening-label" className="sr-only">
            {t("opening")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="invite-opening"
            labelledBy="invite-opening-label"
            value={openingId ? [openingId] : []}
            onChange={([v]) => edit(() => setOpeningId(v ?? ""))}
            items={openings.map((o) => ({ value: o.id, label: o.name, description: o.deadlineDay ? common("deadline", { date: formatInviteDay(o.deadlineDay, uiLocale) }) : common("noDeadline") }))}
          />
        </>
      ),
    },
    person: {
      id: "person",
      title: t("stepPersonTitle"),
      lead: <p>{t("lead")}</p>,
      layout: "single",
      primary: { kind: "button", id: "invite-next", label: fromSummary ? flow("backToSummary") : flow("continue"), waitReason: personReason ? t(`reason${personReason}`) : null, onClick: toSummary },
      secondary: duplicateHere ? { kind: "button", id: "invite-anyway", label: t("inviteAnyway"), busy: pending, busyLabel: t("creating"), onClick: () => submit(true) } : null,
      note: refusalNote,
      body: (
        <div className="space-y-field">
          <p id="invite-mode-label" className="sr-only">
            {t("modeLabel")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="invite-mode"
            labelledBy="invite-mode-label"
            columns={2}
            value={[mode]}
            onChange={([v]) => edit(() => setMode(v as "single" | "many"))}
            items={[
              { value: "single", label: t("single"), marker: UserRoundPlus },
              { value: "many", label: t("modeList"), marker: ClipboardPaste },
            ]}
          />
          {mode === "single" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="invite-name">{t("fullName")}</Label>
                <Input id="invite-name" autoComplete="off" maxLength={120} className="text-[16px]" value={fullName} onChange={(e) => edit(() => setFullName(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("email")}</Label>
                <Input id="invite-email" type="email" autoComplete="off" maxLength={160} className="text-[16px]" value={email} onChange={(e) => edit(() => setEmail(e.target.value))} />
              </div>
            </>
          ) : (
            // The pasted list, its live problems and its preview: plan 2's code, unchanged.
            <div className="space-y-2">
              <Label htmlFor="invite-paste">{t("pasteLabel")}</Label>
              <Textarea id="invite-paste" rows={6} className="max-h-72 overflow-y-auto" value={text} onChange={(e) => edit(() => setText(e.target.value))} aria-describedby="invite-paste-hint invite-paste-rows" />
              <p id="invite-paste-hint" className="text-[13px] text-muted">
                {t("pasteHint", { max: MAX_INVITE_ROWS })}
              </p>
              <div id="invite-paste-rows" aria-live="polite" className="space-y-1">
                {parsed.rows.some((r) => r.problem) ? (
                  <ul className="space-y-1 text-[13px] text-ink">
                    {parsed.rows
                      .filter((r) => r.problem)
                      .map((r) => (
                        <li key={r.line} className="tnum">
                          <StatusDot tone="warn" className="text-ink">
                            {t(`row${r.problem!}`, { line: r.line })}
                          </StatusDot>
                        </li>
                      ))}
                  </ul>
                ) : null}
                {parsed.tooMany ? <p className="text-[13px] text-ink">{t("tooMany", { max: MAX_INVITE_ROWS })}</p> : null}
                {parsed.rows.length > 0 && !parsed.rows.some((r) => r.problem) ? <p className="tnum text-[13px] text-muted">{t("rowsReady", { count: parsed.rows.length })}</p> : null}
              </div>
              {parsed.rows.length > 0 ? (
                // What will be stored, row by row (fix round 2): outside the live region, so only the count and the problems are announced.
                <section aria-labelledby="invite-preview-title" className="space-y-2 pt-2">
                  <h3 id="invite-preview-title" className="text-[13px] font-medium text-ink">
                    {t("previewTitle")}
                  </h3>
                  <ul aria-labelledby="invite-preview-title" tabIndex={0} className="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                    {parsed.rows.map((r) => (
                      <li key={r.line} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[13px] leading-5">
                        <span className="tnum w-14 shrink-0 text-muted">{t("previewLine", { line: r.line })}</span>
                        <span className={r.problem === "NAME" ? "text-muted italic" : "font-medium text-ink"}>{r.fullName || t("previewNoName")}</span>
                        <span className={r.problem === "EMAIL" ? "text-muted italic" : "text-muted"}>{r.email || t("previewNoEmail")}</span>
                        {r.problem ? (
                          <StatusDot tone="warn" className="text-ink">
                            {t(`preview${r.problem}`)}
                          </StatusDot>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ),
    },
    summary: {
      id: "summary",
      title: t("summaryTitle"),
      layout: "split",
      primary: {
        kind: "button",
        id: "invite-create",
        label: mode === "single" ? t("create") : t("createMany", { count: parsed.rows.length }),
        busy: pending,
        busyLabel: t("creating"),
        waitReason: reason ? t(`reason${reason}`) : null,
        onClick: () => submit(false),
      },
      note: refusalNote ?? fixLink,
      body: (
        <div className="space-y-4">
          <SummaryRows
            rows={[
              ...(pickOpening && opening ? [{ id: "opening", label: t("opening"), value: opening.name, edit: { onClick: change("opening") } }] : []),
              mode === "single"
                ? { id: "person", label: t("personRow"), value: [fullName.replace(/\s+/g, " ").trim(), email.trim()].filter(Boolean).join(" · "), edit: { onClick: change("person") } }
                : { id: "person", label: t("listRow"), value: <span className="tnum">{t("rowsReady", { count: parsed.rows.length })}</span>, edit: { onClick: change("person") } },
              { id: "language", label: t("language"), value: <span lang={locale}>{t(locale)}</span>, edit: { onClick: change("language") } },
              { id: "deadline", label: t("deadline"), value: <span className="tnum">{dayText}</span>, edit: opening ? { onClick: change("deadline") } : null },
            ]}
            changeLabel={flow("change")}
            changedLabel={flow("changed")}
          />
          {short && opening ? (
            <div className="space-y-1">
              <StatusDot tone="warn" className="items-start text-ink [&>span:first-child]:mt-[7px]">
                <span className="tnum text-[14px] leading-5">{t("panelShort", { evaluators: short.evaluators, min: short.min })}</span>
              </StatusDot>
              {/* KG3: straight to the team flow's first step (4.10); a plain anchor, so that page hears the hash. */}
              <a href={`/hiring/openings/${opening.id}/settings#team-members`} className={`ml-3.5 inline-flex min-h-11 items-center text-[14px] font-medium text-ink ${LINK}`}>
                {t("goTeam")}
              </a>
            </div>
          ) : opening && opening.live && opening.evaluators > 0 ? (
            <p className="tnum text-[14px] text-muted">{t("evaluators", { count: opening.evaluators })}</p>
          ) : null}
        </div>
      ),
    },
    language: {
      id: "language",
      title: t("stepLanguageTitle"),
      layout: "split",
      primary: { kind: "button", id: "invite-next", label: flow("backToSummary"), onClick: toSummary },
      body: (
        <>
          <p id="invite-language-label" className="sr-only">
            {t("language")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="invite-language"
            labelledBy="invite-language-label"
            columns={2}
            value={[locale]}
            onChange={([v]) => edit(() => setLocale(v as Locale))}
            items={(["tr", "en"] as const).map((l) => ({ value: l, label: <span lang={l}>{t(l)}</span> }))}
          />
        </>
      ),
    },
    deadline: {
      id: "deadline",
      title: t("stepDeadlineTitle"),
      lead: <p className="tnum">{dayText}</p>,
      layout: "single",
      primary: { kind: "button", id: "invite-next", label: flow("backToSummary"), waitReason: reason === "deadline" ? t("reasondeadline") : null, onClick: toSummary },
      note: refusalNote,
      body: opening ? (
        <div className="space-y-2">
          <Label htmlFor="invite-deadline">{t("deadline")}</Label>
          <Input
            id="invite-deadline"
            type="date"
            min={today}
            max={openingDeadline ?? undefined}
            value={deadlineInputValue({ opening, deadline, today })}
            onChange={(e) => edit(() => setDeadline(e.target.value || null))}
            className="tnum w-56 text-[16px]"
            aria-describedby={openingDeadline ? "invite-deadline-max" : undefined}
          />
          {openingDeadline ? (
            <p id="invite-deadline-max" className="text-[13px] text-muted">
              {t("deadlineMax", { date: formatInviteDay(openingDeadline, uiLocale) })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] text-muted">{t("pickOpeningFirst")}</p>
      ),
    },
  };

  const first = path[0];
  return (
    <GuidedFlow
      container={container}
      // C19: the head names the opening the link is for (the Sheet names it under its title).
      kicker={opening ? `${t("title")} · ${opening.name}` : t("title")}
      step={screens[step]}
      journey={flowJourney(path, step, "summary")}
      back={
        step === first
          ? container === "page"
            ? { label: common("back"), href: "/hiring/openings" }
            : null
          : step === "language" || step === "deadline"
            ? // Opened from the summary with "Değiştir": back is the summary (the filled button says "Özete dön").
              { label: flow("back"), onClick: toSummary }
            : { label: flow("back"), onClick: () => nav.back(path[Math.max(0, path.indexOf(step) - 1)]) }
      }
      exit={container === "page" ? { dirty, href: "/hiring/openings" } : null}
      enter={nav.moved}
      arrive={returned}
    />
  );
}
