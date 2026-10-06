"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { flowJourney } from "@/components/manager/flow-model";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { createOpeningAction } from "@/app/(manager)/hiring/openings/new/actions";
import { positionIcon } from "./position-icon";
import { startChoices, type StartValue } from "./start-choices";
import { createWait, matchPosition, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps, newOpeningSummary, POSITION_FILTER_FROM, visiblePositions, type NewOpeningRefusal, type NewOpeningStep } from "./new-opening-steps";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };

/** The card that adds a position that is not in the library yet. */
const NEW = "__new__";

/**
 * HIRING-UX 5.3 as HIRING-VISUAL-FLOW 4.6 (K12) in the look of the manager mockup (screens 3, 4): which position (cards, or a new name), the job ad
 * (a new position only, plan decision 13), how to start; one question per step
 * on GuidedFlow, every value kept across the steps and the browser's buttons.
 * The last step carries the one-line summary (H3: no separate summary step)
 * and "Alımı oluştur". createOpeningAction, its refusals and the 120-character
 * AI rule are unchanged; a refusal opens its step with its existing sentence.
 */
export function NewOpeningForm({
  positions,
  sources,
  initialPositionId,
  initialCopyId,
}: {
  positions: PositionOption[];
  sources: Array<{ id: string; name: string; detail: string }>;
  initialPositionId: string | null;
  initialCopyId: string | null;
}) {
  const t = useMT("hiringNew");
  const common = useMT("hiringCommon");
  const flow = useMT("flow");
  const router = useRouter();
  const initialPicked = positions.find((p) => p.id === initialPositionId) ?? null;
  // Only a source this organisation may copy from (the page's list) is preselected.
  const copySource = initialCopyId && sources.some((s) => s.id === initialCopyId) ? initialCopyId : "";
  // User decision 2026-10-06 (less AI): the job ad preselects nothing; only a ?copy= link is a chosen start.
  const initialStart: StartValue | null = copySource ? "COPY" : null;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PositionOption | null>(initialPicked);
  const [newName, setNewName] = useState<string | null>(null);
  // W4: the typed name stays while a library card is chosen, and comes back with "Yeni bir pozisyon".
  const [nameDraft, setNameDraft] = useState("");
  const [jobAd, setJobAd] = useState("");
  const [start, setStart] = useState<StartValue | null>(initialStart);
  const [copyFrom, setCopyFrom] = useState(copySource);
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<NewOpeningRefusal | null>(null);

  const hasAd = picked ? picked.hasJobAd : jobAd.trim().length > 0;
  // The job-ad start cannot stay chosen without an ad: it falls back to no choice (never to another start).
  const effective: StartValue | null = start === "AI" && !hasAd ? null : start;
  const positionReady = picked !== null || (newName !== null && newName.trim().length > 0);
  const steps = newOpeningSteps({ newName: picked === null && newName !== null });
  // The flow knows this path's steps, so a hash it does not show (the ad step of a library
  // position, a later step before a position is set) is rewritten to the step shown (W3).
  const nav = useFlowStep({ steps, firstInvalid: positionReady ? null : "position", mode: "hash" });
  // The same rule as the model's (tested there): the flow shows exactly this step.
  const step = newOpeningStepOf(`#${nav.step}`, { steps, positionReady });
  const index = steps.indexOf(step);
  const wait = createWait({ positionReady, start: effective, copyFrom });
  const shown = visiblePositions(positions, query, picked?.id ?? null);
  const positionValue = picked ? [picked.id] : newName !== null ? [NEW] : [];
  const dirty = picked?.id !== initialPicked?.id || newName !== null || jobAd !== "" || start !== initialStart || copyFrom !== copySource;

  const refusalText: Record<NewOpeningRefusal, string> = {
    POSITION_NAME_REQUIRED: t("needPosition"),
    POSITION_NOT_FOUND: t("positionGone"),
    JOB_AD_REQUIRED: t("startAiDisabled"),
    COPY_SOURCE_NOT_FOUND: t("copySourceGone"),
    INVALID: t("failed"),
    FAILED: t("failed"),
  };

  function choosePosition(id: string) {
    setRefusal(null);
    if (id === NEW) {
      setPicked(null);
      setNewName(nameDraft);
      return;
    }
    setPicked(positions.find((p) => p.id === id) ?? null);
    setNewName(null);
  }

  // "Devam et" on the position: a typed library name is that position (no ad step then).
  function continueFromPosition() {
    const match = picked ? null : matchPosition(positions, newName ?? "");
    if (match) {
      setPicked(match);
      setNewName(null);
      nav.go("start");
      return;
    }
    const to = steps[index + 1];
    if (to) nav.go(to);
  }

  function submit() {
    // The button waits with "Nasıl başlayacağını seç." meanwhile; the action never gets a missing start.
    if (effective === null) return;
    const chosen = effective;
    setRefusal(null);
    startTransition(async () => {
      try {
        const result = await createOpeningAction({
          position: picked ? { kind: "existing", id: picked.id } : { kind: "new", name: newName ?? "", jobDescription: jobAd },
          start: chosen,
          copyFrom: chosen === "COPY" ? copyFrom : null,
        });
        if (result.ok) router.push(result.next);
        else {
          // W8, D10: the refusal opens the step it is about, with its existing sentence there.
          setRefusal(result.code);
          const at = newOpeningStepOfRefusal(result.code);
          if (at !== step) nav.go(at);
        }
      } catch {
        setRefusal("FAILED");
      }
    });
  }

  const note =
    refusal && newOpeningStepOfRefusal(refusal) === step ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {refusalText[refusal]}
      </p>
    ) : null;
  const next = (to: NewOpeningStep | undefined) => () => {
    if (to) nav.go(to);
  };

  const choices = startChoices({ hasCopySources: sources.length > 0 });
  const summary = newOpeningSummary({ name: picked?.name ?? (newName ?? "").trim(), hasAd, start: effective, copyName: sources.find((s) => s.id === copyFrom)?.name ?? null })
    .map((part) => ("text" in part ? part.text : part.key === "summaryCopy" ? t(part.key, { name: part.name }) : t(part.key)))
    .join(" · ");

  const screens: Record<NewOpeningStep, FlowStep> = {
    position: {
      id: "position",
      title: t("stepPositionTitle"),
      lead: <p>{t("stepPositionLead")}</p>,
      layout: "split",
      illustration: "emptyOpenings",
      primary: { kind: "button", id: "new-opening-next", label: flow("continue"), waitReason: positionReady ? null : t("needPosition"), onClick: continueFromPosition },
      note,
      body: (
        <div className="space-y-3">
          <span id="new-opening-position-label" className="sr-only">
            {t("stepPositionTitle")}
          </span>
          {positions.length > POSITION_FILTER_FROM ? (
            <Input aria-label={t("positionFilter")} placeholder={t("positionFilter")} value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 text-[16px]" />
          ) : null}
          <ChoiceCardGroup
            type="single"
            name="new-opening-position"
            labelledBy="new-opening-position-label"
            look="panel"
            value={positionValue}
            onChange={([v]) => (v ? choosePosition(v) : undefined)}
            items={[
              ...shown.map((p) => ({
                value: p.id,
                label: p.name,
                marker: positionIcon(p.name),
                description: t("positionCardDetail", { count: p.competencyCount, ad: p.hasJobAd ? t("summaryAd") : t("summaryNoAd") }),
              })),
              { value: NEW, label: t("positionNew"), description: t("positionNewBody"), marker: Plus, tone: "new" as const },
            ]}
          />
          {newName !== null && !picked ? (
            <div className="space-y-2">
              <Label htmlFor="new-opening-name">{t("positionNewName")}</Label>
              <Input
                id="new-opening-name"
                maxLength={POSITION_NAME_MAX}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNewName(e.target.value);
                  setRefusal(null);
                }}
                className="h-11 text-[16px]"
              />
            </div>
          ) : null}
        </div>
      ),
    },
    ad: {
      id: "ad",
      title: t("stepAdTitle"),
      lead: <p>{t("jobAdHint")}</p>,
      // W2: a field step is the single 640px column.
      layout: "single",
      primary: { kind: "button", id: "new-opening-next", label: jobAd.trim() ? flow("continue") : t("continueWithoutAd"), onClick: next(steps[index + 1]) },
      note,
      body: (
        <div className="space-y-2">
          <Label htmlFor="new-opening-ad">{t("jobAd")}</Label>
          <Textarea id="new-opening-ad" rows={14} maxLength={POSITION_JOB_AD_MAX} value={jobAd} onChange={(e) => setJobAd(e.target.value)} className="text-[16px]" />
        </div>
      ),
    },
    start: {
      id: "start",
      title: t("stepStartTitle"),
      lead: <p>{t("stepStartLead")}</p>,
      // H3, W5: the decisions so far in one line, as the mockup's summary pill.
      aside: positionReady ? (
        <p className="inline-flex items-center gap-2 rounded-[10px] bg-accent-soft px-3 py-2 text-[14px] font-medium text-accent">
          <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          {summary}
        </p>
      ) : null,
      layout: "split",
      primary: { kind: "button", id: "new-opening-create", label: t("create"), busy: pending, busyLabel: t("creating"), waitReason: wait ? t(wait) : null, onClick: submit },
      note,
      body: (
        <div className="space-y-4">
          <span id="new-opening-start-label" className="sr-only">
            {t("stepStartTitle")}
          </span>
          <ChoiceCardGroup
            type="single"
            name="new-opening-start"
            labelledBy="new-opening-start-label"
            look="panel-lg"
            value={effective ? [effective] : []}
            onChange={([v]) => setStart((v as StartValue | undefined) ?? null)}
            items={choices.map((c) => ({
              value: c.value,
              marker: c.icon,
              label: t(c.title),
              disabled: c.value === "AI" && !hasAd,
              description:
                c.value === "AI" && !hasAd ? (
                  <>
                    {t("startAiDisabled")}
                    {/* A library position without an ad: the ad is added on the position, not here. */}
                    {picked ? (
                      <>
                        {" "}
                        <Link href={`/library/positions/${picked.id}`} className="relative z-10 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                          {t("addJobAd")}
                        </Link>
                      </>
                    ) : null}
                  </>
                ) : (
                  t(c.body)
                ),
            }))}
          />
          {effective === "COPY" ? (
            <div className="space-y-2">
              <Label htmlFor="new-opening-copy">{t("copyFrom")}</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger id="new-opening-copy" className="w-full">
                  <SelectValue placeholder={t("copyFrom")} />
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
          ) : null}
        </div>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={t("title")}
      step={screens[step]}
      journey={flowJourney(steps, step)}
      back={index === 0 ? { label: common("back"), href: "/hiring/openings" } : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty, href: "/hiring/openings" }}
      enter={nav.moved}
    />
  );
}
