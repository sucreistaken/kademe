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
import { TodayGlance } from "@/components/manager/today-glance";
import { Disclosure } from "@/components/visual/disclosure";
import { IconTile } from "@/components/visual/icon-tile";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { attentionRows, daysWaiting, inviteEmphasis, pickNextTask, splitQueue, todaySummary } from "@/lib/today";
import { expiringLinks } from "@/server/links";
import { requireUser } from "@/server/session";
import { inviteTargets } from "@/solutions/registry";
import { solutionModules } from "@/solutions/registry.server";
import type { TodayCell, TodayItem } from "@/solutions/types";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

const YOU_SHOWN = 8;
const AI_SHOWN = 10;
const REVIEW_TAB = "/exam/students?tab=review";
const ATTENTION_ICON = { requests: Inbox, expiring: Clock, draft: FilePenLine } as const;
const TEXT_LINK = "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink hover:underline";

function Cell({ cell }: { cell: TodayCell }) {
  if (cell.kind === "text") return <span className="text-[13.5px] text-ink-2">{cell.text}</span>;
  if (cell.kind === "level") return <Level level={cell.text} muted={!cell.final} />;
  return <Dot tone={cell.tone}>{cell.text}</Dot>;
}

/**
 * "Today": "what should I look at?", readable in one look. Four tiles say how
 * much waits for the manager, how much the AI is still preparing, who is in an
 * exam and which links run out; each tile jumps to its part. The next task
 * (K10) holds the one filled button and says why it is first. Left: what needs
 * the manager (attention rows, then the results waiting for a decision, oldest
 * first, the first few with a link to the rest). Right: what needs nobody
 * (the AI's unfinished work, exams in progress, expiring links with "7 gün
 * uzat", hiring's control view). No result the AI is still grading is listed
 * among the manager's decisions.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const modules = solutionModules();
  const items: TodayItem[] = (await Promise.all(modules.map((m) => m.today(user.orgId, user.id, locale)))).flat();
  const labelOf = (key: TodayItem["solution"]) => modules.find((m) => m.key === key)?.label[locale] ?? "";
  const now = new Date();
  const { you, ai } = splitQueue(items);
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
  const waitedText = (item: TodayItem) => {
    const days = daysWaiting(item.sortAt, now);
    return days === null ? null : t("today.waited", { days });
  };
  const nextNote = next?.lane === "review" ? (next.cells.find((c) => c.kind === "dot")?.text ?? null) : null;
  const glance = [
    { key: "you", label: t("today.glanceYou"), sub: t("today.glanceYouSub"), count: summary.count, href: "#today-you", emphasis: true },
    { key: "ai", label: t("today.glanceAi"), sub: t("today.glanceAiSub"), count: ai.length, href: "#today-ai" },
    { key: "running", label: t("today.glanceRunning"), sub: t("today.glanceRunningSub"), count: running.length, href: "#today-running" },
    { key: "expiring", label: t("today.glanceExpiring"), sub: t("today.glanceExpiringSub"), count: expiring.length, href: "#today-expiring" },
    // Hiring is the platform's focus: its open rows get a tile that opens its control view.
    ...overviews.map((o) => ({ key: `overview-${o.key}`, label: labelOf(o.key), sub: o.label, count: items.filter((i) => i.solution === o.key && (i.lane === "attention" || i.lane === "review")).length, href: o.href })),
  ];
  const showEmpty = emphasis === "empty" && you.length === 0;
  const nothingAtAll = showEmpty && ai.length === 0 && running.length === 0 && expiring.length === 0;

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PanelHeader
        title={t("today.title")}
        meta={[t("today.summary", { count: summary.count }), summary.oldest ? t("today.oldest", { date: shortDateTime(summary.oldest, locale) }) : null, t("today.aiNote", { count: summary.ai })].filter(Boolean).join(" ")}
        primary={emphasis === "empty" ? undefined : inviteButton(emphasis === "outline" ? "secondary" : "primary")}
      />

      {showEmpty ? (
        // "Davet edebilirsin" only to someone who can; a user who may invite for nothing sees the disabled invite and its reason.
        <EmptyState
          className="mt-8"
          illustration="emptyToday"
          title={t("today.emptyTitle")}
          body={invite.kind === "none" ? undefined : t("today.emptyBody")}
          action={inviteButton("primary")}
        />
      ) : null}

      {nothingAtAll ? null : (
        <div className="mt-6">
          <TodayGlance tiles={glance} label={t("today.title")} />
        </div>
      )}

      {next ? (
        <div className="mt-6">
          <NextTaskCard
            heading={t("today.nextTitle")}
            solution={labelOf(next.solution)}
            withDrawing={next.solution === "hiring"}
            title={next.title}
            detail={next.lane === "task" ? (next.detail ?? null) : null}
            note={nextNote}
            reason={next.lane === "review" ? t("today.nextReason") : null}
            meta={(next.lane === "review" ? [next.subtitle, waitedText(next)] : [next.subtitle, next.sortAt ? shortDateTime(next.sortAt, locale) : null]).filter(Boolean).join(" · ") || null}
            action={{ label: next.lane === "task" ? t("today.nextRequest") : t("today.review"), href: next.href }}
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-8">
          {attention.length ? (
            <section aria-labelledby="today-attention">
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

          <section id="today-you" aria-labelledby="today-you-title" className="scroll-mt-6">
            <h2 id="today-you-title" className="mb-3 text-[15px] font-semibold text-ink">
              {t("today.youTitle", { count: you.length })}
            </h2>
            {you.length === 0 ? (
              <Card className="px-6 py-6 text-center">
                <p className="text-[15px] font-medium text-ink">{t("today.youEmpty")}</p>
                {/* The invite hint only where it is a second way to the invite: not under the empty state's own invite, never to someone who may invite for nothing. */}
                {!showEmpty && invite.kind !== "none" ? <p className="mt-1 text-[13.5px] text-muted">{t("today.queueEmptyHint")}</p> : null}
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {you.slice(0, YOU_SHOWN).map((r) => {
                  const days = daysWaiting(r.sortAt, now);
                  return (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[1.4fr_1.2fr_0.5fr_1.3fr_1.1fr_auto]"
                    >
                      <span>
                        <span className="block text-[14.5px] font-semibold text-ink">{r.title}</span>
                        <span className={days !== null && days >= 3 ? "text-[12.5px] font-medium text-ink-2" : "text-[12.5px] text-muted"}>{waitedText(r) ?? r.subtitle}</span>
                      </span>
                      {r.cells.map((cell, i) => (
                        <Cell key={i} cell={cell} />
                      ))}
                      <span className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">{t("today.review")}</span>
                    </Link>
                  );
                })}
              </Card>
            )}
            {you.length > YOU_SHOWN ? (
              <Link href={REVIEW_TAB} className={`${TEXT_LINK} mt-1`}>
                {t("today.showAll", { count: you.length })}
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
            ) : null}
          </section>
        </div>

        <aside className="space-y-8">
          <section id="today-ai" className="scroll-mt-6">
            <Disclosure label={t("today.aiTitle", { count: ai.length })}>
              <p className="mb-2 text-[13px] text-muted">{t("today.aiHint")}</p>
              <Card className="divide-y divide-line">
                {ai.slice(0, AI_SHOWN).map((r) => (
                  <Link key={r.id} href={r.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas">
                    <span className="truncate text-[13.5px] font-medium text-ink">{r.title}</span>
                    <span className="tnum shrink-0 text-[12.5px] text-muted">{r.sortAt ? shortDateTime(r.sortAt, locale) : ""}</span>
                  </Link>
                ))}
              </Card>
              {ai.length > AI_SHOWN ? (
                <Link href={REVIEW_TAB} className={`${TEXT_LINK} mt-1`}>
                  {t("today.showAll", { count: ai.length })}
                  <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              ) : null}
            </Disclosure>
          </section>

          <section id="today-running" className="scroll-mt-6">
            <Disclosure label={t("today.runningCount", { title: t("today.runningTitle"), count: running.length })}>
              <Card className="divide-y divide-line">
                {running.length === 0 ? (
                  <p className="px-5 py-4 text-[13.5px] text-muted">{t("today.runningEmpty")}</p>
                ) : (
                  running.map((r) => (
                    <Link key={r.id} href={r.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
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

          <section id="today-expiring" className="scroll-mt-6">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.expiringTitle")}</h2>
            {sp.extended ? <p className="mb-2 text-[13px] text-muted">{t("today.extended")}</p> : null}
            <Card className="divide-y divide-line">
              {expiring.length === 0 ? (
                <p className="px-5 py-4 text-[13.5px] text-muted">-</p>
              ) : (
                expiring.map((e) => (
                  <div key={e.link.id} className="flex items-center justify-between gap-4 px-4 py-3">
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
        </aside>
      </div>
    </main>
  );
}
