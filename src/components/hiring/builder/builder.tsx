"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlignLeft, CircleDot, ListChecks, Mic, Paperclip, Plus, Type, Video } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UndoStrip } from "@/components/ui/undo-strip";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/format";
import { pickText } from "@/lib/i18n-text";
import { MAX_ACTIVITIES_PER_STAGE } from "@/solutions/hiring/rules/patches";
import { ACTIVITY_TYPES, orderedActivities, orderedStages, totalSeconds, type ActivityType, type ContentStage } from "@/solutions/hiring/rules/content";
import { publishOpeningAction } from "@/app/(manager)/hiring/openings/[id]/actions";
import {
  addActivityAction,
  addStageAction,
  deleteActivityAction,
  deleteStageAction,
  moveActivityAction,
  moveStageAction,
  restoreActivityFormAction,
  restoreStageFormAction,
  saveActivityAction,
  startDraftAction,
} from "@/app/(manager)/hiring/openings/[id]/assessment/edit/actions";
import type { ActionResult, UndoTicket } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";
import { ActivityEditor } from "./activity-editor";
import { BuilderCheckContext, type BuilderCheck } from "./check-context";
import type { EditorBinding } from "./fields";
import { refusalKey } from "./refusal-copy";
import { StageEditor } from "./stage-editor";
import { withUnsaved } from "./overlay";
import { useSaver } from "./use-saver";

export const TYPE_ICON: Record<ActivityType, typeof Video> = {
  VIDEO: Video,
  AUDIO: Mic,
  LONG_TEXT: AlignLeft,
  SHORT_TEXT: Type,
  SINGLE_CHOICE: CircleDot,
  MULTI_CHOICE: ListChecks,
  FILE_UPLOAD: Paperclip,
};

type Selection = { kind: "stage" | "activity"; id: string } | null;
type Undo = ({ kind: "stage" } & UndoTicket) | ({ kind: "activity"; stageId: string } & UndoTicket) | null;

function initialSelection(stages: ContentStage[], initial: { stageId: string | null; activityId: string | null }): Selection {
  const all = stages.flatMap((s) => s.activities);
  if (initial.activityId && all.some((a) => a.id === initial.activityId)) return { kind: "activity", id: initial.activityId };
  if (initial.stageId && stages.some((s) => s.id === initial.stageId)) return { kind: "stage", id: initial.stageId };
  const first = stages[0];
  if (!first) return null;
  const firstActivity = orderedActivities(first)[0];
  return firstActivity ? { kind: "activity", id: firstActivity.id } : { kind: "stage", id: first.id };
}

/**
 * HIRING-UX 5.5 (canvas Y2): the structure on the left, what the candidate
 * sees in the middle, the team-only vault on the right, and a sticky bar with
 * the save line, the question check (`checkSlot`, which reads the stages and
 * the save queue through BuilderCheckContext) and the one filled button:
 * "Yayınla" on a draft, "Düzenlemeye başla" on a live version.
 *
 * Writes go through one save queue (use-saver.ts): typed text is debounced and
 * always sent before a structural change, so nothing typed is lost to a
 * reorder, a delete or a reload. Every control has a label, reorder is by
 * buttons, and focus moves to the item a change leaves selected.
 */
