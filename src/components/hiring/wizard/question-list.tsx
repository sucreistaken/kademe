"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { UndoStrip } from "@/components/ui/undo-strip";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { pickText } from "@/lib/i18n-text";
import { MAX_ACTIVITIES_PER_STAGE } from "@/solutions/hiring/rules/patches";
import { ACTIVITY_TYPES, orderedActivities, orderedStages, type ActivityType, type ContentStage } from "@/solutions/hiring/rules/content";
import {
  addActivityAction,
  addStageAction,
  deleteActivityAction,
  moveActivityAction,
  restoreActivityFormAction,
  saveActivityAction,
} from "@/app/(manager)/hiring/openings/[id]/assessment/edit/actions";
import type { UndoTicket } from "@/app/(manager)/hiring/openings/[id]/assessment/edit/result";
import { reviseAssessmentAction } from "@/app/(manager)/hiring/openings/[id]/setup/actions";
import { ActivityEditor } from "@/components/hiring/builder/activity-editor";
import { TYPE_ICON } from "@/components/hiring/builder/builder";
import type { EditorBinding } from "@/components/hiring/builder/fields";
import { withUnsaved } from "@/components/hiring/builder/overlay";
import { refusalKey } from "@/components/hiring/builder/refusal-copy";
import type { useSaver } from "@/components/hiring/builder/use-saver";
import { aiCodeKey } from "./setup-model";

const LINK =
  "inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-[13px] font-medium text-ink-2 underline decoration-transparent underline-offset-4 transition-colors duration-[120ms] ease-out hover:text-ink hover:decoration-line-strong disabled:text-muted";

type Saver = ReturnType<typeof useSaver>;

/**
 * HIRING-UX 5.20 step 2's list: the stages as headings, their questions under
 * them. Each question opens its editor in place ("Düzenle", the builder's own
 * ActivityEditor and save queue), takes an instruction for the AI ("AI ile
 * düzelt", that question only) and is deleted with the builder's 8 second
 * undo. "+ Kendi sorunu ekle" ends the list.
 */
