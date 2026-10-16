import type { Locale } from "@/i18n/locale";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { DetailMark, DetailQuestion, DetailSection, DetailTask, GapPart } from "./detail-model";

type T = ReturnType<typeof managerT>;

/**
 * Print rules for the detailed part. Each section starts on a new page. The
 * page margin is 0 (the summary sheet is a full-bleed A4 box), so the detail
 * is a table whose empty header and footer rows repeat on every printed page
 * and act as the top and bottom margin of a page that continues.
 */
const DETAIL_CSS = `
.report-detail-table { width: 100%; border-collapse: collapse; }
.report-detail-pad { padding: 0 16mm; }
.report-detail-q { break-inside: avoid; }
@media print {
  .report-detail { break-before: page; margin: 0 !important; width: 210mm !important; min-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
  .report-detail-head td, .report-detail-foot td { height: 14mm; }
}
`;

const MARK_CLASS: Record<DetailMark, string> = {
  correct: "text-success",
  accepted: "text-success",
  wrong: "text-danger",
  blank: "text-danger",
};

function MarkBadge({ mark, t }: { mark: DetailMark; t: T }) {
  const ok = mark === "correct" || mark === "accepted";
  const word = mark === "accepted" ? t("resultReport.markAccepted") : t(`resultReport.mark${mark === "correct" ? "Correct" : mark === "wrong" ? "Wrong" : "Blank"}` as "resultReport.markWrong");
  return (
    <span className={cn("whitespace-nowrap font-semibold", MARK_CLASS[mark])}>
      {ok ? "✓" : "✗"} {word}
    </span>
  );
}

function GapText({ parts, t }: { parts: GapPart[]; t: T }) {
  return (
    <p lang="de" className="whitespace-pre-line leading-[1.9]">
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        if (p.mark === "correct" || p.mark === "accepted") {
          return (
            <span key={i} className="font-semibold text-success">
              {p.shown}
            </span>
          );
        }
        return (
          <span key={i}>
            {p.shown ? (
              <s className="text-danger">{p.shown}</s>
            ) : (
              <span className="text-danger">
                {p.prefix}
                <s>{t("resultReport.empty")}</s>
              </span>
            )}{" "}
            <span className="rounded-[3px] bg-success-soft px-1 font-semibold text-success" title={t("resultReport.gapCorrect")}>
              {p.correct}
            </span>
          </span>
        );
      })}
    </p>
  );
}

