import { PageTitle } from "@/components/manager/page-title";
import { NewOpeningForm } from "@/components/hiring/new-opening-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { copySources, positionOptions } from "@/solutions/hiring/server/openings";
import { BackToOpenings } from "../[id]/opening-header";

export const dynamic = "force-dynamic";

/** HIRING-UX 5.3. `?position=` (from a library position page) pre-selects an active position. */
export default async function NewOpeningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("opening:write");
  const t = managerT(await managerLocale());
  const sp = await searchParams;
  const [positions, sources] = await Promise.all([positionOptions(user.orgId), copySources(user.orgId)]);
  const initial = typeof sp.position === "string" && isUuid(sp.position) ? sp.position : null;
  return (
    <main className="mx-auto max-w-[1080px] px-page py-8">
      <BackToOpenings t={t} />
      <div className="mt-3">
        <PageTitle title={t("hiringNew.title")} sub={t("hiringNew.sub")} />
      </div>
      <div className="mt-section">
        <NewOpeningForm positions={positions} sources={sources} initialPositionId={initial} />
      </div>
    </main>
  );
}
