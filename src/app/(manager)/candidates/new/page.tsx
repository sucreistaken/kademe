import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import {
  activities,
  positions,
  stages,
  templateVersions,
  templates,
} from "@/db/schema";
import { requireUser } from "@/server/session";
import { InviteForm } from "@/components/manager/invite-form";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";

export default async function NewCandidatePage() {
  const user = await requireUser("candidate:invite");
  const locale = await managerLocale();
  const t = managerT(locale);

  // Only published versions can be invited against: a draft is still moving.
  const rows = await db
    .select({
      versionId: templateVersions.id,
      versionNumber: templateVersions.versionNumber,
      templateName: templates.name,
      positionName: positions.name,
      // Which languages this template was actually authored in. Offering a
      // language the questions were never written in would send the candidate
      // a half translated assessment.
      localeSet: templateVersions.localeSet,
      defaultLocale: templateVersions.defaultLocale,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templates.id, templateVersions.templateId))
    .innerJoin(positions, eq(positions.id, templates.positionId))
    .where(
      and(
        eq(templateVersions.orgId, user.orgId),
        eq(templateVersions.status, "PUBLISHED"),
      ),
    );

  // A version can claim a language in `locale_set` and still have questions
  // that were never written in it. Offering that language would send the
  // candidate an assessment with blank questions, so the option is computed
  // from the content rather than from the claim.
  const prompts = rows.length
    ? await db
        .select({
          versionId: stages.versionId,
          prompt: activities.candidatePrompt,
        })
        .from(activities)
        .innerJoin(stages, eq(stages.id, activities.stageId))
        .where(
          inArray(
            stages.versionId,
            rows.map((row) => row.versionId),
          ),
        )
    : [];

  const writtenIn = (versionId: string, code: "tr" | "en") => {
    const mine = prompts.filter((row) => row.versionId === versionId);
    return mine.length > 0 && mine.every((row) => row.prompt[code]?.trim());
  };

  const options = rows
    .map((row) => ({
      versionId: row.versionId,
      positionName: row.positionName,
      templateName: `${row.templateName} v${row.versionNumber}`,
      locales: (row.localeSet?.length
        ? row.localeSet
        : [row.defaultLocale]
      ).filter((code) => writtenIn(row.versionId, code)),
      defaultLocale: row.defaultLocale,
    }))
    // A version with no language fully written cannot be invited against at
    // all: every question would arrive blank.
    .filter((option) => option.locales.length > 0)
    .sort((a, b) => a.positionName.localeCompare(b.positionName, locale));

  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <p className="text-[13px] text-muted">
        <Link href="/candidates" className="hover:text-ink hover:underline">
          {t("shared.candidatesBreadcrumb")}
        </Link>{" "}
        / {t("invite.breadcrumb")}
      </p>
      <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
        {t("invite.title")}
      </h1>
      <p className="mt-1 text-sm text-muted">{t("invite.lead")}</p>

      <Card className="mt-6 p-6">
        {options.length === 0 ? (
          <div className="py-4">
            <p className="text-sm font-medium">{t("invite.noTemplate")}</p>
            <p className="mt-1.5 text-[13px] text-muted">{t("invite.noTemplateBody")}</p>
          </div>
        ) : (
          <InviteForm options={options} />
        )}
      </Card>
    </main>
  );
}
