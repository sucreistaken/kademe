"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Eye, EyeOff, FilePlus, Gauge, LayoutTemplate, Minus, Monitor, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { createExamAction, type CreateExamResult } from "@/app/(manager)/exam/exams/actions";
import {
  clampMinutes,
  EXAM_WIZARD_STEPS,
  orderTemplates,
  RECOMMENDED_TEMPLATE,
  sectionChoices,
  sectionKind,
  sectionsWait,
  startDraft,
  totalMinutes,
  wizardConfig,
  type ExamStart,
  type ExamWizardStep,
  type SectionChoice,
  type WizardTemplate,
} from "@/app/(manager)/exam/exams/new/wizard-model";
import { flowJourney } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { SummaryRows } from "@/components/manager/summary-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { StepScreen } from "@/components/visual/step-screen";
import { useMT } from "@/i18n/manager-client";
import { bankCoverage, type BankCount } from "@/lib/exam/blueprint";
import type { ExamMode } from "@/lib/exam/types";
import { requiredChecks, type PolicyPreset } from "@/lib/proctor/policy";
import { cn } from "@/lib/cn";

/** One ready template, in the manager's language, with its config for the later steps. */
export type ExamTemplateCard = WizardTemplate & { summary: string; meta: string };

const ICONS: Record<string, LucideIcon> = { "quick-screen": Gauge, placement: LayoutTemplate, "level-check": ClipboardCheck };
const PRESET_ICONS: Record<PolicyPreset, LucideIcon> = { OFF: EyeOff, STANDARD: Eye, STRICT: ShieldCheck };
const PRESETS_SHOWN: PolicyPreset[] = ["OFF", "STANDARD", "STRICT"];
const BLANK = "blank";
const PILL = "ml-1 inline-block rounded-full bg-accent-soft px-2 align-[2px] text-[12px] leading-5 font-semibold text-accent group-has-[:checked]/choice:bg-surface";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 hover:decoration-ink";

/**
 * "Sınav oluştur" as a guided flow, the hiring setup wizard's way (one
 * decision per step, the step in the address's hash, "Adım n / 4", the
 * summary's "Değiştir" back to a step). Start: a ready template (the
 * placement test first, "Önerilen") or blank. Sections: each one on or off
 * and its minutes, with one plain sentence on how it asks. Proctoring: three
 * levels and the note that a computer is needed. Last look: the name, what
 * the student will go through, the bank check, then "Yayınla" (or a draft
 * that opens the editor for the finer settings).
 */
