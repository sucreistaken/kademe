"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Copy, Download, FileUp, Info, Monitor, UserPlus } from "lucide-react";
import { inviteStudentsAction, type InviteStudentsResult } from "@/app/(manager)/exam/students/new/actions";
import {
  alreadyInvited,
  claimFor,
  csvFileName,
  decodeCsv,
  examWait,
  INVITE_PATH,
  INVITE_STEPS,
  inviteFirstInvalid,
  listWait,
  MAX_CSV_BYTES,
  MAX_STUDENT_ROWS,
  parseStudentRows,
  studentsCsv,
  studentsTsv,
  type InviteStep,
  type InvitedStudent,
} from "@/app/(manager)/exam/students/new/rows";
import { flowJourney } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { StepScreen } from "@/components/visual/step-screen";
import { useMT } from "@/i18n/manager-client";
import { bankCoverage, type BankCount, type BlueprintConfig } from "@/lib/exam/blueprint";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { cn } from "@/lib/cn";

/**
 * One exam the students can be invited to. `value` is an exam-choice value
 * (src/lib/exam/exam-choice). A template that is not `published` yet becomes
 * an exam on this invite, so it needs the publish coverage (every level or
 * every claim), not only the chosen claim's.
 */
export type ExamOption = {
  value: string;
  group: "own" | "template";
  name: string;
  summary: string | null;
  mode: "PLACEMENT" | "LEVEL_VERIFICATION";
  published: boolean;
  config: BlueprintConfig;
  minutes: number;
  sections: number;
};

type Done = Extract<InviteStudentsResult, { ok: true }>;
type Refusal = Extract<InviteStudentsResult, { ok: false }>["code"];

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/** "Kopyalandı" for two seconds after a copy, per key. */
function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => (timer.current ? window.clearTimeout(timer.current) : undefined), []);
  async function copy(key: string, value: string, fallbackId?: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // The clipboard was refused: the text is selected so it can be copied by hand.
      const field = fallbackId ? (document.getElementById(fallbackId) as HTMLInputElement | null) : null;
      field?.focus();
      field?.select();
    }
  }
  return { copied, copy };
}

/**
 * "Öğrenci davet et" as a guided flow, the hiring invite's way: the list
 * (pasted "Ad Soyad, e-posta" lines or a CSV file, problems shown per line),
 * the exam, a last look where the student's screen language holds its
 * default and opens its own step with "Değiştir". "N daveti oluştur" invites
 * everyone; the result lists every student with their link, "Tümünü
 * kopyala" and "CSV indir". Nothing is e-mailed: the school shares the links,
 * and each link can be copied again later from the student list.
 */
