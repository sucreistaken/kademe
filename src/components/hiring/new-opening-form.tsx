"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { clarifyRoleAction, createOpeningAction } from "@/app/(manager)/hiring/openings/new/actions";
import { alternativeStarts, type AlternativeStart } from "./start-choices";
import { TemplateGallery, type TemplateOption } from "./template-gallery";
import {
  afterCreate,
  answersOf,
  CLARIFY_COPY,
  jobDescriptionOf,
  matchPosition,
  newOpeningStepOf,
  newOpeningStepOfRefusal,
  newOpeningSteps,
  roundsToFinish,
  suggestedPositions,
  templateForPosition,
  wizardJourney,
  type ClarifyCode,
  type NewOpeningRefusal,
  type RoleQuestion,
  type RoleRound,
  type WizardStart,
} from "./new-opening-steps";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };

/** The role text the AI reads; the server takes up to 2000 characters. */
const ROLE_TEXT_MAX = 2000;
const ANSWER_MAX = 500;

const LINK =
  "inline-flex min-h-11 items-center gap-0.5 text-left text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink disabled:text-muted disabled:no-underline";
const CHIP =
  "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[14px] transition-colors duration-[120ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Phase = "describe" | "asking" | "brief";
type Brief = { summary: string[]; jobAd: string };

/**
 * HIRING-UX 5.20 step 1 "Rolü anlat": the position's name and a few words,
 * then "Devam". The AI either asks a few short questions (cards with answer
 * chips and "Başka" for own words, on the same screen; "Bu kadar yeter, devam
 * et" stops it) or writes a 3-5 bullet summary, which "Düzelt" edits in place.
 * "Soruları hazırla" opens the opening with the AI's job ad and goes on to
 * step 2. The other starts sit under it as plain links, each doing what it
 * says: a ready template (its gallery), copying an earlier opening (only when
 * there is one) and writing the questions yourself.
 */
