"use client";

import { useState } from "react";
import { Button, DisabledReason } from "@/components/ui/button";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import type { CommonWritingError, CoursePoints, CourseRubricProposal } from "@/lib/exam/course/types";
import {
  COMMON_ERRORS_SENT,
  criterionMax,
  editorAction,
  needsReason,
  pointsField,
  pointsTotal,
  rubricMax,
  startingErrors,
  startingPoints,
  type CourseGradingStatus,
  type EditorCriterion,
  type EditorState,
  type GradedSection,
} from "./grading-model";

/**
 * The grading form of one writing or speaking answer of a course test: the
 * rubric as Halil Bey's sheet prints it, a row per criterion with its points
 * as a row of boxes to tick (0-3 writing, 0-4 speaking), the AI's proposal and
 * rationale under it, and for writing the sheet's "Häufigste Fehler" boxes.
 *
 * One button, and the pickers decide which: still the AI's points means
 * "confirm" (no reason), another point means "save my points" (a reason of
 * three characters), a decided grading with only a box changed means "save
 * errors". The AI only proposes; nothing is saved until this button.
 * Criteria the AI could not judge (AUSSPRACHE from a transcript) start empty
 * and must be set. The server actions are passed in, so this file imports no
 * server code and renders anywhere.
 */

type FormAction = (formData: FormData) => void | Promise<void>;

const CHIP =
  "tnum grid h-10 min-w-10 cursor-pointer place-items-center rounded-[10px] border px-2 text-[14px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

export function CourseGradingEditor({
  gradingId,
  tab,
  section,
  status,
  proposal,
  decided,
  criteria,
  boxes,
  actions,
}: {
  gradingId: string;
  tab: string;
  section: GradedSection;
  status: CourseGradingStatus;
  proposal: CourseRubricProposal | null;
  /** `course_points` once a teacher confirmed or changed the grading. */
  decided: { points: CoursePoints; commonErrors?: CommonWritingError[] } | null;
  criteria: EditorCriterion[];
  /** The "Häufigste Fehler" boxes with their German labels; empty for speaking. */
  boxes: Array<{ id: CommonWritingError; label: string }>;
  actions: { confirm: FormAction; change: FormAction; errors: FormAction };
}) {
  const t = useMT("courseResult");
  const [picks, setPicks] = useState<CoursePoints>(() => startingPoints({ section, decided, proposal }));
  const [ticks, setTicks] = useState<CommonWritingError[]>(() => startingErrors({ section, decided, proposal }));
  const [reason, setReason] = useState("");
  const state: EditorState = { section, status, proposal, decided, picks, ticks, reason };
  const action = editorAction(state);
  const max = criterionMax(section);
  const formAction = action.kind === "confirm" ? actions.confirm : action.kind === "change" ? actions.change : action.kind === "errors" ? actions.errors : undefined;
  const label = action.kind === "confirm" ? t("actionConfirm") : action.kind === "errors" ? t("actionErrors") : t("actionChange");

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="gradingId" value={gradingId} />
      <input type="hidden" name="tab" value={tab} />
      <div className="divide-y divide-line">
        {criteria.map((c) => {
          const labelId = `${gradingId}-${c.id}`;
          return (
            <div key={c.id} role="radiogroup" aria-labelledby={labelId} className="py-3 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span id={labelId} lang="de" className="text-[13.5px] font-semibold text-ink">
                  {c.label}
                </span>
                <span className="tnum shrink-0 text-[12px] text-muted">{t("editorMax", { max })}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: max + 1 }, (_, n) => (
                  <label key={n} className={cn(CHIP, picks[c.id] === n ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:bg-canvas")}>
                    <input type="radio" name={pointsField(c.id)} value={n} checked={picks[c.id] === n} onChange={() => setPicks((p) => ({ ...p, [c.id]: n }))} className="sr-only" />
                    {n}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
                {c.proposed === null ? (
                  <span className="font-medium text-ink">{t("editorNotAssessable")}</span>
                ) : (
                  <span className="tnum font-medium text-ink-2">{t("editorAi", { points: c.proposed })}</span>
                )}
                {c.rationale ? <span lang="de">{c.proposed === null ? " " : " · "}{c.rationale}</span> : null}
              </p>
            </div>
          );
        })}
      </div>

      {boxes.length ? (
        <>
          <input type="hidden" name={COMMON_ERRORS_SENT} value="1" />
          <details open className="border-t border-line pt-3">
            <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
              {t("editorBoxesTitle")} <span className="tnum font-normal text-muted">· {t("editorBoxesCount", { count: ticks.length })}</span>
            </summary>
            {!decided && proposal ? <p className="mt-1 text-[12.5px] text-muted">{t("editorBoxesHint")}</p> : null}
            <ul className="mt-2 flex flex-col gap-1.5">
              {boxes.map((b) => (
                <li key={b.id}>
                  <label className="flex items-start gap-2 text-[13px] leading-5 text-ink">
                    <input
                      type="checkbox"
                      name="commonErrors"
                      value={b.id}
                      checked={ticks.includes(b.id)}
                      onChange={(e) => setTicks((current) => (e.target.checked ? [...current, b.id] : current.filter((x) => x !== b.id)))}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span lang="de">{b.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}

      {needsReason(state) ? (
        <label className="mt-3 block text-[12.5px] text-muted">
          {t("editorReasonLabel")}
          <textarea
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            minLength={3}
            placeholder={t("editorReasonPlaceholder")}
            className="mt-1 w-full rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13.5px] text-ink"
          />
        </label>
      ) : null}

      <p className="tnum mt-3 text-[13px] font-semibold text-ink">{t("editorSum", { points: pointsTotal(picks), max: rubricMax(section) })}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        <Button type="submit" variant="secondary" id={`${gradingId}-save`} disabled={action.kind === "none"} disabledReason={action.kind === "none" ? t(`why${action.why}`) : undefined} className="w-full">
          {label}
        </Button>
        {action.kind === "none" ? <DisabledReason id={`${gradingId}-save-why`}>{t(`why${action.why}`)}</DisabledReason> : null}
      </div>
    </form>
  );
}
