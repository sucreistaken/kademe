"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button, DisabledReason } from "@/components/ui/button";
import { useMT, type TypedMT } from "@/i18n/manager-client";
import { Card } from "@/components/ui/card";
import { TemplateSteps } from "@/components/manager/template-steps";
import { JOB_AD_MIN_CHARS, isJobAdThin } from "@/lib/template-draft";
import { StatusDot } from "@/components/ui/status-dot";
import {
  DRAFT_BUDGET,
  SUGGESTABLE_ACTIVITY_TYPES,
  draftTotalSeconds,
  type ActivitySuggestion,
  type CompetencySuggestion,
  type StageSuggestion,
  type SuggestableActivityType,
  type TemplateDraft,
} from "@/lib/template-draft";
import {
  acceptCompetencySuggestion,
  acceptStageSuggestion,
  requestDraft,
  undoCompetencyAccept,
  undoStageAccept,
  type DraftState,
} from "./actions";

type AiT = TypedMT<"aiBuilder">;

/**
 * Y3. Suggestion cards, none of them applied on their own.
 *
 * The whole screen is built around one promise: the manager reads a proposal
 * and decides. So a card can be accepted, edited before accepting, or thrown
 * away, and both accepting and deleting are reversible from the card itself.
 * There is no "apply all", because that is the button that would quietly turn
 * a proposal into a hiring process nobody read.
 */

type StageCard = {
  kind: "stage";
  key: string;
  data: StageSuggestion;
  status: "pending" | "accepted" | "deleted";
  stageId?: string;
  stageNumber?: number;
  error?: string;
};

type CompetencyCard = {
  kind: "competency";
  key: string;
  data: CompetencySuggestion;
  status: "pending" | "accepted" | "deleted";
  competencyId?: string;
  createdInLibrary?: boolean;
  linkedStageIds?: string[];
  error?: string;
};

type SuggestionCard = StageCard | CompetencyCard;

// One source of truth, shared with the server action and the template choice
// screen. Three copies of this number is how a paste over the maximum came to
// be reported as "too short".
const MIN_CHARS = JOB_AD_MIN_CHARS;

function typeLabel(t: AiT, type: SuggestableActivityType): string {
  return t(`type${type}`);
}

