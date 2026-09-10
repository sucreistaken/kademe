import { notFound } from "next/navigation";
import { requireUser } from "@/server/session";
import { loadVersionTree } from "@/server/catalog";
import { BuilderScreen } from "./builder-screen";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string; tid: string; v: string }>;
}) {
  const user = await requireUser("template:write");
  const { id, tid, v } = await params;

  const tree = await loadVersionTree(v, user);
  if (!tree) notFound();

  return (
    <BuilderScreen
      basePath={`/positions/${id}/templates/${tid}/versions/${v}`}
      versionId={v}
      positionName={tree.version.positionName}
      templateName={tree.version.templateName}
      versionNumber={tree.version.versionNumber}
      status={tree.version.status}
      locales={
        tree.version.localeSet?.length
          ? tree.version.localeSet
          : [tree.version.defaultLocale]
      }
      library={tree.library.map((c) => ({ id: c.id, name: c.name.tr || c.name.en }))}
      stages={tree.stages.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        internalPurpose: s.internalPurpose,
        internalObjective: s.internalObjective,
        durationSeconds: s.durationSeconds,
        graceSeconds: s.graceSeconds,
        backNavigation: s.backNavigation,
        competencyIds: s.competencyIds,
        activities: s.activities.map((a) => ({
          id: a.id,
          type: a.type,
          isRequired: a.isRequired,
          candidatePrompt: a.candidatePrompt,
          candidateNote: a.candidateNote,
          internalQuestion: a.internalQuestion,
          internalObjective: a.internalObjective,
          expectedBehaviours: a.expectedBehaviours ?? [],
          redFlags: a.redFlags ?? [],
          thinkSeconds: a.thinkSeconds,
          answerSeconds: a.answerSeconds,
          maxTakes: a.maxTakes,
        })),
      }))}
    />
  );
}
