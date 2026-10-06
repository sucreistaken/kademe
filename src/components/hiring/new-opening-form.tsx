"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Copy, FilePlus2, Plus, Sparkles } from "lucide-react";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { flowJourney } from "@/components/manager/flow-model";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { createOpeningAction } from "@/app/(manager)/hiring/openings/new/actions";
import { createWait, newOpeningStepOf, newOpeningStepOfRefusal, newOpeningSteps, type NewOpeningRefusal, type NewOpeningStep } from "./new-opening-steps";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };
type Start = "AI" | "COPY" | "BLANK";

const ICONS = { AI: Sparkles, COPY: Copy, BLANK: FilePlus2 } as const;
const ALL_STEPS: NewOpeningStep[] = ["position", "ad", "start"];

/**
 * HIRING-UX 5.3 as HIRING-VISUAL-FLOW 4.6 (K12): which position, the job ad
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
  const initialStart: Start = copySource ? "COPY" : "AI";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PositionOption | null>(initialPicked);
  const [newName, setNewName] = useState<string | null>(null);
  const [jobAd, setJobAd] = useState("");
  const [start, setStart] = useState<Start>(initialStart);
  const [copyFrom, setCopyFrom] = useState(copySource);
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<NewOpeningRefusal | null>(null);

  const hasAd = picked ? picked.hasJobAd : jobAd.trim().length > 0;
  // The recommended path is pre-selected, and falls back to "blank" while there is no ad.
  const effective: Start = start === "AI" && !hasAd ? "BLANK" : start;
  const positionReady = picked !== null || (newName !== null && newName.trim().length > 0);
  const steps = newOpeningSteps({ newName: picked === null && newName !== null });
  const nav = useFlowStep({ steps: ALL_STEPS, firstInvalid: positionReady ? null : "position", mode: "hash" });
  // The hash may name the ad step of a library position: the model sends it to the position step.
  const step = newOpeningStepOf(`#${nav.step}`, { steps, positionReady });
  const index = steps.indexOf(step);
  const wait = createWait({ positionReady, start: effective, copyFrom });
  const typed = query.trim();
  const exists = positions.some((p) => p.name.toLocaleLowerCase("tr") === typed.toLocaleLowerCase("tr"));
  const dirty = picked?.id !== initialPicked?.id || newName !== null || jobAd !== "" || start !== initialStart || copyFrom !== copySource;

  const refusalText: Record<NewOpeningRefusal, string> = {
    POSITION_NAME_REQUIRED: t("needPosition"),
    POSITION_NOT_FOUND: t("positionGone"),
    JOB_AD_REQUIRED: t("startAiDisabled"),
    COPY_SOURCE_NOT_FOUND: t("copySourceGone"),
    INVALID: t("failed"),
    FAILED: t("failed"),
  };

  // Closing the picker keeps what was typed: an exact match is picked, any other name
  // becomes the new position unless a position is already picked.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next || !typed) return;
    const match = positions.find((p) => p.name.toLocaleLowerCase("tr") === typed.toLocaleLowerCase("tr"));
    if (match) {
      setPicked(match);
      setNewName(null);
    } else if (!picked) {
      setPicked(null);
      setNewName(typed);
    }
  }

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      try {
        const result = await createOpeningAction({
          position: picked ? { kind: "existing", id: picked.id } : { kind: "new", name: newName ?? "", jobDescription: jobAd },
          start: effective,
          copyFrom: effective === "COPY" ? copyFrom : null,
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

  const options: Array<[Start, string, string]> = [
    ["AI", t("startAi"), t("startAiBody")],
    // "Önceki bir alımdan kopyala" is hidden while there is nothing to copy (HIRING-UX 5.3).
    ...(sources.length ? ([["COPY", t("startCopy"), t("startCopyBody")]] as Array<[Start, string, string]>) : []),
    ["BLANK", t("startBlank"), t("startBlankBody")],
  ];
  const positionName = picked?.name ?? newName ?? "";
  const summary = [
    positionName,
    hasAd ? t("summaryAd") : t("summaryNoAd"),
    effective === "AI" ? t("summaryAi") : effective === "COPY" ? t("summaryCopy", { name: sources.find((s) => s.id === copyFrom)?.name ?? "-" }) : t("summaryBlank"),
  ].join(" · ");

  const screens: Record<NewOpeningStep, FlowStep> = {
    position: {
      id: "position",
      title: t("stepPositionTitle"),
      lead: <p>{t("stepPositionLead")}</p>,
      layout: "split",
      primary: { kind: "button", id: "new-opening-next", label: flow("continue"), waitReason: positionReady ? null : t("needPosition"), onClick: next(steps[index + 1]) },
      note,
      body: (
        <div className="space-y-3">
          {/* The picker's name is the question and the choice, as the old form's heading and value were. */}
          <span id="new-opening-position-label" className="sr-only">
            {t("stepPositionTitle")}
          </span>
          <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-labelledby="new-opening-position-label new-opening-position-value"
                className="h-12 w-full justify-between font-normal"
              >
                <span id="new-opening-position-value" className={picked || newName ? "truncate text-ink" : "truncate text-muted"}>
                  {picked?.name ?? newName ?? t("positionPick")}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder={t("positionSearch")} value={query} onValueChange={setQuery} maxLength={POSITION_NAME_MAX} />
                <CommandList>
                  {/* "No position with this name" only once something is typed. */}
                  {typed ? <CommandEmpty>{t("positionNone")}</CommandEmpty> : null}
                  {positions.length ? (
                    <CommandGroup>
                      {positions.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          keywords={[p.name]}
                          data-checked={picked?.id === p.id}
                          onSelect={() => {
                            setPicked(p);
                            setNewName(null);
                            setRefusal(null);
                            setOpen(false);
                          }}
                        >
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {typed && !exists ? (
                    <CommandGroup forceMount>
                      <CommandItem
                        value={`__new__${typed}`}
                        keywords={[typed]}
                        forceMount
                        onSelect={() => {
                          setPicked(null);
                          setNewName(typed);
                          setRefusal(null);
                          setOpen(false);
                        }}
                      >
                        <Plus className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                        {t("positionCreate", { name: typed })}
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {picked ? (
            <p className="tnum text-[14px] text-muted">
              {picked.competencyCount ? t("profileSummary", { count: picked.competencyCount, weights: picked.weightsEqual ? t("weightsEqual") : t("weightsSet") }) : t("profileEmpty")}
            </p>
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
            value={[effective]}
            onChange={([v]) => setStart(v as Start)}
            items={options.map(([value, title, body]) => ({
              value,
              marker: ICONS[value],
              label: title,
              disabled: value === "AI" && !hasAd,
              description:
                value === "AI" && !hasAd ? (
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
                  body
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
          {/* H3, W5: a short create flow's last step says every decision in one line. */}
          {positionReady ? <p className="text-[14px] leading-[22px] text-ink-2">{summary}</p> : null}
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
