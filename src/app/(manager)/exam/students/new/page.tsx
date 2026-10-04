import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHead } from "@/components/panel/bits";
import { InviteForm } from "@/components/panel/invite-form";
import { estimatedMinutes, enabledSections } from "@/lib/exam/blueprint";
import { bankCounts, publishedBlueprints } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const user = await requireUser("student:invite");
  const t = managerT(await managerLocale());
  const blueprints = await publishedBlueprints(user.orgId);
  const counts = await bankCounts(user.orgId);
  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <PageHead title={t("invite.title")} sub={t("invite.lead")} />
      {blueprints.length === 0 ? (
        <Card className="mt-8 px-6 py-8 text-center">
          <p className="text-[15px] font-medium text-ink">{t("invite.noExam")}</p>
          <Link href="/exam/exams/new" className="mt-2 inline-block text-[13.5px] underline underline-offset-2">
            {t("invite.createExam")}
          </Link>
        </Card>
      ) : (
        <InviteForm
          counts={counts}
          blueprints={blueprints.map((b) => ({
            id: b.id,
            name: b.name,
            mode: b.mode,
            config: b.config,
            minutes: estimatedMinutes(b.config),
            sections: enabledSections(b.config).length,
          }))}
        />
      )}
    </main>
  );
}
