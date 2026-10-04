import Link from "next/link";
import { PageTitle } from "@/components/manager/page-title";
import { NewCompetencyForm } from "@/components/library/new-competency-form";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function NewCompetencyPage() {
  await requireUser("library:write");
  const t = managerT(await managerLocale());
  return (
    <main className="mx-auto max-w-[880px] px-page py-8">
      <Link href="/library/competencies" className="text-[13px] text-muted hover:text-ink">
        {t("libCompetencies.back")}
      </Link>
      <div className="mt-3">
        <PageTitle title={t("libCompetencies.newTitle")} sub={t("libCompetencies.newSub")} />
      </div>
      <div className="mt-section">
        <NewCompetencyForm />
      </div>
    </main>
  );
}