export function Builder({
  openingId,
  mode,
  versionNumber,
  liveNumber,
  stages: unordered,
  competencies,
  problems,
  initial,
  locale,
  canEdit,
  closed,
  checkSlot,
}: {
  openingId: string;
  mode: "draft" | "live";
  versionNumber: number;
  liveNumber: number | null;
  stages: ContentStage[];
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  problems: Array<{ text: string; href: string | null }>;
  initial: { stageId: string | null; activityId: string | null };
  locale: Locale;
  canEdit: boolean;
  closed: boolean;
  checkSlot?: React.ReactNode;
}) {
  const t = useMT("hiringBuilder");
  const editable = canEdit && mode === "draft";
  const [epoch, setEpoch] = useState(0);
  // A reload's unsaved values are replayed into the queue (only where the draft can be edited);
  // the editors reopen so they show them.
  const saver = useSaver(openingId, editable, () => setEpoch((e) => e + 1));
  // Editors are built from the loaded content plus every value the queue still holds (waiting,
  // on its way, failed), so leaving an item and coming back never shows older text than was typed.
  const stages = orderedStages({ stages: withUnsaved(unordered, editable ? saver.queue.entries() : []) }).map((s) => ({
    ...s,
    activities: orderedActivities(s),
  }));
  const [selection, setSelection] = useState<Selection>(() => initialSelection(stages, initial));
  const [undo, setUndo] = useState<Undo>(null);
  const [context, setContext] = useState<"edit" | "undo">("edit");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const treeItems = useRef(new Map<string, HTMLButtonElement>());
  const picked = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  /** Picking from the tree: below 1024px the editor sits under the tree, so it is brought into view. */
  const pick = (next: NonNullable<Selection>) => {
    setSelection(next);
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: "start" }));
  };

  // A new link from the overview or the publish reason (?stage= / ?activity=)
  // selects that item; later renders keep the user's own choice.
  const wanted = initial.activityId ?? initial.stageId;
  const [linked, setLinked] = useState(wanted);
  if (wanted !== linked) {
    setLinked(wanted);
    if (wanted) setSelection(initial.activityId ? { kind: "activity", id: initial.activityId } : { kind: "stage", id: wanted });
  }

  // Focus follows a delete or an undo to the item left selected (carry 8).
  useEffect(() => {
    if (!focusTarget) return;
    const node = treeItems.current.get(focusTarget);
    if (node) {
      node.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, unordered]);

  // A new question type remounts the editor with that type's fields; focus goes back to the
  // type select once the new editor is on screen (checked after every render until it is).
  const fieldFocus = useRef<{ id: string; key: string } | null>(null);
  useEffect(() => {
    const want = fieldFocus.current;
    if (!want) return;
    const node = document.getElementById(want.id);
    if (node?.closest(`[data-editor="${want.key}"]`)) {
      node.focus();
      fieldFocus.current = null;
    }
  });

  const minutes = Math.round(totalSeconds({ stages }) / 60);
  const stageIndex = selection?.kind === "stage" ? stages.findIndex((s) => s.id === selection.id) : -1;
  const selectedStage = stageIndex >= 0 ? stages[stageIndex] : null;
  const owner = selection?.kind === "activity" ? stages.find((s) => s.activities.some((a) => a.id === selection.id)) : undefined;
  const activityIndex = owner ? owner.activities.findIndex((a) => a.id === selection!.id) : -1;
  const selectedActivity = owner ? owner.activities[activityIndex] : null;

  const queue = saver.queue;
  const state = saver.state;
  const binding = (kind: "stage" | "activity", targetId: string): EditorBinding => ({
    editable,
    onEdit: (field, value) => queue.edit({ kind, id: targetId }, field, value),
    onFlush: () => void queue.flush(),
    errorFor: (field) => {
      if (state.kind !== "refused" || state.targetId !== targetId) return null;
      const match = state.fields.find((f) => f === field || f.startsWith(`${field}.`));
      return match ? t(refusalKey(state.code, [match])) : null;
    },
  });

  /** A structural change: typed text goes first, then the change, one at a time. */
  async function structural<T>(op: () => Promise<ActionResult<T>>, ctx: "edit" | "undo" = "edit") {
    setContext(ctx);
    return queue.run(op);
  }

  async function addStage() {
    const res = await structural(() => addStageAction(openingId));
    if (res.ok) {
      setSelection({ kind: "stage", id: res.value });
      setJustAdded(res.value);
    }
  }
  async function addActivity(stageId: string, type: ActivityType) {
    const res = await structural(() => addActivityAction(openingId, stageId, type));
    if (res.ok) {
      setSelection({ kind: "activity", id: res.value });
      setJustAdded(res.value);
    }
  }
  async function moveStage(stageId: string, from: number, direction: -1 | 1) {
    const res = await structural(() => moveStageAction(openingId, stageId, direction));
    if (res.ok) setAnnouncement(t("movedTo", { n: from + direction + 1 }));
  }
  async function moveActivity(activityId: string, from: number, direction: -1 | 1) {
    const res = await structural(() => moveActivityAction(openingId, activityId, direction));
    if (res.ok) setAnnouncement(t("movedTo", { n: from + direction + 1 }));
  }
  async function removeStage(stageId: string, index: number) {
    const res = await structural(() => deleteStageAction(openingId, stageId));
    if (!res.ok) return;
    setUndo({ kind: "stage", ...res.value });
    const neighbour = stages[index - 1] ?? stages[index + 1];
    setSelection(neighbour ? { kind: "stage", id: neighbour.id } : null);
    setFocusTarget(neighbour?.id ?? null);
  }
  async function removeActivity(stage: (typeof stages)[number], index: number) {
    const id = stage.activities[index].id;
    const res = await structural(() => deleteActivityAction(openingId, id));
    if (!res.ok) return;
    setUndo({ kind: "activity", ...res.value });
    const neighbour = stage.activities[index - 1] ?? stage.activities[index + 1];
    setSelection(neighbour ? { kind: "activity", id: neighbour.id } : { kind: "stage", id: stage.id });
    setFocusTarget(neighbour?.id ?? stage.id);
  }
  /** "Geri al": the server checks the ticket and puts the item back where it was. */
  async function restore(kind: "stage" | "activity", formData: FormData) {
    const res = await structural(() => (kind === "stage" ? restoreStageFormAction(formData) : restoreActivityFormAction(formData)), "undo");
    if (res.ok) {
      setSelection({ kind, id: res.value });
      setFocusTarget(res.value);
      setAnnouncement(t("restored"));
    }
  }

  const saveLine =
    state.kind === "saving"
      ? t("saving")
      : state.kind === "saved"
        ? t("savedAt", { time: clockTime(new Date(state.at)).slice(0, 5) })
        : state.kind === "refused"
          ? t(refusalKey(state.code, state.fields, context))
          : state.kind === "error"
            ? !state.retryable
              ? t("opFailed")
              : state.retrying
                ? t("saveRetrying")
                : t("saveFailed")
            : "";
  const firstProblem = problems[0] ?? null;
  // Publishing waits for what was typed: the gate the server runs must see it (review minor 5).
  const waiting = state.kind === "saving" || (state.kind === "error" && state.retryable);
  const publishReason = !canEdit ? t("readOnly") : waiting ? t("unsavedFirst") : (firstProblem?.text ?? null);
  const reasonIsProblem = canEdit && !waiting && firstProblem !== null;
  const router = useRouter();
  const previewHref = `/hiring/openings/${openingId}/assessment/preview`;
  /** "Önizle": typed values are sent first, so the preview shows what was just typed. A new tab opens as usual. */
  const openPreview = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    await queue.flush();
    router.push(previewHref);
  };
  /** "Yayınla": typed values are sent first; anything still unsaved keeps the draft from publishing. */
  const publish = async (formData: FormData) => {
    await queue.flush();
    if (queue.unsaved()) return;
    await publishOpeningAction(formData);
  };
  /** The question check in the bar: the stages as shown, typed text saved first, a finding opens its question. */
  const check: BuilderCheck = {
    stages,
    saveFirst: async () => {
      await queue.flush();
      return !queue.unsaved();
    },
    focusActivity: (activityId) => {
      const activity = stages.flatMap((s) => s.activities).find((a) => a.id === activityId);
      if (!activity) return;
      pick({ kind: "activity", id: activityId });
      fieldFocus.current = { id: "prompt-tr", key: `${activity.id}:${activity.type}` };
    },
  };
  const readOnlyNote = closed ? t("closedNote") : !canEdit ? t("readOnly") : mode === "live" ? t("readOnlyLive", { live: liveNumber ?? versionNumber }) : null;

  const tree = (
    <nav aria-label={t("treeLabel")} className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:self-start lg:overflow-y-auto lg:pr-1">
      <ol className="space-y-5">
        {stages.map((stage, si) => {
          const stageLabel = pickText(stage.name, locale) || t("untitledStage", { n: si + 1 });
          return (
            <li key={stage.id} className="space-y-1">
              <button
                type="button"
                ref={(node) => {
                  if (node) treeItems.current.set(stage.id, node);
                  else treeItems.current.delete(stage.id);
                }}
                onClick={() => pick({ kind: "stage", id: stage.id })}
                aria-current={selection?.id === stage.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-semibold text-ink transition-colors duration-[120ms] ease-out hover:bg-subtle",
                  selection?.id === stage.id && "bg-brand-soft hover:bg-brand-soft",
                )}
              >
                <span className="truncate">{stageLabel}</span>
                <span className="tnum shrink-0 text-[12px] font-normal text-muted">{t("stageMinutesShort", { minutes: Math.round(stage.durationSeconds / 60) })}</span>
              </button>
              {stage.activities.length ? (
                <ol className="space-y-0.5 pl-2">
                  {stage.activities.map((activity) => {
                    const Icon = TYPE_ICON[activity.type];
                    return (
                      <li key={activity.id}>
                        <button
                          type="button"
                          ref={(node) => {
                            if (node) treeItems.current.set(activity.id, node);
                            else treeItems.current.delete(activity.id);
                          }}
                          onClick={() => pick({ kind: "activity", id: activity.id })}
                          aria-current={selection?.id === activity.id ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink-2 transition-colors duration-[120ms] ease-out hover:bg-subtle",
                            selection?.id === activity.id && "bg-brand-soft text-ink hover:bg-brand-soft",
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                          <span className="sr-only">{`${t(`type${activity.type}`)}: `}</span>
                          <span className="truncate">{pickText(activity.prompt, locale) || t("untitledActivity")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              {editable && stage.activities.length >= MAX_ACTIVITIES_PER_STAGE ? (
                <div className="space-y-1 pl-2">
                  <Button id={`add-to-${stage.id}`} variant="ghost" size="sm" disabled disabledReason={t("stageFull")}>
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                    {t("addActivity")}
                  </Button>
                  <DisabledReason id={`add-to-${stage.id}-why`} className="px-3">
                    {t("stageFull")}
                  </DisabledReason>
                </div>
              ) : editable ? (
                <div className="pl-2">
                  <DropdownMenu
                    onOpenChange={(open) => {
                      if (open) picked.current = false;
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label={t("addActivityTo", { stage: stageLabel })}>
                        <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                        {t("addActivity")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56"
                      // A picked type opens the new question with focus in its text; Escape returns to the trigger.
                      onCloseAutoFocus={(event) => {
                        if (picked.current) event.preventDefault();
                      }}
                    >
                      {ACTIVITY_TYPES.map((type) => {
                        const Icon = TYPE_ICON[type];
                        return (
                          <DropdownMenuItem key={type} className="py-2" onSelect={() => {
                              picked.current = true;
                              void addActivity(stage.id, type);
                            }}>
                            <Icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                            {t(`type${type}`)}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {editable ? (
        <Button variant="secondary" size="sm" onClick={() => void addStage()}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {t("addStage")}
        </Button>
      ) : null}
      <div className="space-y-1 border-t border-line pt-3">
        <p className="tnum text-[13px] text-muted">{t("total", { stages: stages.length, minutes })}</p>
        {minutes > 30 ? <p className="text-[13px] text-muted">{t("respectTime")}</p> : null}
      </div>
    </nav>
  );

  return (
    <>
      {readOnlyNote ? (
        <p className="mt-6 max-w-[720px] text-[14px] text-ink">{readOnlyNote}</p>
      ) : mode === "draft" && liveNumber !== null ? (
        <p className="tnum mt-6 max-w-[720px] text-[13px] text-muted">{t("draftOfLive", { number: versionNumber, live: liveNumber })}</p>
      ) : null}
      {stages.length === 0 ? (
        <Card className="mt-section max-w-[560px] p-card">
          <p className="text-[16px] leading-6 font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-[14px] text-muted">{t("emptyBody")}</p>
          {editable ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="secondary" onClick={() => void addStage()}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                {t("addStage")}
              </Button>
              <Link
                href={`/hiring/openings/${openingId}/assessment/ai`}
                className="text-[14px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {t("emptyAi")}
              </Link>
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="mt-section grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {tree}
          {/* The two panels sit side by side once the editor itself is wide enough (container
              query, HIRING-UX 5.5: three columns at a 1360 wide panel), not at a viewport width. */}
          <div className="@container min-w-0">
            <div
              ref={editorRef}
              className={cn(
                "grid scroll-mt-4 content-start items-start gap-6 @min-[740px]:grid-cols-2",
                // Read-only fields look settled, not like empty inputs waiting for text.
                !editable &&
                  "[&_input:read-only]:border-line [&_input:read-only]:bg-canvas [&_textarea:read-only]:resize-none [&_textarea:read-only]:border-line [&_textarea:read-only]:bg-canvas [&_.vault_textarea:read-only]:border-vault-line [&_.vault_textarea:read-only]:bg-vault",
              )}
              data-editor={selectedActivity ? `${selectedActivity.id}:${selectedActivity.type}` : (selectedStage?.id ?? "")}
            >
              {selectedActivity && owner ? (
                <ActivityEditor
                  key={`${selectedActivity.id}:${selectedActivity.type}:${epoch}`}
                  activity={selectedActivity}
                  index={activityIndex}
                  count={owner.activities.length}
                  competencies={competencies}
                  binding={binding("activity", selectedActivity.id)}
                  autoFocus={justAdded === selectedActivity.id}
                  onChangeType={async (type) => {
                    setJustAdded(null);
                    const res = await structural(() => saveActivityAction(openingId, selectedActivity.id, { type }));
                    if (res.ok) {
                      fieldFocus.current = { id: "activity-type", key: `${selectedActivity.id}:${type}` };
                      setAnnouncement(t(`type${type}`));
                    }
                    return res.ok;
                  }}
                  onSetCompetencies={(ids) => {
                    queue.edit({ kind: "competencies", id: selectedActivity.id }, "ids", ids);
                    void queue.flush();
                  }}
                  onMove={(direction) => void moveActivity(selectedActivity.id, activityIndex, direction)}
                  onDelete={() => void removeActivity(owner, activityIndex)}
                />
              ) : selectedStage ? (
                <StageEditor
                  key={`${selectedStage.id}:${epoch}`}
                  stage={selectedStage}
                  index={stageIndex}
                  count={stages.length}
                  binding={binding("stage", selectedStage.id)}
                  autoFocus={justAdded === selectedStage.id}
                  onMove={(direction) => void moveStage(selectedStage.id, stageIndex, direction)}
                  onDelete={() => void removeStage(selectedStage.id, stageIndex)}
                />
              ) : (
                <p className="text-[14px] text-muted @min-[740px]:col-span-2">{t("selectHint")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-panel-soft lg:left-(--sidebar-width)">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-page">
          {/* Always present for the screen reader; on a phone an empty line takes no room. */}
          <div
            role="status"
            aria-live="polite"
            className={cn("flex min-h-8 min-w-0 flex-1 items-center gap-2 text-[13px] text-muted sm:min-w-[200px] sm:flex-none", !saveLine && "max-sm:sr-only")}
          >
            <span className={cn("tnum", (state.kind === "refused" || state.kind === "error") && "font-medium text-ink")}>{saveLine}</span>
            {state.kind === "error" && state.retryable ? (
              <Button variant="ghost" size="sm" className="font-medium text-ink underline decoration-line-strong underline-offset-4" onClick={() => void queue.retry()}>
                {t("retry")}
              </Button>
            ) : null}
          </div>
          <BuilderCheckContext value={check}>{checkSlot}</BuilderCheckContext>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <Button asChild variant="secondary">
              <Link href={previewHref} onClick={openPreview}>
                {t("preview")}
              </Link>
            </Button>
            {mode === "draft" ? (
              closed ? null : (
                <form action={publish} className="flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
                  <input type="hidden" name="openingId" value={openingId} />
                  <input type="hidden" name="back" value="builder" />
                  {publishReason ? (
                    <DisabledReason id="builder-publish-why" className="max-w-[420px] text-right">
                      {publishReason}
                      {reasonIsProblem && problems.length > 1 ? ` ${t("moreProblems", { count: problems.length - 1 })}` : ""}
                      {reasonIsProblem && firstProblem?.href?.includes("?") ? (
                        <>
                          {" "}
                          <Link href={firstProblem.href} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                            {t("goToProblem")}
                          </Link>
                        </>
                      ) : null}
                    </DisabledReason>
                  ) : null}
                  <SubmitButton id="builder-publish" label={t("publish")} pendingLabel={t("publishing")} reason={publishReason} />
                </form>
              )
            ) : closed ? null : (
              <form action={startDraftAction} className="flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <input type="hidden" name="openingId" value={openingId} />
                <p id="builder-start-why" className="max-w-[460px] text-right text-[13px] text-muted">
                  {canEdit ? t("liveNote", { live: liveNumber ?? versionNumber, next: versionNumber + 1 }) : t("readOnly")}
                </p>
                <SubmitButton id="builder-start" label={t("startEditing")} pendingLabel={t("starting")} reason={canEdit ? null : t("readOnly")} />
              </form>
            )}
          </div>
        </div>
      </div>

      {undo ? (
        // The strip is fixed to the bottom; this transformed box becomes its frame, so it sits above the bar.
        <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-50 h-0 transform-gpu">
          <UndoStrip
            key={undo.token}
            message={undo.kind === "stage" ? t("stageDeleted") : t("activityDeleted")}
            action={(formData) => restore(undo.kind, formData)}
            onSubmitted={() => setUndo(null)}
            hiddenFields={{
              openingId,
              payload: undo.payload,
              index: String(undo.index),
              token: undo.token,
              ...(undo.kind === "activity" ? { stageId: undo.stageId } : {}),
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/** The bar's one filled button; while its form is on its way it says so and cannot be pressed twice. */
function SubmitButton({ id, label, pendingLabel, reason }: { id: string; label: string; pendingLabel: string; reason: string | null }) {
  const { pending } = useFormStatus();
  return (
    <Button id={id} type="submit" variant="primary" disabled={pending || reason !== null} disabledReason={reason ?? undefined} aria-busy={pending || undefined}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
