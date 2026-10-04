import { Card } from "@/components/ui/card";
import { UndoStrip } from "@/components/ui/undo-strip";
import { OpeningSettingsForm, type SettingsUser } from "@/components/hiring/opening-settings-form";
import { PendingButton } from "@/components/ui/pending-button";
import { UrlNotice } from "@/components/ui/url-notice";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { orgDay, zoneLabel } from "@/lib/org-timezone";
import { one } from "@/lib/url-notice";
import { loadPanelUsers } from "@/server/settings";
import { canDecide } from "@/solutions/hiring/rules/access";
import { openingFor } from "../access";
import { OpeningHeader } from "../opening-header";
import { closeOpeningAction, reopenOpeningAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * HIRING-UX 5.18 "Ekip ve kurallar". Everyone who may see the opening sees
 * this page (a reviewer outside the team gets the 404 of openingFor); only an
 * owner or manager of an opening that is not closed changes it. A closed
 * opening is read-only here as everywhere, and an owner or manager gets
 * "Yeniden aç" as the page's one filled button.
 */
export default async function OpeningSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user, opening, access } = await openingFor(id, "view");
  const locale = await managerLocale();
  const t = managerT(locale);
  const [all, sp] = await Promise.all([loadPanelUsers(user.orgId), searchParams]);
  const closed = opening.status === "CLOSED";
  const runs = canDecide(user.role);
  // Someone who only reads the opening sees the people on it, not the organisation's whole user list.
  const onOpening = new Set([...opening.memberIds, opening.decisionMakerId, opening.backupDecisionMakerId]);
  const users: SettingsUser[] = all
    .filter((u) => access.edit || onOpening.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabledAt !== null }));

  return (
    <main className="mx-auto max-w-[1360px] px-page py-8">
      <OpeningHeader opening={opening} active="settings" locale={locale} t={t} />
      {closed ? (
        <Card className="mt-section space-y-3 p-card">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringSettings.closedTitle")}</h2>
          <p className="text-[13px] text-muted">{runs ? t("hiringSettings.closedBody") : t("hiringSettings.closedReadOnly")}</p>
          {runs ? (
            <form action={reopenOpeningAction}>
              <input type="hidden" name="openingId" value={opening.id} />
              <PendingButton variant="primary" label={t("hiringSettings.reopen")} pendingLabel={t("hiringSettings.reopening")} />
            </form>
          ) : null}
        </Card>
      ) : null}
      <div className="mt-section">
        <OpeningSettingsForm
          // A reopen gives the form fresh values; a save keeps the form (and its "Kaydedildi.").
          // `initial.deadline` is also the saved day: a passed deadline blocks only a change.
          key={opening.status}
          openingId={opening.id}
          canEdit={access.edit}
          closed={closed}
          today={orgDay()}
          zone={zoneLabel(locale)}
          users={users}
          initial={{
            name: opening.name,
            memberIds: opening.memberIds,
            decisionMakerId: opening.decisionMakerId,
            backupDecisionMakerId: opening.backupDecisionMakerId,
            minEvaluations: opening.minEvaluations,
            blindMode: opening.blindMode,
            deadline: opening.deadlineAt ? orgDay(opening.deadlineAt) : null,
            feedbackDays: opening.feedbackDays,
            candidateContactEmail: opening.candidateContactEmail ?? "",
          }}
        />
      </div>
      {access.edit ? (
        <Card className="mt-section space-y-3 p-card">
          <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("hiringSettings.closeTitle")}</h2>
          <p className="text-[13px] text-muted">{t("hiringSettings.closeBody")}</p>
          <form action={closeOpeningAction}>
            <input type="hidden" name="openingId" value={opening.id} />
            <PendingButton label={t("hiringSettings.close")} pendingLabel={t("hiringSettings.closing")} />
          </form>
        </Card>
      ) : null}
      {one(sp.closed) === "1" && closed && runs ? (
        // Shown once after closing; a reload does not bring the strip back.
        <UrlNotice params={["closed"]}>
          <UndoStrip message={t("hiringSettings.closedUndo")} action={reopenOpeningAction} hiddenFields={{ openingId: opening.id }} />
        </UrlNotice>
      ) : null}
    </main>
  );
}
