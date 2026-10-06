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
 * HIRING-UX 5.11 as a page (`?opening=` preselects), the guided flow of
 * HIRING-VISUAL-FLOW 4.9; the opening pages open the same flow in a Sheet.
 * A reviewer reads why there is no form (no opening is read for them); the
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
  if (openings.length === 0) {
    return (
      <main className="mx-auto max-w-[720px] px-page py-8">
        <PageTitle title={t("hiringInvite.title")} />
        <Card className="mt-section space-y-2 p-card">
          <p className="text-[14px] text-ink">{t("hiringInvite.noOpenings")}</p>
          <Link href="/hiring/openings" className="text-[14px] font-medium text-ink underline decoration-underline underline-offset-4">
            {t("hiringInvite.goOpenings")}
          </Link>
        </Card>
      </main>
    );
  }
  // 4.9: the guided flow draws its own head ("Aday davet et · <alım>", "Çık") and its steps.
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <InviteForm container="page" openings={openings} initialOpeningId={one(sp.opening) ?? null} today={orgDay()} zone={zoneLabel(locale)} />
    </main>
  );
}