export function StudentInviteWizard({
  options,
  counts,
  openEmails,
  linkDays,
  lastDay,
  initialChoice,
  initialClaimed,
}: {
  options: ExamOption[];
  counts: BankCount[];
  /** How many days a new link stays open (the server's LINK_TTL_DAYS), and that day, written out. */
  linkDays: number;
  lastDay: string;
  /** E-mails that already have an open invitation, lower case. */
  openEmails: string[];
  /** The exam the manager came from (`?exam=`): just published, or "Davet et" on it. */
  initialChoice?: string;
  initialClaimed?: Cefr;
}) {
  const t = useMT("examWizard");
  const sec = useMT("sectionName");
  const m = useMT("mode");
  const inv = useMT("invite");
  const flow = useMT("flow");
  const uiLocale = useLocale() === "en" ? "en" : "tr";
  const own = options.filter((o) => o.group === "own");
  const [text, setText] = useState("");
  const [choice, setChoice] = useState(initialChoice ?? (own.length === 1 ? own[0].value : ""));
  const [batch, setBatch] = useState<Cefr | null>(initialClaimed ?? null);
  const [locale, setLocale] = useState<"tr" | "en">("tr");
  const [fromSummary, setFromSummary] = useState(false);
  const [fileError, setFileError] = useState<"SIZE" | "READ" | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [returned, setReturned] = useState(false);
  const [pending, start] = useTransition();
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopied();

  const parsed = useMemo(() => parseStudentRows(text), [text]);
  const listReason = listWait(parsed);
  const exam = options.find((o) => o.value === choice) ?? null;
  const examReason = examWait({ mode: exam?.mode ?? null, rows: parsed.rows, batch });
  const nav = useFlowStep({ steps: INVITE_STEPS, firstInvalid: inviteFirstInvalid({ listReady: !listReason, examReady: !examReason }), mode: "hash" });
  const step = nav.step;
  // A verification exam is checked for each claim on the list; a template's first use for every claim (it is published here).
  const claims = exam?.mode === "LEVEL_VERIFICATION" ? [...new Set(parsed.rows.map((r) => claimFor(r, "LEVEL_VERIFICATION", batch)))] : [null];
  const missing = exam
    ? claims.flatMap((c) => bankCoverage(counts, exam.config, exam.mode, exam.published ? c : null).rows.filter((r) => !r.ok)).slice(0, 1)[0] ?? null
    : null;
  const repeated = alreadyInvited(parsed.rows, openEmails);

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  function edit(change: () => void) {
    setRefusal(null);
    change();
  }

  async function readFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setFileError("SIZE");
      return;
    }
    try {
      setRefusal(null);
      setText(decodeCsv(await file.arrayBuffer()));
    } catch {
      setFileError("READ");
    }
  }

  function next(from: InviteStep) {
    if (fromSummary || from === "language") {
      setFromSummary(false);
      nav.go("review");
      return;
    }
    nav.go(INVITE_PATH[Math.min(INVITE_PATH.length - 1, INVITE_PATH.indexOf(from as (typeof INVITE_PATH)[number]) + 1)]);
  }
  const change = (to: InviteStep) => () => {
    setFromSummary(true);
    nav.go(to);
  };

  function submit() {
    if (!exam) return;
    setRefusal(null);
    start(async () => {
      try {
        const r = await inviteStudentsAction({ text, exam: exam.value, claimed: batch, locale });
        if (r.ok) setDone(r);
        else {
          setRefusal(r.code);
          if (r.code === "LIST") nav.go("list");
          else if (r.code === "EXAM" || r.code === "CLAIM_REQUIRED") nav.go("exam");
        }
      } catch {
        setRefusal("GENERIC");
      }
    });
  }

  function reset() {
    setDone(null);
    setText("");
    setRefusal(null);
    setReturned(true);
    nav.go("list");
  }

  if (done) {
    const students: InvitedStudent[] = done.created.map((c) => ({
      fullName: c.fullName,
      email: c.email,
      url: c.url,
      expires: new Date(c.expiresAt).toLocaleDateString(uiLocale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" }),
    }));
    const download = () => {
      const csv = studentsCsv(students, [t("csvName"), t("csvEmail"), t("csvExam"), t("csvLink"), t("csvExpires")], done.examName, uiLocale === "en" ? "," : ";");
      const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = href;
      // The manager's own day: toISOString is UTC and names the file after yesterday late in a Turkish evening.
      const now = new Date();
      a.download = csvFileName(done.examName, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    };
    return (
      <StepScreen
        layout="single"
        width={760}
        illustration="inviteReady"
        illustrationSize="spot"
        title={t("inviteDoneTitle", { count: done.created.length })}
        titleRef={doneHeading}
        lead={<p>{inv("doneBody")}</p>}
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-[14px] border border-line bg-canvas px-4 py-3.5">
            <Monitor className="mt-0.5 size-5 shrink-0 text-ink" strokeWidth={1.75} aria-hidden />
            <p className="text-[14px] leading-[22px] text-ink-2">{t("inviteComputer")}</p>
          </div>
          {students.length ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => copy("all", studentsTsv(students, [t("csvName"), t("csvEmail"), t("csvLink")]))}>
                  <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                  {copied === "all" ? t("copied") : t("copyAll")}
                </Button>
                <Button variant="secondary" onClick={download}>
                  <Download className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("downloadCsv")}
                </Button>
                <span className="tnum text-[13px] text-muted">{t("inviteDoneExam", { exam: done.examName, date: students[0].expires })}</span>
              </div>
              <ul aria-label={t("inviteDoneListLabel")} className="divide-y divide-line rounded-[14px] border border-line bg-surface">
                {students.map((s, i) => {
                  const id = `invite-link-${i}`;
                  return (
                    <li key={s.url} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="text-[14.5px] font-semibold text-ink">{s.fullName}</p>
                        <p className="text-[13px] text-muted">{s.email}</p>
                      </div>
                      <label htmlFor={id} className="sr-only">
                        {t("linkFor", { name: s.fullName })}
                      </label>
                      <input
                        id={id}
                        readOnly
                        value={s.url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-10 min-w-0 flex-[2] rounded-[10px] border border-line bg-paper px-3 font-mono text-[12.5px] text-ink"
                      />
                      <Button size="sm" variant="secondary" aria-label={`${t("copyLink")}: ${s.fullName}`} onClick={() => copy(id, s.url, id)}>
                        {copied === id ? t("copied") : t("copyLink")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {done.failed.length ? (
            <div role="alert" className="space-y-1">
              <p className="text-[14px] font-medium text-ink">{t("inviteFailedTitle", { count: done.failed.length })}</p>
              <ul className="space-y-1">
                {done.failed.map((f) => (
                  <li key={`${f.line}-${f.email}`} className="tnum">
                    <StatusDot tone="warn" className="text-ink">
                      {t("inviteFailedRow", { line: f.line, name: f.fullName, email: f.email })} {inv(`err${f.code}`)}
                    </StatusDot>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <span role="status" className="sr-only">
            {copied ? t("copied") : ""}
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-4">
            <button type="button" onClick={reset} className={LINK}>
              <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
              {inv("another")}
            </button>
            <Button asChild variant="secondary" className="ml-auto">
              <Link href="/exam/students">{t("toStudents")}</Link>
            </Button>
          </div>
        </div>
      </StepScreen>
    );
  }

  const refusalNote = refusal ? (
    <p role="alert" className="text-[14px] font-medium text-ink">
      {refusal === "LIST" ? t("inviteErrLIST") : refusal === "CLAIM_REQUIRED" ? inv("errCLAIM_REQUIRED") : inv(`err${refusal}`)}
    </p>
  ) : null;
  const primaryLabel = fromSummary ? flow("backToSummary") : flow("continue");
  const examMeta = (o: ExamOption) => inv("examMeta", { minutes: o.minutes, sections: o.sections, preset: inv(`preset${o.config.proctoring.preset}`) });
  const examItems = (group: "own" | "template") =>
    options
      .filter((o) => o.group === group)
      .map((o) => ({
        value: o.value,
        label: o.name,
        description: (
          <>
            {o.summary ? <span className="block">{o.summary}</span> : null}
            <span className="mt-0.5 block text-[13px] text-muted">
              {m(o.mode)} · {examMeta(o)}
            </span>
          </>
        ),
      }));

  const screens: Record<InviteStep, FlowStep> = {
    list: {
      id: "list",
      title: t("inviteListTitle"),
      lead: <p>{inv("lead")}</p>,
      layout: "single",
      mascot: "wave",
      primary: { kind: "button", id: "invite-next", label: primaryLabel, waitReason: listReason ? t(`inviteWait${listReason}`, { max: MAX_STUDENT_ROWS }) : null, onClick: () => next("list") },
      note: refusal === "LIST" ? refusalNote : null,
      body: (
        <div className="space-y-3">
          <Label htmlFor="invite-list">{t("inviteListLabel")}</Label>
          <Textarea
            id="invite-list"
            rows={7}
            spellCheck={false}
            placeholder={t("inviteListPlaceholder")}
            value={text}
            onChange={(e) => edit(() => setText(e.target.value))}
            aria-describedby="invite-list-hint invite-list-rows"
            className="max-h-80 overflow-y-auto font-mono text-[14px]"
          />
          <p id="invite-list-hint" className="text-[13px] leading-5 text-muted">
            {t("inviteListHint", { max: MAX_STUDENT_ROWS })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
                const input = e.currentTarget;
                void readFile(input.files?.[0]).finally(() => {
                  // The same file can be chosen again after an edit.
                  input.value = "";
                });
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              <FileUp className="size-4" strokeWidth={1.75} aria-hidden />
              {t("inviteCsv")}
            </Button>
            <span className="text-[13px] text-muted">{t("inviteCsvHint")}</span>
          </div>
          {fileError ? (
            <p role="alert" className="text-[13.5px] font-medium text-ink">
              {t(fileError === "SIZE" ? "inviteCsvSize" : "inviteCsvRead")}
            </p>
          ) : null}
          <div id="invite-list-rows" aria-live="polite" className="space-y-1">
            {parsed.rows.some((r) => r.problem) ? (
              <ul className="space-y-1 text-[13px]">
                {parsed.rows
                  .filter((r) => r.problem)
                  .map((r) => (
                    <li key={r.line} className="tnum">
                      <StatusDot tone="warn" className="text-ink">
                        {t(`inviteRow${r.problem!}`, { line: r.line })}
                      </StatusDot>
                    </li>
                  ))}
              </ul>
            ) : null}
            {parsed.tooMany ? <p className="text-[13px] text-ink">{t("inviteWaitTOO_MANY", { max: MAX_STUDENT_ROWS })}</p> : null}
            {parsed.rows.length > 0 && !listReason ? <p className="tnum text-[13.5px] font-medium text-ink">{t("inviteReady", { count: parsed.rows.length })}</p> : null}
          </div>
          {parsed.rows.length > 0 ? (
            <section aria-labelledby="invite-preview-title" className="space-y-2 pt-1">
              <h3 id="invite-preview-title" className="text-[13px] font-medium text-ink">
                {t("invitePreview")}
              </h3>
              <ul tabIndex={0} aria-labelledby="invite-preview-title" className="max-h-64 divide-y divide-line overflow-y-auto rounded-[12px] border border-line bg-surface">
                {parsed.rows.map((r) => (
                  <li key={r.line} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[13.5px] leading-5">
                    <span className="tnum w-14 shrink-0 text-muted">{t("inviteLine", { line: r.line })}</span>
                    <span className={r.problem === "NAME" ? "text-muted italic" : "font-medium text-ink"}>{r.fullName || t("inviteNoName")}</span>
                    <span className={r.problem === "EMAIL" ? "text-muted italic" : "text-muted"}>{r.email || t("inviteNoEmail")}</span>
                    {r.claimed ? <span className="tnum text-muted">{r.claimed}</span> : null}
                    {r.problem ? (
                      <StatusDot tone="warn" className="text-ink">
                        {t(`invitePreview${r.problem}`)}
                      </StatusDot>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ),
    },
    exam: {
      id: "exam",
      title: t("inviteExamTitle"),
      lead: <p>{t("inviteExamLead")}</p>,
      layout: "single",
      mascot: "think",
      primary: { kind: "button", id: "invite-next", label: primaryLabel, waitReason: examReason ? t(`inviteWait${examReason}`) : null, onClick: () => next("exam") },
      note: refusal === "EXAM" || refusal === "CLAIM_REQUIRED" ? refusalNote : null,
      body: (
        <div className="space-y-6">
          {(["own", "template"] as const)
            .filter((g) => options.some((o) => o.group === g))
            .map((g) => (
              <div key={g} className="space-y-2">
                <p id={`invite-exam-${g}`} className="text-[13px] font-medium text-muted">
                  {g === "own" ? inv("groupOwn") : inv("groupTemplates")}
                </p>
                <ChoiceCardGroup
                  type="single"
                  name="invite-exam"
                  labelledBy={`invite-exam-${g}`}
                  look="panel"
                  value={[choice]}
                  onChange={([v]) => edit(() => setChoice(v ?? ""))}
                  items={examItems(g)}
                />
              </div>
            ))}
          {exam?.mode === "LEVEL_VERIFICATION" ? (
            <fieldset className="space-y-2">
              <legend className="text-[14px] font-medium text-ink">{t("inviteClaim")}</legend>
              <div className="flex flex-wrap gap-1.5">
                {CEFR_LEVELS.map((l) => (
                  <label
                    key={l}
                    className={cn(
                      "tnum flex h-11 w-14 cursor-pointer items-center justify-center rounded-[10px] border text-[14px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                      batch === l ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:bg-canvas",
                    )}
                  >
                    <input type="radio" name="invite-claim" value={l} className="sr-only" checked={batch === l} onChange={() => edit(() => setBatch(l))} />
                    {l}
                  </label>
                ))}
              </div>
              <p className="text-[13px] text-muted">{t("inviteClaimHint")}</p>
            </fieldset>
          ) : null}
          {missing ? (
            <p className="text-[14px] leading-[22px] text-ink">
              {inv(exam?.published ? "coverageBlocked" : "templateCoverageBlocked", { section: sec(missing.section), level: missing.level, available: missing.available, needed: missing.needed })}{" "}
              <Link href="/exam/bank" className="underline underline-offset-2">
                {inv("toBank")}
              </Link>
            </p>
          ) : null}
        </div>
      ),
    },
    review: {
      id: "review",
      title: t("inviteReviewTitle"),
      lead: <p>{t("inviteReviewLead")}</p>,
      layout: "split",
      primary: {
        kind: "button",
        id: "invite-create",
        label: t("inviteCreate", { count: parsed.rows.length }),
        busy: pending,
        busyLabel: t("inviteCreating"),
        waitReason: listReason ? t(`inviteWait${listReason}`, { max: MAX_STUDENT_ROWS }) : examReason ? t(`inviteWait${examReason}`) : missing ? t("inviteWaitCOVERAGE") : null,
        onClick: submit,
      },
      note: refusal && refusal !== "LIST" && refusal !== "EXAM" && refusal !== "CLAIM_REQUIRED" ? refusalNote : null,
      body: (
        <div className="space-y-5">
          <SummaryRows
            rows={[
              {
                id: "list",
                label: t("inviteRowStudents"),
                value: <span className="tnum">{t("inviteReady", { count: parsed.rows.length })}</span>,
                detail: parsed.rows
                  .slice(0, 3)
                  .map((r) => r.fullName)
                  .join(", ")
                  .concat(parsed.rows.length > 3 ? ` +${parsed.rows.length - 3}` : ""),
                edit: { onClick: change("list") },
              },
              { id: "exam", label: t("inviteRowExam"), value: exam?.name ?? "", detail: exam ? examMeta(exam) : null, edit: { onClick: change("exam") } },
              ...(exam?.mode === "LEVEL_VERIFICATION"
                ? [{ id: "claim", label: t("inviteClaim"), value: batch ?? t("inviteClaimPerRow"), edit: { onClick: change("exam") } }]
                : []),
              { id: "language", label: inv("language"), value: <span lang={locale}>{locale === "en" ? "English" : "Türkçe"}</span>, edit: { onClick: change("language") } },
              { id: "expires", label: t("inviteRowExpires"), value: <span className="tnum">{t("inviteExpires", { days: linkDays, date: lastDay })}</span> },
            ]}
            changeLabel={flow("change")}
            changedLabel={flow("changed")}
          />
          <div className="flex gap-3 rounded-[14px] border border-line bg-canvas px-4 py-3.5">
            <Info className="mt-0.5 size-5 shrink-0 text-ink" strokeWidth={1.75} aria-hidden />
            <p className="text-[14px] leading-[22px] text-ink-2">{t("inviteNoMail")}</p>
          </div>
          {repeated.length ? <p className="text-[14px] leading-[22px] text-ink">{t("inviteRepeated", { count: repeated.length, list: repeated.slice(0, 3).join(", ") + (repeated.length > 3 ? ` +${repeated.length - 3}` : "") })}</p> : null}
        </div>
      ),
    },
    language: {
      id: "language",
      title: t("inviteLanguageTitle"),
      lead: <p>{t("inviteLanguageLead")}</p>,
      layout: "single",
      mascot: "think",
      primary: { kind: "button", id: "invite-next", label: flow("backToSummary"), onClick: () => next("language") },
      body: (
        <>
          <p id="invite-language-label" className="sr-only">
            {inv("language")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="invite-language"
            labelledBy="invite-language-label"
            look="panel"
            columns={2}
            value={[locale]}
            onChange={([v]) => setLocale(v === "en" ? "en" : "tr")}
            items={[
              { value: "tr", label: <span lang="tr">Türkçe</span> },
              { value: "en", label: <span lang="en">English</span> },
            ]}
          />
        </>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={inv("title")}
      step={screens[step]}
      journey={flowJourney(INVITE_PATH, step === "language" ? "review" : step, "review")}
      back={
        step === "list"
          ? { label: flow("back"), href: "/exam/students" }
          : step === "language" || fromSummary
            ? {
                label: flow("back"),
                onClick: () => {
                  setFromSummary(false);
                  nav.go("review");
                },
              }
            : { label: flow("back"), onClick: () => nav.back() }
      }
      exit={{ dirty: text.trim() !== "", href: "/exam/students" }}
      enter={nav.moved}
      arrive={returned}
    />
  );
}
