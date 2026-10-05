import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { UrlNotice } from "@/components/ui/url-notice";
import { CandidateTable } from "@/components/hiring/candidates/candidate-table";
import { panelShortfall } from "@/components/hiring/invite/form-rules";
import { InviteSheet } from "@/components/hiring/invite/invite-sheet";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { invitableOpenings, listOpeningCandidates } from "@/solutions/hiring/server/invitations";
import { openingFor } from "../access";
import { inviteWaitReason } from "../invite-wait";
import { OpeningHeader } from "../opening-header";
import { candidatesNotice, NOTICE_PARAMS } from "./notices";

export const dynamic = "force-dynamic";

const LINK = "font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";

/** HIRING-UX 5.12 "Adaylar": who was invited, where they are, their links and their open requests. */
export default async function OpeningCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  // Ruling C12 (plan 2): who runs openings sees names; blind mode masks only the others.
  const runs = can(user, "opening:write");
  const now = new Date();
  const [rows, invitable, sp] = await Promise.all([
    listOpeningCandidates(user.orgId, opening.id, { id: user.id, runs, blindMode: opening.blindMode }, now),
    access.edit ? invitableOpenings(user.orgId) : Promise.resolve([]),
    searchParams,
  ]);
  // The opening as the invite form needs it: OPEN, of this organisation (invitableOpenings).
  const target = invitable.find((o) => o.id === opening.id) ?? null;
  const short = panelShortfall(target);
  const closed = opening.status === "CLOSED";

  const notice = candidatesNotice(sp);

  // The page's one filled button: the invite Sheet, or the same button waiting with its reason (RULES 5).
  const waitReason = target ? null : inviteWaitReason(closed, access.edit, t);
  const action = target ? (
    <InviteSheet opening={target} today={orgDay(now)} zone={zoneLabel(locale)} />
  ) : (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:max-w-[360px] sm:items-end sm:text-right">
      <Button id="invite-candidate" variant="primary" disabled disabledReason={waitReason ?? undefined}>
        {t("hiringOverview.invite")}
      </Button>
      <DisabledReason id="invite-candidate-why">{waitReason}</DisabledReason>
    </div>
  );

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="candidates" locale={locale} t={t} action={action} />
      {notice ? (
        <UrlNotice params={NOTICE_PARAMS}>
          {notice.warn ? (
            // A refusal or a failure reads as a warning, never like a success (Task 18 fix round 1).
            <p role="status" className="mt-6">
              <StatusDot tone="warn" className="items-start text-ink [&>span:first-child]:mt-[7px]">
                <span className="text-[14px] leading-5 font-medium">{t(`hiringCandidates.${notice.key}`)}</span>
              </StatusDot>
            </p>
          ) : (
            <p role="status" className="mt-6 text-[14px] font-medium text-ink">
              {t(`hiringCandidates.${notice.key}`)}
            </p>
          )}
        </UrlNotice>
      ) : null}
      {short ? (
        // Task 11 carry: the same calm warning as the invite form; not a block.
        <div className="mt-6 space-y-1">
          <StatusDot tone="warn" className="items-start text-ink [&>span:first-child]:mt-[7px]">
            <span className="tnum text-[14px] leading-5">{t("hiringInvite.panelShort", { evaluators: short.evaluators, min: short.min })}</span>
          </StatusDot>
          <Link href={`/hiring/openings/${opening.id}/settings`} className={`ml-3.5 inline-block text-[13px] ${LINK}`}>
            {t("hiringInvite.goTeam")}
          </Link>
        </div>
      ) : null}
      <Card className="mt-section p-card">
        <h2 className="sr-only">{t("hiringCandidates.title")}</h2>
        {rows.length === 0 ? (
          <div className="space-y-1">
            <p className="text-[14px] text-ink">{t("hiringCandidates.empty")}</p>
            {access.edit ? <p className="text-[13px] text-muted">{target?.live ? t("hiringCandidates.emptyRuns") : t("hiringCandidates.emptyNotLive")}</p> : null}
          </div>
        ) : (
          <CandidateTable rows={rows} openingId={opening.id} edit={access.edit} closed={closed} runs={runs} locale={locale} t={t} now={now} />
        )}
      </Card>
    </main>
  );
}
