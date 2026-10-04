import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, Level, PageHead, shortDateTime } from "@/components/panel/bits";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { expiringLinks } from "@/server/links";
import { requireUser } from "@/server/session";
import { solutionModules } from "@/solutions/registry.server";
import type { TodayCell, TodayItem } from "@/solutions/types";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

function Cell({ cell }: { cell: TodayCell }) {
  if (cell.kind === "text") return <span className="text-[13.5px] text-ink-2">{cell.text}</span>;
  if (cell.kind === "level") return <Level level={cell.text} muted={!cell.final} />;
  return <Dot tone={cell.tone}>{cell.text}</Dot>;
}

/**
 * "Today": one question, "what should I look at?". Every registered solution
 * contributes rows (spec 3, `today()`); the review queue, oldest first, is the
 * page. Work in progress and links about to lapse come after. No stat tiles:
 * every row here leads to an action. With one solution this draws exactly what
 * the exam dashboard drew; the solution label column arrives with the second
 * solution (HIRING-UX 4.5).
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const modules = solutionModules();
  const items: TodayItem[] = (await Promise.all(modules.map((m) => m.today(user.orgId, user.id, locale)))).flat();
  const queue = items
    .filter((i) => i.lane === "review")
    .sort((a, b) => (a.sortAt?.getTime() ?? 0) - (b.sortAt?.getTime() ?? 0));
  const running = items.filter((i) => i.lane === "running");
  const expiring = await expiringLinks(user.orgId);
  const canInvite = can(user, "student:invite");
  const inviteHref = modules[0]?.inviteHref ?? "/dashboard";

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead
        title={t("today.title", { count: queue.length })}
        sub={queue[0]?.sortAt ? t("today.oldest", { date: shortDateTime(queue[0].sortAt, locale) }) : undefined}
        action={
          <div className="flex flex-col items-end">
            <Button asChild={canInvite} variant="primary" disabled={!canInvite} disabledReason={canInvite ? undefined : t("today.noInvitePermission")}>
              {canInvite ? <Link href={inviteHref}>{t("today.invite")}</Link> : t("today.invite")}
            </Button>
            {!canInvite ? <DisabledReason>{t("today.noInvitePermission")}</DisabledReason> : null}
          </div>
        }
      />

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.queueTitle")}</h2>
        {queue.length === 0 ? (
          <Card className="px-6 py-8 text-center">
            <p className="text-[15px] font-medium text-ink">{t("today.queueEmpty")}</p>
            <p className="mt-1 text-[13.5px] text-muted">{t("today.queueEmptyHint")}</p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {queue.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[1.6fr_1.3fr_0.6fr_1.4fr_1.2fr_auto]"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{r.title}</span>
                  <span className="text-[12.5px] text-muted">{r.subtitle}</span>
                </span>
                {r.cells.map((cell, i) => (
                  <Cell key={i} cell={cell} />
                ))}
                <span className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">{t("today.review")}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.runningTitle")}</h2>
          <Card className="divide-y divide-line">
            {running.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">{t("today.runningEmpty")}</p>
            ) : (
              running.map((r) => (
                <Link key={r.id} href={r.href} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                  <span className="text-[14px] font-medium text-ink">{r.title}</span>
                  {r.cells.map((cell, i) => (
                    <Cell key={i} cell={cell} />
                  ))}
                </Link>
              ))
            )}
          </Card>
        </section>
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.expiringTitle")}</h2>
          {sp.extended ? <p className="mb-2 text-[13px] text-muted">{t("today.extended")}</p> : null}
          <Card className="divide-y divide-line">
            {expiring.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">-</p>
            ) : (
              expiring.map((e) => (
                <div key={e.link.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{e.name}</span>
                    <span className="text-[12.5px] text-muted">{shortDateTime(e.link.expiresAt, locale)}</span>
                  </span>
                  {canInvite ? (
                    <form action={extendLink}>
                      <input type="hidden" name="linkId" value={e.link.id} />
                      <input type="hidden" name="back" value="/dashboard" />
                      <Button type="submit" size="sm">
                        {t("today.extend")}
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