export function NewOpeningForm({
  positions,
  sources,
  templates,
  initialPositionId,
  initialCopyId,
}: {
  positions: PositionOption[];
  sources: Array<{ id: string; name: string; detail: string }>;
  templates: TemplateOption[];
  initialPositionId: string | null;
  initialCopyId: string | null;
}) {
  const t = useMT("hiringWizard");
  const old = useMT("hiringNew");
  const common = useMT("hiringCommon");
  const flow = useMT("flow");
  const router = useRouter();
  const initialPicked = positions.find((p) => p.id === initialPositionId) ?? null;
  // Only a source this organisation may copy from (the page's list) is preselected.
  const copySource = initialCopyId && sources.some((s) => s.id === initialCopyId) ? initialCopyId : "";

  const [name, setName] = useState(initialPicked?.name ?? "");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("describe");
  const [rounds, setRounds] = useState<RoleRound[]>([]);
  const [questions, setQuestions] = useState<RoleQuestion[]>([]);
  const [chips, setChips] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState<Brief | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [aiError, setAiError] = useState<ClarifyCode | "NETWORK" | null>(null);
  const [refusal, setRefusal] = useState<NewOpeningRefusal | null>(null);
  const [chosenTemplate, setChosenTemplate] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState(copySource);
  const [asking, startAsking] = useTransition();
  const [creating, startCreating] = useTransition();
  const [creatingStart, setCreatingStart] = useState<WizardStart | null>(null);

  const steps = newOpeningSteps({ hasCopySources: sources.length > 0 });
  const nav = useFlowStep({ steps, firstInvalid: null, mode: "hash" });
  const step = newOpeningStepOf(`#${nav.step}`, steps);
  // "Önceki bir alımın sorularını kopyala" on an opening's menu (?copy=) opens the copy screen once.
  useEffect(() => {
    if (copySource) nav.go("copy");
    // Only on arrival; the manager moves on from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmed = name.trim();
  const library = matchPosition(positions, trimmed);
  const suggestions = suggestedPositions(positions, trimmed);
  const template = templates.find((x) => x.key === chosenTemplate) ?? templateForPosition(templates, trimmed);
  const source = sources.find((s) => s.id === copyFrom) ?? null;
  const dirty = trimmed !== (initialPicked?.name ?? "") || text.trim() !== "" || rounds.length > 0;
  const busy = asking || creating;

  function resetConversation() {
    setPhase("describe");
    setRounds([]);
    setQuestions([]);
    setChips({});
    setTyped({});
    setBrief(null);
    setSummary([]);
    setEditing(null);
    setAiError(null);
  }

  function ask(nextRounds: RoleRound[]) {
    setAiError(null);
    setRefusal(null);
    startAsking(async () => {
      try {
        const res = await clarifyRoleAction({ positionName: trimmed, text: text.trim(), rounds: nextRounds });
        if (!res.ok) {
          setAiError(res.code);
          return;
        }
        setRounds(nextRounds);
        setChips({});
        setTyped({});
        if (res.result.kind === "questions") {
          setQuestions(res.result.questions);
          setPhase("asking");
        } else {
          setQuestions([]);
          setBrief({ summary: res.result.summary, jobAd: res.result.jobAd });
          setSummary(res.result.summary);
          setPhase("brief");
        }
      } catch {
        setAiError("NETWORK");
      }
    });
  }

  const answeredRound = (): RoleRound => ({ questions, answers: answersOf(questions, chips, typed) });

  /** The position createOpeningAction gets: the library's when the name is one of its positions, otherwise a new one. */
  function positionFor(positionName: string) {
    const match = matchPosition(positions, positionName);
    return match ? ({ kind: "existing", id: match.id } as const) : ({ kind: "new", name: positionName, jobDescription: "" } as const);
  }

  function create(start: WizardStart) {
    setRefusal(null);
    setCreatingStart(start);
    const positionName = start === "TEMPLATE" ? trimmed || template?.name || "" : start === "COPY" ? trimmed || (source?.name.split(" · ")[0] ?? "") : trimmed;
    // The AI start's ad fills the position only where it has none (createOpening).
    const jobAd = start === "AI" && brief ? jobDescriptionOf(brief, summary, POSITION_JOB_AD_MAX) : null;
    startCreating(async () => {
      try {
        const result = await createOpeningAction({
          position: positionFor(positionName),
          start,
          ...(jobAd ? { jobAd } : {}),
          copyFrom: start === "COPY" ? copyFrom : null,
          ...(start === "TEMPLATE" ? { templateKey: template?.key ?? null } : {}),
        });
        if (result.ok) router.push(afterCreate(result.next, start));
        else {
          // W8: the refusal opens the screen it is about, with its sentence there.
          setRefusal(result.code);
          const at = newOpeningStepOfRefusal(result.code);
          if (at !== step) nav.go(at);
        }
      } catch {
        setRefusal("FAILED");
      }
    });
  }

  const refusalText: Record<NewOpeningRefusal, string> = {
    POSITION_NAME_REQUIRED: t("needName"),
    POSITION_NOT_FOUND: old("positionGone"),
    JOB_AD_REQUIRED: t("needJobAd"),
    COPY_SOURCE_NOT_FOUND: old("copySourceGone"),
    TEMPLATE_NOT_FOUND: old("templateGone"),
    INVALID: old("failed"),
    FAILED: old("failed"),
  };
  const note =
    refusal && newOpeningStepOfRefusal(refusal) === step ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {refusalText[refusal]}
      </p>
    ) : null;

  function alternative(a: AlternativeStart) {
    if (a.value === "TEMPLATE") nav.go("template");
    else if (a.value === "COPY") nav.go("copy");
    else create("BLANK");
  }

  const alternatives = (
    <nav aria-labelledby="wizard-alt-title" className="space-y-1 border-t border-line pt-4">
      <p id="wizard-alt-title" className="text-[13px] text-muted">
        {t("altTitle")}
      </p>
      <ul className="flex flex-col items-start">
        {alternativeStarts({ hasCopySources: sources.length > 0 }).map((a) => (
          <li key={a.value}>
            <button
              type="button"
              id={`wizard-alt-${a.value.toLowerCase()}`}
              className={LINK}
              disabled={busy || (a.value === "BLANK" && !trimmed)}
              aria-describedby={a.value === "BLANK" && !trimmed ? "wizard-alt-blank-why" : undefined}
              onClick={() => alternative(a)}
            >
              {creating && creatingStart === a.value ? t("creating") : t(a.label)}
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            {a.value === "BLANK" && !trimmed ? (
              <span id="wizard-alt-blank-why" className="sr-only">
                {t("needName")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );

  const aiNote = aiError ? (
    <p role="alert" className="text-[14px] leading-[22px] font-medium text-ink">
      {t(CLARIFY_COPY[aiError])}
    </p>
  ) : null;

  // The name and the words, once sent: one line with "Değiştir" back to them (the conversation starts over).
  const recap =
    phase === "describe" ? null : (
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[10px] bg-canvas px-4 py-3">
        <p className="min-w-0 text-[14px] leading-[22px] text-ink-2">
          <span className="font-semibold text-ink">{trimmed}</span>
          {text.trim() ? <span className="break-words">{` · ${text.trim()}`}</span> : null}
        </p>
        <button type="button" className={LINK} disabled={busy} onClick={resetConversation}>
          {flow("change")}
        </button>
      </div>
    );

  const describeBody = (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="wizard-position">{t("positionName")}</Label>
        <Input
          id="wizard-position"
          maxLength={POSITION_NAME_MAX}
          placeholder={t("positionPlaceholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setRefusal(null);
          }}
          className="h-11 text-[16px]"
        />
        {suggestions.length ? (
          <div className="space-y-1">
            <p id="wizard-library-label" className="text-[13px] text-muted">
              {t("fromLibrary")}
            </p>
            <div role="group" aria-labelledby="wizard-library-label" className="flex flex-wrap gap-2">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={library?.id === p.id}
                  onClick={() => setName(p.name)}
                  className={cn(CHIP, library?.id === p.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-canvas")}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {library ? <p className="text-[13px] text-muted">{t("libraryPicked")}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="wizard-role-text">{t("roleText")}</Label>
        <Textarea
          id="wizard-role-text"
          rows={3}
          maxLength={ROLE_TEXT_MAX}
          placeholder={t("rolePlaceholder")}
          aria-describedby="wizard-role-text-hint"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-[16px]"
        />
        <p id="wizard-role-text-hint" className="text-[13px] text-muted">
          {t("roleTextHint")}
        </p>
      </div>
    </div>
  );

  const askingBody = (
    <div className="space-y-4">
      <p className="text-[14px] leading-[22px] text-ink-2">{t("askLead")}</p>
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const labelId = `wizard-q-${i}`;
          return (
            <li key={q.key} className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <p id={labelId} className="text-[15px] leading-[22px] font-semibold text-ink">
                {q.text}
              </p>
              {q.options.length ? (
                <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
                  {q.options.map((option) => {
                    const on = chips[q.key] === option && !(typed[q.key] ?? "").trim();
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => {
                          setChips((c) => ({ ...c, [q.key]: c[q.key] === option ? "" : option }));
                          setTyped((x) => ({ ...x, [q.key]: "" }));
                        }}
                        className={cn(CHIP, on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-canvas")}
                      >
                        {on ? <Check className="size-4" strokeWidth={2} aria-hidden /> : null}
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {q.allowFree ? (
                <div className="space-y-1">
                  <Label htmlFor={`${labelId}-own`} className="text-[13px] text-muted">
                    {q.options.length ? t("other") : t("yourAnswer")}
                  </Label>
                  <Input
                    id={`${labelId}-own`}
                    maxLength={ANSWER_MAX}
                    placeholder={t("otherPlaceholder")}
                    value={typed[q.key] ?? ""}
                    disabled={busy}
                    onChange={(e) => setTyped((x) => ({ ...x, [q.key]: e.target.value }))}
                    className="h-10 text-[15px]"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <button type="button" id="wizard-enough" className={LINK} disabled={busy} onClick={() => ask(roundsToFinish([...rounds, answeredRound()]))}>
        {t("enough")}
        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );

  const briefBody = (
    <section aria-labelledby="wizard-brief-title" className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 id="wizard-brief-title" className="text-[15px] leading-[22px] font-semibold text-ink">
        {t("briefTitle")}
      </h2>
      <ul className="divide-y divide-line">
        {summary.map((line, i) => (
          <li key={i} className="flex min-h-11 items-center gap-3 py-1.5">
            <Check className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
            {editing === i ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditing(null);
                }}
              >
                <Input
                  autoFocus
                  aria-label={t("briefLine", { n: i + 1 })}
                  maxLength={200}
                  value={line}
                  onChange={(e) => setSummary((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                  className="h-10 flex-1 text-[15px]"
                />
                <button type="submit" className={LINK}>
                  {t("done")}
                </button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-[15px] leading-[22px] text-ink">{line}</span>
                <button type="button" className={LINK} aria-label={`${t("fix")}: ${line}`} disabled={busy} onClick={() => setEditing(i)}>
                  {t("fix")}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  const roleScreen: FlowStep = {
    id: "role",
    title: t("roleTitle"),
    lead: phase === "describe" ? <p>{t("roleLead")}</p> : undefined,
    layout: "single",
    primary:
      phase === "brief"
        ? { kind: "button", id: "wizard-next", label: t("prepare"), busy: creating && creatingStart === "AI", busyLabel: t("creating"), onClick: () => create("AI") }
        : {
            kind: "button",
            id: "wizard-next",
            label: flow("continue"),
            busy: asking,
            busyLabel: t("thinking"),
            waitReason: trimmed ? (creating ? t("creating") : null) : t("needName"),
            onClick: () => ask(phase === "asking" ? [...rounds, answeredRound()] : []),
          },
    note,
    body: (
      <div className="space-y-6">
        {recap}
        {phase === "describe" ? describeBody : phase === "asking" ? askingBody : briefBody}
        {aiNote}
        {alternatives}
      </div>
    ),
  };

  const templateScreen: FlowStep = {
    id: "template",
    title: old("stepTemplateTitle"),
    lead: <p>{old("stepTemplateLead")}</p>,
    layout: "single",
    primary: {
      kind: "button",
      id: "wizard-next",
      label: t("useTemplate"),
      busy: creating,
      busyLabel: t("creating"),
      waitReason: template ? null : old("needTemplate"),
      onClick: () => create("TEMPLATE"),
    },
    note,
    body: (
      <TemplateGallery
        templates={templates}
        value={template?.key ?? null}
        onChange={(key) => {
          setChosenTemplate(key);
          setRefusal(null);
        }}
      />
    ),
  };

  const copyScreen: FlowStep = {
    id: "copy",
    title: t("copyTitle"),
    lead: <p>{t("copyLead")}</p>,
    layout: "single",
    primary: {
      kind: "button",
      id: "wizard-next",
      label: t("useCopy"),
      busy: creating,
      busyLabel: t("creating"),
      waitReason: copyFrom ? null : old("needCopySource"),
      onClick: () => create("COPY"),
    },
    note,
    body: (
      <div className="space-y-2">
        <Label htmlFor="wizard-copy">{old("copyFrom")}</Label>
        <Select value={copyFrom} onValueChange={setCopyFrom}>
          <SelectTrigger id="wizard-copy" className="w-full">
            <SelectValue placeholder={old("copyFrom")} />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="truncate">{s.name}</span>
                <span className="tnum truncate text-muted">{s.detail}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ),
  };

  const screens: Record<typeof step, FlowStep> = { role: roleScreen, template: templateScreen, copy: copyScreen };

  return (
    <GuidedFlow
      kicker={old("title")}
      step={screens[step]}
      journey={wizardJourney(step)}
      back={step === "role" ? { label: common("back"), href: "/hiring/openings" } : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty, href: "/hiring/openings" }}
      enter={nav.moved}
    />
  );
}
