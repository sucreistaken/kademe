import Link from "next/link";
import { requireUser } from "@/server/session";
import { loadPositions } from "@/server/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { can } from "@/lib/authorize";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";

export default async function PositionsPage() {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const rows = await loadPositions(user.orgId);
  const mayWrite = can(user, "position:write");

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="text-[12.5px] text-muted">{t("positions.kicker")}</p>
          <h1 className="mt-0.5 text-[24px] font-semibold tracking-tight">
            {rows.length === 0
              ? t("positions.none")
              : t("positions.count", { count: rows.length })}
          </h1>
        </div>
        {mayWrite ? (
          <Button variant="primary" size="md" asChild>
            <Link href="/positions/new">{t("positions.create")}</Link>
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card className="p-8">
          <p className="text-[14px]">{t("positions.emptyTitle")}</p>
          <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-muted">
            {t("positions.emptyBody")}
          </p>
          {mayWrite ? (
            <div className="mt-5">
              <Button variant="primary" size="md" asChild>
                <Link href="/positions/new">{t("positions.createFirst")}</Link>
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/positions/${row.id}`}
              className="flex items-center gap-6 px-6 py-4 hover:bg-canvas"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{row.name}</p>
                {row.shortDescription ? (
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    {row.shortDescription}
                  </p>
                ) : null}
              </div>
              <StatusDot tone={Number(row.publishedCount) > 0 ? "active" : "neutral"}>
                {Number(row.publishedCount) > 0
                  ? t("positions.publishedTemplates", { count: Number(row.publishedCount) })
                  : Number(row.templateCount) > 0
                    ? t("positions.draftOnly")
                    : t("positions.noTemplate")}
              </StatusDot>
              <span className="w-24 shrink-0 text-right text-[13px] text-muted tnum">
                {t("positions.candidateCount", { count: Number(row.candidateCount) })}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
