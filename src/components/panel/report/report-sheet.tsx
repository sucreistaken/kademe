import { BrandMark } from "@/components/visual/brand-mark";
import { CEFR_LEVELS } from "@/lib/exam/types";
import { dateTime } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import type { ReportModel } from "./model";

type T = ReturnType<typeof managerT>;

/**
 * Print rules for the sheet: A4 with no browser margin, the app chrome gone,
 * and a fixed one-page box so a long name can never push a second page.
 * `print-color-adjust` keeps the level bars when the browser would drop
 * backgrounds.
 */
const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; height: auto !important; }
  [data-slot="sidebar-wrapper"] > :not(:last-child),
  [data-slot="sidebar-wrapper"] header,
  .report-toolbar { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-wrapper"] > div { min-height: 0 !important; }
  .report-wrap { padding: 0 !important; margin: 0 !important; }
  .report-sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; width: 210mm !important; height: 296mm !important; overflow: hidden; break-inside: avoid; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

const dayFmt = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);

function LevelBar({ level }: { level: string | null }) {
  const at = level ? CEFR_LEVELS.indexOf(level as (typeof CEFR_LEVELS)[number]) : -1;
  return (
    <div className="flex gap-1" aria-hidden>
      {CEFR_LEVELS.map((l, i) => (
        <div key={l} className={cn("h-2.5 flex-1 rounded-full", i <= at ? "bg-accent" : "bg-line")} />
      ))}
    </div>
  );
}

export function ReportSheet({ model, t, locale }: { model: ReportModel; t: T; locale: Locale }) {
  const m = model;
  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        lang={locale}
        className="report-sheet mx-auto flex w-[210mm] min-h-[296mm] flex-col rounded-[16px] border border-line bg-white px-[16mm] py-[14mm] text-ink shadow-panel"
      >
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <div className="text-[20px] font-bold tracking-[-0.01em]">{m.schoolName}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{t("resultReport.title")}</div>
            {m.finalizedAt ? <div className="tnum text-[12.5px] text-muted">{dayFmt(m.finalizedAt, locale)}</div> : null}
          </div>
        </div>

        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.student")}</div>
          <h1 className="mt-1 break-words text-[30px] font-bold leading-tight tracking-[-0.02em]">{m.studentName}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 text-[13.5px]">
            <div>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.exam")}</dt>
              <dd className="mt-0.5 font-medium">{m.examName}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.examDate")}</dt>
              <dd className="tnum mt-0.5 font-medium">{m.examDate ? dayFmt(m.examDate, locale) : "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex items-center gap-8 rounded-[20px] bg-accent-soft px-8 py-7">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">{t("resultReport.overall")}</div>
            <div className="tnum mt-1 text-[84px] font-bold leading-none text-accent-deep">{m.overall}</div>
          </div>
          <div className="min-w-0 flex-1 border-l border-accent/20 pl-8">
            {m.recommendedClass ? (
              <div className="mb-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">{t("resultReport.recommendedClass")}</div>
                <div className="tnum mt-0.5 text-[22px] font-bold text-accent-deep">
                  {m.recommendedClass.level}
                  {m.recommendedClass.sublevel ? <span className="ml-2 text-[15px] font-semibold">({m.recommendedClass.sublevel})</span> : null}
                </div>
              </div>
            ) : null}
            <p className="text-[13.5px] leading-[1.55] text-ink-2">{t(`resultReport.level.${m.overall}`)}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{t("resultReport.skills")}</h2>
          <ul className="mt-3 flex flex-col gap-3.5">
            {m.skills.map((s) => (
              <li key={s.section} className="grid grid-cols-[34mm_1fr_14mm] items-center gap-4">
                <span className="text-[14px] font-medium">{t(`sectionName.${s.section}`)}</span>
                <LevelBar level={s.level} />
                <span className="tnum text-right text-[17px] font-bold">{s.level ?? "-"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-[34mm_1fr_14mm] gap-4" aria-hidden>
            <span />
            <div className="flex gap-1">
              {CEFR_LEVELS.map((l) => (
                <span key={l} className="tnum flex-1 text-center text-[10.5px] text-muted">
                  {l}
                </span>
              ))}
            </div>
            <span />
          </div>
          <p className="mt-3 text-[11.5px] text-muted">{t("resultReport.scaleNote")}</p>
        </div>

        {m.feedback ? (
          <section className="mt-6 rounded-[14px] bg-canvas px-5 py-4" aria-labelledby="report-feedback">
            <h2 id="report-feedback" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
              {t("resultReport.feedbackTitle")}
            </h2>
            {m.feedback.strengths.length ? (
              <ul className="mt-2 list-disc pl-5 text-[12.5px] leading-[1.5] text-ink-2">
                {m.feedback.strengths.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
            {m.feedback.improve.length ? (
              <>
                <div className="mt-2 text-[12px] font-semibold text-ink">{t("resultReport.feedbackImprove")}</div>
                <ul className="mt-1 flex flex-col gap-1.5 text-[12.5px] leading-[1.5] text-ink-2">
                  {m.feedback.improve.map((i) => (
                    <li key={i.topic}>
                      <span className="font-semibold text-ink">{i.topic}.</span> {i.why}
                      {i.example ? (
                        <span lang="de" className="ml-1 italic text-ink">
                          ({i.example})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-2">
              <span className="font-semibold text-ink">{t("resultReport.feedbackNext")}:</span> {m.feedback.nextStep}
            </p>
          </section>
        ) : null}

        <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-8 border-t border-line pt-5">
          <dl className="grid grid-cols-2 gap-x-6 text-[13px]">
            <div>
              <dt className="text-[11.5px] uppercase tracking-[0.06em] text-muted">{t("resultReport.finalizedBy")}</dt>
              <dd className="mt-0.5 font-medium">{m.teacherName ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] uppercase tracking-[0.06em] text-muted">{t("resultReport.finalizedOn")}</dt>
              <dd className="tnum mt-0.5 font-medium">{m.finalizedAt ? dateTime(m.finalizedAt, locale) : "-"}</dd>
            </div>
          </dl>
          <div className="text-right">
            <div className="text-[11.5px] uppercase tracking-[0.06em] text-muted">{t("resultReport.verification")}</div>
            <div className="tnum mt-0.5 font-mono text-[20px] font-bold tracking-[0.12em]">{m.verificationCode}</div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">{t("resultReport.verificationHint")}</p>
        <p className="mt-1 text-[11px] text-muted">{t("brand.madeWith")}</p>
      </article>
    </>
  );
}
