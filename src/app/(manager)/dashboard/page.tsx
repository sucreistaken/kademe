import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, INTEGRITY_TONE, Level, PageHead, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { expiringLinks, listStudents } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

/**
 * "Today": one question, "what should I look at?". The review queue, oldest
 * first, is the page. Exams in progress and links about to lapse come after.
 * No stat tiles: every row here leads to an action.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const rows = await listStudents(user.orgId);
  const queue = rows
    .filter((r) => r.status === "AWAITING_REVIEW" || r.status === "AWAITING_GRADING")
    .sort((a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
  const running = rows.filter((r) => r.status === "IN_EXAM");
  const expiring = await expiringLinks(user.orgId);
  const canInvite = can(user, "student:invite");

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead
        title={t("today.title", { count: queue.length })}
        sub={queue[0]?.completedAt ? t("today.oldest", { date: shortDateTime(queue[0].completedAt, locale) }) : undefined}
        action={
          <div className="flex flex-col items-end">
            <Button asChild={canInvite} variant="primary" disabled={!canInvite} disabledReason={canInvite ? undefined : t("today.noInvitePermission")}>
              {canInvite ? <Link href="/exam/students/new">{t("today.invite")}</Link> : t("today.invite")}
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
                key={r.assessmentId}
                href={`/exam/students/${r.assessmentId}`}
                className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[1.6fr_1.3fr_0.6fr_1.4fr_1.2fr_auto]"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{r.name}</span>
                  <span className="text-[12.5px] text-muted">{shortDateTime(r.completedAt, locale)}</span>
                </span>
                <span className="text-[13.5px] text-ink-2">
                  {t(`mode.${r.mode}`)}
                  {r.claimed ? ` · ${t("mode.claimed", { level: r.claimed })}` : ""}
                </span>
                <Level level={r.level} muted={!r.levelFinal} />
                <Dot tone={r.status === "AWAITING_GRADING" ? "neutral" : "warn"}>
                  {r.status === "AWAITING_GRADING"
                    ? t("today.aiRunning")
                    : r.aiProposals > 0
                      ? t("today.aiPending", { n: r.aiProposals })
                      : t("today.readyToFinalize")}
                </Dot>
                <Dot tone={INTEGRITY_TONE[r.integrity]}>{t(`integrityLevel.${r.integrity}`)}</Dot>
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
                <Link key={r.assessmentId} href={`/exam/students/${r.assessmentId}`} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                  <span className="text-[14px] font-medium text-ink">{r.name}</span>
                  <Dot tone={STATUS_TONE.IN_EXAM}>
                    {r.currentSection ? t("today.sectionNow", { section: t(`sectionName.${r.currentSection}`) }) : t("status.IN_EXAM")}
                  </Dot>
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
