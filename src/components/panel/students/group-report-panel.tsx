import { Card } from "@/components/ui/card";
import { CEFR_LEVELS } from "@/lib/exam/types";
import { groupCounts, levelDistribution, type GroupRow } from "./group-report";

export type GroupReportLabels = {
  title: string;
  sub: string;
  invited: string;
  started: string;
  finished: string;
  notStarted: string;
  /** "Finished with serious flags". */
  serious: string;
  levels: string;
  levelsNone: string;
  /** "{level} seviyesinde {n} öğrenci", already filled per level. */
  levelCount: (level: string, n: number) => string;
};

/** A compact strip above the list: the group's counts and, for those who finished, how the levels spread. */
export function GroupReport({ rows, labels }: { rows: readonly GroupRow[]; labels: GroupReportLabels }) {
  const c = groupCounts(rows);
  const dist = levelDistribution(rows);
  const max = Math.max(1, ...CEFR_LEVELS.map((l) => dist[l]));
  const total = CEFR_LEVELS.reduce((s, l) => s + dist[l], 0);
  const counts: [string, number][] = [
    [labels.invited, c.invited],
    [labels.started, c.started],
    [labels.finished, c.finished],
    [labels.notStarted, c.notStarted],
    [labels.serious, c.seriousFinished],
  ];
  return (
    <Card className="mt-6 px-5 py-4" data-testid="group-report">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        {labels.title} <span className="font-normal normal-case tracking-normal">({labels.sub})</span>
      </h2>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <dl className="flex gap-8">
          {counts.map(([label, n]) => (
            <div key={label}>
              <dd className="tnum text-[22px] font-extrabold leading-none text-ink">{n}</dd>
              <dt className="mt-1 text-[12.5px] text-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="min-w-[280px] flex-1 max-w-[460px]">
          <p className="text-[12.5px] text-muted">{labels.levels}</p>
          {total === 0 ? (
            <p className="mt-2 text-[13px] text-ink-2">{labels.levelsNone}</p>
          ) : (
            <ul className="mt-2 flex items-end gap-2" aria-label={labels.levels}>
              {CEFR_LEVELS.map((l) => (
                <li key={l} className="flex flex-1 flex-col items-center gap-1" title={labels.levelCount(l, dist[l])} aria-label={labels.levelCount(l, dist[l])}>
                  <span className="tnum text-[12px] font-semibold text-ink">{dist[l]}</span>
                  <span className="flex h-12 w-full items-end rounded-md bg-subtle">
                    <span className="w-full rounded-md bg-accent" style={{ height: dist[l] === 0 ? 0 : Math.max(6, Math.round((dist[l] / max) * 48)) }} />
                  </span>
                  <span className="tnum text-[12px] font-bold text-muted">{l}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
