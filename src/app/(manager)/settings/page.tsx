import { Card } from "@/components/ui/card";
import { Button, DisabledReason } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { InlineLink } from "@/components/ui/inline-link";
import { UndoStrip } from "@/components/ui/undo-strip";
import { RoleSelect } from "@/components/settings/role-select";
import { shortStamp } from "@/components/settings/stamp";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import type { Locale } from "@/i18n/locale";
import { can } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import {
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  ROLE_ORDER,
  countActiveOwners,
  isRole,
  loadOrg,
  loadPanelUsers,
  loadPendingSetupUserIds,
  type PanelUser,
} from "@/server/settings";
import { changeUserRole, saveOrgSettings, setUserDisabled } from "./actions";

/**
 * The whole settings surface, on one screen, on purpose: the plan's rule is
 * that there is no settings labyrinth, so the count of settings stays small
 * enough to fit here. The audit log is the single thing that gets its own
 * route, because it is a log rather than a setting.
 *
 * Read by anyone who can sign in, written only with settings:write. A role
 * without the capability still sees the values, because "what is our retention
 * period" is a question a recruiter is allowed to answer, and it sees why the
 * controls are inert instead of finding them silently dead.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const locale = await managerLocale();
  const t = managerT(locale);

  const [org, panelUsers, activeOwners, pendingSetup] = await Promise.all([
    loadOrg(user.orgId),
    loadPanelUsers(user.orgId),
    countActiveOwners(user.orgId),
    loadPendingSetupUserIds(user.orgId),
  ]);

  const mayWrite = can(user, "settings:write");
  const mayReadAudit = can(user, "audit:read");
  const error = single(params.error);
  const roleOptions = ROLE_ORDER.map((role) => ({
    value: role,
    label: roleLabel(t, role),
  }));

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---- organization ---- */}
          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("settings.org.title")}</h2>
            </div>

            {/* No action at all without the capability: the server action
                guards itself, but a form that cannot succeed should not be
                submittable in the first place. */}
            <form
              action={mayWrite ? saveOrgSettings : undefined}
              className="px-5 py-4"
            >
              <Field
                label={t("settings.org.name")}
                hint={t("settings.org.nameHint")}
                htmlFor="org-name"
              >
                <input
                  id="org-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  defaultValue={org?.name ?? ""}
                  readOnly={!mayWrite}
                  aria-readonly={!mayWrite}
                  className={inputClass(mayWrite, "w-full max-w-[420px]")}
                />
              </Field>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label={t("settings.org.mediaRetention")}
                  hint={t("settings.org.mediaRetentionHint")}
                  htmlFor="media-retention"
                >
                  <DayInput
                    id="media-retention"
                    name="mediaRetentionDays"
                    value={org?.mediaRetentionDays ?? 180}
                    editable={mayWrite}
                    unit={t("settings.org.days")}
                  />
                </Field>
                <Field
                  label={t("settings.org.candidateRetention")}
                  hint={t("settings.org.candidateRetentionHint")}
                  htmlFor="candidate-retention"
                >
                  <DayInput
                    id="candidate-retention"
                    name="candidateRetentionDays"
                    value={org?.candidateRetentionDays ?? 730}
                    editable={mayWrite}
                    unit={t("settings.org.days")}
                  />
                </Field>
              </div>

              {/* The nightly purge job is not built yet. Showing a retention
                  period as if it were being enforced would be the screen
                  telling a compliance lie. */}
              <p className="mt-4 text-[13px] text-muted">
                {t("settings.org.purgeNotice")}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {mayWrite ? (
                  <Button type="submit" variant="primary" size="md">
                    {t("settings.org.save")}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Button
                      id="save-settings"
                      variant="primary"
                      size="md"
                      disabled
                      disabledReason={t("settings.org.readOnly")}
                    >
                      {t("settings.org.save")}
                    </Button>
                    <DisabledReason id="save-settings-why">
                      {t("settings.org.readOnlyHint")}
                    </DisabledReason>
                  </div>
                )}
                {params.saved === "1" && (
                  <StatusDot tone="done">{t("settings.org.saved")}</StatusDot>
                )}
                {error === "name" && (
                  <p className="text-[13px] text-danger">{t("settings.errors.name")}</p>
                )}
                {error === "retention" && (
                  <p className="text-[13px] text-danger">
                    {t("settings.errors.retention")}
                  </p>
                )}
              </div>
            </form>
          </Card>

          {/* ---- users and roles ---- */}
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("settings.users.title")}</h2>
              <span className="text-[13px] text-muted">
                {t("settings.users.hint", { count: panelUsers.length })}
              </span>
            </div>

            {error === "self" && (
              <p className="border-b border-line px-5 py-3 text-[13px] text-danger">
                {t("settings.errors.self")}
              </p>
            )}
            {error === "lastOwner" && (
              <p className="border-b border-line px-5 py-3 text-[13px] text-danger">
                {t("settings.errors.lastOwner")}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[12.5px] text-muted">
                    <th className="px-5 py-3 font-medium">{t("settings.users.person")}</th>
                    <th className="px-5 py-3 font-medium">{t("settings.users.role")}</th>
                    <th className="px-5 py-3 font-medium">
                      {t("settings.users.lastLogin")}
                    </th>
                    <th className="px-5 py-3 font-medium">{t("settings.users.status")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {panelUsers.map((row) => (
                    <UserRow
                      key={row.id}
                      row={row}
                      isSelf={row.id === user.id}
                      lastActiveOwner={
                        row.role === "OWNER" && !row.disabledAt && activeOwners <= 1
                      }
                      pendingSetup={pendingSetup.has(row.id)}
                      mayWrite={mayWrite}
                      locale={locale}
                      t={t}
                      roleOptions={roleOptions}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* An account is opened from here, and the person invited sets
                their own password from a one-time link. Nobody types a
                password on somebody else's behalf. */}
            <div className="border-t border-line px-5 py-3.5">
              {mayWrite ? (
                <InlineLink href="/settings/users/new" className="text-[13px]">
                  {t("settings.users.invite")}
                </InlineLink>
              ) : (
                <p className="text-[13px] text-muted">
                  {t("settings.users.readOnlyHint")}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ---- right column ---- */}
        <div className="space-y-6">
          <Card className="h-fit">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("settings.audit.title")}</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-muted">{t("settings.audit.hint")}</p>
              {mayReadAudit ? (
                <InlineLink href="/settings/audit" className="mt-3 inline-block text-[13px]">
                  {t("settings.audit.open")}
                </InlineLink>
              ) : (
                <DisabledReason className="mt-3">
                  {t("settings.audit.noPermission")}
                </DisabledReason>
              )}
            </div>
          </Card>

          <Card className="h-fit">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold">{t("settings.users.role")}</h2>
            </div>
            <ul className="px-5 py-2">
              {ROLE_ORDER.map((role) => (
                <li key={role} className="border-b border-line py-3 last:border-b-0">
                  <p className="text-sm font-medium">{roleLabel(t, role)}</p>
                  <p className="mt-1 text-[13px] text-muted">{roleHelp(t, role)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {params.undo === "role" &&
        typeof params.userId === "string" &&
        isRole(single(params.prev)) && (
          <UndoStrip
            message={t("settings.users.roleChanged", {
              name: single(params.who),
              role: roleLabel(t, asRole(single(params.next))),
            })}
            action={changeUserRole}
            hiddenFields={{
              userId: params.userId,
              role: single(params.prev),
              revert: "1",
            }}
          />
        )}

      {params.undo === "disable" && typeof params.userId === "string" && (
        <UndoStrip
          message={t("settings.users.userDisabled", { name: single(params.who) })}
          action={setUserDisabled}
          hiddenFields={{ userId: params.userId, disabled: "0", revert: "1" }}
        />
      )}

      {params.undo === "enable" && typeof params.userId === "string" && (
        <UndoStrip
          message={t("settings.users.userEnabled", { name: single(params.who) })}
          action={setUserDisabled}
          hiddenFields={{ userId: params.userId, disabled: "1", revert: "1" }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */

type Translator = ReturnType<typeof managerT>;

function UserRow({
  row,
  isSelf,
  lastActiveOwner,
  pendingSetup,
  mayWrite,
  locale,
  t,
  roleOptions,
}: {
  row: PanelUser;
  isSelf: boolean;
  lastActiveOwner: boolean;
  /** Invited, with a live setup link they have not used yet. */
  pendingSetup: boolean;
  mayWrite: boolean;
  locale: Locale;
  t: Translator;
  roleOptions: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Two reasons a role is shown as plain text instead of a control, and both
  // of them end with nobody able to open this screen again: you cannot demote
  // yourself, and the last active owner cannot be demoted by anyone.
  const lockReason = isSelf
    ? t("settings.users.selfReason")
    : lastActiveOwner
      ? t("settings.users.lastOwnerReason")
      : null;

  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-5 py-3.5">
        <p className="font-medium">
          {row.name}
          {isSelf && (
            <span className="ml-2 text-[13px] font-normal text-muted">
              {t("settings.users.you")}
            </span>
          )}
        </p>
        <p className="text-[13px] text-muted">{row.email}</p>
      </td>

      <td className="px-5 py-3.5">
        {mayWrite && !lockReason ? (
          <RoleSelect
            userId={row.id}
            value={row.role}
            label={t("settings.users.roleLabel", { name: row.name })}
            options={roleOptions}
            action={changeUserRole}
          />
        ) : (
          <div>
            <p className="text-[13px]">{roleLabel(t, row.role)}</p>
            {mayWrite && lockReason && (
              <DisabledReason className="mt-1 max-w-[240px]">{lockReason}</DisabledReason>
            )}
          </div>
        )}
      </td>

      <td className="px-5 py-3.5 text-[13px] text-muted">
        {row.lastLoginAt ? (
          <span className="tnum">{shortStamp(row.lastLoginAt, locale)}</span>
        ) : (
          t("settings.users.neverSignedIn")
        )}
      </td>

      <td className="px-5 py-3.5">
        {/* Three states, one dot each. A pending invitation is not a warning:
            it is simply an account nobody has opened yet. */}
        <StatusDot
          tone={row.disabledAt ? "warn" : pendingSetup ? "neutral" : "done"}
        >
          {row.disabledAt
            ? t("settings.users.disabled")
            : pendingSetup
              ? t("settings.users.pending")
              : t("settings.users.active")}
        </StatusDot>
        {!row.disabledAt && pendingSetup && (
          <p className="mt-1 max-w-[200px] text-[13px] text-muted">
            {t("settings.users.pendingReason")}
          </p>
        )}
      </td>

      <td className="px-5 py-3.5 text-right">
        {mayWrite &&
          (lockReason ? (
            <>
              <Button
                id={`toggle-${row.id}`}
                variant="ghost"
                size="sm"
                disabled
                disabledReason={lockReason}
              >
                {t("settings.users.disable")}
              </Button>
              {/* The reason is already printed in this row's role cell, so it
                  is repeated for screen readers only rather than twice. */}
              <DisabledReason id={`toggle-${row.id}-why`} className="sr-only">
                {lockReason}
              </DisabledReason>
            </>
          ) : (
            <form action={setUserDisabled} className="inline">
              <input type="hidden" name="userId" value={row.id} />
              <input type="hidden" name="disabled" value={row.disabledAt ? "0" : "1"} />
              <Button type="submit" variant="ghost" size="sm">
                {row.disabledAt
                  ? t("settings.users.enable")
                  : t("settings.users.disable")}
              </Button>
            </form>
          ))}
      </td>
    </tr>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
      </label>
      <p className="mt-0.5 mb-2 text-[13px] text-muted">{hint}</p>
      {children}
    </div>
  );
}

function DayInput({
  id,
  name,
  value,
  editable,
  unit,
}: {
  id: string;
  name: string;
  value: number;
  editable: boolean;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={RETENTION_MIN_DAYS}
        max={RETENTION_MAX_DAYS}
        step={1}
        required
        defaultValue={value}
        readOnly={!editable}
        aria-readonly={!editable}
        className={inputClass(editable, "tnum w-28")}
      />
      <span className="text-[13px] text-muted">{unit}</span>
    </div>
  );
}

function inputClass(editable: boolean, extra: string) {
  return [
    "h-10 rounded-[10px] border px-3 text-sm",
    editable
      ? "border-line-strong bg-surface text-ink"
      : "border-line bg-canvas text-muted",
    extra,
  ].join(" ");
}

function roleLabel(t: Translator, role: "OWNER" | "MANAGER" | "REVIEWER") {
  if (role === "OWNER") return t("settings.roles.OWNER");
  if (role === "MANAGER") return t("settings.roles.MANAGER");
  return t("settings.roles.REVIEWER");
}

function roleHelp(t: Translator, role: "OWNER" | "MANAGER" | "REVIEWER") {
  if (role === "OWNER") return t("settings.roleHelp.OWNER");
  if (role === "MANAGER") return t("settings.roleHelp.MANAGER");
  return t("settings.roleHelp.REVIEWER");
}

function asRole(value: string): "OWNER" | "MANAGER" | "REVIEWER" {
  return isRole(value) ? value : "REVIEWER";
}

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
