"use client";

import { courseKeysOfKind, COURSE_FORM_CHOICES, COURSE_KINDS, type CourseFormChoice } from "@/app/(manager)/exam/students/new/rows";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import type { CourseKey, CourseTestKind } from "@/lib/exam/course/types";

/**
 * The course tests on the invite wizard's exam step (spec 2026-10-28). Two
 * moves in one place: the kind as two cards (Zwischentest, Abschlusstest), and,
 * right under them once a kind is picked, the course as chips. A course test
 * is scored by points, so there is no claimed level to ask for. The caller owns
 * the state and the choice value; this only draws and reports.
 */

const CHIP =
  "flex h-11 cursor-pointer items-center justify-center rounded-[10px] border px-4 text-[14px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
const chip = (on: boolean) => cn(CHIP, on ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:bg-canvas");

export function CourseKindChoice({
  kind,
  course,
  onKind,
  onCourse,
}: {
  /** The kind picked, whether or not a course is chosen yet. */
  kind: CourseTestKind | null;
  course: CourseKey | null;
  onKind(kind: CourseTestKind): void;
  onCourse(course: CourseKey): void;
}) {
  const cw = useMT("courseInvite");
  return (
    <div className="space-y-2">
      <p id="invite-exam-course" className="text-[13px] font-medium text-muted">
        {cw("group")}
      </p>
      <ChoiceCardGroup
        type="single"
        name="invite-course-kind"
        labelledBy="invite-exam-course"
        look="panel"
        columns={2}
        value={kind ? [kind] : []}
        onChange={([v]) => onKind(v === "FINAL" ? "FINAL" : "INTERIM")}
        items={COURSE_KINDS.map((k) => ({ value: k, label: cw(`kind${k}`), description: cw(`kind${k}Hint`) }))}
      />
      {kind ? (
        <fieldset className="space-y-2 pt-1">
          <legend className="text-[14px] font-medium text-ink">{cw("courseLegend")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {courseKeysOfKind(kind).map((key) => (
              <label key={key} className={cn(chip(course === key), "tnum min-w-16 px-3")}>
                <input type="radio" name="invite-course" value={key} className="sr-only" checked={course === key} onChange={() => onCourse(key)} />
                {key}
              </label>
            ))}
          </div>
          <p className="text-[13px] text-muted">{cw(`courseHint${kind}`)}</p>
        </fieldset>
      ) : null}
    </div>
  );
}

/** "Automatisch (A/B abwechselnd)" (the default), "Form A", "Form B": the same small chip row as the claimed level and the difficulty. */
export function CourseFormPicker({ value, onChange }: { value: CourseFormChoice; onChange(next: CourseFormChoice): void }) {
  const cw = useMT("courseInvite");
  return (
    <fieldset className="space-y-2">
      <legend className="text-[14px] font-medium text-ink">{cw("formLegend")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {COURSE_FORM_CHOICES.map((f) => (
          <label key={f} className={chip(value === f)}>
            <input type="radio" name="invite-course-form" value={f} className="sr-only" checked={value === f} onChange={() => onChange(f)} />
            {cw(`form${f}`)}
          </label>
        ))}
      </div>
      <p className="text-[13px] text-muted">{cw("formHint")}</p>
    </fieldset>
  );
}
