import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  positions,
  stages,
  templateVersions,
  templates,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import { getAiProvider } from "@/lib/ai";
import { AiBuilder } from "./ai-builder";

/**
 * Y3, the AI builder.
 *
 * The job ad goes in, suggestion cards come out, and every card waits for the
 * manager. Nothing on this screen changes the template until a card is
 * accepted, which is why the page itself is read only.
 */
/**
 * The draft is produced inside a server action on this segment. Gemini
 * answers in seconds, but NVIDIA stays configured as the fallback and was
 * measured at up to 275, so the segment needs a ceiling above the default.
 */
export const maxDuration = 300;

export default async function AiBuilderPage({
  params,
}: {
  params: Promise<{ id: string; tid: string; v: string }>;
}) {
  const user = await requireUser("template:write");
  const { id: positionId, tid: templateId, v: versionId } = await params;

  const [version] = await db
    .select({
      id: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      status: templateVersions.status,
      localeSet: templateVersions.localeSet,
      templateId: templateVersions.templateId,
      templateName: templates.name,
      positionId: positions.id,
      positionName: positions.name,
      jobDescription: positions.jobDescription,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(
        eq(templateVersions.id, versionId),
        eq(templateVersions.orgId, user.orgId),
      ),
    )
    .limit(1);
  if (!version) notFound();

  const [{ stageCount }] = await db
    .select({ stageCount: sql<number>`count(*)::int` })
    .from(stages)
    .where(eq(stages.versionId, versionId));

  // Read on the server so the screen can say the provider is missing before the
  // manager writes a job ad and presses a button that cannot work.
  const provider = getAiProvider();

  return (
    <AiBuilder
      versionId={version.id}
      positionId={positionId}
      templateId={templateId}
      heading={`${version.positionName} · ${version.templateName} · v${version.versionNumber}`}
      positionName={version.positionName}
      versionStatus={version.status}
      versionNumber={version.versionNumber}
      stageCount={stageCount}
      locales={version.localeSet?.length ? version.localeSet : ["tr"]}
      jobDescription={version.jobDescription ?? ""}
      aiConfigured={provider.available}
      providerName={provider.name}
      model={provider.model}
    />
  );
}