export function QuestionList({
  openingId,
  stages: unordered,
  competencies,
  locale,
  saver,
  epoch,
  initialOpen,
  onRevised,
  onBusy,
}: {
  openingId: string;
  stages: ContentStage[];
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  locale: Locale;
  saver: Saver;
  epoch: number;
  initialOpen: string | null;
  /** An "AI ile düzelt" was applied: the wizard shows its undo strip. */
  onRevised: (undoToken: string) => void;
  /** An "AI ile düzelt" is running (30-40 s): the wizard's footer waits for it. */
  onBusy?: (busy: boolean) => void;
}) {
  const t = useMT("hiringWizard");
  const b = useMT("hiringBuilder");
  const router = useRouter();
  const { queue, state } = saver;
  const stages = orderedStages({ stages: withUnsaved(unordered, queue.entries()) }).map((s) => ({ ...s, activities: orderedActivities(s) }));
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixPending, startFix] = useTransition();
  const [undo, setUndo] = useState<(UndoTicket & { stageId: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const binding = (targetId: string): EditorBinding => ({
    editable: true,
    onEdit: (field, value) => queue.edit({ kind: "activity", id: targetId }, field, value),
    onFlush: () => void queue.flush(),
    errorFor: (field) => {
      if (state.kind !== "refused" || state.targetId !== targetId) return null;
      const match = state.fields.find((f) => f === field || f.startsWith(`${field}.`));
      return match ? b(refusalKey(state.code, [match])) : null;
    },
  });

  const said = (res: { ok: boolean; code?: string }) => {
    if (res.ok) {
      setError(null);
      return true;
    }
    setError(res.code === "NETWORK" ? b("opFailed") : b(refusalKey(res.code as Parameters<typeof refusalKey>[0], [])));
    return false;
  };

  async function add(type: ActivityType) {
    const last = stages[stages.length - 1];
    let stageId = last && last.activities.length < MAX_ACTIVITIES_PER_STAGE ? last.id : null;
    if (!stageId) {
      const made = await queue.run(() => addStageAction(openingId));
      if (!said(made) || !made.ok) return;
      stageId = made.value;
    }
    const target = stageId;
    const res = await queue.run(() => addActivityAction(openingId, target, type));
    if (!said(res) || !res.ok) return;
    setOpen(res.value);
    setJustAdded(res.value);
    setAnnouncement(t("added"));
    router.refresh();
  }

  async function remove(activityId: string) {
    const res = await queue.run(() => deleteActivityAction(openingId, activityId));
    if (!said(res) || !res.ok) return;
    if (open === activityId) setOpen(null);
    setUndo(res.value);
    setAnnouncement(b("activityDeleted"));
    router.refresh();
  }

  async function restore(formData: FormData) {
    const res = await queue.run(() => restoreActivityFormAction(formData));
    if (said(res) && res.ok) {
      setAnnouncement(b("restored"));
      router.refresh();
    }
  }

  async function move(activityId: string, direction: -1 | 1) {
    const res = await queue.run(() => moveActivityAction(openingId, activityId, direction));
    if (said(res)) router.refresh();
  }

  function fix(activityId: string) {
    const text = instruction.trim();
    if (!text) return;
    setFixError(null);
    onBusy?.(true);
    startFix(async () => {
      await queue.flush();
      try {
        const res = await reviseAssessmentAction(openingId, { instruction: text, target: { kind: "activity", activityId } });
        if (!res.ok) {
          setFixError(t(aiCodeKey(res.code)));
          return;
        }
        setFixing(null);
        setInstruction("");
        setOpen(null);
        onRevised(res.undoToken);
        router.refresh();
      } catch {
        setFixError(t("aiFailed"));
      } finally {
        onBusy?.(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {stages.length === 0 ? <p className="text-[14px] text-muted">{t("empty")}</p> : null}
      {stages.map((stage, si) => (
        <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 id={`stage-${stage.id}`} className="text-[16px] leading-6 font-semibold text-ink">
              {pickText(stage.name, locale) || b("untitledStage", { n: si + 1 })}
            </h2>
            <p className="tnum text-[13px] text-muted">{t("stageMeta", { minutes: Math.round(stage.durationSeconds / 60), count: stage.activities.length })}</p>
          </div>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {stage.activities.map((activity, ai) => {
              const Icon = TYPE_ICON[activity.type];
              const prompt = pickText(activity.prompt, locale) || b("untitledActivity");
              const editing = open === activity.id;
              return (
                <li key={activity.id} data-activity={activity.id} className="space-y-3 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-[18px] shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-[22px] break-words text-ink">{prompt}</p>
                      <p className="text-[12px] leading-5 text-muted">{b(`type${activity.type}`)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 pl-[30px]">
                    <button
                      type="button"
                      className={LINK}
                      aria-expanded={editing}
                      aria-label={`${editing ? t("doneEditing") : t("edit")}: ${prompt}`}
                      onClick={() => {
                        if (editing) {
                          void queue.flush().then(() => router.refresh());
                          setOpen(null);
                        } else setOpen(activity.id);
                      }}
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {editing ? t("doneEditing") : t("edit")}
                    </button>
                    <button
                      type="button"
                      className={LINK}
                      aria-expanded={fixing === activity.id}
                      aria-label={`${t("fixWithAi")}: ${prompt}`}
                      onClick={() => {
                        setFixing(fixing === activity.id ? null : activity.id);
                        setInstruction("");
                        setFixError(null);
                      }}
                    >
                      <MessageSquare className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {t("fixWithAi")}
                    </button>
                    <button type="button" className={LINK} aria-label={`${t("delete")}: ${prompt}`} onClick={() => void remove(activity.id)}>
                      <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {t("delete")}
                    </button>
                  </div>
                  {fixing === activity.id ? (
                    <form
                      className="space-y-1 pl-[30px]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        fix(activity.id);
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          autoFocus
                          aria-label={`${t("fixWithAi")}: ${prompt}`}
                          placeholder={t("fixPlaceholder")}
                          maxLength={500}
                          value={instruction}
                          disabled={fixPending}
                          onChange={(e) => setInstruction(e.target.value)}
                          className="h-10 min-w-[220px] flex-1 text-[15px]"
                        />
                        <Button type="submit" size="sm" disabled={fixPending || !instruction.trim()} disabledReason={fixPending ? t("applying") : t("needInstruction")}>
                          {fixPending ? t("applying") : t("apply")}
                        </Button>
                      </div>
                      {fixError ? (
                        <p role="alert" className="text-[13px] font-medium text-ink">
                          {fixError}
                        </p>
                      ) : fixPending ? (
                        <p role="status" className="text-[13px] text-muted">
                          {t("applyingLong")}
                        </p>
                      ) : null}
                    </form>
                  ) : null}
                  {editing ? (
                    <div className="@container">
                      <div className="grid content-start items-start gap-4 @min-[740px]:grid-cols-2" data-editor={`${activity.id}:${activity.type}`}>
                        <ActivityEditor
                          key={`${activity.id}:${activity.type}:${epoch}`}
                          activity={activity}
                          index={ai}
                          count={stage.activities.length}
                          competencies={competencies}
                          binding={binding(activity.id)}
                          autoFocus={justAdded === activity.id}
                          onChangeType={async (type) => {
                            setJustAdded(null);
                            const res = await queue.run(() => saveActivityAction(openingId, activity.id, { type }));
                            if (res.ok) router.refresh();
                            return res.ok;
                          }}
                          onSetCompetencies={(ids) => {
                            queue.edit({ kind: "competencies", id: activity.id }, "ids", ids);
                            void queue.flush();
                          }}
                          onMove={(direction) => void move(activity.id, direction)}
                          onDelete={() => void remove(activity.id)}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button id="wizard-add-own" variant="secondary">
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            {t("addOwn")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {ACTIVITY_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            return (
              <DropdownMenuItem key={type} className="py-2" onSelect={() => void add(type)}>
                <Icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                {b(`type${type}`)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {error ? (
        <p role="alert" className="text-[14px] font-medium text-ink">
          {error}
        </p>
      ) : null}
      <p className={cn("sr-only")} role="status" aria-live="polite">
        {announcement}
      </p>

      {undo ? (
        // The strip is fixed; this transformed box is its frame, so it sits above the step's footer.
        <div className="pointer-events-none fixed inset-x-0 z-50 h-0 transform-gpu" style={{ bottom: "var(--step-footer-space, 112px)" }}>
          <UndoStrip
            key={undo.token}
            message={b("activityDeleted")}
            action={restore}
            onSubmitted={() => setUndo(null)}
            hiddenFields={{ openingId, payload: undo.payload, index: String(undo.index), token: undo.token, stageId: undo.stageId }}
          />
        </div>
      ) : null}
    </div>
  );
}
