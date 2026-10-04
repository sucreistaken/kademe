import Link from "next/link";
import { PageTitle } from "@/components/manager/page-title";
import { NewPositionForm } from "@/components/library/new-position-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function NewPositionPage() {
  await requireUser("library:write");
  const t = managerT(await managerLocale());
  return (
    <main className="mx-auto max-w-[880px] px-page py-8">
      <Link href="/library/positions" className="text-[13px] text-muted hover:text-ink">
        {t("libPositions.back")}
      </Link>
      <div className="mt-3">
        <PageTitle title={t("libPositions.newTitle")} sub={t("libPositions.newSub")} />
      </div>
      <div className="mt-section">
        <NewPositionForm />
      </div>
    </main>
  );
}