export function AiBuilder({
  versionId,
  positionId,
  templateId,
  heading,
  positionName,
  versionStatus,
  versionNumber,
  stageCount,
  locales,
  jobDescription: initialJobDescription,
  aiConfigured,
  providerName,
  model,
}: {
  versionId: string;
  positionId: string;
  templateId: string;
  heading: string;
  positionName: string;
  versionStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  versionNumber: number;
  stageCount: number;
  locales: Array<"tr" | "en">;
  jobDescription: string;
  aiConfigured: boolean;
  providerName: string;
  model: string;
}) {
  const t = useMT("aiBuilder");
  const errors = useMT("aiErrors");
  const shared = useMT("shared");
  const locale = useLocale();
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [state, formAction, generating] = useActionState<DraftState, FormData>(
    requestDraft,
    { status: "idle" },
  );

  const [cards, setCards] = useState<SuggestionCard[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [targetVersionId, setTargetVersionId] = useState(versionId);
  // The server's count is a snapshot taken at render. Accepting appends a
  // stage, so the line would otherwise keep quoting a number that stopped
  // being true on the first click. `acceptStageSuggestion` already returns the
  // count after its insert, which is cheaper and more honest than a cache
  // revalidation.
  const [stages, setStages] = useState(stageCount);
  const [openedNewDraft, setOpenedNewDraft] = useState(false);
  const [working, startWork] = useTransition();

  // A finished run brings new cards. Done during render rather than in an
  // effect: this is derived state being reset when its source changes, and an
  // effect would paint the previous run's cards for one frame.
  //
  // Accepted cards SURVIVE the rerun. They are real rows in the database, so
  // dropping them from the list would leave the stage in the template with its
  // Undo unreachable, and rerunning with an edited job ad is the normal way to
  // repair a bad draft. A fresh run reuses suggestion keys like "s1", so an
  // incoming card that collides with a survivor is dropped rather than shown
  // twice.
  if (state.status === "ready" && state.runId !== runId) {
    setRunId(state.runId);
    setCards((previous) => {
      const kept = previous.filter((card) => card.status === "accepted");
      const keptKeys = new Set(kept.map((card) => card.key));
      return [
        ...kept,
        ...buildCards(state.draft).filter((card) => !keptKeys.has(card.key)),
      ];
    });
  }

  const tooShort = jobDescription.trim().length < MIN_CHARS;
  // Usable but thin. The button stays live: how good a draft has to be is the
  // manager's call, and a disabled button cannot make it for them.
  const thin = isJobAdThin(jobDescription);
  const accepted = cards.filter((card) => card.status === "accepted").length;
  const pending = cards.filter((card) => card.status === "pending").length;
  const acceptedStageIdByKey = new Map(
    cards
      .filter(
        (card): card is StageCard =>
          card.kind === "stage" && card.status === "accepted" && !!card.stageId,
      )
      // Keyed by the suggestion's own key, which is what a competency
      // suggestion points at in `stageKeys`.
      .map((card) => [card.data.key, card.stageId!]),
  );

  const patch = (key: string, changes: Partial<SuggestionCard>) =>
    setCards((prev) =>
      prev.map((card) =>
        card.key === key ? ({ ...card, ...changes } as SuggestionCard) : card,
      ),
    );

  const acceptStage = (card: StageCard) =>
    startWork(async () => {
      const result = await acceptStageSuggestion(versionId, card.data);
      if (!result.ok) {
        patch(card.key, { error: errors(result.code) });
        return;
      }
      setTargetVersionId(result.targetVersionId);
      if (result.openedNewDraft) setOpenedNewDraft(true);
      setStages(result.stageNumber);
      patch(card.key, {
        status: "accepted",
        stageId: result.stageId,
        stageNumber: result.stageNumber,
        error: undefined,
      });
    });

  const undoStage = (card: StageCard) =>
    startWork(async () => {
      if (!card.stageId) return;
      const result = await undoStageAccept(card.stageId);
      if (!result.ok) {
        patch(card.key, { error: errors(result.code) });
        return;
      }
      setStages((count) => Math.max(0, count - 1));
      patch(card.key, {
        status: "pending",
        stageId: undefined,
        stageNumber: undefined,
        error: undefined,
      });
    });

  const acceptCompetency = (card: CompetencyCard, stageIds: string[]) =>
    startWork(async () => {
      const result = await acceptCompetencySuggestion(
        versionId,
        card.data,
        stageIds,
      );
      if (!result.ok) {
        patch(card.key, { error: errors(result.code) });
        return;
      }
      patch(card.key, {
        status: "accepted",
        competencyId: result.competencyId,
        createdInLibrary: result.createdInLibrary,
        linkedStageIds: result.linkedStageIds,
        error: undefined,
      });
    });

  const undoCompetency = (card: CompetencyCard) =>
    startWork(async () => {
      if (!card.competencyId || !card.linkedStageIds) return;
      const result = await undoCompetencyAccept(
        card.competencyId,
        card.linkedStageIds,
        card.createdInLibrary ?? false,
      );
      if (!result.ok) {
        patch(card.key, { error: errors(result.code) });
        return;
      }
      patch(card.key, {
        status: "pending",
        competencyId: undefined,
        linkedStageIds: undefined,
        createdInLibrary: undefined,
        error: undefined,
      });
    });

  const builderHref = `/positions/${positionId}/templates/${templateId}/versions/${targetVersionId}/builder`;
  // Exactly one filled button on the screen. Before anything is accepted it is
  // the generate button; afterwards the next real step is the builder.
  const primaryIsBuilder = accepted > 0;

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      {/* A real breadcrumb, mirroring the builder. This screen is now the
          redirect target of position creation, so a manager who accepts no
          suggestion at all had no way out but the browser's back button. */}
      <p className="text-[12.5px] text-muted">
        <Link href="/positions" className="hover:text-ink">
          {shared("positionsBreadcrumb")}
        </Link>{" "}
        /{" "}
        <Link href={`/positions/${positionId}`} className="hover:text-ink">
          {positionName}
        </Link>
      </p>
      <p className="mt-1 text-[13px] text-muted">{heading}</p>
      <h1 className="mt-1 text-[19px] font-semibold tracking-tight">{t("title")}</h1>
      <div className="mt-2">
        <TemplateSteps
          basePath={`/positions/${positionId}/templates/${templateId}/versions/${targetVersionId}`}
          current={1}
          reviewable={stages > 0}
        />
      </div>
      <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
        {t("lead")}
      </p>

      <Card className="mt-6 p-6">
        <form action={formAction}>
          <input type="hidden" name="versionId" value={versionId} />
          <label
            htmlFor="jobDescription"
            className="text-[13.5px] font-medium"
          >
            {t("jobAdLabel", { position: positionName })}
          </label>
          <textarea
            id="jobDescription"
            name="jobDescription"
            rows={10}
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder={t("jobAdPlaceholder")}
            className="mt-2 w-full rounded-[10px] border border-line bg-surface p-3.5
                       text-[13.5px] leading-relaxed outline-none focus:border-muted"
          />
          {thin ? (
            <p className="mt-1.5 text-[13px] text-muted">{t("thinAd")}</p>
          ) : null}
          <p className="mt-1.5 text-[13px] text-muted">
            {t("charCount", {
              count: jobDescription
                .trim()
                .length.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB"),
            })}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              id="generate-draft"
              type="submit"
              variant={primaryIsBuilder ? "secondary" : "primary"}
              size="md"
              disabled={!aiConfigured || tooShort || generating}
              disabledReason={
                !aiConfigured
                  ? t("notConfigured")
                  : tooShort
                    ? t("tooShort", { min: MIN_CHARS })
                    : generating
                      ? t("generatingReason")
                      : undefined
              }
            >
              {generating
                ? t("generating")
                : cards.length
                  ? t("regenerate")
                  : t("generate")}
            </Button>

            {!aiConfigured ? (
              <DisabledReason id="generate-draft-why">
                {t("notConfiguredLong")}
              </DisabledReason>
            ) : tooShort ? (
              <DisabledReason id="generate-draft-why">
                {t("tooShortLong", { min: MIN_CHARS })}
              </DisabledReason>
            ) : null}
          </div>
        </form>

        <p className="mt-4">
          <StatusDot tone={aiConfigured ? "active" : "neutral"}>
            {aiConfigured ? (
              <>
                {t("provider")} <span lang="en">{providerName}</span> · {t("model")}{" "}
                <span lang="en">{model}</span>
              </>
            ) : (
              t("providerMissing")
            )}
          </StatusDot>
        </p>

        {/* Reasoning models take minutes to answer, and a blank screen is
            indistinguishable from a broken one. */}
        {generating ? (
          <p className="mt-2" aria-live="polite">
            <StatusDot tone="active">{t("working")}</StatusDot>
          </p>
        ) : null}
      </Card>

      {versionStatus !== "DRAFT" ? (
        <Card className="mt-4 p-5">
          <p className="text-[13.5px]">
            {t("publishedTitle", { version: versionNumber })}
          </p>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted">
            {t("publishedBody")}
          </p>
        </Card>
      ) : null}

      {state.status === "reported" ? (
        <>
          <Notice tone="danger" text={errors(state.code)} />
          {state.detail ? (
            <p className="mt-1.5 text-[12px] text-muted" lang="en">
              {state.detail}
            </p>
          ) : null}
        </>
      ) : null}
      {state.status === "error" ? (
        <Notice tone="danger" text={errors(state.code)} />
      ) : null}

      {state.status === "ready" ? (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {t("countLine", { count: cards.length, accepted })}
            </h2>
            <p className="text-[13px] text-muted">
              {pending > 0 ? t("pendingLine", { count: pending }) : t("allReviewed")}
            </p>
          </div>

          <p className="mt-2 text-[13px] text-muted">
            {t("totalMinutes", {
              minutes: Math.round(draftTotalSeconds(state.draft) / 60),
              target: Math.round(DRAFT_BUDGET.totalTargetSeconds / 60),
            })}
          </p>
          {state.budgetWarning ? (
            <Card className="mt-2 p-5">
              <p className="text-[13.5px]">{t("budgetTitle")}</p>
              <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted">
                {t("budgetBody", { warning: state.budgetWarning })}
              </p>
            </Card>
          ) : null}
          {state.droppedStages > 0 ? (
            <p className="mt-2 text-[13px] text-muted">
              {t("dropped", {
                count: state.droppedStages,
                max: DRAFT_BUDGET.maxStages,
              })}
            </p>
          ) : null}
          {state.repaired ? (
            <p className="mt-2 text-[13px] text-muted">{t("repaired")}</p>
          ) : null}
          {state.fellBackTo ? (
            <p className="mt-2 text-[13px] text-muted">{t("fellBackTo")}</p>
          ) : null}
          {state.attempts > 1 ? (
            <p className="mt-2 text-[13px] text-muted">
              {t("attempts", { count: state.attempts })}
            </p>
          ) : null}
          {targetVersionId !== versionId && !openedNewDraft ? (
            // Not a new draft: an existing one. Saying nothing here would mean
            // the manager's accepted stages landed in a version they never
            // named, and where the manager's data went is not a thing this
            // product stays quiet about.
            <p className="mt-2 text-[13px] text-muted">{t("wroteToOtherDraft")}</p>
          ) : null}
          {openedNewDraft ? (
            <p className="mt-2 text-[13px] text-muted">{t("openedNewDraft")}</p>
          ) : null}
          {stages > 0 ? (
            <p className="mt-2 text-[13px] text-muted">
              {t("existingStages", { count: stages })}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {cards.map((card) =>
              card.kind === "stage" ? (
                <StageCardView
                  key={card.key}
                  card={card}
                  locales={locales}
                  busy={working}
                  onChange={(data) => patch(card.key, { data })}
                  onAccept={() => acceptStage(card)}
                  onUndo={() => undoStage(card)}
                  onDelete={() => patch(card.key, { status: "deleted" })}
                  onRestore={() => patch(card.key, { status: "pending" })}
                />
              ) : (
                <CompetencyCardView
                  key={card.key}
                  card={card}
                  busy={working}
                  stageIds={card.data.stageKeys
                    .map((key) => acceptedStageIdByKey.get(key))
                    .filter((id): id is string => !!id)}
                  onChange={(data) => patch(card.key, { data })}
                  onAccept={(ids) => acceptCompetency(card, ids)}
                  onUndo={() => undoCompetency(card)}
                  onDelete={() => patch(card.key, { status: "deleted" })}
                  onRestore={() => patch(card.key, { status: "pending" })}
                />
              ),
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              id="open-builder"
              variant={primaryIsBuilder ? "primary" : "secondary"}
              size="md"
              disabled={accepted === 0}
              disabledReason={accepted === 0 ? t("noneAccepted") : undefined}
              asChild={accepted > 0}
            >
              {accepted > 0 ? (
                <Link href={builderHref}>{t("openBuilder")}</Link>
              ) : (
                <span>{t("openBuilder")}</span>
              )}
            </Button>
            {accepted === 0 ? (
              <DisabledReason id="open-builder-why">
                {t("noneAcceptedLong")}
              </DisabledReason>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="mt-10 max-w-[62ch] text-[13px] leading-relaxed text-muted">
        {t("disclaimer")}
      </p>
    </main>
  );
}

function Notice({ tone, text }: { tone: "warn" | "danger"; text: string }) {
  const t = useMT("aiBuilder");
  return (
    <Card className="mt-4 p-5">
      <p
        role="alert"
        className={
          tone === "danger" ? "text-[13.5px] text-danger" : "text-[13.5px]"
        }
      >
        {text}
      </p>
      <p className="mt-1 text-[13px] text-muted">{t("nothingWritten")}</p>
    </Card>
  );
}

function StageCardView({
  card,
  locales,
  busy,
  onChange,
  onAccept,
  onUndo,
  onDelete,
  onRestore,
}: {
  card: StageCard;
  locales: Array<"tr" | "en">;
  busy: boolean;
  onChange: (data: StageSuggestion) => void;
  onAccept: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const t = useMT("aiBuilder");
  const shared = useMT("shared");
  const [editing, setEditing] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  if (card.status === "deleted") {
    return (
      <RemovedRow
        text={t("deletedStage", { name: card.data.nameTr })}
        onRestore={onRestore}
      />
    );
  }

  if (card.status === "accepted") {
    return (
      <AcceptedRow
        text={t("acceptedStage", {
          name: card.data.nameTr,
          activities: card.data.activities.length,
          number: card.stageNumber ?? 0,
        })}
        busy={busy}
        onUndo={onUndo}
        error={card.error}
      />
    );
  }

  const minutes = Math.round(card.data.durationSeconds / 60);

  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">
        {t("stageSuggestion", {
          types: card.data.activities.map((a) => typeLabel(t, a.type)).join(", "),
          minutes,
        })}
      </p>
      {/* The suggestion text is Turkish template content, not interface copy. */}
      <h3 lang="tr" className="mt-1 text-[15px] font-semibold tracking-tight">
        {card.data.nameTr}
      </h3>
      {card.data.descriptionTr ? (
        <p lang="tr" className="mt-1 max-w-[68ch] text-[13.5px] leading-relaxed">
          {card.data.descriptionTr}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRationale((open) => !open)}
        className="mt-2 text-[13px] text-muted underline underline-offset-2"
        aria-expanded={showRationale}
      >
        {showRationale ? t("hideRationale") : t("showRationale")}
      </button>
      {showRationale ? (
        <div className="mt-2 space-y-2 border-l border-line pl-3">
          {card.data.rationale ? (
            <p lang="tr" className="max-w-[68ch] text-[13px] leading-relaxed text-muted">
              {card.data.rationale}
            </p>
          ) : null}
          {card.data.internalPurpose ? (
            <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted">
              {t("internalPurposeLine", { text: card.data.internalPurpose })}
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-3 space-y-2.5">
        {card.data.activities.map((activity) => (
          <li key={activity.key} className="border-t border-line pt-2.5">
            <p className="text-[13px] text-muted">
              {t("activityLine", {
                type: typeLabel(t, activity.type),
                think: activity.thinkSeconds,
                answer: activity.answerSeconds,
              })}
            </p>
            <p lang="tr" className="mt-0.5 max-w-[68ch] text-[13.5px] leading-relaxed">
              {activity.promptTr}
            </p>
            {activity.expectedBehaviours.length > 0 ? (
              <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted">
                {t("expectedBehaviours", {
                  list: activity.expectedBehaviours.join(" · "),
                })}
              </p>
            ) : null}
            {activity.redFlags.length > 0 ? (
              <p className="mt-0.5 max-w-[68ch] text-[13px] leading-relaxed text-muted">
                {t("redFlags", { list: activity.redFlags.join(" · ") })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {editing ? (
        <StageEditor
          data={card.data}
          locales={locales}
          onChange={onChange}
          onClose={() => setEditing(false)}
        />
      ) : null}

      {card.error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {card.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          disabledReason={busy ? t("waiting") : undefined}
          onClick={onAccept}
        >
          {t("accept")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing((open) => !open)}>
          {editing ? t("closeEdit") : shared("edit")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          {shared("delete")}
        </Button>
      </div>
    </Card>
  );
}

function StageEditor({
  data,
  locales,
  onChange,
  onClose,
}: {
  data: StageSuggestion;
  locales: Array<"tr" | "en">;
  onChange: (data: StageSuggestion) => void;
  onClose: () => void;
}) {
  const t = useMT("aiBuilder");
  const setActivity = (index: number, changes: Partial<ActivitySuggestion>) =>
    onChange({
      ...data,
      activities: data.activities.map((activity, i) =>
        i === index ? { ...activity, ...changes } : activity,
      ),
    });

  return (
    <div className="mt-4 space-y-4 rounded-[10px] border border-line p-4">
      <Field label={t("stageNameTr")}>
        <input
          type="text"
          lang="tr"
          value={data.nameTr}
          onChange={(event) => onChange({ ...data, nameTr: event.target.value })}
          className={inputClass}
        />
      </Field>
      {locales.includes("en") ? (
        <Field label={t("stageNameEn")}>
          <input
            type="text"
            lang="en"
            value={data.nameEn}
            onChange={(event) => onChange({ ...data, nameEn: event.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}
      <Field label={t("durationMinutes")}>
        <input
          type="number"
          min={1}
          max={120}
          value={Math.round(data.durationSeconds / 60)}
          onChange={(event) =>
            onChange({
              ...data,
              durationSeconds: Math.max(60, Number(event.target.value) * 60 || 60),
            })
          }
          className={`${inputClass} w-24 text-right tnum`}
        />
      </Field>
      <Field label={t("internalPurposeField")}>
        <textarea
          rows={2}
          lang="tr"
          value={data.internalPurpose}
          onChange={(event) =>
            onChange({ ...data, internalPurpose: event.target.value })
          }
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      {data.activities.map((activity, index) => (
        <div key={activity.key} className="space-y-3 border-t border-line pt-3">
          <Field label={t("activityPrompt", { index: index + 1 })}>
            <textarea
              rows={3}
              lang="tr"
              value={activity.promptTr}
              onChange={(event) =>
                setActivity(index, { promptTr: event.target.value })
              }
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("typeField")}>
              <select
                value={activity.type}
                onChange={(event) =>
                  setActivity(index, {
                    type: event.target.value as SuggestableActivityType,
                  })
                }
                className={inputClass}
              >
                {SUGGESTABLE_ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(t, type)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("thinkSeconds")}>
              <input
                type="number"
                min={0}
                max={600}
                value={activity.thinkSeconds}
                onChange={(event) =>
                  setActivity(index, {
                    thinkSeconds: Math.max(0, Number(event.target.value) || 0),
                  })
                }
                className={`${inputClass} w-24 text-right tnum`}
              />
            </Field>
            <Field label={t("answerSeconds")}>
              <input
                type="number"
                min={30}
                max={1800}
                value={activity.answerSeconds}
                onChange={(event) =>
                  setActivity(index, {
                    answerSeconds: Math.max(30, Number(event.target.value) || 30),
                  })
                }
                className={`${inputClass} w-24 text-right tnum`}
              />
            </Field>
          </div>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={onClose}>
        {t("finishEdit")}
      </Button>
    </div>
  );
}

function CompetencyCardView({
  card,
  busy,
  stageIds,
  onChange,
  onAccept,
  onUndo,
  onDelete,
  onRestore,
}: {
  card: CompetencyCard;
  busy: boolean;
  stageIds: string[];
  onChange: (data: CompetencySuggestion) => void;
  onAccept: (stageIds: string[]) => void;
  onUndo: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const t = useMT("aiBuilder");
  const shared = useMT("shared");
  const [editing, setEditing] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  if (card.status === "deleted") {
    return (
      <RemovedRow
        text={t("deletedCompetency", { name: card.data.nameTr })}
        onRestore={onRestore}
      />
    );
  }

  if (card.status === "accepted") {
    return (
      <AcceptedRow
        text={t("acceptedCompetency", {
          name: card.data.nameTr,
          count: card.linkedStageIds?.length ?? 0,
        })}
        busy={busy}
        onUndo={onUndo}
        error={card.error}
      />
    );
  }

  // A competency measured by no accepted stage has nothing to attach to. The
  // button says so rather than failing after the click.
  const blocked =
    card.data.stageKeys.length === 0
      ? t("notLinked")
      : stageIds.length === 0
        ? t("acceptStageFirst")
        : busy
          ? t("waiting")
          : undefined;

  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">
        {t("competencySuggestion", { count: card.data.stageKeys.length })}
      </p>
      {/* The suggestion text is Turkish template content, not interface copy. */}
      <h3 lang="tr" className="mt-1 text-[15px] font-semibold tracking-tight">
        {card.data.nameTr}
      </h3>
      {card.data.descriptionTr ? (
        <p lang="tr" className="mt-1 max-w-[68ch] text-[13.5px] leading-relaxed">
          {card.data.descriptionTr}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRationale((open) => !open)}
        className="mt-2 text-[13px] text-muted underline underline-offset-2"
        aria-expanded={showRationale}
      >
        {showRationale ? t("hideRationale") : t("showRationale")}
      </button>
      {showRationale && card.data.rationale ? (
        <p lang="tr" className="mt-2 max-w-[68ch] border-l border-line pl-3 text-[13px] leading-relaxed text-muted">
          {card.data.rationale}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4 space-y-3 rounded-[10px] border border-line p-4">
          <Field label={t("competencyName")}>
            <input
              type="text"
              lang="tr"
              value={card.data.nameTr}
              onChange={(event) =>
                onChange({ ...card.data, nameTr: event.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("competencyDescription")}>
            <textarea
              rows={2}
              lang="tr"
              value={card.data.descriptionTr}
              onChange={(event) =>
                onChange({ ...card.data, descriptionTr: event.target.value })
              }
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t("finishEdit")}
          </Button>
        </div>
      ) : null}

      {card.error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {card.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          id={`accept-${card.key}`}
          variant="secondary"
          size="sm"
          disabled={!!blocked}
          disabledReason={blocked}
          onClick={() => onAccept(stageIds)}
        >
          {t("accept")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing((open) => !open)}>
          {editing ? t("closeEdit") : shared("edit")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          {shared("delete")}
        </Button>
      </div>
      {blocked && !busy ? (
        <DisabledReason id={`accept-${card.key}-why`}>{blocked}</DisabledReason>
      ) : null}
    </Card>
  );
}

function AcceptedRow({
  text,
  busy,
  onUndo,
  error,
}: {
  text: string;
  busy: boolean;
  onUndo: () => void;
  error?: string;
}) {
  const t = useMT("aiBuilder");
  const common = useMT("common");
  return (
    <Card className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <StatusDot tone="active" className="flex-1">
        {text}
      </StatusDot>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        disabledReason={busy ? t("waiting") : undefined}
        onClick={onUndo}
      >
        {common("undo")}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function RemovedRow({ text, onRestore }: { text: string; onRestore: () => void }) {
  const common = useMT("common");
  return (
    <Card className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <StatusDot tone="done" className="flex-1">
        {text}
      </StatusDot>
      <Button variant="ghost" size="sm" onClick={onRestore}>
        {common("undo")}
      </Button>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

const inputClass =
  "h-9 w-full rounded-[6px] border border-line bg-surface px-2.5 text-[13.5px] " +
  "outline-none focus:border-muted";

function buildCards(draft: TemplateDraft): SuggestionCard[] {
  return [
    ...draft.stages.map(
      (stage): StageCard => ({
        kind: "stage",
        key: `stage:${stage.key}`,
        data: stage,
        status: "pending",
      }),
    ),
    ...draft.competencies.map(
      (competency): CompetencyCard => ({
        kind: "competency",
        key: `competency:${competency.key}`,
        data: competency,
        status: "pending",
      }),
    ),
  ];
}
