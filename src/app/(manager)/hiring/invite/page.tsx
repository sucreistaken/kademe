import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/manager/page-title";
import { InviteForm } from "@/components/hiring/invite/invite-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { can } from "@/lib/authorize";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { requireUser } from "@/server/session";
import { invitableOpenings } from "@/solutions/hiring/server/invitations";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.11 as a page (`?opening=` preselects); the opening pages open
 * the same form in a Sheet. A reviewer reads why there is no form; the
 * actions refuse them too.
 */
export default async function HiringInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  if (!can(user, "opening:write")) {
    return (
      <main className="mx-auto max-w-[720px] px-page py-8">
        <PageTitle title={t("hiringInvite.title")} />
        <Card className="mt-section space-y-2 p-card">
          <p className="text-[14px] text-ink">{t("hiringInvite.noPermission")}</p>
          <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("hiringInvite.goOpenings")}
          </Link>
        </Card>
      </main>
    );
  }
  const openings = await invitableOpenings(user.orgId);
  return (
    <main className="mx-auto max-w-[720px] px-page py-8">
      <PageTitle title={t("hiringInvite.title")} sub={t("hiringInvite.lead")} />
      <Card className="mt-section p-card">
        {openings.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[14px] text-ink">{t("hiringInvite.noOpenings")}</p>
            <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
              {t("hiringInvite.goOpenings")}
            </Link>
          </div>
        ) : (
          <InviteForm openings={openings} initialOpeningId={one(sp.opening) ?? null} today={orgDay()} zone={zoneLabel(locale)} />
        )}
      </Card>
    </main>
  );
}
