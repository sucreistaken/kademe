import { Dot } from "@/components/panel/bits";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { StudentCourse } from "./course-row";

type T = ReturnType<typeof managerT>;

/**
 * The student list's "Ergebnis" cell for a course test: Bestanden or Nicht
 * bestanden and the points ("52/74") instead of a CEFR level. A result the
 * teacher has not finalized is muted, like a draft level. Not passed is a
 * yellow-soft pill, never red: a status is not a verdict (RULES.md rule 1).
 */
export function CourseResultCell({ course, t }: { course: StudentCourse; t: T }) {
  if (!course.outcome && course.points === null) return <span className="tnum text-[14px] font-bold text-muted">-</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {course.outcome ? (
        <Dot tone={!course.final ? "neutral" : course.outcome === "PASS" ? "done" : "warn"}>{t(`courseStudents.outcome${course.outcome}`)}</Dot>
      ) : null}
      {course.points !== null ? (
        <span title={t("courseStudents.pointsTitle", { points: course.points, max: course.max })} className={cn("tnum text-[13.5px] font-bold", course.final ? "text-ink" : "text-muted")}>
          {course.points}/{course.max}
        </span>
      ) : null}
    </span>
  );
}
