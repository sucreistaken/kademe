"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { useMT } from "@/i18n/manager-client";
import {
  EMPTY_DIRTY,
  clearDirty,
  markDirty,
  mergeDirty,
  type DirtyMap,
} from "./merge-dirty";
import { Button, DisabledReason } from "@/components/ui/button";
import { TemplateSteps } from "@/components/manager/template-steps";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import type { I18nText } from "@/db/schema/types";
import {
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  addActivity,
  updateActivity,
  deleteActivity,
  setStageCompetencies,
  setVersionLocales,
  type BuilderErrorCode,
} from "./actions";
import {
  publishVersion,
  type PositionErrorCode,
} from "@/app/(manager)/positions/actions";

/* ------------------------------------------------------------------ types */

export type BuilderActivity = {
  id: string;
  type: string;
  isRequired: boolean;
  candidatePrompt: I18nText;
  candidateNote: I18nText | null;
  internalQuestion: string | null;
  internalObjective: string | null;
  expectedBehaviours: string[];
  redFlags: string[];
  thinkSeconds: number;
  answerSeconds: number | null;
  maxTakes: number;
};

export type BuilderStage = {
  id: string;
  name: I18nText;
  description: I18nText | null;
  internalPurpose: string | null;
  internalObjective: string | null;
  durationSeconds: number;
  graceSeconds: number;
  backNavigation: boolean;
  competencyIds: string[];
  activities: BuilderActivity[];
};

const TYPES = [
  "VIDEO",
  "AUDIO",
  "LONG_TEXT",
  "SHORT_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "FILE_UPLOAD",
  "SCENARIO",
] as const;

type ActivityType = (typeof TYPES)[number];

function isActivityType(value: string): value is ActivityType {
  return (TYPES as readonly string[]).includes(value);
}

/** The builder's own type vocabulary, one key per activity type. */
type TypeT = (key: `type${ActivityType}`) => string;

function typeLabel(t: TypeT, type: string): string {
  return isActivityType(type) ? t(`type${type}`) : type;
}

/**
 * A failed write names its reason with a code. Builder codes and the publish
 * codes that come back from the positions module live in separate namespaces,
 * so the lookup asks the one the code belongs to.
 */
const BUILDER_CODES: readonly string[] = [
  "VERSION_NOT_FOUND",
  "VERSION_PUBLISHED",
  "STAGE_NOT_FOUND",
  "INVALID_STAGE",
  "ACTIVITY_NOT_FOUND",
  "INVALID_ACTIVITY",
];

const field =
  "w-full rounded-[6px] border border-line bg-surface px-2.5 py-2 text-[13px] " +
  "outline-none focus:border-muted placeholder:text-muted/70";

/**
 * The same field on the dark "manager only" ground. Inheriting the light one
 * there leaves dark text on a dark box, which is exactly what happened the
 * first time this column was built.
 */
const vaultField =
  "w-full rounded-[6px] border border-vault-line bg-vault-box px-2.5 py-2 text-[13px] " +
  "text-vault-text outline-none focus:border-vault-chip placeholder:text-vault-label/70";

type Minutes = (seconds: number) => string;

/* ------------------------------------------------------------- sortable row */

