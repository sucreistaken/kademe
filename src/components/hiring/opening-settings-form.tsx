"use client";

import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { CalendarDays, Check, EyeOff, Lock, Tag, Users } from "lucide-react";
import { flowFocusKey, flowJourney, isDirty, saveWait, summaryRows } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows, type SummaryRow } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { IconRow } from "@/components/visual/icon-row";
import { stepFocusController } from "@/hooks/use-step-focus";
import { useMT } from "@/i18n/manager-client";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locale";
import { clearHash, currentHash, isHashStepEntry, leaveHashStep, noHash, pushHash, subscribeHash } from "@/lib/client/hash-step";
import { canDecide } from "@/solutions/hiring/rules/access";
import { formatInviteDay } from "@/solutions/hiring/rules/invitation";
import { openingRulesProblems, type OpeningRulesInput, type RulesProblem } from "@/solutions/hiring/rules/opening-rules";
import { saveOpeningRulesAction } from "@/app/(manager)/hiring/openings/[id]/settings/actions";
import {
  ALL_FIELDS,
  FLOW_FIELDS,
  REVIEW_STEP,
  RULES_ENTRY,
  afterSave,
  RULES_FLOWS,
  firstInvalidStep,
  flowOfStep,
  otherFlowProblem,
  rulesNavMode,
  rulesPath,
  rulesRoute,
  rulesStepOf,
  saveInput,
  stepWait,
  teamLine,
  type RulesFlow,
  savedNote,
  type RulesStep,
} from "./rules-flows";

export type SettingsUser = { id: string; name: string; role: "OWNER" | "MANAGER" | "REVIEWER"; disabled: boolean };

