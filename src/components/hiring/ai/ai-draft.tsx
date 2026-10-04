"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import {
  cardCompetencies,
  draftTotalSeconds,
  isJobAdThin,
  jobAdProblem,
  pendingCompetencies,
  stagePayloadFrom,
  toggleCompetency,
  visibleProposals,
  type ActivitySuggestion,
  type CompetencySuggestion,
  type HiringDraft,
  type StageSuggestion,
} from "@/solutions/hiring/ai/draft";
import { isChoice, MAX_COMPETENCIES_PER_ACTIVITY } from "@/solutions/hiring/rules/content";
import {
  acceptCompetencyAction,
  acceptStageAction,
  generateDraftAction,
  removeAcceptedStageAction,
  undoCompetencyAction,
} from "@/app/(manager)/hiring/openings/[id]/assessment/ai/actions";
import type { AiCode } from "@/app/(manager)/hiring/openings/[id]/assessment/ai/result";
import { startDraftAction } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/actions";
import { aiRefusal } from "./refusal-copy";

/** The record without one key. */
const without = <V,>(record: Record<string, V>, key: string): Record<string, V> => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

type Outcome = { kind: "none" } | { kind: "refused"; code: AiCode | "NETWORK" } | { kind: "ready"; draft: HiringDraft; jobAd: string; budgetWarning: boolean };
type Mode = "draft" | "live" | "closed";

/** Card keys come from the model: stage and competency cards keep apart by a prefix. */
const stageId = (key: string) => `s:${key}`;
const competencyId = (key: string) => `c:${key}`;
const LEVELS = [1, 3, 5] as const;
const exampleOf = (a: ActivitySuggestion, level: (typeof LEVELS)[number]) => (level === 1 ? a.example1 : level === 3 ? a.example3 : a.example5);
const anchorOf = (c: CompetencySuggestion, level: (typeof LEVELS)[number]) => (level === 1 ? c.anchor1Tr : level === 3 ? c.anchor3Tr : c.anchor5Tr);

/**
 * HIRING-UX 5.6 (canvas Y3): the AI's proposal as cards, none applied by
 * itself. Each card is accepted, edited (question, measured competencies,
 * 1/3/5 examples; a new competency's name and anchors) or removed, and every
 * one of those can be undone. A stage that measures a new competency waits
 * until that competency is accepted. Model text is shown as text only.
 */