function Question({ q, t }: { q: DetailQuestion; t: T }) {
  const head = (
    <div className="mb-1 text-[0.85em] font-semibold uppercase tracking-[0.04em] text-muted">
      {t("resultReport.question", { n: q.n })} <span className="tnum font-normal">{q.level}</span>
    </div>
  );
  if (q.kind === "GAP") {
    return (
      <div className="report-detail-q mt-3">
        {head}
        <GapText parts={q.parts} t={t} />
      </div>
    );
  }
  if (q.kind === "CHOICE") {
    return (
      <div className="report-detail-q mt-3">
        {head}
        <p lang="de">{q.stem}</p>
        <p lang="de" className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-4">
          <span>
            <span className="text-muted">{t("resultReport.yourAnswer")}: </span>
            <span className={cn("font-medium", q.mark === "blank" && "text-muted")}>{q.given || t("resultReport.empty")}</span>
            {q.mark !== "correct" && q.mark !== "accepted" ? (
              <>
                <span className="text-muted"> / {t("resultReport.correctAnswer")}: </span>
                <span className="font-medium text-success">{q.key}</span>
              </>
            ) : null}
          </span>
          <MarkBadge mark={q.mark} t={t} />
        </p>
      </div>
    );
  }
  return (
    <div className="report-detail-q mt-3">
      {head}
      {q.stem ? <p lang="de">{q.stem}</p> : null}
      <table className="mt-1 w-full text-left">
        <thead className="text-[0.85em] text-muted">
          <tr>
            <th className="w-[52%] py-0.5 pr-3 font-medium" />
            <th className="py-0.5 pr-3 font-medium">{t("resultReport.yourAnswer")}</th>
            <th className="py-0.5 pr-3 font-medium">{t("resultReport.correctAnswer")}</th>
            <th className="py-0.5" />
          </tr>
        </thead>
        <tbody>
          {q.rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-baseline">
              <td lang="de" className="py-0.5 pr-3">
                {r.label}
              </td>
              <td lang="de" className={cn("py-0.5 pr-3 font-medium", !r.given && "text-muted")}>
                {r.given || t("resultReport.empty")}
              </td>
              <td lang="de" className="py-0.5 pr-3">
                {r.key}
              </td>
              <td className="py-0.5 text-right">
                <MarkBadge mark={r.mark} t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Task({ task, section, t }: { task: DetailTask; section: string; t: T }) {
  return (
    <div className="report-detail-q mt-4 rounded-[8px] border border-line p-4">
      <div className="text-[0.85em] font-semibold uppercase tracking-[0.04em] text-muted">
        {t("resultReport.task")} {task.n}
      </div>
      <p lang="de" className="mt-1 whitespace-pre-line text-ink-2">
        {task.prompt}
      </p>

      {task.text ? (
        <div className="mt-3">
          <div className="text-[0.85em] font-semibold text-muted">
            {t("resultReport.studentText")}
            {task.words !== null ? <span className="tnum font-normal"> ({t("resultReport.words", { n: task.words })})</span> : null}
          </div>
          {task.typedInstead ? <p className="text-[0.9em] text-muted">{t("resultReport.typedInstead")}</p> : null}
          <p lang="de" className="mt-1 whitespace-pre-line rounded-[6px] bg-canvas px-3 py-2">
            {task.text}
          </p>
        </div>
      ) : null}
      {!task.text && task.transcript === null ? (
        <p className="mt-3 text-muted">{section === "SPEAKING" ? t("resultReport.noTranscript") : t("resultReport.noAnswer")}</p>
      ) : null}
      {task.transcript !== null ? (
        <div className="mt-3">
          <div className="text-[0.85em] font-semibold text-muted">{t("resultReport.transcript")}</div>
          <p lang="de" className="mt-1 whitespace-pre-line rounded-[6px] bg-canvas px-3 py-2">
            {task.transcript}
          </p>
        </div>
      ) : null}

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{t("resultReport.teacherLevel")}</span>
          <span className="tnum text-[1.3em] font-bold">{task.level ?? "-"}</span>
        </div>
        {task.decidedBy ? <p className="text-[0.9em] text-muted">{t("resultReport.teacherBy", { name: task.decidedBy })}</p> : null}
        {task.teacherNote ? (
          <p className="mt-1">
            <span className="font-medium">{t("resultReport.teacherNote")}: </span>
            {task.teacherNote}
          </p>
        ) : null}
        {task.criteria.length ? (
          <div className="mt-2">
            <div className="text-[0.85em] font-semibold text-muted">{t("resultReport.criteria")}</div>
            <ul className="mt-1 flex flex-col gap-1">
              {task.criteria.map((c) => (
                <li key={c.criterion}>
                  <span className="font-medium">{t(`result.crit${c.criterion}` as "result.critRANGE")}</span> <span className="tnum font-semibold">{c.level}</span>
                  {c.note ? <span className="text-ink-2"> - {c.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {task.summary ? <p className="mt-2 text-ink-2">{task.summary}</p> : null}
      </div>
    </div>
  );
}

function SectionBody({ s, t }: { s: DetailSection; t: T }) {
  if (s.kind === "PRODUCTIVE") return <>{s.tasks.map((task) => <Task key={task.n} task={task} section={s.section} t={t} />)}</>;
  return (
    <>
      {s.hasTfng ? <p className="mt-2 text-[0.9em] text-muted">{s.section === "LISTENING" ? t("resultReport.tfLegendListening") : t("resultReport.tfLegend")}</p> : null}
      {s.blocks.map((b, i) => (
        <div key={i} className="mt-4">
          {b.heading ? (
            <h3 lang="de" className="border-b border-line pb-1 font-semibold">
              <span className="text-[0.85em] font-semibold uppercase tracking-[0.04em] text-muted">
                {s.section === "LISTENING" ? t("resultReport.recording") : t("resultReport.readingText")}:{" "}
              </span>
              {b.heading}
            </h3>
          ) : null}
          {b.questions.map((q) => (
            <Question key={q.n} q={q} t={t} />
          ))}
        </div>
      ))}
    </>
  );
}

/** The question-by-question part of the report: one page-broken article per section. */
export function DetailSheet({ sections, studentName, t, locale }: { sections: DetailSection[]; studentName: string; t: T; locale: Locale }) {
  if (sections.length === 0) return null;
  return (
    <>
      <style>{DETAIL_CSS}</style>
      {sections.map((s, i) => (
        <article
          key={s.section}
          lang={locale}
          className="report-detail mx-auto mt-6 w-[210mm] max-w-full rounded-[16px] border border-line bg-white py-[10mm] text-[10.5pt] leading-[1.5] text-ink shadow-panel"
        >
          <table className="report-detail-table">
            <thead className="report-detail-head">
              <tr>
                <td className="report-detail-pad align-bottom text-[0.8em] text-muted">{t("resultReport.detailRunning", { name: studentName })}</td>
              </tr>
            </thead>
            <tfoot className="report-detail-foot">
              <tr>
                <td />
              </tr>
            </tfoot>
            <tbody>
              <tr>
                <td className="report-detail-pad align-top">
                  <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-strong pb-2">
                    <h2 className="text-[1.5em] font-bold tracking-[-0.01em]">{t(`sectionName.${s.section}`)}</h2>
                    <div className="tnum flex items-baseline gap-4">
                      {s.kind === "OBJECTIVE" ? <span className="font-semibold">{t("resultReport.score", { correct: s.correct, total: s.total })}</span> : null}
                      <span>
                        <span className="text-muted">{t("resultReport.levelLabel")} </span>
                        <span className="text-[1.3em] font-bold">{s.level ?? "-"}</span>
                      </span>
                    </div>
                  </div>
                  {i === 0 ? <p className="mt-2 text-[0.9em] text-muted">{t("resultReport.detailIntro")}</p> : null}
                  <SectionBody s={s} t={t} />
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      ))}
    </>
  );
}