function Sortable({
  id,
  children,
  disabled,
}: {
  id: string;
  children: (handle: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-60")}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/** No store to watch: the value flips once, when the client takes over. */
const subscribeNever = () => () => {};

/**
 * Wraps the list in dnd-kit only once the client has taken over. Before that it
 * is a plain container, so the server and the first client render agree.
 */
function StageSorter({
  enabled,
  sensors,
  ids,
  onDragEnd,
  children,
}: {
  enabled: boolean;
  sensors: ReturnType<typeof useSensors>;
  ids: string[];
  onDragEnd: (event: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <DndContext
      id="stage-sorter"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------- the screen */

export function BuilderScreen({
  basePath,
  versionId,
  positionName,
  templateName,
  versionNumber,
  status,
  library,
  locales,
  stages: initialStages,
}: {
  basePath: string;
  versionId: string;
  positionName: string;
  templateName: string;
  versionNumber: number;
  status: string;
  library: Array<{ id: string; name: string }>;
  /** The languages this version claims to be written in. */
  locales: ReadonlyArray<"tr" | "en">;
  stages: BuilderStage[];
}) {
  const t = useMT("builder");
  const shared = useMT("shared");
  const builderErrors = useMT("builderErrors");
  const positionErrors = useMT("positionErrors");
  const locale = useLocale();
  // Which half of the bilingual content is being written. Lifted to the screen
  // so it survives switching between activities: a manager filling in the
  // English half wants to stay in English while they work down the list.
  const [contentLang, setContentLang] = useState<"tr" | "en">(locales[0] ?? "tr");
  const minutes: Minutes = (seconds) =>
    shared("minutes", {
      count: seconds % 60 === 0 ? seconds / 60 : Math.round(seconds / 60),
    });
  const errorText = (code: BuilderErrorCode | PositionErrorCode) =>
    BUILDER_CODES.includes(code)
      ? builderErrors(code as BuilderErrorCode)
      : positionErrors(code as PositionErrorCode);

  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  // Fields edited locally and not yet handed to a save. See merge-dirty.ts.
  const [dirty, setDirty] = useState<DirtyMap>(EMPTY_DIRTY);

  /**
   * Local state seeded from a prop goes stale the moment the server sends new
   * data: router.refresh() re-rendered this component with a new tree and the
   * list kept showing the old one. Resetting during render when the incoming
   * prop actually changed is React's own answer to that, and it is cheaper and
   * less surprising than an effect that fires after a paint.
   *
   * Not a plain reset, though. Every save triggers a refresh, and the manager
   * has usually tabbed into the next field by the time it lands; replacing the
   * tree wholesale threw away what they had typed there. Dirty fields keep
   * their local value, everything else takes the server's.
   */
  const [seenStages, setSeenStages] = useState(initialStages);
  if (seenStages !== initialStages) {
    setSeenStages(initialStages);
    setStages(mergeDirty(initialStages, stages, dirty));
  }
  const [selected, setSelected] = useState<string | null>(
    initialStages[0]?.activities[0]?.id ?? null,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const readOnly = status !== "DRAFT";

  /**
   * dnd-kit numbers its aria-describedby targets from a module counter that
   * restarts on the client, so server and client disagree and React reports a
   * hydration mismatch on every load. Dragging is a pointer affordance that
   * means nothing before hydration anyway, so the sortable wiring mounts after
   * it. The list itself still renders on the server.
   *
   * useSyncExternalStore rather than an effect: it is the API built for "server
   * and client legitimately differ here", so React hands over without a
   * cascading render and without the mismatch warning.
   */
  const dragReady = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalSeconds = stages.reduce((acc, s) => acc + s.durationSeconds, 0);
  const activityCount = stages.reduce((acc, s) => acc + s.activities.length, 0);

  // Not memoised: it is a walk over a handful of stages, and the React Compiler
  // handles it better than a manual dependency list does.
  const found = (() => {
    for (const stage of stages) {
      const activity = stage.activities.find((a) => a.id === selected);
      if (activity) return { stage, activity };
    }
    return null;
  })();

  /** Every mutation refreshes from the server so the tree never drifts. */
  const run = (
    fn: () => Promise<{ ok: true } | { ok: false; code: BuilderErrorCode }>,
  ) =>
    start(async () => {
      setProblem(null);
      const result = await fn();
      if (!result.ok) {
        setProblem(errorText(result.code));
        return;
      }
      setSaved(
        new Date().toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      router.refresh();
    });

  /** Local echo for a stage field, so typing does not wait on the server. */
  const patchStage = (id: string, patch: Partial<BuilderStage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty((prev) => markDirty(prev, id, Object.keys(patch)));
  };

  const patchActivity = (id: string, patch: Partial<BuilderActivity>) => {
    setStages((prev) =>
      prev.map((s) => ({
        ...s,
        activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),
    );
    setDirty((prev) => markDirty(prev, id, Object.keys(patch)));
  };

  /**
   * A field handed to a save is clean again: from here the server's copy is
   * the truth, and the refresh that follows the save is allowed to replace it.
   */
  const saveStage = (id: string, patch: Parameters<typeof updateStage>[1]) => {
    setDirty((prev) => clearDirty(prev, id, Object.keys(patch)));
    run(() => updateStage(id, patch));
  };

  const saveActivity = (id: string, patch: Parameters<typeof updateActivity>[1]) => {
    setDirty((prev) => clearDirty(prev, id, Object.keys(patch)));
    run(() => updateActivity(id, patch));
  };

  const onStageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stages.findIndex((s) => s.id === active.id);
    const to = stages.findIndex((s) => s.id === over.id);
    const next = arrayMove(stages, from, to);
    setStages(next);
    run(() => reorderStages(versionId, next.map((s) => s.id)));
  };

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] text-muted">
            <Link href="/positions" className="hover:text-ink">
              {shared("positionsBreadcrumb")}
            </Link>{" "}
            /{" "}
            <Link href={basePath.split("/templates")[0]} className="hover:text-ink">
              {positionName}
            </Link>
          </p>
          <h1 className="mt-1 text-[19px] font-semibold tracking-tight">
            {templateName} · v{versionNumber}
          </h1>
          <div className="mt-1.5">
            <TemplateSteps
              basePath={basePath}
              current={readOnly ? 3 : 1}
              reviewable={activityCount > 0}
            />
          </div>
          {/* Which languages this version ships in. Without it a template opens
              Turkish only and there is no way to say otherwise, which leaves
              the bilingual fields in the editor unreachable. Turkish is not
              removable: it is the fallback every reader lands on. */}
          {!readOnly ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
              <span>{t("candidateLanguages")}</span>
              {(["tr", "en"] as const).map((code) => {
                const on = locales.includes(code);
                const fixed = code === "tr";
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={fixed || pending}
                    aria-pressed={on}
                    onClick={() =>
                      run(() =>
                        setVersionLocales(
                          versionId,
                          on
                            ? locales.filter((c) => c !== code)
                            : [...locales, code],
                        ),
                      )
                    }
                    className={cn(
                      "rounded-[6px] px-1.5 py-0.5",
                      on
                        ? "bg-accent-soft font-medium text-accent"
                        : "border border-line text-muted hover:text-ink",
                      fixed && "cursor-default",
                    )}
                  >
                    {on ? code.toUpperCase() : `+ ${code.toUpperCase()}`}
                  </button>
                );
              })}
            </p>
          ) : null}
          <p className="mt-1">
            <StatusDot tone={readOnly ? "done" : "active"}>
              {readOnly
                ? t("publishedReadOnly")
                : saved
                  ? t("autosaved", { time: saved })
                  : t("draftAutosave")}
            </StatusDot>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Nothing to preview until there is something in it, and a preview
              of an empty assessment is a dead end. */}
          {activityCount > 0 ? (
            <Button variant="secondary" size="md" asChild>
              <Link href={`${basePath}/preview`}>{t("previewCandidate")}</Link>
            </Button>
          ) : null}
          {!readOnly ? (
            <Button
              variant="primary"
              size="md"
              disabled={pending || activityCount === 0}
              disabledReason={
                activityCount === 0 ? t("needActivity") : pending ? t("adding") : undefined
              }
              aria-describedby={activityCount === 0 ? "publish-why" : undefined}
              onClick={() =>
                start(async () => {
                  const result = await publishVersion(versionId);
                  if (!result.ok) return setProblem(errorText(result.code));
                  router.refresh();
                })
              }
            >
              {t("publish")}
            </Button>
          ) : null}
          {activityCount === 0 && !readOnly ? (
            <DisabledReason id="publish-why">{t("needActivity")}</DisabledReason>
          ) : null}
        </div>
      </div>

      {problem ? (
        <p role="alert" className="mb-4 text-[13px] text-danger">
          {problem}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ---------------------------------------------------- stage tree */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[13px] font-semibold">{t("stages")}</p>
            <p className="text-[12px] text-muted tnum">
              {t("stagesSummary", {
                count: stages.length,
                duration: minutes(totalSeconds),
              })}
            </p>
          </div>
          {!readOnly && stages.length > 1 ? (
            <p className="mb-2 text-[12px] text-muted">{t("dragHint")}</p>
          ) : null}

          <StageSorter
            enabled={dragReady && !readOnly}
            sensors={sensors}
            ids={stages.map((s) => s.id)}
            onDragEnd={onStageDragEnd}
          >
              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <Sortable
                    key={stage.id}
                    id={stage.id}
                    disabled={readOnly || !dragReady}
                  >
                    {(handle) => (
                      <Card className="overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                          {!readOnly ? (
                            <button
                              {...handle}
                              aria-label={t("moveStage")}
                              className="cursor-grab px-1 text-[13px] text-muted hover:text-ink"
                            >
                              ⠿
                            </button>
                          ) : null}
                          <span className="shrink-0 text-[13.5px] font-medium tnum">
                            {i + 1} ·
                          </span>
                          {/* The candidate reads this in the stage bar, so the
                              manager has to be able to write it. An input that
                              looks like text until it is focused, saving on
                              blur, which is the same contract the rest of this
                              screen uses. Dragging is on the handle, so an
                              editable field here does not fight it. */}
                          {readOnly ? (
                            <span
                              lang={contentLang}
                              className="flex-1 truncate text-[13.5px] font-medium"
                            >
                              {stage.name[contentLang] || t("unnamedStage")}
                            </span>
                          ) : (
                            <input
                              lang={contentLang}
                              aria-label={t("stageNameLabel")}
                              value={stage.name[contentLang] ?? ""}
                              placeholder={t("unnamedStage")}
                              maxLength={120}
                              onChange={(e) =>
                                patchStage(stage.id, {
                                  name: {
                                    ...stage.name,
                                    [contentLang]: e.target.value,
                                  },
                                })
                              }
                              onKeyDown={(e) => {
                                // Enter as well as blur. A manager renaming a
                                // stage presses it out of habit, and relying on
                                // blur alone means a save that never happens if
                                // they never click away.
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                  saveStage(stage.id, { name: stage.name });
                                }
                              }}
                              onBlur={() => saveStage(stage.id, { name: stage.name })}
                              className="min-w-0 flex-1 rounded-[6px] border border-transparent
                                         bg-transparent px-1.5 py-0.5 text-[13.5px] font-medium
                                         hover:border-line focus:border-line-strong
                                         focus:bg-surface focus:outline-none"
                            />
                          )}
                          <span className="text-[12px] text-muted tnum">
                            {minutes(stage.durationSeconds)}
                          </span>
                          {!readOnly ? (
                            <button
                              onClick={() => run(() => deleteStage(stage.id))}
                              className="px-1 text-[12px] text-muted hover:text-danger"
                              aria-label={t("deleteStage")}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>

                        <div className="divide-y divide-line">
                          {stage.activities.length === 0 ? (
                            <p className="px-3 py-2.5 text-[12.5px] text-muted">
                              {t("noActivities")}
                            </p>
                          ) : (
                            stage.activities.map((activity) => (
                              <button
                                key={activity.id}
                                onClick={() => setSelected(activity.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2.5 text-left",
                                  selected === activity.id
                                    ? "bg-canvas"
                                    : "hover:bg-canvas/60",
                                )}
                              >
                                <span className="flex-1 truncate text-[12.5px]">
                                  {activity.candidatePrompt.tr || (
                                    <span className="text-muted">{t("noPrompt")}</span>
                                  )}
                                </span>
                                <span className="shrink-0 text-[11.5px] text-muted">
                                  {typeLabel(t, activity.type)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>

                        {!readOnly ? (
                          <div className="border-t border-line px-3 py-2">
                            <select
                              value=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                run(() =>
                                  addActivity(stage.id, e.target.value as never),
                                );
                              }}
                              className="w-full rounded-[6px] border border-line bg-surface px-2 py-1.5 text-[12.5px] text-muted"
                            >
                              <option value="">{t("addActivity")}</option>
                              {TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {t(`type${type}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </Card>
                    )}
                  </Sortable>
                ))}
              </div>
          </StageSorter>

          {!readOnly ? (
            <Button
              variant="secondary"
              size="md"
              className="mt-3 w-full"
              disabled={pending}
              disabledReason={pending ? t("adding") : undefined}
              onClick={() => run(() => addStage(versionId))}
            >
              {t("addStage")}
            </Button>
          ) : null}

          {/* Only in read only. While the version is editable the first run
              panel on the right says this, with the two ways to act on it. */}
          {stages.length === 0 && readOnly ? (
            <p className="mt-3 text-[12.5px] text-muted">{t("noStages")}</p>
          ) : null}

        </div>

        {/* ------------------------------------------------ activity editor */}
        {found ? (
          <ActivityEditor
            key={found.activity.id}
            stage={found.stage}
            activity={found.activity}
            library={library}
            readOnly={readOnly}
            locales={locales}
            contentLang={contentLang}
            onContentLang={setContentLang}
            onPatch={patchActivity}
            onSave={(patch) => saveActivity(found.activity.id, patch)}
            onSaveStage={(patch) => saveStage(found.stage.id, patch)}
            onDelete={() => {
              setSelected(null);
              run(() => deleteActivity(found.activity.id));
            }}
            onCompetencies={(ids) =>
              run(() => setStageCompetencies(found.stage.id, ids))
            }
          />
        ) : stages.length === 0 ? (
          /* First run. "Pick an activity from the list on the left" is a lie
             when the left is empty, and it was the first sentence a manager
             read. This says what the two ways to fill the template are, and
             the AI one is a link rather than a second filled button. */
          <Card className="grid place-items-center p-10">
            <div className="max-w-[44ch] text-center">
              <p className="text-[14px]">{t("firstRunTitle")}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {t("firstRunBody")}
              </p>
              {!readOnly ? (
                <div className="mt-5 flex flex-col items-center gap-2.5">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={pending}
                    disabledReason={pending ? t("adding") : undefined}
                    onClick={() => run(() => addStage(versionId))}
                  >
                    {t("addStage")}
                  </Button>
                  <Link
                    href={`${basePath}/ai`}
                    className="text-[13px] text-muted underline decoration-line
                               underline-offset-[3px] hover:text-ink hover:decoration-ink"
                  >
                    {t("askAi")}
                  </Link>
                </div>
              ) : null}
            </div>
          </Card>
        ) : (
          <Card className="grid place-items-center p-10">
            <p className="max-w-[44ch] text-center text-[13px] text-muted">
              {/* There is a stage but nothing in it yet, so "pick an activity
                  from the list" is still one step ahead of the manager. The
                  next thing to do is put a question in the stage. */}
              {activityCount === 0 && !readOnly
                ? t("addFirstActivity")
                : t("pickActivity")}
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

/* --------------------------------------------------------------- the editor */

function ActivityEditor({
  stage,
  activity,
  library,
  readOnly,
  locales,
  contentLang,
  onContentLang,
  onPatch,
  onSave,
  onSaveStage,
  onDelete,
  onCompetencies,
}: {
  stage: BuilderStage;
  activity: BuilderActivity;
  library: Array<{ id: string; name: string }>;
  readOnly: boolean;
  locales: ReadonlyArray<"tr" | "en">;
  contentLang: "tr" | "en";
  onContentLang: (next: "tr" | "en") => void;
  onPatch: (id: string, patch: Partial<BuilderActivity>) => void;
  onSave: (patch: Record<string, unknown>) => void;
  onSaveStage: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onCompetencies: (ids: string[]) => void;
}) {
  const t = useMT("builder");
  const isMedia = activity.type === "VIDEO" || activity.type === "AUDIO";
  const stageName = stage.name.tr || t("stageFallback");

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* The kicker is upper cased by CSS, and casing follows the element's
              language: the stage name is the Turkish half of a bilingual record,
              so it says so or "Kıdemli" renders as "KIDEMLI" on an English panel. */}
          <p className="text-[11.5px] uppercase tracking-wide text-muted">
            <span lang="tr">{stageName}</span> · {typeLabel(t, activity.type)}
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {activity.candidatePrompt.tr || t("noPrompt")}
          </p>
          {isMedia ? (
            <p className="mt-1 text-[12.5px] text-muted tnum">
              {t("timing", {
                think: activity.thinkSeconds,
                answer: Math.round((activity.answerSeconds ?? 0) / 60),
                takes: activity.maxTakes,
              })}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            {t("deleteActivity")}
          </Button>
        ) : null}
      </div>

      {/*
        Canvas Y2 puts these side by side rather than behind tabs, and the
        artboard is literally titled "adaya görünen ↔ sadece yönetici görür".
        The arrow is the point: the manager writes the hidden evaluation logic
        while looking at exactly what the candidate will read. Tabs hide one
        half at the moment it is most useful, so this is two columns, and the
        manager half is dark so the split is never ambiguous.
      */}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="grid size-4 place-items-center rounded-[3px] bg-ink text-[10px] font-semibold text-surface">
              {t("candidateSideMark")}
            </span>
            <h4 className="text-[13px] font-semibold">{t("candidateSideTitle")}</h4>
            <span className="text-[11.5px] text-muted">{t("candidateSideHint")}</span>
            {/* Which half of the bilingual content is being written. Only when
                the version claims more than one language: a Turkish only
                template has no second half to fill. */}
            {locales.length > 1 ? (
              <span className="ml-auto flex items-center gap-1">
                {locales.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onContentLang(code)}
                    aria-current={code === contentLang ? "true" : undefined}
                    className={cn(
                      "rounded-[6px] px-1.5 py-0.5 text-[11.5px]",
                      code === contentLang
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
          <div className="space-y-4 rounded-[10px] border border-line p-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium">
              {t("promptLabel")}
            </span>
            <textarea
              rows={4}
              lang={contentLang}
              disabled={readOnly}
              value={activity.candidatePrompt[contentLang] ?? ""}
              onChange={(e) =>
                onPatch(activity.id, {
                  candidatePrompt: {
                    ...activity.candidatePrompt,
                    [contentLang]: e.target.value,
                  },
                })
              }
              onBlur={() => onSave({ candidatePrompt: activity.candidatePrompt })}
              className={`${field} resize-y leading-relaxed`}
            />
            {/* An empty half is not a typo, it is a question the candidate in
                that language would see blank. The invite screen refuses to
                offer a language until every question exists in it, so this line
                is the only place the manager finds out why. */}
            {locales.length > 1 && !activity.candidatePrompt[contentLang]?.trim() ? (
              <span className="mt-1 block text-[12px] text-muted">
                {t("promptMissing", { lang: contentLang.toUpperCase() })}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium">
              {t("noteLabel")}
            </span>
            <input
              lang={contentLang}
              disabled={readOnly}
              value={activity.candidateNote?.[contentLang] ?? ""}
              onChange={(e) =>
                onPatch(activity.id, {
                  candidateNote: {
                    tr: activity.candidateNote?.tr ?? "",
                    en: activity.candidateNote?.en ?? "",
                    [contentLang]: e.target.value,
                  },
                })
              }
              onBlur={() => onSave({ candidateNote: activity.candidateNote })}
              placeholder={t("notePlaceholder")}
              className={field}
            />
          </label>

          {isMedia ? (
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium">
                  {t("thinkSeconds")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={600}
                  disabled={readOnly}
                  value={activity.thinkSeconds}
                  onChange={(e) =>
                    onPatch(activity.id, { thinkSeconds: Number(e.target.value) || 0 })
                  }
                  onBlur={() => onSave({ thinkSeconds: activity.thinkSeconds })}
                  className={`${field} tnum`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium">
                  {t("answerSeconds")}
                </span>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  disabled={readOnly}
                  value={activity.answerSeconds ?? 180}
                  onChange={(e) =>
                    onPatch(activity.id, { answerSeconds: Number(e.target.value) || 10 })
                  }
                  onBlur={() => onSave({ answerSeconds: activity.answerSeconds })}
                  className={`${field} tnum`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium">
                  {t("maxTakes")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  disabled={readOnly}
                  value={activity.maxTakes}
                  onChange={(e) =>
                    onPatch(activity.id, { maxTakes: Number(e.target.value) || 1 })
                  }
                  onBlur={() => onSave({ maxTakes: activity.maxTakes })}
                  className={`${field} tnum`}
                />
              </label>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={activity.isRequired}
              onChange={(e) => {
                onPatch(activity.id, { isRequired: e.target.checked });
                onSave({ isRequired: e.target.checked });
              }}
            />
            {t("requiredLabel")}
          </label>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="grid size-4 place-items-center rounded-[3px] bg-ink text-[10px] font-semibold text-surface">
              {t("managerSideMark")}
            </span>
            <h4 className="text-[13px] font-semibold">{t("managerSideTitle")}</h4>
            <span className="text-[11px] uppercase tracking-wide text-muted">
              {t("managerSideHint")}
            </span>
          </div>

          <div className="space-y-4 rounded-[10px] bg-vault p-4 text-vault-text">
            <p className="text-[12px] text-vault-label">{t("managerSideNote")}</p>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-vault-text">
              {t("internalObjective")}
            </span>
            <textarea
              rows={3}
              lang="tr"
              disabled={readOnly}
              value={activity.internalObjective ?? ""}
              onChange={(e) =>
                onPatch(activity.id, { internalObjective: e.target.value })
              }
              onBlur={() => onSave({ internalObjective: activity.internalObjective })}
              placeholder={t("internalObjectivePlaceholder")}
              className={`${vaultField} resize-y leading-relaxed`}
            />
          </label>

          <ListEditor
            label={t("expectedBehaviour")}
            values={activity.expectedBehaviours}
            readOnly={readOnly}
            dark
            placeholder={t("expectedBehaviourPlaceholder")}
            onChange={(values) => {
              onPatch(activity.id, { expectedBehaviours: values });
              onSave({ expectedBehaviours: values });
            }}
          />

          <ListEditor
            label={t("redFlags")}
            values={activity.redFlags}
            readOnly={readOnly}
            dark
            placeholder={t("redFlagsPlaceholder")}
            onChange={(values) => {
              onPatch(activity.id, { redFlags: values });
              onSave({ redFlags: values });
            }}
          />

          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-vault-text text-vault-text">
              {t("stageCompetencies")}
            </p>
            {library.length === 0 ? (
              <p className="text-[12.5px] text-vault-label">
                {t("libraryEmpty")}{" "}
                <Link href="/library" className="underline underline-offset-2">
                  {t("goToLibrary")}
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {library.map((competency) => {
                  const on = stage.competencyIds.includes(competency.id);
                  return (
                    <button
                      key={competency.id}
                      disabled={readOnly}
                      onClick={() =>
                        onCompetencies(
                          on
                            ? stage.competencyIds.filter((c) => c !== competency.id)
                            : [...stage.competencyIds, competency.id],
                        )
                      }
                      className={cn(
                        "rounded-[6px] border px-2 py-1 text-[12.5px]",
                        on
                          ? "border-vault-text/40 bg-vault-text/10 font-medium text-vault-text"
                          : "border-vault-chip bg-transparent text-vault-label hover:text-vault-text",
                      )}
                    >
                      {competency.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-[12px] text-vault-label">
              {t("competencyStageLevel")}
            </p>
          </div>

          <div className="border-t border-vault-line pt-4">
            <p className="mb-2 text-[12.5px] font-medium text-vault-text">
              {t("stageSettings")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-vault-label">
                  {t("stageDuration")}
                </span>
                <input
                  type="number"
                  min={30}
                  disabled={readOnly}
                  defaultValue={stage.durationSeconds}
                  onBlur={(e) =>
                    onSaveStage({ durationSeconds: Number(e.target.value) || 300 })
                  }
                  className={`${vaultField} tnum`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-vault-label">
                  {t("graceSeconds")}
                </span>
                <input
                  type="number"
                  min={0}
                  disabled={readOnly}
                  defaultValue={stage.graceSeconds}
                  onBlur={(e) =>
                    onSaveStage({ graceSeconds: Number(e.target.value) || 0 })
                  }
                  className={`${vaultField} tnum`}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                disabled={readOnly}
                defaultChecked={stage.backNavigation}
                onChange={(e) => onSaveStage({ backNavigation: e.target.checked })}
              />
              {t("backNavigation")}
            </label>
          </div>
          </div>
        </section>
      </div>
    </Card>
  );
}

function ListEditor({
  label,
  values,
  readOnly,
  placeholder,
  dark = false,
  onChange,
}: {
  label: string;
  values: string[];
  readOnly: boolean;
  placeholder: string;
  /** Rendered on the dark manager column, where the light field is unreadable. */
  dark?: boolean;
  onChange: (values: string[]) => void;
}) {
  const shared = useMT("shared");
  const input = dark ? vaultField : field;
  const [draft, setDraft] = useState("");
  return (
    <div>
      <p className={cn("mb-1.5 text-[12.5px] font-medium", dark && "text-vault-text")}>
        {label}
      </p>
      <ol className="space-y-1.5">
        {values.map((value, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn("pt-1.5 text-[11.5px] tnum", dark ? "text-vault-label" : "text-muted")}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <input
              lang="tr"
              disabled={readOnly}
              value={value}
              onChange={(e) =>
                onChange(values.map((v, j) => (j === i ? e.target.value : v)))
              }
              className={`${input} flex-1`}
            />
            {!readOnly ? (
              <button
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className={cn("pt-1.5 text-[12px]", dark ? "text-vault-label hover:text-vault-mark" : "text-muted hover:text-danger")}
                aria-label={shared("remove")}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {!readOnly ? (
        <input
          lang="tr"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !draft.trim()) return;
            e.preventDefault();
            onChange([...values, draft.trim()]);
            setDraft("");
          }}
          onBlur={() => {
            if (!draft.trim()) return;
            onChange([...values, draft.trim()]);
            setDraft("");
          }}
          className={`${field} mt-1.5`}
        />
      ) : null}
    </div>
  );
}
