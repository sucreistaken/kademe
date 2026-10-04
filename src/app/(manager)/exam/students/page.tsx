import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, INTEGRITY_TONE, Level, PageHead, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { can } from "@/lib/authorize";
import { listStudents, type StudentRow } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const TABS = ["all", "review", "running", "final"] as const;
type Tab = (typeof TABS)[number];
const inTab = (r: StudentRow, tab: Tab) =>
  tab === "all"
    ? true
    : tab === "review"
      ? r.status === "AWAITING_REVIEW" || r.status === "AWAITING_GRADING"
      : tab === "running"
        ? r.status === "IN_EXAM" || r.status === "NOT_STARTED"
        : r.status === "FINAL" || r.status === "RELEASED";

/** Every student, one row each. A zero-result filter offers the way back. */
export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "all";
  const q = (sp.q ?? "").trim().toLocaleLowerCase(locale);
  const all = await listStudents(user.orgId);
  const rows = all.filter((r) => inTab(r, tab) && (!q || `${r.name} ${r.email}`.toLocaleLowerCase(locale).includes(q)));
  const tabLabel: Record<Tab, string> = {
    all: t("students.tabAll"),
    review: t("students.tabReview"),
    running: t("students.tabRunning"),
    final: t("students.tabFinal"),
  };

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead
        title={t("students.title")}
        action={
          can(user, "student:invite") ? (
            <Button asChild variant="primary">
              <Link href="/exam/students/new">{t("today.invite")}</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-1">
          {TABS.map((k) => (
            <Link
              key={k}
              href={`/exam/students?tab=${k}${q ? `&q=${encodeURIComponent(sp.q ?? "")}` : ""}`}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-[13.5px]",
                k === tab ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {tabLabel[k]} <span className="tnum">{all.filter((r) => inTab(r, k)).length}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={t("students.search")}
            className="h-9 w-[260px] rounded-[8px] border border-line bg-surface px-3 text-[13.5px]"
          />
        </form>
      </div>

      {all.length === 0 ? (
        <Card className="mt-6 px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-ink">{t("students.empty")}</p>
          <p className="mt-1 text-[13.5px] text-muted">{t("students.emptyHint")}</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="mt-6 px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-ink">{t("students.noMatch")}</p>
          <Link href="/exam/students" className="mt-2 inline-block text-[13.5px] text-ink underline underline-offset-2">
            {t("students.clearFilters")}
          </Link>
        </Card>
      ) : (
        <Card className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">{t("students.colStudent")}</th>
                <th className="px-3 py-3 font-medium">{t("students.colExam")}</th>
                <th className="px-3 py-3 font-medium">{t("students.colClaimed")}</th>
                <th className="px-3 py-3 font-medium">{t("students.colResult")}</th>
                <th className="px-3 py-3 font-medium">{t("students.colStatus")}</th>
                <th className="px-3 py-3 font-medium">{t("students.colIntegrity")}</th>
                <th className="px-5 py-3 font-medium">{t("students.colDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.assessmentId} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <Link href={`/exam/students/${r.assessmentId}`} className="block">
                      <span className="block text-[14px] font-semibold text-ink">{r.name}</span>
                      <span className="text-[12.5px] text-muted">{r.email}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13.5px] text-ink-2">
                    {r.examName}
                    <span className="block text-[12px] text-muted">{t(`mode.${r.mode}`)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Level level={r.claimed} muted />
                  </td>
                  <td className="px-3 py-3">
                    <Level level={r.level} muted={!r.levelFinal} />
                    {r.outcome ? <span className="ml-2 text-[12.5px] text-muted">{t(`result.outcome${r.outcome}`)}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    <Dot tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Dot>
                  </td>
                  <td className="px-3 py-3">
                    <Dot tone={INTEGRITY_TONE[r.integrity]}>{t(`integrityLevel.${r.integrity}`)}</Dot>
                  </td>
                  <td className="tnum px-5 py-3 text-[13px] text-muted">{shortDateTime(r.completedAt ?? r.invitedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