export function AiDraft({
  openingId,
  initialJobAd,
  library,
  locales,
  mode,
  canEdit,
  liveNumber,
  versionNumber,
}: {
  openingId: string;
  initialJobAd: string;
  /** The organisation's active competencies, named in the viewer's language. */
  library: Array<{ id: string; name: string }>;
  locales: Locale[];
  mode: Mode;
  canEdit: boolean;
  liveNumber: number | null;
  versionNumber: number;
}) {
  const t = useMT("hiringAi");
  const tb = useMT("hiringBuilder");
  const [jobAd, setJobAd] = useState(initialJobAd);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const [generating, startGenerating] = useTransition();
  const [working, startWorking] = useTransition();
  const [acceptedStages, setAcceptedStages] = useState<Record<string, string>>({});
  const [acceptedCompetencies, setAcceptedCompetencies] = useState<Record<string, { id: string; created: boolean }>>({});
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [stageEdits, setStageEdits] = useState<Record<string, StageSuggestion>>({});
  const [competencyEdits, setCompetencyEdits] = useState<Record<string, CompetencySuggestion>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const busy = generating || working;

  const writable = canEdit && mode === "draft";
  const adProblem = jobAdProblem(jobAd);
  const generateReason =
    mode === "closed"
      ? t("closedNote")
      : !canEdit
        ? t("noPermission")
        : mode === "live"
          ? t("needsDraft")
          : adProblem === "TOO_SHORT"
            ? t("jobAdTooShort")
            : adProblem === "TOO_LONG"
              ? t("jobAdTooLong")
              : null;

  const ready = outcome.kind === "ready" ? outcome : null;
  const visible = ready ? visibleProposals(ready.draft, ready.jobAd) : null;
  const competencyOf = (c: CompetencySuggestion) => competencyEdits[c.key] ?? c;
  // A new competency the manager removed is no longer measured; a stage that named it can still be accepted.
  const activeNew = visible ? visible.newCompetencies.filter((c) => !removed[competencyId(c.key)]).map(competencyOf) : [];
  const allCompetencies = ready
    ? cardCompetencies(
        ready.draft,
        activeNew,
        library,
        Object.values(acceptedCompetencies).map((a) => a.id),
      )
    : [];
  const usable = new Set(allCompetencies.map((c) => c.key));
  const libraryName = (id: string) => library.find((l) => l.id === id)?.name;
  const nameOf = (key: string) => {
    const c = allCompetencies.find((x) => x.key === key);
    if (!c) return key;
    return c.libraryId ? (libraryName(c.libraryId) ?? c.nameTr) : t("newCompetencyChip", { name: c.nameTr });
  };
  const acceptedIds = Object.fromEntries(Object.entries(acceptedCompetencies).map(([k, v]) => [k, v.id]));
  const say = (code: AiCode | "NETWORK") => aiRefusal(code, (key, values) => t(key, values));
  const note = (card: string, text: string | null) => setNotes((all) => (text ? { ...all, [card]: text } : without(all, card)));

  function generate() {
    setNotes({});
    startGenerating(async () => {
      try {
        const result = await generateDraftAction(openingId, jobAd);
        setOutcome(result.ok ? { kind: "ready", draft: result.draft, jobAd: jobAd.trim(), budgetWarning: result.budgetWarning !== null } : { kind: "refused", code: result.code });
      } catch {
        setOutcome({ kind: "refused", code: "NETWORK" });
      }
      // A new proposal starts from clean cards; what was accepted is already in the builder.
      setAcceptedStages({});
      setAcceptedCompetencies({});
      setRemoved({});
      setStageEdits({});
      setCompetencyEdits({});
      setEditing(null);
    });
  }

  function run<T extends { ok: boolean }>(card: string, action: () => Promise<T>, done: (result: T & { ok: true }) => string | null) {
    note(card, null);
    startWorking(async () => {
      try {
        const result = await action();
        if (result.ok) note(card, done(result as T & { ok: true }));
        else note(card, say((result as unknown as { code: AiCode }).code));
      } catch {
        note(card, say("NETWORK"));
      }
    });
  }

  function acceptStage(stage: StageSuggestion) {
    if (!ready) return;
    const payload = stagePayloadFrom(stage, allCompetencies, acceptedIds);
    run(stageId(stage.key), () => acceptStageAction(openingId, payload), (result) => {
      setAcceptedStages((s) => ({ ...s, [stage.key]: result.stageId }));
      setEditing((e) => (e === stageId(stage.key) ? null : e));
      return null;
    });
  }

  function undoStage(key: string) {
    const id = acceptedStages[key];
    run(stageId(key), () => removeAcceptedStageAction(openingId, id), () => {
      setAcceptedStages((s) => without(s, key));
      return t("stageUndone");
    });
  }

  function acceptCompetency(c: CompetencySuggestion) {
    const proposal = {
      name: { tr: c.nameTr, en: c.nameEn },
      description: { tr: c.descriptionTr, en: c.descriptionEn },
      anchors: { 1: { tr: c.anchor1Tr, en: c.anchor1En }, 3: { tr: c.anchor3Tr, en: c.anchor3En }, 5: { tr: c.anchor5Tr, en: c.anchor5En } },
    };
    run(competencyId(c.key), () => acceptCompetencyAction(openingId, proposal), (result) => {
      setAcceptedCompetencies((s) => ({ ...s, [c.key]: { id: result.id, created: result.created } }));
      setEditing((e) => (e === competencyId(c.key) ? null : e));
      return result.created ? null : t("acceptedReused");
    });
  }

  function undoCompetency(key: string) {
    const accepted = acceptedCompetencies[key];
    if (!accepted.created) {
      // A reused library competency: nothing was written, so nothing is archived.
      setAcceptedCompetencies((s) => without(s, key));
      note(competencyId(key), null);
      return;
    }
    run(competencyId(key), () => undoCompetencyAction(openingId, accepted.id), () => {
      setAcceptedCompetencies((s) => without(s, key));
      return t("competencyArchived");
    });
  }

  const editActivity = (stage: StageSuggestion, index: number, change: Partial<ActivitySuggestion>) =>
    setStageEdits((all) => ({ ...all, [stage.key]: { ...stage, activities: stage.activities.map((x, j) => (j === index ? { ...x, ...change } : x)) } }));

  const stageCard = (original: StageSuggestion, si: number) => {
    const card = stageId(original.key);
    const stage = stageEdits[original.key] ?? original;
    const isAccepted = !!acceptedStages[stage.key];
    const isEditing = editing === card && !isAccepted;
    const shown = { ...stage, activities: stage.activities.map((a) => ({ ...a, competencyKeys: a.competencyKeys.filter((k) => usable.has(k)) })) };
    const waiting = pendingCompetencies(shown, activeNew, acceptedIds);
    const acceptReason = mode === "closed" ? t("closedNote") : !canEdit ? t("noPermission") : mode === "live" ? t("needsDraft") : waiting.length ? t("acceptFirst", { names: waiting.map((c) => c.nameTr).join(", ") }) : null;
    const headingId = `ai-stage-${si}`;
    if (removed[card]) {
      return (
        <Card key={card} className="flex flex-wrap items-center justify-between gap-2 p-card">
          <span role="status" className="text-[13px] text-muted">
            {t("removed", { name: stage.nameTr })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRemoved((r) => without(r, card))}>
            {t("restore")}
          </Button>
        </Card>
      );
    }
    return (
      <Card key={card} className="space-y-4 p-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] tracking-[0.06em] text-muted uppercase">{t("stageCard")}</p>
            <h3 id={headingId} className="text-[16px] leading-6 font-semibold break-words text-ink">
              {stage.nameTr}
            </h3>
          </div>
          <span className="tnum text-[13px] text-muted">
            {t("minutes", { minutes: Math.round(stage.durationSeconds / 60) })} · {t("questionCount", { count: stage.activities.length })}
          </span>
        </div>
        <p className="text-[13px] break-words text-muted">
          <span className="font-medium text-ink">{t("why")}</span> &ldquo;{stage.quote}&rdquo;
        </p>
        <ol className="space-y-3">
          {shown.activities.map((a, ai) => {
            const base = `ai-s${si}-a${ai}`;
            const atLimit = a.competencyKeys.length >= MAX_COMPETENCIES_PER_ACTIVITY;
            return (
              <li key={a.key} className="space-y-2 rounded-lg border border-line p-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${base}-prompt`}>{t("promptLabel")}</Label>
                      <Textarea id={`${base}-prompt`} value={a.promptTr} maxLength={2000} onChange={(e) => editActivity(stage, ai, { promptTr: e.target.value })} />
                    </div>
                    {locales.includes("en") ? (
                      <div className="space-y-1.5">
                        <Label htmlFor={`${base}-prompt-en`}>{t("promptLabelEn")}</Label>
                        <Textarea id={`${base}-prompt-en`} value={a.promptEn} maxLength={2000} onChange={(e) => editActivity(stage, ai, { promptEn: e.target.value })} />
                      </div>
                    ) : null}
                    <div className="space-y-2" role="group" aria-labelledby={`${base}-competencies`}>
                      <p id={`${base}-competencies`} className="text-[13px] font-medium text-ink">
                        {t("competenciesLabel")}
                      </p>
                      {isChoice(a.type) ? (
                        <p className="text-[13px] text-muted">{t("choiceNoCompetency")}</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {allCompetencies.map((c) => {
                              const on = a.competencyKeys.includes(c.key);
                              const blocked = !on && atLimit;
                              return (
                                <button
                                  key={c.key}
                                  type="button"
                                  aria-pressed={on}
                                  disabled={blocked}
                                  aria-describedby={blocked ? `${base}-limit` : undefined}
                                  onClick={() => editActivity(stage, ai, { competencyKeys: toggleCompetency(a.type, a.competencyKeys, c.key) })}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-[120ms] ease-out",
                                    on ? "border-ink bg-ink font-medium text-white" : "border-line-strong text-ink hover:border-ink",
                                    blocked && "cursor-not-allowed opacity-50 hover:border-line-strong",
                                  )}
                                >
                                  {nameOf(c.key)}
                                </button>
                              );
                            })}
                          </div>
                          {atLimit ? (
                            <p id={`${base}-limit`} className="text-[13px] text-muted">
                              {t("competencyLimit")}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {LEVELS.map((level) => (
                        <div key={level} className="space-y-1.5">
                          <Label htmlFor={`${base}-example-${level}`}>{t("exampleLabel", { level })}</Label>
                          <Textarea
                            id={`${base}-example-${level}`}
                            value={exampleOf(a, level)}
                            maxLength={600}
                            onChange={(e) => editActivity(stage, ai, { [`example${level}`]: e.target.value } as Partial<ActivitySuggestion>)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[14px] break-words text-ink">{a.promptTr}</p>
                    <p className="text-[13px] text-muted">
                      {a.competencyKeys.length ? t("measures", { names: a.competencyKeys.map(nameOf).join(", ") }) : t("measuresNone")}
                    </p>
                    {LEVELS.some((level) => exampleOf(a, level)) ? (
                      <div className="text-[13px] text-ink-2">
                        <p className="text-muted">{t("examplesTitle")}</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {LEVELS.filter((level) => exampleOf(a, level)).map((level) => (
                            <li key={level} className="break-words">
                              {t("exampleLine", { level, text: exampleOf(a, level) })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
                <p className="text-[12px] break-words text-muted">
                  <span className="font-medium">{t("why")}</span> &ldquo;{a.quote}&rdquo;
                </p>
              </li>
            );
          })}
        </ol>
        <CardActions
          card={card}
          accepted={isAccepted}
          editing={isEditing}
          busy={busy}
          writable={writable}
          acceptLabel={t("acceptStage", { name: stage.nameTr })}
          acceptReason={acceptReason}
          note={notes[card] ?? null}
          onAccept={() => acceptStage(shown)}
          onUndo={() => undoStage(stage.key)}
          onEdit={() => setEditing(isEditing ? null : card)}
          onRemove={() => {
            setRemoved((r) => ({ ...r, [card]: true }));
            if (isEditing) setEditing(null);
          }}
        />
      </Card>
    );
  };

  const competencyCard = (original: CompetencySuggestion, ci: number) => {
    const card = competencyId(original.key);
    const c = competencyOf(original);
    const isAccepted = !!acceptedCompetencies[c.key];
    const isEditing = editing === card && !isAccepted;
    const headingId = `ai-competency-${ci}`;
    const change = (patch: Partial<CompetencySuggestion>) => setCompetencyEdits((all) => ({ ...all, [c.key]: { ...c, ...patch } }));
    if (removed[card]) {
      return (
        <Card key={card} className="flex flex-wrap items-center justify-between gap-2 p-card">
          <span role="status" className="text-[13px] text-muted">
            {t("removed", { name: c.nameTr })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRemoved((r) => without(r, card))}>
            {t("restore")}
          </Button>
        </Card>
      );
    }
    const reason = mode === "closed" ? t("closedNote") : !canEdit ? t("noPermission") : mode === "live" ? t("needsDraft") : !c.nameTr.trim() ? t("errNameRequired") : null;
    return (
      <Card key={card} className="space-y-3 p-card">
        <div>
          <p className="text-[12px] tracking-[0.06em] text-muted uppercase">{t("competencyCard")}</p>
          <h3 id={headingId} className="text-[16px] leading-6 font-semibold break-words text-ink">
            {c.nameTr}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">{t("competencyCardNote")}</p>
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${card}-name`}>{t("nameLabel")}</Label>
              <Input id={`${card}-name`} value={c.nameTr} maxLength={120} onChange={(e) => change({ nameTr: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {LEVELS.map((level) => (
                <div key={level} className="space-y-1.5">
                  <Label htmlFor={`${card}-anchor-${level}`}>{t("anchorLabel", { level })}</Label>
                  <Textarea
                    id={`${card}-anchor-${level}`}
                    value={anchorOf(c, level)}
                    maxLength={600}
                    onChange={(e) => change({ [`anchor${level}Tr`]: e.target.value } as Partial<CompetencySuggestion>)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[12px] text-muted">{t("anchorsLater")}</p>
          </div>
        ) : (
          <div className="text-[13px] text-ink-2">
            <p className="text-muted">{t("anchorsTitle")}</p>
            <ul className="mt-0.5 space-y-0.5">
              {LEVELS.map((level) => (
                <li key={level} className="break-words">
                  {t("exampleLine", { level, text: anchorOf(c, level) || "-" })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[12px] break-words text-muted">
          <span className="font-medium">{t("why")}</span> &ldquo;{c.quote}&rdquo;
        </p>
        <CardActions
          card={card}
          accepted={isAccepted}
          editing={isEditing}
          busy={busy}
          writable={writable}
          acceptLabel={t("acceptCompetency", { name: c.nameTr })}
          acceptReason={reason}
          note={notes[card] ?? null}
          onAccept={() => acceptCompetency(c)}
          onUndo={() => undoCompetency(c.key)}
          onEdit={() => setEditing(isEditing ? null : card)}
          onRemove={() => {
            setRemoved((r) => ({ ...r, [card]: true }));
            if (isEditing) setEditing(null);
          }}
        />
      </Card>
    );
  };

  const anyAccepted = Object.keys(acceptedStages).length > 0;
  const builderHref = `/hiring/openings/${openingId}/assessment/edit`;
  const refused = outcome.kind === "refused" ? outcome : null;
  const failedToGenerate = refused && (refused.code === "PROVIDER_FAILED" || refused.code === "SCHEMA_FAILED" || refused.code === "UNCONFIGURED");

  return (
    <div className="mt-section max-w-[960px] space-y-section">
      <p className="text-[13px] text-muted">{t("boundary")}</p>

      {mode === "live" ? (
        <Card className="p-card">
          {canEdit ? (
            <form action={startDraftAction} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <input type="hidden" name="openingId" value={openingId} />
              <input type="hidden" name="back" value="ai" />
              <p className="max-w-[560px] text-[14px] text-ink">{tb("liveNote", { live: liveNumber ?? versionNumber, next: versionNumber + 1 })}</p>
              <StartButton label={tb("startEditing")} pendingLabel={tb("starting")} />
            </form>
          ) : (
            <p className="text-[14px] text-ink">{t("noPermission")}</p>
          )}
        </Card>
      ) : mode === "closed" ? (
        <p className="text-[14px] text-ink">{t("closedNote")}</p>
      ) : null}

      <Card className="space-y-field p-card">
        <div className="space-y-1.5">
          <Label htmlFor="ai-job-ad">{t("jobAd")}</Label>
          <p id="ai-job-ad-hint" className="text-[13px] text-muted">
            {t("jobAdHint")}
          </p>
        </div>
        <Textarea
          id="ai-job-ad"
          rows={10}
          className="max-h-[420px]"
          value={jobAd}
          readOnly={!writable}
          aria-describedby="ai-job-ad-hint"
          onChange={(e) => setJobAd(e.target.value)}
        />
        {isJobAdThin(jobAd) ? <p className="text-[13px] text-muted">{t("jobAdThin")}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          {/* One filled button: "Önerileri üret" until a stage is accepted, then "Kabul edilenlerle kurucuya geç"; on a live version "Düzenlemeye başla". */}
          <Button
            id="ai-generate"
            variant={anyAccepted || mode !== "draft" ? "secondary" : "primary"}
            disabled={busy || generateReason !== null}
            disabledReason={generateReason ?? undefined}
            aria-busy={generating || undefined}
            onClick={generate}
          >
            {generating ? t("generating") : ready ? t("regenerate") : t("generate")}
          </Button>
          {generateReason ? <DisabledReason id="ai-generate-why">{generateReason}</DisabledReason> : null}
          {anyAccepted ? (
            <Button asChild variant="primary">
              <Link href={builderHref}>{t("toBuilder")}</Link>
            </Button>
          ) : null}
        </div>
      </Card>

      {generating ? (
        <div className="space-y-3" aria-busy="true">
          <p role="status" className="text-[13px] text-muted">
            {t("working")}
          </p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : refused ? (
        <Card className="space-y-2 p-card">
          <p role="status" className="text-[14px] text-ink">
            {say(refused.code)}
          </p>
          {failedToGenerate ? (
            <Link href={builderHref} className="text-[14px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              {t("startBlank")}
            </Link>
          ) : null}
        </Card>
      ) : null}

      {!generating && ready && visible ? (
        <div className="space-y-4">
          {ready.budgetWarning ? <p className="text-[13px] text-muted">{t("budget", { minutes: Math.round(draftTotalSeconds(ready.draft) / 60) })}</p> : null}
          {visible.hidden > 0 ? <p className="text-[13px] text-muted">{t("hidden", { count: visible.hidden })}</p> : null}
          {visible.newCompetencies.map(competencyCard)}
          {visible.stages.map(stageCard)}
        </div>
      ) : null}
    </div>
  );
}

/** Kabul et · Düzenle · Sil on an open card; "Kabul edildi." with Geri al on an accepted one (all reversible). */
function CardActions({
  card,
  accepted,
  editing,
  busy,
  writable,
  acceptLabel,
  acceptReason,
  note,
  onAccept,
  onUndo,
  onEdit,
  onRemove,
}: {
  card: string;
  accepted: boolean;
  editing: boolean;
  busy: boolean;
  writable: boolean;
  acceptLabel: string;
  acceptReason: string | null;
  note: string | null;
  onAccept: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useMT("hiringAi");
  const id = `ai-accept-${card.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return (
    <div className="space-y-1.5 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {accepted ? (
          <>
            <span className="text-[13px] font-medium text-ink">{t("accepted")}</span>
            <Button variant="ghost" size="sm" disabled={busy || !writable} onClick={onUndo}>
              {t("undo")}
            </Button>
          </>
        ) : (
          <>
            <Button id={id} variant="secondary" size="sm" aria-label={acceptLabel} disabled={busy || acceptReason !== null} disabledReason={acceptReason ?? undefined} onClick={onAccept}>
              {t("accept")}
            </Button>
            <Button variant="ghost" size="sm" aria-pressed={editing} disabled={!writable} onClick={onEdit}>
              {editing ? t("doneEditing") : t("edit")}
            </Button>
            <Button variant="ghost" size="sm" disabled={!writable} onClick={onRemove}>
              {t("remove")}
            </Button>
            {acceptReason ? <DisabledReason id={`${id}-why`}>{acceptReason}</DisabledReason> : null}
          </>
        )}
      </div>
      {note ? (
        <p role="status" className="text-[13px] text-ink">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** "Düzenlemeye başla" while its form is on its way says so and cannot be pressed twice. */
function StartButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} aria-busy={pending || undefined}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
