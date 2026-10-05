"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button, DisabledReason } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";
import { formatInviteDay, linkExpiryDay, parseInviteRows } from "@/solutions/hiring/rules/invitation";
import { inviteCandidateAction, inviteManyAction, type InviteOneResult } from "@/app/(manager)/hiring/invite/actions";
import { CopyField } from "./copy-field";
import { inviteReason, panelShortfall, type InviteOpening } from "./form-rules";

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
 * HIRING-UX 5.11: the opening (preselected), the person, their language and
 * the last day (from the opening, "Değiştir" to choose another), or a pasted
 * list. The button waits with its reason, said next to it. On success the
 * link is shown once with "Linki kopyala" as the filled button and the ready
 * message below; a pasted list gets each row's result, a link and a message
 * per invitation, and "Tümünü kopyala".
 */
export function InviteForm({ openings, initialOpeningId, today, zone, onDone }: { openings: InviteOpening[]; initialOpeningId: string | null; today: string; zone: string; onDone?: () => void }) {
  const t = useMT("hiringInvite");
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
  const [changing, setChanging] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<{ result: Refusal; name: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const parsed = useMemo(() => parseInviteRows(text), [text]);
  const reason = inviteReason({ opening, mode, fullName, email, rows: parsed.rows, deadline, today });
  const short = panelShortfall(opening);
  // The day the server will use (linkExpiryDay): the chosen one held to the opening's deadline, else the deadline, else 14 days.
  const openingDeadline = opening?.deadlineDay && opening.deadlineDay >= today ? opening.deadlineDay : null;
  const shownDay = opening ? linkExpiryDay({ chosen: deadline, openingDeadlineDay: opening.deadlineDay, today }) : null;
  const doneHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

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
  }

  function submit(allowDuplicate = false) {
    setRefusal(null);
    const name = fullName;
    start(async () => {
      try {
        if (mode === "single") {
          const result = await inviteCandidateAction({ openingId, fullName, email, locale, deadline, allowDuplicate });
          if (result.ok) setDone({ kind: "one", result });
          else setRefusal({ result, name });
          return;
        }
        const { results } = await inviteManyAction({ openingId, text, locale, deadline });
        // Line 0 is a refusal of the whole list (role, opening, day) or malformed input.
        const whole = results.find((r) => r.line === 0);
        if (whole && !whole.result.ok) {
          setRefusal({ result: whole.result, name: "" });
          return;
        }
        if (results.length === 0) {
          setRefusal({ result: { ok: false, code: "FAILED" }, name: "" });
          return;
        }
        setDone({
          kind: "many",
          ok: results.flatMap((r) => (r.result.ok ? [{ line: r.line, fullName: r.fullName, email: r.email, result: r.result }] : [])),
          failed: results.flatMap((r) => (r.result.ok ? [] : [{ line: r.line, fullName: r.fullName, result: r.result }])),
        });
      } catch {
        // A dropped connection or a server error: the calm message, never the raw one.
        setRefusal({ result: { ok: false, code: "FAILED" }, name: "" });
      }
    });
  }

  if (done?.kind === "one") {
    return (
      <div className="space-y-5">
        <div>
          <h2 ref={doneHeading} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-ink outline-none">
            {t("readyTitle")}
          </h2>
          <p className="tnum mt-1 text-[14px] text-muted">{t("readyBody", { name: done.result.name, date: done.result.expires })}</p>
        </div>
        <CopyField id="invite-link" label={t("linkLabel")} value={done.result.url} primary copyLabel={t("copyLink")} />
        <CopyField id="invite-message" label={t("messageLabel")} value={done.result.message.body} multiline copyLabel={t("copyMessage")} />
        <p className="text-[13px] text-muted">{t("onceNote")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={reset} className={`min-h-10 text-[14px] font-medium text-ink ${LINK}`}>
            {t("another")}
          </button>
          {onDone ? (
            <Button variant="ghost" onClick={onDone}>
              {t("close")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (done?.kind === "many") {
    const all = done.ok.map((r) => `${r.fullName}\t${r.email}\t${r.result.url}`).join("\n");
    const duplicates = done.failed.some((f) => f.result.code === "DUPLICATE");
    return (
      <div className="space-y-5">
        <div>
          <h2 ref={doneHeading} tabIndex={-1} className="tnum text-[16px] leading-6 font-semibold text-ink outline-none">
            {t("manyReady", { count: done.ok.length })}
          </h2>
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
            <p className="text-[13px] text-muted">{t("onceNote")}</p>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={reset} className={`min-h-10 text-[14px] font-medium text-ink ${LINK}`}>
            {t("another")}
          </button>
          {onDone ? (
            <Button variant="ghost" onClick={onDone}>
              {t("close")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const why = reason ? t(`reason${reason}`) : pending ? t("creating") : null;

  return (
    <div className="space-y-field">
      {openings.length > 1 || !opening ? (
        <div className="space-y-2">
          <Label htmlFor="invite-opening">{t("opening")}</Label>
          <Select value={openingId} onValueChange={(v) => edit(() => setOpeningId(v))}>
            <SelectTrigger id="invite-opening" className="w-full">
              <SelectValue placeholder={t("chooseOpening")} />
            </SelectTrigger>
            <SelectContent>
              {openings.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-[14px] text-ink">
          <span className="text-muted">{t("opening")}:</span> {opening.name}
        </p>
      )}
      {opening && opening.live && opening.evaluators > 0 ? <p className="tnum text-[13px] text-muted">{t("evaluators", { count: opening.evaluators })}</p> : null}
      {short && opening ? (
        <div className="space-y-1">
          <StatusDot tone="warn" className="items-start text-ink [&>span:first-child]:mt-[7px]">
            <span className="tnum leading-5">{t("panelShort", { evaluators: short.evaluators, min: short.min })}</span>
          </StatusDot>
          <Link href={`/hiring/openings/${opening.id}/settings`} className={`ml-3.5 inline-block text-[13px] font-medium text-ink ${LINK}`}>
            {t("goTeam")}
          </Link>
        </div>
      ) : null}

      <RadioGroup value={mode} onValueChange={(v) => edit(() => setMode(v as "single" | "many"))} className="flex flex-wrap gap-x-6 gap-y-1" aria-label={t("modeLabel")}>
        {(["single", "many"] as const).map((m) => (
          <label key={m} className="flex min-h-10 cursor-pointer items-center gap-2 text-[14px] text-ink">
            <RadioGroupItem value={m} />
            {t(m)}
          </label>
        ))}
      </RadioGroup>

      {mode === "single" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t("fullName")}</Label>
            <Input id="invite-name" autoComplete="off" maxLength={120} value={fullName} onChange={(e) => edit(() => setFullName(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("email")}</Label>
            <Input id="invite-email" type="email" autoComplete="off" maxLength={160} value={email} onChange={(e) => edit(() => setEmail(e.target.value))} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="invite-paste">{t("pasteLabel")}</Label>
          <Textarea id="invite-paste" rows={6} value={text} onChange={(e) => edit(() => setText(e.target.value))} aria-describedby="invite-paste-hint invite-paste-rows" />
          <p id="invite-paste-hint" className="text-[13px] text-muted">
            {t("pasteHint")}
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
            {parsed.tooMany ? <p className="text-[13px] text-ink">{t("tooMany")}</p> : null}
            {parsed.rows.length && !parsed.rows.some((r) => r.problem) ? <p className="tnum text-[13px] text-muted">{t("rowsReady", { count: parsed.rows.length })}</p> : null}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label id="invite-language">{t("language")}</Label>
        <RadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)} className="flex flex-wrap gap-x-6 gap-y-1" aria-labelledby="invite-language">
          {(["tr", "en"] as const).map((l) => (
            <label key={l} lang={l} className="flex min-h-10 cursor-pointer items-center gap-2 text-[14px] text-ink">
              <RadioGroupItem value={l} />
              {t(l)}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor={changing ? "invite-deadline" : undefined} id="invite-deadline-label">
          {t("deadline")}
        </Label>
        {changing ? (
          <>
            <Input
              id="invite-deadline"
              type="date"
              min={today}
              max={openingDeadline ?? undefined}
              value={deadline ?? shownDay ?? ""}
              onChange={(e) => setDeadline(e.target.value || null)}
              className="w-48"
              aria-describedby={openingDeadline ? "invite-deadline-max" : undefined}
            />
            {openingDeadline ? (
              <p id="invite-deadline-max" className="text-[13px] text-muted">
                {t("deadlineMax", { date: formatInviteDay(openingDeadline, uiLocale) })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="tnum flex flex-wrap items-center gap-x-3 text-[14px] text-ink">
            {shownDay ? <span>{t("deadlineValue", { date: formatInviteDay(shownDay, uiLocale), zone })}</span> : null}
            <button type="button" onClick={() => setChanging(true)} className={`min-h-10 text-[13px] font-medium ${LINK}`}>
              {t("change")}
            </button>
          </p>
        )}
      </div>

      {refusal ? (
        <div role="alert" className="space-y-2 rounded-xl border border-line bg-surface p-4 text-[14px] text-ink">
          {refusal.result.code === "DUPLICATE" ? (
            <>
              <p>{t("duplicate", { name: refusal.name.replace(/\s+/g, " ").trim(), date: refusal.result.existing?.invitedAt ?? "" })}</p>
              <p className="text-muted">{t("duplicateHelp")}</p>
              <Button size="sm" onClick={() => submit(true)} id="invite-anyway">
                {t("inviteAnyway")}
              </Button>
            </>
          ) : (
            <p>{t(`err${refusal.result.code}`)}</p>
          )}
        </div>
      ) : null}

      <div className="space-y-1">
        <Button id="invite-create" variant="primary" disabled={why !== null} disabledReason={why ?? undefined} aria-busy={pending || undefined} onClick={() => submit(false)}>
          {pending ? t("creating") : mode === "single" ? t("create") : t("createMany", { count: parsed.rows.length })}
        </Button>
        {why ? (
          <DisabledReason id="invite-create-why">
            {why}{" "}
            {reason === "notPublished" && opening ? (
              <Link href={`/hiring/openings/${opening.id}/assessment`} className={`font-medium text-ink ${LINK}`}>
                {t("goAssessment")}
              </Link>
            ) : (reason === "noEvaluators" || reason === "openingDeadline") && opening ? (
              <Link href={`/hiring/openings/${opening.id}/settings`} className={`font-medium text-ink ${LINK}`}>
                {t("goTeam")}
              </Link>
            ) : null}
          </DisabledReason>
        ) : null}
      </div>
    </div>
  );
}
