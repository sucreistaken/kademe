import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, FilePenLine, Inbox } from "lucide-react";
import { InviteMenu, InviteUnavailable } from "@/components/manager/invite-menu";
import { inviteChoice } from "@/components/manager/invite-choice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, Level, shortDateTime } from "@/components/panel/bits";
import { EmptyState } from "@/components/manager/empty-state";
import { NextTaskCard } from "@/components/manager/next-task-card";
import { PanelHeader } from "@/components/manager/panel-header";
import { Disclosure } from "@/components/visual/disclosure";
import { IconTile } from "@/components/visual/icon-tile";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { attentionRows, inviteEmphasis, pickNextTask, reviewQueue, todaySummary } from "@/lib/today";
import { expiringLinks } from "@/server/links";
import { requireUser } from "@/server/session";
import { inviteTargets } from "@/solutions/registry";
import { solutionModules } from "@/solutions/registry.server";
import type { TodayCell, TodayItem } from "@/solutions/types";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

const ATTENTION_ICON = { requests: Inbox, expiring: Clock, draft: FilePenLine } as const;
const TEXT_LINK = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink hover:underline";

function Cell({ cell }: { cell: TodayCell }) {
  if (cell.kind === "text") return <span className="text-[13.5px] text-ink-2">{cell.text}</span>;
  if (cell.kind === "level") return <Level level={cell.text} muted={!cell.final} />;
  return <Dot tone={cell.tone}>{cell.text}</Dot>;
}

/**
 * "Today" (HIRING-VISUAL-FLOW 4.3): "what should I look at?". The next task
 * (K10) holds the one filled button; "Dikkat isteyenler" lists what needs a
 * look, each row with the action that fixes it; under it, each solution's own
 * control view ("Tüm alımların durumu ›", H1); the exam's review queue keeps
 * its rows, columns and order exactly; work in progress sits behind a
 * disclosure; the exam's expiring links keep their "7 gün uzat". No stat
 * tiles: every row leads to an action.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const modules = solutionModules();
  const items: TodayItem[] = (await Promise.all(modules.map((m) => m.today(user.orgId, user.id, locale)))).flat();
  const labelOf = (key: TodayItem["solution"]) => modules.find((m) => m.key === key)?.label[locale] ?? "";
  const queue = reviewQueue(items);
  const next = pickNextTask(items);
  const attention = attentionRows(items);
  const summary = todaySummary(items);
  const running = items.filter((i) => i.lane === "running");
  // H1: a solution with a control view of its own (hiring's openings) is one link away; everyone who sees its menu sees the link.
  const overviews = modules.flatMap((m) => (m.overview ? [{ key: m.key, href: m.overview.href, label: m.overview.label[locale] }] : []));
  const expiring = await expiringLinks(user.orgId);
  // Extending a link needs the same right as inviting a student.
  const canExtend = can(user, "student:invite");
  // Every solution that can invite and that this user may invite for (HIRING-UX 4.5).
  const invite = inviteChoice(inviteTargets(), (capability) => can(user, capability), locale);
  const emphasis = inviteEmphasis({ next: next !== null, attention: attention.length });
  const inviteButton = (variant: "primary" | "secondary") =>
    invite.kind === "many" ? (
      <InviteMenu label={t("today.inviteMenu")} items={invite.items} variant={variant} />
    ) : invite.kind === "one" ? (
      <Button asChild variant={variant}>
        <Link href={invite.href}>{invite.label}</Link>
      </Button>
    ) : (
      <InviteUnavailable label={t("today.inviteMenu")} reason={t("today.noInvitePermission")} variant={variant} />
    );
  const queueLabel = queue[0] ? labelOf(queue[0].solution) : (modules.find((m) => m.key === "language-exam")?.label[locale] ?? "");

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PanelHeader
        title={t("today.title")}
        meta={[t("today.summary", { count: summary.count }), summary.oldest ? t("today.oldest", { date: shortDateTime(summary.oldest, locale) }) : null].filter(Boolean).join(" ")}
        primary={emphasis === "empty" ? undefined : inviteButton(emphasis === "outline" ? "secondary" : "primary")}
      />

      {emphasis === "empty" && queue.length === 0 ? (
        // "Davet edebilirsin" only to someone who can; a user who may invite for nothing sees the disabled invite and its reason.
        <EmptyState
          className="mt-8"
          illustration="emptyToday"
          title={t("today.emptyTitle")}
          body={invite.kind === "none" ? undefined : t("today.emptyBody")}
          action={inviteButton("primary")}
        />
      ) : null}

      {next ? (
        <div className="mt-8">
          <NextTaskCard
            heading={t("today.nextTitle")}
            solution={labelOf(next.solution)}
            withDrawing={next.solution === "hiring"}
            title={next.title}
            detail={next.lane === "task" ? (next.detail ?? null) : null}
            meta={[next.subtitle, next.sortAt ? shortDateTime(next.sortAt, locale) : null].filter(Boolean).join(" · ") || null}
            action={{ label: next.lane === "task" ? t("today.nextRequest") : t("today.review"), href: next.href }}
          />
        </div>
      ) : null}

      {attention.length ? (
        <section className="mt-8" aria-labelledby="today-attention">
          <h2 id="today-attention" className="mb-2.5 text-[12px] font-semibold tracking-[0.07em] text-muted uppercase">
            {t("today.attentionTitle")}
          </h2>
          <Card className="divide-y divide-hairline overflow-hidden">
            {attention.map((row) => {
              const Icon = ATTENTION_ICON[row.attention ?? "requests"];
              return (
                <Link key={row.id} href={row.href} className="flex items-center gap-3.5 px-[18px] py-3.5 hover:bg-canvas">
                  <IconTile icon={Icon} color={row.attention === "expiring" ? "neutral" : "accent"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{row.title}</span>
                    {row.subtitle ? <span className="block truncate text-[13px] text-muted">{row.subtitle}</span> : null}
                    {/* Ruling C6: data-rights requests are counted here and said plainly; they are handled with plan 3. */}
                    {row.detail ? <span className="block text-[13px] text-muted">{row.detail}</span> : null}
                  </span>
                  <span className="hidden rounded-full bg-row-line px-2.5 py-[3px] text-[12px] text-ink-2 sm:inline">{labelOf(row.solution)}</span>
                  <span className="inline-flex items-center gap-0.5 text-[14px] whitespace-nowrap text-ink underline decoration-underline underline-offset-[3px]">
                    {row.actionLabel ?? t("today.open")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                </Link>
              );
            })}
          </Card>
        </section>
      ) : null}

      {overviews.length ? (
        <p className="mt-3 flex flex-wrap gap-x-6">
          {overviews.map((o) => (
            <Link key={o.key} href={o.href} className={TEXT_LINK}>
              {o.label}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ))}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.queueTitle", { solution: queueLabel, count: queue.length })}</h2>
        {queue.length === 0 ? (
          <Card className="px-6 py-8 text-center">
            <p className="text-[15px] font-medium text-ink">{t("today.queueEmpty")}</p>
            {/* The invite hint only where it is a second way to the invite: not under the empty state's own invite, never to someone who may invite for nothing. */}
            {emphasis !== "empty" && invite.kind !== "none" ? <p className="mt-1 text-[13.5px] text-muted">{t("today.queueEmptyHint")}</p> : null}
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
          <Disclosure label={t("today.runningCount", { title: t("today.runningTitle"), count: running.length })}>
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
          </Disclosure>
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
                  {canExtend ? (
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