export function NewExamWizard({ templates, counts }: { templates: ExamTemplateCard[]; counts: BankCount[] }) {
  const t = useMT("examWizard");
  const ex = useMT("exams");
  const sec = useMT("sectionName");
  const m = useMT("mode");
  const flow = useMT("flow");
  const router = useRouter();
  const ordered = useMemo(() => orderTemplates(templates), [templates]);
  const firstStart: ExamStart = ordered.some((x) => x.key === RECOMMENDED_TEMPLATE) ? { kind: "template", key: RECOMMENDED_TEMPLATE } : ordered[0] ? { kind: "template", key: ordered[0].key } : { kind: "blank", mode: "PLACEMENT" };
  const firstDraft = startDraft(firstStart, ordered)!;

  const [start, setStart] = useState<ExamStart>(firstStart);
  const [blankMode, setBlankMode] = useState<ExamMode>("PLACEMENT");
  const [choices, setChoices] = useState<SectionChoice[]>(sectionChoices(firstDraft.config));
  const [preset, setPreset] = useState<PolicyPreset>(firstDraft.config.proctoring.preset);
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [fromSummary, setFromSummary] = useState(false);
  const [refusal, setRefusal] = useState<Extract<CreateExamResult, { ok: false }>["code"] | null>(null);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const [pending, startCreating] = useTransition();
  const [creating, setCreating] = useState<"publish" | "draft" | null>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  const draft = startDraft(start, ordered) ?? firstDraft;
  const template = start.kind === "template" ? (ordered.find((x) => x.key === start.key) ?? null) : null;
  const config = wizardConfig(draft.config, choices, preset);
  const missing = bankCoverage(counts, config, draft.mode, null).rows.filter((r) => !r.ok);
  const sectionsReason = sectionsWait(choices);
  const nav = useFlowStep({ steps: EXAM_WIZARD_STEPS, firstInvalid: sectionsReason ? "sections" : null, mode: "hash" });
  const step = nav.step;

  /** A new start brings its own sections and watching level; the name stays as typed. */
  function pickStart(next: ExamStart) {
    const d = startDraft(next, ordered);
    if (!d) return;
    setStart(next);
    setChoices(sectionChoices(d.config));
    setPreset(d.config.proctoring.preset);
    setTouched(true);
    setRefusal(null);
  }

  function setChoice(section: SectionChoice["section"], patch: Partial<SectionChoice>) {
    setChoices((all) => all.map((c) => (c.section === section ? { ...c, ...patch } : c)));
    setTouched(true);
    setRefusal(null);
  }

  /** "Devam et", or "Özete dön" when the step was opened from the summary. */
  function next(from: ExamWizardStep) {
    if (fromSummary) {
      setFromSummary(false);
      nav.go("review");
      return;
    }
    nav.go(EXAM_WIZARD_STEPS[Math.min(EXAM_WIZARD_STEPS.length - 1, EXAM_WIZARD_STEPS.indexOf(from) + 1)]);
  }

  const change = (to: ExamWizardStep) => () => {
    setFromSummary(true);
    nav.go(to);
  };

  function create(publish: boolean) {
    setRefusal(null);
    setCreating(publish ? "publish" : "draft");
    startCreating(async () => {
      try {
        const r = await createExamAction({ start, name, sections: choices, preset, publish });
        if (!r.ok) {
          setRefusal(r.code);
          if (r.code === "NO_SECTION") nav.go("sections");
          else if (r.code === "TEMPLATE") nav.go("start");
          return;
        }
        if (r.status === "DRAFT") router.push(`/exam/exams/${r.id}`);
        else {
          setDone({ id: r.id, name: r.name });
          window.setTimeout(() => doneHeading.current?.focus(), 0);
        }
      } catch {
        setRefusal("FAILED");
      }
    });
  }

  if (done) {
    return (
      <StepScreen layout="single" width={640} illustration="done" illustrationSize="spot" title={t("doneTitle", { name: done.name })} titleRef={doneHeading} lead={<p>{t("doneLead")}</p>}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-4">
          <Link href="/exam/exams" className={LINK}>
            {t("toList")}
          </Link>
          <Link href={`/exam/exams/${done.id}`} className={LINK}>
            {t("open")}
          </Link>
          <Button asChild variant="primary" size="lg" className="ml-auto">
            <Link href={`/exam/students/new?exam=${done.id}`}>{t("invite")}</Link>
          </Button>
        </div>
      </StepScreen>
    );
  }

  const refusalNote = refusal ? (
    <p role="alert" className="text-[14px] font-medium text-ink">
      {t(`err${refusal}`)}
    </p>
  ) : null;
  const primaryLabel = fromSummary ? flow("backToSummary") : flow("continue");
  const startValue = start.kind === "template" ? start.key : BLANK;
  const total = totalMinutes(choices);
  // The device checks the level asks for; the browser check every exam has is not news.
  const checks = requiredChecks(config.proctoring).filter((c) => c.required && c.id !== "BROWSER");
  const missingList = missing
    .slice(0, 4)
    .map((r) => `${sec(r.section)} ${r.level}`)
    .join(", ")
    .concat(missing.length > 4 ? ` +${missing.length - 4}` : "");

  const screens: Record<ExamWizardStep, FlowStep> = {
    start: {
      id: "start",
      title: t("startTitle"),
      lead: <p>{t("startLead")}</p>,
      layout: "single",
      primary: { kind: "button", id: "exam-next", label: primaryLabel, onClick: () => next("start") },
      note: refusal === "TEMPLATE" ? refusalNote : null,
      body: (
        <div className="space-y-6">
          <p id="exam-start-label" className="sr-only">
            {t("startTitle")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="exam-start"
            labelledBy="exam-start-label"
            look="panel-lg"
            value={[startValue]}
            onChange={([v]) => pickStart(!v || v === BLANK ? { kind: "blank", mode: blankMode } : { kind: "template", key: v })}
            items={[
              ...ordered.map((c) => ({
                value: c.key,
                marker: ICONS[c.key] ?? LayoutTemplate,
                label:
                  c.key === RECOMMENDED_TEMPLATE ? (
                    <>
                      {c.name} <span className={PILL}>{t("recommended")}</span>
                    </>
                  ) : (
                    c.name
                  ),
                description: (
                  <>
                    {c.summary}
                    <span className="mt-1 block text-[13px] text-muted">{c.meta}</span>
                  </>
                ),
              })),
              { value: BLANK, marker: FilePlus, label: t("blankTitle"), description: t("blankBody") },
            ]}
          />
          {start.kind === "blank" ? (
            <div className="space-y-3">
              <p id="exam-mode-label" className="text-[14px] font-medium text-ink">
                {t("modeLabel")}
              </p>
              <ChoiceCardGroup
                type="single"
                name="exam-mode"
                labelledBy="exam-mode-label"
                look="panel"
                columns={2}
                value={[start.mode]}
                onChange={([v]) => {
                  const mode: ExamMode = v === "LEVEL_VERIFICATION" ? "LEVEL_VERIFICATION" : "PLACEMENT";
                  setBlankMode(mode);
                  pickStart({ kind: "blank", mode });
                }}
                items={(["PLACEMENT", "LEVEL_VERIFICATION"] as const).map((x) => ({
                  value: x,
                  label: m(x),
                  description: x === "PLACEMENT" ? ex("placementDesc") : ex("verificationDesc"),
                }))}
              />
            </div>
          ) : null}
        </div>
      ),
    },
    sections: {
      id: "sections",
      title: t("sectionsTitle"),
      lead: <p>{t("sectionsLead")}</p>,
      layout: "single",
      primary: { kind: "button", id: "exam-next", label: primaryLabel, waitReason: sectionsReason ? t("needSection") : null, onClick: () => next("sections") },
      note: refusal === "NO_SECTION" ? refusalNote : null,
      body: (
        <div className="space-y-4">
          <ul className="space-y-3">
            {draft.config.sections.map((s) => {
              const c = choices.find((x) => x.section === s.section) ?? { section: s.section, enabled: s.enabled, minutes: s.durationMinutes };
              const kind = sectionKind(s);
              const id = `exam-section-${s.section.toLowerCase()}`;
              return (
                <li key={s.section} className={cn("flex flex-wrap items-start gap-x-4 gap-y-3 rounded-[14px] border border-line bg-surface px-4 py-4", !c.enabled && "bg-canvas")}>
                  <Switch id={id} checked={c.enabled} onCheckedChange={(on) => setChoice(s.section, { enabled: on === true })} aria-describedby={`${id}-about`} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={id} className="text-[15px] font-semibold text-ink">
                      {sec(s.section)}
                    </Label>
                    <p id={`${id}-about`} className="mt-0.5 text-[13.5px] leading-5 text-ink-2">
                      {t(`about${s.section}`)} {kind === "tasks" ? t("kindTasks", { n: s.tasks }) : kind === "adaptive" ? t("kindAdaptive") : t("kindFixed")}
                    </p>
                  </div>
                  <div className={cn("flex items-center gap-1.5", !c.enabled && "opacity-50")}>
                    <Button type="button" variant="secondary" size="icon-sm" aria-label={t("minus", { section: sec(s.section) })} disabled={!c.enabled || c.minutes <= 1} onClick={() => setChoice(s.section, { minutes: clampMinutes(c.minutes - 1) })}>
                      <Minus className="size-4" strokeWidth={2} aria-hidden />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={180}
                      aria-label={t("minutesLabel", { section: sec(s.section) })}
                      disabled={!c.enabled}
                      value={c.minutes}
                      onChange={(e) => setChoice(s.section, { minutes: clampMinutes(Number(e.target.value)) })}
                      className="tnum h-9 w-16 text-center text-[15px]"
                    />
                    <Button type="button" variant="secondary" size="icon-sm" aria-label={t("plus", { section: sec(s.section) })} disabled={!c.enabled || c.minutes >= 180} onClick={() => setChoice(s.section, { minutes: clampMinutes(c.minutes + 1) })}>
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                    </Button>
                    <span className="text-[13px] text-muted">{t("minutesShort")}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className="tnum text-[15px] font-semibold text-ink">
            {t("total", { n: total })}
          </p>
        </div>
      ),
    },
    proctoring: {
      id: "proctoring",
      title: t("proctoringTitle"),
      lead: <p>{t("proctoringLead")}</p>,
      layout: "single",
      primary: { kind: "button", id: "exam-next", label: primaryLabel, onClick: () => next("proctoring") },
      body: (
        <div className="space-y-5">
          <p id="exam-proctoring-label" className="sr-only">
            {t("proctoringTitle")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="exam-proctoring"
            labelledBy="exam-proctoring-label"
            look="panel"
            value={[preset]}
            onChange={([v]) => {
              setPreset(v === "OFF" || v === "STRICT" ? v : "STANDARD");
              setTouched(true);
            }}
            items={PRESETS_SHOWN.map((p) => ({
              value: p,
              marker: PRESET_ICONS[p],
              label:
                p === draft.config.proctoring.preset ? (
                  <>
                    {t(`preset${p}`)} <span className={PILL}>{template ? t("templatePick") : t("defaultPick")}</span>
                  </>
                ) : (
                  t(`preset${p}`)
                ),
              description: t(`preset${p}Body`),
            }))}
          />
          <div className="flex gap-3 rounded-[14px] border border-line bg-canvas px-4 py-3.5">
            <Monitor className="mt-0.5 size-5 shrink-0 text-ink" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="text-[14.5px] font-semibold text-ink">{t("computerTitle")}</p>
              <p className="mt-0.5 text-[14px] leading-[22px] text-ink-2">{t("computerBody")}</p>
            </div>
          </div>
        </div>
      ),
    },
    review: {
      id: "review",
      title: t("reviewTitle"),
      lead: <p>{t("reviewLead")}</p>,
      layout: "split",
      primary: {
        kind: "button",
        id: "exam-publish",
        label: t("publish"),
        busy: pending && creating === "publish",
        busyLabel: t("publishing"),
        waitReason: missing.length ? t("waitCoverage") : pending ? t("saving") : null,
        onClick: () => create(true),
      },
      secondary: { kind: "button", id: "exam-draft", label: t("draft"), busy: pending && creating === "draft", busyLabel: t("saving"), onClick: () => create(false) },
      note: refusal && refusal !== "TEMPLATE" && refusal !== "NO_SECTION" ? refusalNote : null,
      body: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="exam-name">{t("nameLabel")}</Label>
            <Input
              id="exam-name"
              maxLength={120}
              placeholder={template?.name ?? (draft.mode === "PLACEMENT" ? t("defaultNamePlacement") : t("defaultNameVerification"))}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTouched(true);
              }}
              aria-describedby="exam-name-hint"
              className="h-11 text-[16px]"
            />
            <p id="exam-name-hint" className="text-[13px] text-muted">
              {t("nameHint")}
            </p>
          </div>
          <SummaryRows
            rows={[
              { id: "start", label: t("rowStart"), value: template ? template.name : `${t("blankTitle")} · ${m(draft.mode)}`, edit: { onClick: change("start") } },
              {
                id: "sections",
                label: t("rowSections"),
                value: choices
                  .filter((c) => c.enabled)
                  .map((c) => t("sectionMinutes", { section: sec(c.section), n: clampMinutes(c.minutes) }))
                  .join(" · "),
                detail: t("total", { n: total }),
                edit: { onClick: change("sections") },
              },
              {
                id: "proctoring",
                label: t("rowProctoring"),
                value: t(`preset${preset}`),
                detail: checks.length ? t("checks", { list: checks.map((c) => t(`check${c.id}`)).join(", ") }) : t("checksNone"),
                edit: { onClick: change("proctoring") },
              },
              { id: "device", label: t("rowDevice"), value: t("computerTitle"), detail: t("computerShort") },
            ]}
            changeLabel={flow("change")}
            changedLabel={flow("changed")}
          />
          {missing.length ? (
            <p className="text-[14px] leading-[22px] text-ink">
              {t("coverageMissing", { list: missingList })}{" "}
              <Link href="/exam/bank" className="underline underline-offset-2">
                {t("toBank")}
              </Link>
            </p>
          ) : (
            <p className="text-[14px] leading-[22px] text-muted">{t("coverageOk")}</p>
          )}
          <p className="text-[13px] leading-5 text-muted">{t("detailsHint")}</p>
        </div>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={t("kicker")}
      step={screens[step]}
      journey={flowJourney(EXAM_WIZARD_STEPS, step)}
      back={
        step === "start"
          ? { label: flow("back"), href: "/exam/exams" }
          : fromSummary
            ? {
                label: flow("back"),
                onClick: () => {
                  setFromSummary(false);
                  nav.go("review");
                },
              }
            : { label: flow("back"), onClick: () => nav.back() }
      }
      exit={{ dirty: touched, href: "/exam/exams" }}
      enter={nav.moved}
    />
  );
}
