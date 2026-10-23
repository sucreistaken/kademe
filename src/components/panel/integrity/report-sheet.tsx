import { BrandMark } from "@/components/visual/brand-mark";
import { SEVERITY_STYLE } from "@/components/panel/result/integrity-panel";
import { dateTime } from "@/i18n/dates";
import type { Locale } from "@/i18n/locale";
import type { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";
import { clockTime, type FlagGroup } from "./groups";

type T = ReturnType<typeof managerT>;

export type IntegrityReportModel = {
  schoolName: string;
  studentName: string;
  examName: string;
  examDate: Date | null;
  preset: "OFF" | "STANDARD" | "STRICT";
  level: "CLEAR" | "REVIEW" | "ATTENTION";
  outcome: { value: "VALID" | "RETAKE" | "INVALID"; by: string | null; at: Date | null } | null;
  headline: string;
  flags: FlagGroup[];
  technical: FlagGroup[];
  technicalEvents: number;
  /** Who decided events of each type, by type. */
  deciders: Record<string, string[]>;
  frames: Array<{ id: string; url: string; kind: string; type: string }>;
  generatedAt: Date;
  verificationCode: string;
};

/**
 * Print rules: A4 with a modest margin, the app chrome gone. Unlike the level
 * report this one may run onto a second page, so the sheet has no fixed
 * height; a flag row never splits across pages.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; height: auto !important; }
  [data-slot="sidebar-wrapper"] > :not(:last-child),
  [data-slot="sidebar-wrapper"] header,
  .report-toolbar { display: none !important; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-wrapper"] > div { min-height: 0 !important; }
  .report-wrap { padding: 0 !important; margin: 0 !important; }
  .integrity-sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
  .integrity-sheet tr, .integrity-sheet figure { break-inside: avoid; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

const dayFmt = (d: Date, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);

export function IntegrityReportSheet({ model, t, locale }: { model: IntegrityReportModel; t: T; locale: Locale }) {
  const m = model;
  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        lang={locale}
        data-testid="integrity-report"
        className="integrity-sheet mx-auto flex w-[210mm] min-h-[296mm] flex-col rounded-[16px] border border-line bg-white px-[16mm] py-[14mm] text-ink shadow-panel"
      >
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <div className="text-[20px] font-bold tracking-[-0.01em]">{m.schoolName}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{t("integrityFlags.reportTitle")}</div>
            <div className="tnum text-[12.5px] text-muted">{dayFmt(m.generatedAt, locale)}</div>
          </div>
        </div>

        <div className="mt-7">
          <div className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.student")}</div>
          <h1 className="mt-1 break-words text-headline">{m.studentName}</h1>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 text-[13.5px]">
            <div>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.exam")}</dt>
              <dd className="mt-0.5 font-medium">{m.examName}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("resultReport.examDate")}</dt>
              <dd className="tnum mt-0.5 font-medium">{m.examDate ? dayFmt(m.examDate, locale) : "-"}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-muted">{t("integrityFlags.reportProctoring")}</dt>
              <dd className="mt-0.5 font-medium">{t(`invite.preset${m.preset}`)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_1fr] gap-4">
          <div className="rounded-[14px] bg-accent-soft px-5 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">{t("integrityFlags.reportSummary")}</div>
            <div className="mt-1 text-[20px] font-bold text-accent-deep">{m.headline}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-2">{t(`integrityLevel.${m.level}`)}</div>
          </div>
          <div className="rounded-[14px] border border-line px-5 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t("integrity.outcomeTitle")}</div>
            <div className="mt-1 text-[20px] font-bold">{m.outcome ? t(`integrity.outcome${m.outcome.value}`) : t("integrityFlags.reportNoDecision")}</div>
            {m.outcome && (m.outcome.by || m.outcome.at) ? (
              <div className="tnum mt-0.5 text-[12.5px] text-muted">{[m.outcome.by, m.outcome.at ? dateTime(m.outcome.at, locale) : null].filter(Boolean).join(", ")}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-7">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{t("integrityFlags.flagsTitle")}</h2>
          {m.flags.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-ink-2">{t("integrityFlags.reportNoFlags")}</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-left text-[12.5px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.05em] text-muted">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">{t("integrityFlags.colFlag")}</th>
                  <th className="px-2 py-1.5 font-medium">{t("integrityFlags.colCount")}</th>
                  <th className="px-2 py-1.5 font-medium">{t("integrityFlags.colTimes")}</th>
                  <th className="px-2 py-1.5 font-medium">{t("integrityFlags.colAi")}</th>
                  <th className="py-1.5 pl-2 font-medium">{t("integrityFlags.colTeacher")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {m.flags.map((g) => {
                  const ai = [
                    g.ai.CONFIRMED > 0 ? t("integrityFlags.aiConfirmed", { n: g.ai.CONFIRMED }) : null,
                    g.ai.UNCLEAR > 0 ? t("integrityFlags.aiUnclear", { n: g.ai.UNCLEAR }) : null,
                    g.ai.NOT_CONFIRMED > 0 ? t("integrityFlags.aiNotConfirmed", { n: g.ai.NOT_CONFIRMED }) : null,
                    g.ai.pending > 0 ? t("integrityFlags.aiPending", { n: g.ai.pending }) : null,
                  ].filter(Boolean);
                  const teacher = [
                    g.confirmed > 0 ? t("integrityFlags.stateConfirmed", { n: g.confirmed }) : null,
                    g.dismissed > 0 ? t("integrityFlags.stateDismissed", { n: g.dismissed }) : null,
                    g.open > 0 ? t("integrityFlags.stateOpen", { n: g.open }) : null,
                  ].filter(Boolean);
                  return (
                    <tr key={g.type}>
                      <td className="py-2 pr-2">
                        <span className="font-semibold">{t(`eventType.${g.type}` as "eventType.TAB_HIDDEN")}</span>
                        <span className={cn("ml-2 rounded-full px-1.5 py-px text-[10.5px] font-semibold", SEVERITY_STYLE[g.severity].chip)}>{t(`integrity.severity${g.severity}`)}</span>
                      </td>
                      <td className="tnum px-2 py-2">{g.count}</td>
                      <td className="tnum px-2 py-2">
                        {g.count > 1 ? `${clockTime(g.first)} - ${clockTime(g.last)}` : clockTime(g.first)}
                        {g.totalMs >= 1000 ? <span className="block text-muted">{t("integrityFlags.total", { s: Math.round(g.totalMs / 1000) })}</span> : null}
                      </td>
                      <td className="px-2 py-2">{ai.length ? ai.join(", ") : "-"}</td>
                      <td className="py-2 pl-2">
                        {teacher.join(", ")}
                        {m.deciders[g.type]?.length ? <span className="block text-muted">{m.deciders[g.type].join(", ")}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {m.technicalEvents > 0 ? (
            <p className="mt-3 text-[12px] text-muted">
              {t("integrityFlags.reportTechnical", {
                n: m.technicalEvents,
                types: m.technical.map((g) => `${t(`eventType.${g.type}` as "eventType.TAB_HIDDEN")} (${g.count})`).join(", "),
              })}
            </p>
          ) : null}
        </div>

        {m.frames.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{t("integrityFlags.reportFrames")}</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {m.frames.map((f) => (
                <figure key={f.id} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="h-[26mm] rounded-[6px] border border-line object-cover" />
                  <figcaption className="mt-0.5 text-[10.5px] text-muted">{t(`eventType.${f.type}` as "eventType.TAB_HIDDEN")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-8 border-t border-line pt-5">
          <p className="text-[11.5px] leading-[1.5] text-muted">{t("integrityFlags.reportNote")}</p>
          <div className="text-right">
            <div className="text-[11.5px] uppercase tracking-[0.06em] text-muted">{t("resultReport.verification")}</div>
            <div className="tnum mt-0.5 font-mono text-[20px] font-bold tracking-[0.12em]">{m.verificationCode}</div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">{t("brand.madeWith")}</p>
      </article>
    </>
  );
}
