import Link from "next/link";
import type { ReactNode } from "react";
import { overrideCourseOutcome } from "@/app/(manager)/exam/students/[id]/course-actions";
import { Dot } from "@/components/panel/bits";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { CourseOutcome, CourseResult } from "@/lib/exam/course/types";
import type { CourseOutcomeOverride } from "./outcome";
import type { SheetRow, Thresholds } from "./model";

type T = ReturnType<typeof managerT>;

/**
 * The section table of Halil Bey's Bewertungsbogen ("Gesamtauswertung":
 * Prüfungsteil, max., erreicht, Bemerkung) as a card: one row per section with
 * its points, a section that waits marked, and the total row. Each section
 * name opens that section's tab.
 */
export function SheetCard({
  t,
  assessmentId,
  rows,
  total,
  max,
  pctText,
  remark,
}: {
  t: T;
  assessmentId: string;
  rows: SheetRow[];
  total: number | null;
  max: number;
  /** The share of the maximum, already written in the panel's language. */
  pctText: string | null;
  remark: (row: SheetRow) => ReactNode;
}) {
  return (
    <Card className="overflow-x-auto">
      <h2 className="px-5 pt-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t("courseResult.partsTitle")}</h2>
      <table className="mt-2 w-full min-w-[520px] text-left">
        <thead className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-muted">
          <tr>
            <th className="px-5 py-2 font-medium">{t("courseResult.colPart")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("courseResult.colMax")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("courseResult.colPoints")}</th>
            <th className="px-5 py-2 font-medium">{t("courseResult.colRemark")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.section} className="hover:bg-canvas">
              <td className="px-5 py-3">
                <Link href={`/exam/students/${assessmentId}?tab=${r.section}`} className="text-[14px] font-semibold text-ink underline-offset-2 hover:underline">
                  {t(`courseResult.section${r.section}`)}
                </Link>
              </td>
              <td className="tnum px-3 py-3 text-right text-[14px] text-muted">{r.max}</td>
              <td className="px-3 py-3 text-right">
                {r.pending ? (
                  <span className="inline-flex items-center justify-end gap-2">
                    <Dot tone="warn">{t("courseResult.pendingShort")}</Dot>
                    <span className="tnum text-[16px] font-bold text-muted">-</span>
                  </span>
                ) : (
                  <span className="tnum text-[16px] font-bold text-ink">{r.points}</span>
                )}
              </td>
              <td className="px-5 py-3 text-[13px] text-muted">{remark(r)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line">
          <tr>
            <td className="px-5 py-3 text-[14px] font-extrabold text-ink">{t("courseResult.totalRow")}</td>
            <td className="tnum px-3 py-3 text-right text-[14px] font-semibold text-ink">{max}</td>
            <td className="tnum px-3 py-3 text-right text-[18px] font-extrabold text-ink">{total ?? "-"}</td>
            <td className="tnum px-5 py-3 text-[13px] text-muted">{pctText === null ? "" : `${pctText} %`}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

/**
 * The sheet's closing block: Einstufung (Bestanden or Nicht bestanden, and why
 * not), Empfehlung (the course to continue in, the focus), the cut scores in
 * points, and the teacher's own PASS or FAIL with its reason. Not passed is
 * ink on a neutral ground, never red.
 */
export function OutcomeCard({
  t,
  assessmentId,
  course,
  outcome,
  final,
  override,
  overrideName,
  thresholds,
  speaking,
  max,
  pctText,
  canOverride,
  reasonMissing,
}: {
  t: T;
  assessmentId: string;
  course: CourseResult | null;
  /** The outcome as it stands: the teacher's decision, else the engine's. */
  outcome: CourseOutcome | null;
  final: boolean;
  override: CourseOutcomeOverride | null;
  overrideName: string;
  thresholds: Thresholds;
  /** The speaking section's points and maximum. */
  speaking: { points: number | null; max: number };
  max: number;
  /** The share of the maximum, already written in the panel's language. */
  pctText: string | null;
  canOverride: boolean;
  /** The last override was refused for want of a reason. */
  reasonMissing: boolean;
}) {
  const total = course?.total ?? null;
  const engineDisagrees = override !== null && course?.outcome != null && course.outcome !== override.outcome;
  return (
    <Card className="p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t("courseResult.einstufung")}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.04em] text-muted">{t("courseResult.outcomeLabel")}</div>
          <div className={cn("text-[26px] font-bold leading-tight", final ? "text-ink" : "text-ink-3")}>
            {outcome ? `${final ? "" : `${t("result.preliminary")}: `}${t(`courseResult.outcome${outcome}`)}` : t("courseResult.outcomePending")}
          </div>
        </div>
        {total !== null ? (
          <div className="tnum text-[15px] font-semibold text-ink">{t("courseResult.pointsAndPct", { points: total, max, pct: pctText ?? "" })}</div>
        ) : null}
      </div>

      {course?.reasons.length ? (
        <ul className="mt-3 flex flex-col gap-1 text-[13.5px] leading-[1.55] text-ink-2">
          {course.reasons.map((reason) => (
            <li key={reason}>
              {t(`courseResult.reason${reason}`, {
                points: reason === "SPEAKING_BELOW_MIN" ? (speaking.points ?? 0) : (total ?? 0),
                need: reason === "SPEAKING_BELOW_MIN" ? (thresholds.speakingMin ?? 0) : thresholds.pass,
              })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[12.5px] font-semibold text-muted">{t("courseResult.recommendation")}</h3>
        {engineDisagrees ? (
          <p className="mt-1 text-[13.5px] text-ink-2">{t("courseResult.recommendationOverridden")}</p>
        ) : course?.recommendation ? (
          <p className="mt-1 text-[15px] font-semibold text-ink">
            <span className="tnum">{t("courseResult.recommendedCourse", { course: course.recommendation })}</span>
            {course.focus ? <span className="ml-2 text-[13.5px] font-medium text-ink-2">· {t(`courseResult.focus${course.focus}`)}</span> : null}
          </p>
        ) : (
          <p className="mt-1 text-[13.5px] text-muted">{t("courseResult.recommendationNone")}</p>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-4 text-[12.5px] leading-5 text-muted">
        <li className="tnum">{t("courseResult.thresholdPass", { pct: thresholds.passPct, points: thresholds.pass, max })}</li>
        {thresholds.speakingMin !== null ? (
          <li className="tnum">{t("courseResult.thresholdSpeaking", { points: thresholds.speakingMin, max: speaking.max, pct: thresholds.speakingMinPct ?? 0 })}</li>
        ) : null}
        {thresholds.contentZeroFails ? <li>{t("courseResult.thresholdContent")}</li> : null}
      </ul>

      {override ? (
        <p className="mt-4 rounded-[10px] bg-canvas px-3 py-2 text-[13px] leading-5 text-ink">
          {t("courseResult.overriddenBy", { name: overrideName || "-", outcome: t(`courseResult.outcome${override.outcome}`), reason: override.reason ?? "" })}
        </p>
      ) : null}

      {canOverride ? (
        <details className="mt-4 border-t border-line pt-4" open={reasonMissing}>
          <summary className="cursor-pointer text-[12.5px] text-ink underline underline-offset-2">{t("courseResult.overrideTitle")}</summary>
          {reasonMissing ? <p className="mt-2 text-[12.5px] font-medium text-ink">{t("result.reasonRequired")}</p> : null}
          <form action={overrideCourseOutcome} className="mt-2 flex max-w-[420px] flex-col gap-2">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <select name="outcome" required defaultValue="" aria-label={t("courseResult.overrideOutcome")} className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13.5px]">
              <option value="" disabled>
                {t("courseResult.overrideOutcome")}
              </option>
              <option value="PASS">{t("courseResult.outcomePASS")}</option>
              <option value="FAIL">{t("courseResult.outcomeFAIL")}</option>
            </select>
            <label className="text-[12.5px] text-muted">
              {t("courseResult.overrideReasonLabel")}
              <textarea
                name="reason"
                required
                minLength={3}
                rows={2}
                placeholder={t("courseResult.overrideReasonPlaceholder")}
                className="mt-1 w-full rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[13.5px] text-ink"
              />
            </label>
            <p className="text-[12px] text-muted">{t("courseResult.overrideHint")}</p>
            <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full")}>
              {t("courseResult.overrideSave")}
            </button>
          </form>
        </details>
      ) : null}
    </Card>
  );
}
