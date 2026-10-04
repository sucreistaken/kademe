import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { BlueprintEditor } from "@/components/panel/blueprint-editor";
import { db } from "@/db";
import { examBlueprints } from "@/db/schema";
import { bankCounts } from "@/server/panel";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

export default async function ExamEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("blueprint:write");
  const t = managerT(await managerLocale());
  const { id } = await params;
  const sp = await searchParams;
  const [b] = await db.select().from(examBlueprints).where(and(eq(examBlueprints.id, id), eq(examBlueprints.orgId, user.orgId)));
  if (!b) notFound();
  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <Link href="/exam/exams" className="text-[13px] text-muted hover:text-ink">
        {t("exams.title")}
      </Link>
      <p className="mt-1 text-[13px] text-muted">
        {t(`mode.${b.mode}`)} · {t(`exams.status${b.status}`)}
      </p>
      {sp.error === "coverage" ? <p className="mt-2 text-[13px] text-danger">{t("exams.publishBlocked")}</p> : null}
      <div className="mt-4">
        <BlueprintEditor
          id={b.id}
          mode={b.mode}
          initialName={b.name}
          initialDescription={b.description}
          initialConfig={b.config}
          status={b.status}
          counts={await bankCounts(user.orgId)}
        />
      </div>
    </main>
  );
}
