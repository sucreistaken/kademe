import { Card } from "@/components/ui/card";
import { UndoStrip } from "@/components/ui/undo-strip";
import { FocusOnArrival } from "@/components/hiring/focus-on-arrival";
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
import { setupStrip } from "../setup-strip";
import { closeOpeningAction, reopenOpeningAction } from "./actions";

export const dynamic = "force-dynamic";

/** The closed card's heading: where the focus lands after "Alımı kapat" (its button is gone with the redirect). */
const CLOSED_HEADING_ID = "opening-closed-title";

/**
 * HIRING-UX 5.18 as HIRING-VISUAL-FLOW 4.10 "Ekip ve kurallar": the rules'
 * summary and its four short flows (OpeningSettingsForm). Everyone who may see
 * the opening sees this page (a reviewer outside the team gets the 404 of
 * openingFor); only an owner or manager of an opening that is not closed
 * changes it. "Alımı kapat" is an action under the summary: it closes at
 * once and the 8-second strip gives it back (RULES 4, no dialog); the strip
 * shows only while the opening is closed and the viewer may reopen it, which
 * is exactly when reopenOpeningAction can undo it. A closed opening is
 * read-only, and an owner or manager gets "Yeniden aç" as the page's one
 * filled button.
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
  // 4.5: a draft's setup path, one line under the tabs (after the people, ruling C21), judged on the people read above (B-M5).
  const setup = await setupStrip({ orgId: user.orgId, opening, access, t, locale, people: all });
  const closed = opening.status === "CLOSED";
  const runs = canDecide(user.role);
  // Someone who only reads the opening sees the people on it, not the organisation's whole user list.
  const onOpening = new Set([...opening.memberIds, opening.decisionMakerId, opening.backupDecisionMakerId]);
  const users: SettingsUser[] = all
    .filter((u) => access.edit || onOpening.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: u.disabledAt !== null }));

  return (
    <main className="mx-auto max-w-[1080px] px-page py-8">
      <OpeningHeader opening={opening} active="settings" locale={locale} t={t} setup={setup} />
      {closed ? (
        <Card className="mt-section space-y-3 p-card">
          <h2 id={CLOSED_HEADING_ID} tabIndex={-1} className="text-[16px] leading-6 font-semibold text-ink outline-none">
            {t("hiringSettings.closedTitle")}
          </h2>
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
            blindMode: opening.blindMode,
            deadline: opening.deadlineAt ? orgDay(opening.deadlineAt) : null,
            feedbackDays: opening.feedbackDays,
            candidateContactEmail: opening.candidateContactEmail ?? "",
            finishSurveyEnabled: opening.finishSurveyEnabled,
          }}
        >
          {access.edit ? (
            // Under the summary only, never inside a flow (the form draws it there).
            <div className="space-y-1">
              <form action={closeOpeningAction}>
                <input type="hidden" name="openingId" value={opening.id} />
                <PendingButton label={t("hiringSettings.close")} pendingLabel={t("hiringSettings.closing")} />
              </form>
              <p className="text-[13px] text-muted">{t("hiringSettings.closeBody")}</p>
            </div>
          ) : null}
        </OpeningSettingsForm>
      </div>
      {one(sp.closed) === "1" && closed && runs ? (
        // Shown once after closing; a reload does not bring the strip back.
        <UrlNotice params={["closed"]}>
          {/* Once, on the arrival from "Alımı kapat": its button went with the redirect. */}
          <FocusOnArrival targetId={CLOSED_HEADING_ID} />
          <UndoStrip message={t("hiringSettings.closedUndo")} action={reopenOpeningAction} hiddenFields={{ openingId: opening.id }} />
        </UrlNotice>
      ) : null}
    </main>
  );
}
