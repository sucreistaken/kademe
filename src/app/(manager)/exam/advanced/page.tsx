import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHead } from "@/components/panel/bits";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

/**
 * The exam side's advanced tools behind one menu entry. Inviting needs none of
 * them: the ready templates are in the invite form. The pages themselves keep
 * their own addresses.
 */
export default async function AdvancedPage() {
  await requireUser();
  const t = managerT(await managerLocale());
  const links = [
    { href: "/exam/exams", title: t("advanced.exams"), hint: t("advanced.examsHint") },
    { href: "/exam/bank", title: t("advanced.bank"), hint: t("advanced.bankHint") },
  ];
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <PageHead title={t("advanced.title")} sub={t("advanced.lead")} />
      <Card className="mt-6 divide-y divide-line">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-4 px-5 py-4 hover:bg-canvas">
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink">{l.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{l.hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </Link>
        ))}
      </Card>
    </main>
  );
}
