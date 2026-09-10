import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { requireUser } from "@/server/session";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { getAiProvider } from "@/lib/ai";
import { TemplateChoice } from "./template-choice";

/**
 * The one decision that follows creating a position: build the template by hand
 * or hand the AI the job ad.
 *
 * It is a route rather than a region of the position detail for three reasons.
 * `createPosition` ends in a redirect and needs an address to redirect to. The
 * same screen has to be reachable later, when a second template is added, and a
 * conditional empty state disappears the moment a template exists. And the job
 * ad travels between the two screens through the database, not through client
 * state or a query string, so "created with an ad already typed" and "created
 * without one" are the same code path here: a prefilled textarea or an empty
 * one.
 */
export default async function NewTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("template:write");
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;

  const [position] = await db
    .select({
      id: positions.id,
      name: positions.name,
      jobDescription: positions.jobDescription,
    })
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.orgId, user.orgId)))
    .limit(1);
  if (!position) notFound();

  const provider = getAiProvider();

  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="text-[12.5px] text-muted">
        <Link href="/positions" className="hover:text-ink">
          {t("shared.positionsBreadcrumb")}
        </Link>{" "}
        /{" "}
        <Link href={`/positions/${position.id}`} className="hover:text-ink">
          {position.name}
        </Link>
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">
        {t("templateChoice.title")}
      </h1>

      <TemplateChoice
        positionId={position.id}
        jobDescription={position.jobDescription ?? ""}
        defaultTemplateName={t("positionDetail.defaultTemplateName")}
        aiConfigured={provider.available}
      />
    </main>
  );
}