type Notice = { kind: "saved"; renamed: string | null; of: RulesFlow } | { kind: "problem"; problem: RulesProblem } | { kind: "code"; code: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" | "INVALID" } | { kind: "failed" };

const NONE = "none";
/** The summary's heading: where the focus lands when a flow goes back to the summary (W10). */
const SUMMARY_HEADING = "rules-summary-title";
const FLOW_AREA = "rules-flow";
/** A whole number as typed, or NaN (which the rules refuse) for anything else. */
const wholeNumber = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr"))
    .join("");

/**
 * HIRING-UX 5.18 as HIRING-VISUAL-FLOW 4.10 (K12, H2, H5, D10): the rules'
 * summary, and each group changed in its own short flow on GuidedFlow (team;
 * candidate contact; fair review and the survey; the name). The step lives in
 * the hash (#team-members ...), so a control view's link opens the right one;
 * only an open flow owns the address (rulesNavMode), the summary never
 * rewrites it. Every flow saves through saveOpeningRulesAction with every
 * field (those outside the flow as loaded); the same rules as the server
 * (openingRulesProblems) make each step's "Devam et" wait, and a refusal
 * opens the step it is about with its existing sentence. Leaving never asks
 * (H6): back on the summary the values are the saved ones again. A reviewer
 * and a closed opening read the summary only. `children` is the page's
 * "Alımı kapat", shown under the summary.
 */
export function OpeningSettingsForm({
  openingId,
  initial,
  users,
  today,
  zone,
  canEdit,
  closed,
  children,
}: {
  openingId: string;
  initial: OpeningRulesInput;
  users: SettingsUser[];
  /** The organisation's calendar day (orgDay), so the form and the server agree on "past". */
  today: string;
  /** The organisation's time zone name, said next to the deadline. */
  zone: string;
  canEdit: boolean;
  closed: boolean;
  children?: ReactNode;
}) {
  const t = useMT("hiringSettings");
  const common = useMT("hiringCommon");
  const flowT = useMT("flow");
  const appLocale = useLocale();
  const locale = isLocale(appLocale) ? appLocale : DEFAULT_LOCALE;
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [feedbackText, setFeedbackText] = useState(String(initial.feedbackDays));
  const [pickDay, setPickDay] = useState(initial.deadline !== null);
  const [fromSummary, setFromSummary] = useState(false);
  // I1: the flow a cross-flow "Değiştir" (or a refusal about another flow) came from; its pending edits wait for this save.
  const [origin, setOrigin] = useState<RulesFlow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, start] = useTransition();

  const editable = canEdit && !closed;
  const hash = useSyncExternalStore(subscribeHash, currentHash, noHash);
  const route = editable ? rulesRoute(hash) : null;
  const flow: RulesFlow = route?.flow ?? "team";
  const steps = RULES_FLOWS[flow];
  const check = { users, today, savedDeadline: saved.deadline };
  const nav = useFlowStep<RulesStep | typeof RULES_ENTRY>({ steps: rulesPath(flow), firstInvalid: firstInvalidStep(flow, value, check), mode: rulesNavMode(route) });
  const step: RulesStep = nav.step === RULES_ENTRY ? steps[0] : nav.step;
  const index = steps.indexOf(step);
  const changed = isDirty(saved, value, FLOW_FIELDS[flow]);
  // W7: leaving loses any unsaved edit, also one another flow left pending (I1).
  const unsaved = isDirty(saved, value, ALL_FIELDS);

  // H6: leaving a flow (its exit, "Özete dön", the browser's back) puts the saved values back
  // and drops a refusal that belonged to it; "Kaydedildi." stays for the summary to say.
  const staleRefusal = notice !== null && notice.kind !== "saved";
  if (!route && (value !== saved || fromSummary || staleRefusal || origin !== null)) {
    setValue(saved);
    setOrigin(null);
    setFeedbackText(String(saved.feedbackDays));
    setPickDay(saved.deadline !== null);
    setFromSummary(false);
    if (staleRefusal) setNotice(null);
  }
  // On its summary step a flow walks forward again ("Devam et", not "Özete dön").
  if (route && fromSummary && step === REVIEW_STEP[flow]) setFromSummary(false);

  // W10: opening a flow from the summary focuses its first question; going back focuses the
  // summary's heading. The first load (also on a flow's hash) takes no focus. A step change
  // inside a flow is GuidedFlow's own.
  const [heard, setHeard] = useState(false);
  useEffect(() => subscribeHash(() => setHeard(true)), []);
  const [focus] = useState(stepFocusController);
  const inFlow = route !== null;
  const focusKey = flowFocusKey(heard, inFlow ? `flow-${flow}` : "summary");
  useEffect(() => {
    focus.onStep(focusKey, inFlow ? document.querySelector<HTMLElement>(`#${FLOW_AREA} h1`) : document.getElementById(SUMMARY_HEADING));
  }, [focus, focusKey, inFlow]);

  const set = <K extends keyof OpeningRulesInput>(key: K, v: OpeningRulesInput[K]) => {
    setNotice(null);
    setValue((s) => ({ ...s, [key]: v }));
  };
  const person = (id: string | null) => users.find((u) => u.id === id) ?? null;
  const nameOf = (id: string | null) => {
    const u = person(id);
    return u ? (u.disabled ? t("inactiveName", { name: u.name, state: t("inactive") }) : u.name) : null;
  };
  const deciders = users.filter((u) => !u.disabled && canDecide(u.role));
  // A disabled person stays listed while they are still on the panel, so they can be taken off it.
  const panel = users.filter((u) => !u.disabled || saved.memberIds.includes(u.id));
  // A saved decision maker who can no longer decide stays visible, marked, until someone else is chosen; it cannot be chosen again.
  const stale = (id: string | null) => (id && !deciders.some((u) => u.id === id) ? person(id) : null);
  const personCard = (u: SettingsUser, disabled = false) => ({
    value: u.id,
    label: u.name,
    marker: initials(u.name),
    description: u.disabled ? t("inactive") : t(`role${u.role}`),
    disabled,
  });
  const deciderItems = (id: string | null) => {
    const old = stale(id);
    return [...(old ? [personCard(old, true)] : []), ...deciders.map((u) => personCard(u))];
  };
  const activeReviewers = value.memberIds.filter((id) => users.some((u) => u.id === id && !u.disabled)).length;
  const dayText = (day: string) => {
    try {
      return formatInviteDay(day, locale);
    } catch {
      return day;
    }
  };
  const deadlineText = (day: string | null) => (day ? common("deadline", { date: dayText(day) }) : common("noDeadline"));
  const blindText = (on: boolean) => (on ? common("rulesBlindOn") : common("rulesBlindOff"));
  const surveyText = (on: boolean | undefined) => ((on ?? true) ? common("rulesSurveyOn") : common("rulesSurveyOff"));
  const flowTitle: Record<RulesFlow, string> = { team: t("teamTitle"), contact: t("candidateTitle"), fair: t("fairTitle"), name: t("name") };

  function open(target: RulesFlow) {
    setNotice(null);
    // The summary keeps no hash; the flow's first step is a new, marked entry ("Özete dön" goes back to it).
    pushHash(`#${RULES_FLOWS[target][0]}`);
  }
  function edit(target: RulesStep) {
    setFromSummary(true);
    nav.go(target);
  }
  function back() {
    // A page opened on a later step (a link) has no earlier entry: open the step before as a new one.
    if (isHashStepEntry(window.history.state)) nav.back();
    else nav.go(steps[index - 1]);
  }

  function save() {
    const sent = saveInput(saved, value, flow);
    setNotice(null);
    start(async () => {
      try {
        const res = await saveOpeningRulesAction(openingId, sent);
        if (res.ok) {
          // A name another opening already has was numbered on the server: show what was stored.
          const stored = { ...sent, name: res.name };
          // I1: a flow that waited on this one gets its pending edits back on its summary step.
          const next = afterSave({ flow, origin, stored, value });
          setSaved(stored);
          setValue(next.value);
          setOrigin(null);
          setFromSummary(false);
          setNotice({ kind: "saved", renamed: res.name !== sent.name.trim() ? res.name : null, of: flow });
          if (next.hash) pushHash(next.hash);
          else clearHash();
          // The setup line under the tabs names the next step (4.10); nothing redirects.
          router.refresh();
        } else if ("problems" in res) {
          const problem = res.problems[0];
          if (!problem) return setNotice({ kind: "failed" });
          setNotice({ kind: "problem", problem });
          // W8 and D10's cost: the step the refusal is about opens, in this flow or another.
          if (flowOfStep(rulesStepOf(problem)) !== flow) setOrigin((o) => o ?? flow);
          if (rulesStepOf(problem) !== step) nav.go(rulesStepOf(problem));
        } else setNotice({ kind: "code", code: res.code });
      } catch {
        setNotice({ kind: "failed" });
      }
    });
  }

  if (!route) {
    // The problems of what is saved (a decider who left), each said on its own row to whoever can fix it.
    const savedProblems = editable ? openingRulesProblems(saved, users, today, saved.deadline) : [];
    const rowProblem = (target: RulesFlow) => {
      const p = savedProblems.find((x) => RULES_FLOWS[target].includes(rulesStepOf(x)));
      return p ? t(`p${p}`) : undefined;
    };
    const team = teamLine(saved, users);
    const rows: SummaryRow[] = [
      {
        id: "team",
        icon: Users,
        label: t("teamTitle"),
        value: common("rulesTeam", { count: team.count, decider: team.decider ?? common("rulesNoDecider") }),
        detail: [saved.memberIds.map(nameOf).filter(Boolean).join(", "), team.backup ? t("backupLine", { name: team.backup }) : null]
          .filter(Boolean)
          .join(" · "),
        problem: rowProblem("team"),
        edit: { onClick: () => open("team") },
      },
      {
        id: "contact",
        icon: CalendarDays,
        label: t("candidateTitle"),
        value: common("rulesContact", { deadline: deadlineText(saved.deadline), days: saved.feedbackDays }),
        detail: saved.candidateContactEmail || t("noEmail"),
        problem: rowProblem("contact"),
        edit: { onClick: () => open("contact") },
      },
      { id: "fair", icon: EyeOff, label: t("fairTitle"), value: [blindText(saved.blindMode), surveyText(saved.finishSurveyEnabled)].join(" · "), edit: { onClick: () => open("fair") } },
      { id: "name", icon: Tag, label: t("name"), value: saved.name, problem: rowProblem("name"), edit: { onClick: () => open("name") } },
    ];
    return (
      <div className="space-y-section">
        <Card className="p-card">
          <h2 id={SUMMARY_HEADING} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-ink outline-none">
            {t("summaryTitle")}
          </h2>
          {/* Always mounted, so "Kaydedildi." is announced when a flow's save brings the summary back. */}
          <p role="status" className="text-[14px] font-medium text-ink">
            {notice?.kind === "saved" ? (notice.renamed ? t("savedRenamed", { name: notice.renamed }) : t("saved")) : ""}
          </p>
          <SummaryRows rows={rows} readOnly={!editable} changeLabel={flowT("change")} changedLabel={flowT("changed")} />
          {/* P7: the fixed rule is not a setting: a lock and a sentence. */}
          <div className="border-t border-line pt-4">
            <IconRow icon={Lock} title={t("independence")} detail={t("independenceLocked")} />
          </div>
        </Card>
        {editable ? children : null}
      </div>
    );
  }

  // W8: the server's refusal in its existing words, on the step it is about (or on the flow's save step).
  const refusal =
    notice?.kind === "problem" && rulesStepOf(notice.problem) === step
      ? t(`p${notice.problem}`)
      : (notice?.kind === "code" || notice?.kind === "failed") && step === REVIEW_STEP[flow]
        ? notice.kind === "code"
          ? t(`err${notice.code}`)
          : t("saveFailed")
        : null;
  // A save that brought the user back to the flow waiting on it names what it saved: this flow's change is still to save.
  const savedText =
    notice?.kind === "saved"
      ? savedNote(notice, flow)
          .map((part) => (part.key === "savedRenamed" ? t("savedRenamed", { name: part.name }) : part.key === "savedOther" ? t("savedOther", { flow: flowTitle[part.flow] }) : t("saved")))
          .join(" ")
      : "";
  const note = refusal ? (
    <p role="alert" className="text-[14px] font-medium text-ink">
      {refusal}
    </p>
  ) : savedText && step === REVIEW_STEP[flow] ? (
    // Seen here; announced by the flow's own status line below.
    <p className="text-[14px] font-medium text-ink">{savedText}</p>
  ) : null;

  const wait = (s: RulesStep): string | null => {
    if (s === "contact-deadline" && pickDay && !value.deadline) return t("pDEADLINE_INVALID");
    const problem = stepWait(s, value, check);
    return problem ? t(`p${problem}`) : null;
  };
  const forward: FlowStep["primary"] = {
    kind: "button",
    id: "rules-next",
    label: fromSummary ? flowT("backToSummary") : flowT("continue"),
    waitReason: wait(step),
    onClick: () => nav.go(fromSummary ? REVIEW_STEP[flow] : steps[index + 1]),
  };
  const whole = openingRulesProblems(saveInput(saved, value, flow), users, today, saved.deadline);
  // D10's cost: a saved value of another flow that no longer holds (a decider who left) stops this save; it is fixed there.
  const elsewhere = otherFlowProblem(whole, flow);
  const saveAction: FlowStep["primary"] = {
    kind: "button",
    id: "rules-save",
    label: t("save"),
    busy: pending,
    busyLabel: t("saving"),
    waitReason: saveWait(changed) ? flowT("noChanges") : whole[0] ? t(`p${whole[0]}`) : null,
    onClick: save,
  };
  const fix =
    changed && elsewhere && !refusal && !savedText ? (
      <Button
        className="min-h-11"
        onClick={() => {
          setOrigin((o) => o ?? flow);
          edit(rulesStepOf(elsewhere));
        }}
      >
        {flowT("change")}
        <span className="sr-only">: {flowTitle[flowOfStep(rulesStepOf(elsewhere))]}</span>
      </Button>
    ) : null;
  const marks = Object.fromEntries(summaryRows(saved, value, FLOW_FIELDS[flow]).map((r) => [r.field, r.changed])) as Partial<Record<keyof OpeningRulesInput, boolean>>;
  const review = (rows: SummaryRow[], extra?: ReactNode): FlowStep => ({
    id: REVIEW_STEP[flow],
    title: t("reviewTitle"),
    layout: "split",
    primary: saveAction,
    note: note ?? fix,
    body: (
      <div className="space-y-4">
        <SummaryRows rows={rows} changeLabel={flowT("change")} changedLabel={flowT("changed")} />
        {extra}
      </div>
    ),
  });

  const screens: Record<RulesStep, () => FlowStep> = {
    "team-members": () => ({
      id: "team-members",
      title: t("stepMembersTitle"),
      lead: <p>{t("membersHint")}</p>,
      layout: "split",
      illustration: "emptyCandidates",
      primary: forward,
      note,
      body: (
        <div className="space-y-3">
          <ChoiceCardGroup
            type="multi"
            name="rules-members"
            look="panel"
            value={value.memberIds}
            onChange={(ids) => set("memberIds", ids)}
            // A disabled person can be taken off the panel but not put back on it.
            items={panel.map((u) => personCard(u, u.disabled && !value.memberIds.includes(u.id)))}
          />
          {/* Mockup 6: how many are chosen, said politely as it changes. */}
          {activeReviewers > 0 ? (
            <p aria-live="polite" className="flex items-center gap-1.5 text-[14px] text-accent">
              <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t("membersCount", { count: activeReviewers })}
            </p>
          ) : (
            <p aria-live="polite" className="text-[14px] text-ink">
              {t("membersCount", { count: activeReviewers })}
            </p>
          )}
        </div>
      ),
    }),
    "team-decider": () => ({
      id: "team-decider",
      title: t("stepDeciderTitle"),
      lead: <p>{t("decisionMakerHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <div className="space-y-4">
          <ChoiceCardGroup type="single" name="rules-decider" look="panel" value={value.decisionMakerId ? [value.decisionMakerId] : []} onChange={([id]) => set("decisionMakerId", id ?? null)} items={deciderItems(value.decisionMakerId)} />
          <Disclosure label={t("backup")} defaultOpen={value.backupDecisionMakerId !== null}>
            <ChoiceCardGroup
              type="single"
              name="rules-backup"
              look="panel"
              value={[value.backupDecisionMakerId ?? NONE]}
              onChange={([id]) => set("backupDecisionMakerId", !id || id === NONE ? null : id)}
              items={[{ value: NONE, label: t("noBackup") }, ...deciderItems(value.backupDecisionMakerId)]}
            />
          </Disclosure>
        </div>
      ),
    }),
    "team-review": () =>
      review([
        { id: "members", label: t("members"), value: value.memberIds.map(nameOf).filter(Boolean).join(", ") || "-", changed: marks.memberIds, edit: { onClick: () => edit("team-members") } },
        {
          id: "decider",
          label: t("decisionMaker"),
          value: nameOf(value.decisionMakerId) ?? "-",
          detail: value.backupDecisionMakerId ? t("backupLine", { name: nameOf(value.backupDecisionMakerId) ?? "-" }) : undefined,
          changed: marks.decisionMakerId || marks.backupDecisionMakerId,
          edit: { onClick: () => edit("team-decider") },
        },
      ]),
    "contact-deadline": () => ({
      id: "contact-deadline",
      title: t("stepDeadlineTitle"),
      lead: <p>{t("deadlineHint", { zone })}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <div className="space-y-4">
          <ChoiceCardGroup
            type="single"
            name="rules-deadline"
            look="panel"
            value={[pickDay ? "day" : NONE]}
            onChange={([v]) => {
              setPickDay(v === "day");
              if (v !== "day") set("deadline", null);
            }}
            items={[
              { value: NONE, label: t("deadlineNone") },
              { value: "day", label: t("deadlinePick") },
            ]}
          />
          {pickDay ? (
            <div className="space-y-2">
              <Label htmlFor="rules-deadline-day">{t("deadline")}</Label>
              <Input
                id="rules-deadline-day"
                type="date"
                className="tnum w-56 text-[16px]"
                // The earliest day applies only to a new value; a passed deadline left as it is stays valid.
                min={value.deadline === saved.deadline ? undefined : today}
                value={value.deadline ?? ""}
                onChange={(e) => set("deadline", e.target.value || null)}
              />
            </div>
          ) : null}
        </div>
      ),
    }),
    "contact-feedback": () => ({
      id: "contact-feedback",
      title: t("stepFeedbackTitle"),
      lead: <p className="tnum">{t("feedbackHint", { days: Number.isNaN(value.feedbackDays) ? "-" : value.feedbackDays })}</p>,
      layout: "single",
      primary: forward,
      note,
      body: (
        <div className="space-y-3">
          <Label htmlFor="rules-feedback">{t("feedbackDays")}</Label>
          <Input
            id="rules-feedback"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            className="tnum w-32 text-[16px]"
            value={feedbackText}
            onChange={(e) => {
              setFeedbackText(e.target.value);
              set("feedbackDays", wholeNumber(e.target.value));
            }}
          />
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14].map((days) => (
              <Button
                key={days}
                className="min-h-11"
                aria-pressed={value.feedbackDays === days}
                onClick={() => {
                  setFeedbackText(String(days));
                  set("feedbackDays", days);
                }}
              >
                {t("feedbackQuick", { days })}
              </Button>
            ))}
          </div>
        </div>
      ),
    }),
    "contact-email": () => ({
      id: "contact-email",
      title: t("stepEmailTitle"),
      lead: <p>{t("emailLead")}</p>,
      layout: "single",
      primary: forward,
      note,
      body: (
        <div className="space-y-2">
          <Label htmlFor="rules-email">{t("contactEmail")}</Label>
          <Input id="rules-email" type="email" autoComplete="off" maxLength={200} className="text-[16px]" value={value.candidateContactEmail} onChange={(e) => set("candidateContactEmail", e.target.value)} />
        </div>
      ),
    }),
    "contact-review": () =>
      review([
        { id: "deadline", label: t("deadline"), value: deadlineText(value.deadline), changed: marks.deadline, edit: { onClick: () => edit("contact-deadline") } },
        {
          id: "feedback",
          label: t("feedbackDays"),
          value: <span className="tnum">{Number.isNaN(value.feedbackDays) ? "-" : value.feedbackDays}</span>,
          changed: marks.feedbackDays,
          edit: { onClick: () => edit("contact-feedback") },
        },
        { id: "email", label: t("contactEmail"), value: value.candidateContactEmail || t("noEmail"), changed: marks.candidateContactEmail, edit: { onClick: () => edit("contact-email") } },
      ]),
    "fair-blind": () => ({
      id: "fair-blind",
      title: t("stepBlindTitle"),
      lead: <p>{t("blindModeHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <ChoiceCardGroup
          type="single"
          name="rules-blind"
          look="panel"
          value={[value.blindMode ? "hide" : "show"]}
          onChange={([v]) => set("blindMode", v === "hide")}
          items={[
            { value: "show", label: t("blindShow") },
            { value: "hide", label: t("blindHide") },
          ]}
        />
      ),
    }),
    "fair-survey": () => ({
      id: "fair-survey",
      title: t("stepSurveyTitle"),
      lead: <p>{t("finishSurveyHint")}</p>,
      layout: "split",
      primary: forward,
      note,
      body: (
        <ChoiceCardGroup
          type="single"
          name="rules-survey"
          look="panel"
          value={[(value.finishSurveyEnabled ?? true) ? "on" : "off"]}
          onChange={([v]) => set("finishSurveyEnabled", v === "on")}
          items={[
            { value: "on", label: t("surveyOn") },
            { value: "off", label: t("surveyOff") },
          ]}
        />
      ),
    }),
    "fair-review": () =>
      review(
        [
          { id: "blind", label: t("blindMode"), value: blindText(value.blindMode), changed: marks.blindMode, edit: { onClick: () => edit("fair-blind") } },
          { id: "survey", label: t("finishSurvey"), value: surveyText(value.finishSurveyEnabled), changed: marks.finishSurveyEnabled, edit: { onClick: () => edit("fair-survey") } },
        ],
        <IconRow icon={Lock} title={t("independence")} detail={t("independenceLocked")} />,
      ),
    // H2: one field, one step, its own "Kaydet".
    name: () => ({
      id: "name",
      title: t("stepNameTitle"),
      layout: "single",
      primary: saveAction,
      note: note ?? fix,
      body: (
        <div className="space-y-2">
          <Label htmlFor="rules-name">{t("name")}</Label>
          <Input id="rules-name" maxLength={200} className="text-[16px]" value={value.name} onChange={(e) => set("name", e.target.value)} />
        </div>
      ),
    }),
  };

  return (
    <div id={FLOW_AREA}>
      <GuidedFlow
        kicker={`${common("tabSettings")} · ${flowTitle[flow]}`}
        step={screens[step]()}
        journey={steps.length > 1 ? flowJourney(steps, step) : null}
        back={index === 0 ? { label: flowT("backToSummary"), onClick: leaveHashStep } : { label: flowT("back"), onClick: back }}
        exit={{ dirty: unsaved, onClick: clearHash }}
        enter={nav.moved}
      />
      {/* Always mounted while a flow shows, so "Kaydedildi." is announced when a save brings back the flow that waited on it. */}
      <p role="status" className="sr-only">
        {savedText}
      </p>
    </div>
  );
}
