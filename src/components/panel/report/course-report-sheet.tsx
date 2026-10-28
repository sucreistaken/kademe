import type { ReactNode } from "react";
import { percentText } from "@/components/panel/course/model";
import { BrandMark } from "@/components/visual/brand-mark";
import { dateTime } from "@/i18n/dates";
import type { PanelLocale } from "@/i18n/locale";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import { intlTag } from "@/lib/format";
import { ORG_TIMEZONE } from "@/lib/org-timezone";
import type { CourseReportModel, PointCell, RubricBlock } from "./course-model";

type T = ReturnType<typeof managerT>;

/**
 * Print rules for the course sheet. It runs over more than one page (the
 * writing and speaking criteria do not fit on one A4 with the table), so it is
 * not the fixed one-page box of the level report: the page margin is 0 like
 * the detail sheet's, and an empty header and footer row of the outer table
 * repeat on every printed page as its top and bottom margin. Each block keeps
 * together on a page.
 */
const PRINT_CSS = `
@page { size: A4; margin: 0; }
.course-sheet-table { width: 100%; border-collapse: collapse; }
.course-sheet-block { break-inside: avoid; }
@media print {
  html, body { background: #fff !important; height: auto !important; }
  [data-slot="sidebar-wrapper"] > :not(:last-child),
  [data-slot="sidebar-wrapper"] header,
  .report-toolbar { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-wrapper"] > div { min-height: 0 !important; }
  .report-wrap { padding: 0 !important; margin: 0 !important; }
  .course-sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; width: 210mm !important; margin: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
  .course-sheet-head td, .course-sheet-foot td { height: 12mm; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

const dayFmt = (d: Date, locale: PanelLocale) =>
  new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: ORG_TIMEZONE }).format(d);

const heading = "text-[9.5pt] font-semibold uppercase tracking-[0.06em] text-muted";
const th = "py-1.5 font-medium";

/** A number on the sheet: the points, the AI's points marked as a proposal, or "offen". */
function Points({ cell, t }: { cell: PointCell; t: T }) {
  if (cell.points === null) return <span className="font-medium text-muted">{t("courseReport.open")}</span>;
  return (
    <>
      <span className="tnum font-bold">{cell.points}</span>
      {cell.state === "PROPOSED" ? <span className="ml-1 text-[8.5pt] font-normal text-muted">({t("courseReport.proposed")})</span> : null}
    </>
  );
}

const sectionPoints = (points: number | null): PointCell => (points === null ? { points: null, state: "OPEN" } : { points, state: "DECIDED" });

/**
 * The criteria of one productive section as the Bewertungsbogen lays them out:
 * one row per criterion with its maximum, the points of each task in a column
 * of its own (a single task's column is "erreicht"), and the sum row.
 */
function RubricTable({ block, t, sumLabel, firstCol }: { block: RubricBlock; t: T; sumLabel: string; firstCol: string }) {
  const single = block.tasks.length === 1;
  return (
    <table className="mt-2 w-full text-left">
      <thead className="border-b border-line text-[8.5pt] uppercase tracking-[0.04em] text-muted">
        <tr>
          <th className={cn(th, "pr-3")}>{firstCol}</th>
          <th className={cn(th, "w-[16mm] px-2 text-right")}>{t("courseResult.colMax")}</th>
          {block.tasks.map((task) => (
            <th key={task.n} className={cn(th, "w-[30mm] px-2 text-right")}>
              {single ? t("courseResult.colPoints") : t("courseReport.task", { n: task.n })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {block.criteria.map((c) => (
          <tr key={c.id}>
            <td className="py-1.5 pr-3">{c.label}</td>
            <td className="tnum px-2 py-1.5 text-right text-muted">{c.max}</td>
            {block.tasks.map((task) => (
              <td key={task.n} className="px-2 py-1.5 text-right">
                <Points cell={task.cells[c.id] ?? { points: null, state: "OPEN" }} t={t} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-line">
        <tr>
          <td className="py-1.5 pr-3 font-bold">{sumLabel}</td>
          <td className="tnum px-2 py-1.5 text-right font-semibold">{block.taskMax}</td>
          {block.tasks.map((task) => (
            <td key={task.n} className="px-2 py-1.5 text-right">
              <Points cell={task.total} t={t} />
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

/** The AI's adopted advice and the teacher's reasons for one section; nothing when there are none. */
function Notes({ block, title, t }: { block: RubricBlock; title: string; t: T }) {
  if (block.notes.length === 0) return null;
  const several = block.tasks.length > 1;
  return (
    <div className="mt-3">
      <h3 className="text-[9pt] font-semibold text-muted">{title}</h3>
      <ul className="mt-1 flex flex-col gap-1">
        {block.notes.map((note, i) => {
          const label = t(note.kind === "ADVICE" ? "courseReport.advice" : "courseReport.teacherReason");
          return (
            <li key={i}>
              <span className="font-semibold">
                {label}
                {several ? `, ${t("courseReport.task", { n: note.task })}` : ""}:
              </span>{" "}
              <span lang="de">{note.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-line pb-1">
      <dt className="shrink-0 text-[9pt] text-muted">{label}:</dt>
      <dd className="min-w-0 break-words font-semibold">{children}</dd>
    </div>
  );
}

/**
 * The German teacher copy of a course test: Halil Bey's Bewertungsbogen
 * (header, points per part, the writing criteria with the "Häufigste Fehler"
 * boxes, the speaking criteria per task, the Gesamtauswertung with Einstufung
 * and Empfehlung, the two signature lines). No CEFR level and no level bar.
 * Not passed is ink like passed: the outcome never has a colour.
 */
export function CourseReportSheet({ model, t, locale }: { model: CourseReportModel; t: T; locale: PanelLocale }) {
  const m = model;
  const h = m.header;
  const e = m.evaluation;
  const num = (n: number) => percentText(n, locale);
  const writingCells = m.writing?.tasks[0]?.cells;
  const remark = (section: string): string => {
    if (section === "WRITING" && writingCells) {
      const show = (id: "INHALT" | "WORTSCHATZ" | "GRAMMATIK") => writingCells[id]?.points ?? t("courseReport.open");
      return t("courseResult.remarkWriting", { content: show("INHALT"), vocab: show("WORTSCHATZ"), grammar: show("GRAMMATIK") });
    }
    if (section === "SPEAKING" && m.speaking?.tasks.length) {
      return t("courseResult.remarkSpeaking", { tasks: m.speaking.tasks.map((task) => task.total.points ?? t("courseReport.open")).join(" · ") });
    }
    return "";
  };
  const outcomeText = e.outcome ? t(`courseResult.outcome${e.outcome}`) : t("courseReport.open");

  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        lang={locale}
        className="course-sheet mx-auto w-[210mm] max-w-full rounded-[16px] border border-line bg-white py-[12mm] text-[10pt] leading-[1.45] text-ink shadow-panel"
      >
        <table className="course-sheet-table">
          <thead className="course-sheet-head">
            <tr>
              <td />
            </tr>
          </thead>
          <tfoot className="course-sheet-foot">
            <tr>
              <td />
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="px-[16mm] align-top">
                {/* Header: school, test and form, the maximum, then the fields of the paper sheet. */}
                <div className="course-sheet-block flex items-start justify-between gap-6 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <BrandMark className="size-9" />
                    <div className="text-[15pt] font-bold tracking-[-0.01em]">{h.schoolName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9pt] font-semibold uppercase tracking-[0.08em] text-accent">{t("courseReport.title")}</div>
                    <div className="mt-0.5 text-[14pt] font-bold">
                      {h.testName}
                      {h.form ? ` · ${t("courseReport.version", { form: h.form })}` : ""}
                    </div>
                    <div className="tnum mt-0.5 text-[9pt] text-muted">
                      {h.oralPoints > 0
                        ? t("courseReport.maxLine", { written: h.writtenPoints, oral: h.oralPoints, max: h.maxPoints })
                        : t("courseReport.maxOnly", { max: h.maxPoints })}
                    </div>
                  </div>
                </div>
                <dl className="course-sheet-block mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <Field label={t("courseReport.name")}>{h.studentName}</Field>
                  <Field label={t("courseReport.course")}>{h.key}</Field>
                  <Field label={t("courseReport.date")}>
                    <span className="tnum">{h.examDate ? dayFmt(h.examDate, locale) : "-"}</span>
                  </Field>
                  <Field label={t("courseReport.teacher")}>{h.teacherName ?? "-"}</Field>
                </dl>

                {/* Points by part. */}
                <section className="course-sheet-block mt-6" aria-labelledby="course-parts">
                  <h2 id="course-parts" className={heading}>
                    {t("courseReport.partsTitle")}
                  </h2>
                  <table className="mt-2 w-full text-left">
                    <thead className="border-b border-line text-[8.5pt] uppercase tracking-[0.04em] text-muted">
                      <tr>
                        <th className={cn(th, "pr-3")}>{t("courseResult.colPart")}</th>
                        <th className={cn(th, "w-[16mm] px-2 text-right")}>{t("courseResult.colMax")}</th>
                        <th className={cn(th, "w-[30mm] px-2 text-right")}>{t("courseResult.colPoints")}</th>
                        <th className={cn(th, "pl-4")}>{t("courseResult.colRemark")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {m.sections.map((r) => (
                        <tr key={r.section}>
                          <td className="py-1.5 pr-3 font-semibold">{t(`courseResult.section${r.section}`)}</td>
                          <td className="tnum px-2 py-1.5 text-right text-muted">{r.max}</td>
                          <td className="px-2 py-1.5 text-right">
                            <Points cell={sectionPoints(r.pending ? null : r.points)} t={t} />
                          </td>
                          <td className="tnum py-1.5 pl-4 text-[9pt] text-ink-2">{remark(r.section)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-line">
                      <tr>
                        <td className="py-2 pr-3 font-extrabold">{t("courseResult.totalRow")}</td>
                        <td className="tnum px-2 py-2 text-right font-semibold">{e.max}</td>
                        <td className="px-2 py-2 text-right text-[12pt]">
                          <Points cell={sectionPoints(e.total)} t={t} />
                        </td>
                        <td className="py-2 pl-4">
                          <span className="text-[9pt] text-muted">{t("courseResult.einstufung")}: </span>
                          <span className="font-bold">{outcomeText}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  {m.hasOpen || m.hasProposal ? (
                    <div className="mt-1.5 text-[8.5pt] text-muted">
                      {m.hasProposal ? <p>{t("courseReport.legendProposed")}</p> : null}
                      {m.hasOpen ? <p>{t("courseReport.legendOpen")}</p> : null}
                    </div>
                  ) : null}
                </section>

                {m.writing ? (
                  <section className="course-sheet-block mt-6" aria-labelledby="course-writing">
                    <h2 id="course-writing" className={heading}>
                      {t("courseResult.sectionWRITING")}
                    </h2>
                    {m.writing.tasks.length ? (
                      <RubricTable block={m.writing} t={t} sumLabel={t("courseReport.writingSum")} firstCol={t("courseReport.colCategory")} />
                    ) : (
                      <p className="mt-2 text-muted">{t("courseReport.noTasks")}</p>
                    )}
                    {m.writing.errors && m.writing.tasks.length ? (
                      <div className="mt-3">
                        <h3 className="text-[9pt] font-semibold text-muted">
                          {t("courseReport.errorsTitle")}
                          {m.writing.errors.state === "PROPOSED" ? <span className="ml-2 font-normal">{t("courseReport.errorsProposed")}</span> : null}
                        </h3>
                        <ul className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 text-[9pt]">
                          {m.writing.errors.boxes.map((box) => (
                            <li key={box.id} data-ticked={box.ticked ? "true" : "false"} className="flex items-start gap-2">
                              <span
                                aria-hidden
                                className="mt-[0.15em] inline-flex size-[3.4mm] shrink-0 items-center justify-center rounded-[2px] border border-ink text-[8pt] font-bold leading-none"
                              >
                                {box.ticked ? "✓" : ""}
                              </span>
                              <span lang="de" className={cn(box.ticked && "font-semibold")}>
                                {box.label}
                                {box.ticked ? <span className="sr-only"> ({t("courseReport.ticked")})</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Notes block={m.writing} title={t("courseReport.commentWriting")} t={t} />
                  </section>
                ) : null}

                {m.speaking ? (
                  <section className="course-sheet-block mt-6" aria-labelledby="course-speaking">
                    <h2 id="course-speaking" className={heading}>
                      {t("courseResult.sectionSPEAKING")}
                    </h2>
                    {m.speaking.tasks.length ? (
                      <RubricTable block={m.speaking} t={t} sumLabel={t("courseReport.taskSum")} firstCol={t("courseReport.colCriterion")} />
                    ) : (
                      <p className="mt-2 text-muted">{t("courseReport.noTasks")}</p>
                    )}
                    <p className="tnum mt-2 font-semibold">
                      {t("courseReport.speakingTotal", { points: m.speaking.points ?? t("courseReport.open"), max: m.speaking.max })}
                    </p>
                    <Notes block={m.speaking} title={t("courseReport.commentSpeaking")} t={t} />
                  </section>
                ) : null}

                {/* Gesamtauswertung: the total, the Einstufung, the Empfehlung, why not passed, and the rules. */}
                <section className="course-sheet-block mt-6 rounded-[12px] border border-line-strong px-5 py-4" aria-labelledby="course-evaluation">
                  <h2 id="course-evaluation" className={heading}>
                    {t("courseReport.evaluationTitle")}
                  </h2>
                  <div className="mt-2 grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-[9pt] text-muted">{t("courseReport.totalLabel")}</div>
                      <div className="tnum mt-0.5 text-[13pt] font-bold">
                        {e.total === null ? t("courseReport.open") : t("courseReport.pointsOf", { points: e.total, max: e.max })}
                      </div>
                      {e.pct !== null ? <div className="tnum text-ink-2">{num(e.pct)} %</div> : null}
                    </div>
                    <div>
                      <div className="text-[9pt] text-muted">{t("courseResult.einstufung")}</div>
                      <div className="mt-0.5 text-[13pt] font-bold">{outcomeText}</div>
                    </div>
                    <div>
                      <div className="text-[9pt] text-muted">{t("courseResult.recommendation")}</div>
                      <div className="mt-0.5 font-bold">
                        {e.changed ? (
                          <span className="font-medium">{t("courseReport.recommendationTeacher")}</span>
                        ) : e.recommendation ? (
                          <span className="tnum text-[12pt]">{t("courseResult.recommendedCourse", { course: e.recommendation })}</span>
                        ) : (
                          <span className="font-medium text-muted">{t("courseReport.open")}</span>
                        )}
                      </div>
                      {e.focus ? <div className="font-semibold text-ink-2">{t(`courseResult.focus${e.focus}`)}</div> : null}
                    </div>
                  </div>

                  {e.reasons.length ? (
                    <ul className="mt-3 flex flex-col gap-0.5 text-ink-2">
                      {e.reasons.map((r) => (
                        <li key={r.code} className="tnum">
                          {r.code === "WRITING_CONTENT_ZERO"
                            ? t("courseResult.reasonWRITING_CONTENT_ZERO")
                            : t(`courseResult.reason${r.code}`, { points: r.points, need: r.need })}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {e.changed ? (
                    <div className="mt-3 text-ink-2">
                      <p>{t("courseReport.changed", { computed: t(`courseResult.outcome${e.changed.computed}`) })}</p>
                      {e.changed.reason ? <p>{t("courseReport.changedReason", { reason: e.changed.reason })}</p> : null}
                      {e.changed.by ? <p>{t("resultReport.teacherBy", { name: e.changed.by })}</p> : null}
                    </div>
                  ) : null}

                  <ul className="mt-3 flex flex-col gap-0.5 border-t border-line pt-2 text-[8.5pt] leading-[1.45] text-muted">
                    <li className="tnum">{t("courseReport.thresholdPass", { pct: num(e.limits.pass.pct), points: e.limits.pass.points, max: e.limits.pass.max })}</li>
                    {e.limits.speaking ? (
                      <li className="tnum">{t("courseReport.thresholdSpeaking", { points: e.limits.speaking.points, max: e.limits.speaking.max })}</li>
                    ) : null}
                    {e.limits.writingContentZeroFails ? <li>{t("courseReport.thresholdContent")}</li> : null}
                  </ul>
                </section>

                {/* The signature lines of the paper sheet. */}
                <div className="course-sheet-block mt-10 grid grid-cols-2 gap-10">
                  <div>
                    <div className="h-[12mm] border-b border-ink" />
                    <div className="mt-1 text-[9pt] text-muted">{t("courseReport.signatureTeacher")}</div>
                  </div>
                  <div>
                    <div className="h-[12mm] border-b border-ink" />
                    <div className="mt-1 text-[9pt] text-muted">{t("courseReport.signatureStudent")}</div>
                  </div>
                </div>

                <div className="course-sheet-block mt-8 grid grid-cols-[1fr_auto] items-end gap-8 border-t border-line pt-4">
                  <dl className="text-[9.5pt]">
                    <dt className="text-[8.5pt] uppercase tracking-[0.06em] text-muted">{t("resultReport.finalizedOn")}</dt>
                    <dd className="tnum mt-0.5 font-medium">{m.finalizedAt ? dateTime(m.finalizedAt, locale) : "-"}</dd>
                  </dl>
                  <div className="text-right">
                    <div className="text-[8.5pt] uppercase tracking-[0.06em] text-muted">{t("resultReport.verification")}</div>
                    <div className="tnum mt-0.5 font-mono text-[15pt] font-bold tracking-[0.12em]">{m.verificationCode}</div>
                  </div>
                </div>
                <p className="mt-2 text-[8pt] text-muted">{t("resultReport.verificationHint")}</p>
                <p className="mt-0.5 text-[8pt] text-muted">{t("brand.madeWith")}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </>
  );
}
