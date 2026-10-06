import { NewOpeningForm } from "@/components/hiring/new-opening-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { shortDate } from "@/lib/format";
import { isUuid } from "@/server/settings";
import { requireUser } from "@/server/session";
import { copySources, positionOptions } from "@/solutions/hiring/server/openings";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.3 as the guided flow of HIRING-VISUAL-FLOW 4.6. `?position=` (a library position page)
 * pre-selects an active position; `?copy=` (the overview's "Kopyala") pre-selects a copy source.
 */
export default async function NewOpeningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("opening:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const [positions, rows] = await Promise.all([positionOptions(user.orgId), copySources(user.orgId)]);
  // Same-named openings are told apart by state and date in the copy picker.
  const sources = rows.map((r) => ({
    id: r.id,
    name: r.name,
    detail: t("hiringNew.copySourceDetail", { status: t(`hiringCommon.status${r.status}`), date: shortDate(r.createdAt, locale) }),
  }));
  const initial = typeof sp.position === "string" && isUuid(sp.position) ? sp.position : null;
  const copy = typeof sp.copy === "string" && isUuid(sp.copy) ? sp.copy : null;
  // The flow draws its own head (the flow's name and "Çık") and its steps' titles (W2).
  return (
    <main className="mx-auto max-w-[1080px] px-page pt-6">
      <NewOpeningForm positions={positions} sources={sources} initialPositionId={initial} initialCopyId={copy} />
    </main>
  );
}
