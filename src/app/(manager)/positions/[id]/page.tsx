import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/session";
import { loadPosition } from "@/server/catalog";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { can } from "@/lib/authorize";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { UndoStrip } from "@/components/ui/undo-strip";
import {
  TemplateActions,
  NewTemplateButton,
  TemplateHeader,
} from "./template-actions";
import { restoreTemplate } from "@/app/(manager)/positions/actions";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

function isStatus(value: string): value is (typeof STATUSES)[number] {
  return (STATUSES as readonly string[]).includes(value);
}

export default async function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const { id } = await params;
  const query = await searchParams;
  const data = await loadPosition(id, user.orgId);
  if (!data) notFound();

  const mayWrite = can(user, "template:write");
  const { position, templates } = data;
  const live = templates.filter((template) => !template.archivedAt);
  const archived = templates.filter((template) => template.archivedAt);
  const hasEmptyDraft = live.some((template) =>
    template.versions.some(
      (version) => version.status === "DRAFT" && Number(version.stageCount) === 0,
    ),
  );

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <p className="text-[12.5px] text-muted">
        <Link href="/positions" className="hover:text-ink">
          {t("shared.positionsBreadcrumb")}
        </Link>
      </p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">
        {position.name}
      </h1>
      {position.shortDescription ? (
        <p className="mt-1 text-[13.5px] text-muted">{position.shortDescription}</p>
      ) : null}

      <div className="mt-7 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[15px] font-semibold">
            {t("positionDetail.templatesTitle")}
          </h2>
          <p className="mt-0.5 max-w-[62ch] text-[13px] leading-relaxed text-muted">
            {t("positionDetail.templatesLead")}
          </p>
        </div>
        {/* One filled button per screen: when the empty state is showing, its
            own call to action is the only one. */}
        {/* The filled button goes to whatever the manager's next step actually
            is. While a template sits empty, that step is filling it, not opening
            another one, so this drops to secondary. */}
        {mayWrite && live.length > 0 ? (
          <NewTemplateButton
            positionId={position.id}
            variant={hasEmptyDraft ? "secondary" : "primary"}
          />
        ) : null}
      </div>

      {/* Live, not total: a position whose only template is archived still has
          no template to work with, and it must not lose the way to create one. */}
      {live.length === 0 ? (
        <Card className="mt-4 p-8">
          <p className="text-[14px]">{t("positionDetail.emptyTitle")}</p>
          <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-muted">
            {t("positionDetail.emptyBody")}
          </p>
          {mayWrite ? (
            <div className="mt-5">
              <NewTemplateButton
                positionId={position.id}
                label={t("positionDetail.createFirstTemplate")}
              />
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {live.map((template) => (
            <Card key={template.id}>
              <div className="border-b border-line px-6 py-3">
                <TemplateHeader
                  templateId={template.id}
                  name={template.name}
                  archived={false}
                  mayWrite={mayWrite}
                />
              </div>
              {template.versions.length === 0 ? (
                <p className="px-6 py-4 text-[13px] text-muted">
                  {t("positionDetail.noVersions")}
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {template.versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center gap-5 px-6 py-3.5"
                    >
                      <span className="w-12 shrink-0 text-[13.5px] font-medium tnum">
                        v{version.versionNumber}
                      </span>
                      <StatusDot
                        tone={version.status === "PUBLISHED" ? "active" : "neutral"}
                        className="w-32 shrink-0"
                      >
                        {isStatus(version.status)
                          ? t(`positionDetail.status${version.status}`)
                          : version.status}
                      </StatusDot>
                      <span className="flex-1 text-[13px] text-muted tnum">
                        {t("positionDetail.stageAndCandidates", {
                          stages: Number(version.stageCount),
                          candidates: Number(version.candidateCount),
                        })}
                      </span>
                      <TemplateActions
                        positionId={position.id}
                        templateId={template.id}
                        versionId={version.id}
                        status={version.status}
                        stageCount={Number(version.stageCount)}
                        mayWrite={mayWrite}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Archived templates are out of the way, not gone. A details element
          rather than a toggle with state: it works before hydration and it
          remembers nothing, which is right for a thing looked at once a year. */}
      {archived.length > 0 ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">
            {t("positionDetail.archivedCount", { count: archived.length })}
          </summary>
          <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            {t("positionDetail.archivedNote")}
          </p>
          <div className="mt-3 space-y-3">
            {archived.map((template) => (
              <Card key={template.id} className="opacity-70">
                <div className="px-6 py-3">
                  <TemplateHeader
                    templateId={template.id}
                    name={template.name}
                    archived
                    mayWrite={mayWrite}
                  />
                </div>
              </Card>
            ))}
          </div>
        </details>
      ) : null}

      {query.undo === "template" && typeof query.templateId === "string" ? (
        <UndoStrip
          message={t("positionDetail.archivedUndo", {
            name: typeof query.who === "string" ? query.who : "",
          })}
          action={restoreTemplate}
          hiddenFields={{ templateId: query.templateId }}
        />
      ) : null}
    </main>
  );
}
