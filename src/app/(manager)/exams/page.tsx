import Link from "next/link";
import { sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, PageHead } from "@/components/panel/bits";
import { db } from "@/db";
import { assessments, examBlueprints } from "@/db/schema";
import { can } from "@/lib/authorize";
import { enabledSections, estimatedMinutes } from "@/lib/exam/blueprint";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const user = await requireUser();
  const t = managerT(await managerLocale());
  const list = await db
    .select()
    .from(examBlueprints)
    .where(and(eq(examBlueprints.orgId, user.orgId), sql`${examBlueprints.status} <> 'ARCHIVED'`))
    .orderBy(desc(examBlueprints.updatedAt));
  const counts = await db
    .select({ id: assessments.blueprintId, n: sql<number>`count(*)::int` })
    .from(assessments)
    .where(eq(assessments.orgId, user.orgId))
    .groupBy(assessments.blueprintId);
  const rows = list.map((b) => ({ b, uses: counts.find((c) => c.id === b.id)?.n ?? 0 }));
  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead
        title={t("exams.title")}
        action={
          can(user, "blueprint:write") ? (
            <Button asChild variant="primary">
              <Link href="/exams/new">{t("exams.new")}</Link>
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <Card className="mt-6 px-6 py-10 text-center text-[15px] text-ink">{t("exams.empty")}</Card>
      ) : (
        <Card className="mt-6 divide-y divide-line">
          {rows.map(({ b, uses }) => (
            <Link key={b.id} href={`/exams/${b.id}`} className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[2fr_1fr_2fr_0.6fr_1fr_0.5fr]">
              <span className="text-[14.5px] font-semibold text-ink">{b.name}</span>
              <span className="text-[13.5px] text-ink-2">{t(`mode.${b.mode}`)}</span>
              <span className="text-[13px] text-muted">{enabledSections(b.config).map((s) => t(`sectionName.${s.section}`)).join(" · ")}</span>
              <span className="tnum text-[13px] text-muted">{t("exams.estimated", { n: estimatedMinutes(b.config) })}</span>
              <Dot tone={b.status === "PUBLISHED" ? "done" : "neutral"}>{t(`exams.status${b.status}`)}</Dot>
              <span className="tnum text-[13px] text-muted">{uses}</span>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
