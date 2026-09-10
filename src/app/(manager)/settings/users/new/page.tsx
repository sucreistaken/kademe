import { Card } from "@/components/ui/card";
import { InlineLink } from "@/components/ui/inline-link";
import { InviteUserForm } from "@/components/settings/invite-user-form";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { can } from "@/lib/authorize";
import { requireUser } from "@/server/session";
import { ROLE_ORDER, type Role } from "@/server/settings";

/**
 * Opening a panel account, on its own screen rather than inside /settings.
 *
 * Two reasons. The settings screen already spends its one filled button on
 * saving the organisation, and this flow ends by showing a link that has to be
 * copied before it disappears, which is not something to bury under a form the
 * person may still be editing.
 */
export default async function InviteUserPage() {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);

  // Not requireUser("settings:write"): a thrown ForbiddenError is a 500 page,
  // and a recruiter who follows a link here deserves a sentence and a way back.
  if (!can(user, "settings:write")) {
    return (
      <main className="mx-auto max-w-[1360px] px-6 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">
          {t("userInvite.title")}
        </h1>
        <Card className="mt-6 max-w-[560px] px-5 py-6">
          <p className="text-sm font-medium">{t("userInvite.noAccessTitle")}</p>
          <p className="mt-1.5 text-[13px] text-muted">
            {t("userInvite.noAccessHint")}
          </p>
          <InlineLink href="/settings" className="mt-3 inline-block text-[13px]">
            {t("userInvite.noAccessBack")}
          </InlineLink>
        </Card>
      </main>
    );
  }

  // The labels travel as props, like `RoleSelect`: `useMT` is typed against the
  // direct children of a namespace and every role string lives one level down.
  const roleOptions = ROLE_ORDER.map((role) => ({
    value: role,
    label: roleLabel(t, role),
    help: roleHelp(t, role),
  }));

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <InlineLink href="/settings" className="text-[13px]">
        {t("userInvite.back")}
      </InlineLink>

      <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
        {t("userInvite.title")}
      </h1>
      <p className="mt-1 text-sm text-muted">{t("userInvite.subtitle")}</p>

      <Card className="mt-6 max-w-[560px] px-5 py-5">
        <InviteUserForm roleOptions={roleOptions} />
      </Card>
    </main>
  );
}

type Translator = ReturnType<typeof managerT>;

function roleLabel(t: Translator, role: Role) {
  if (role === "OWNER") return t("settings.roles.OWNER");
  if (role === "RECRUITER") return t("settings.roles.RECRUITER");
  return t("settings.roles.REVIEWER");
}

function roleHelp(t: Translator, role: Role) {
  if (role === "OWNER") return t("settings.roleHelp.OWNER");
  if (role === "RECRUITER") return t("settings.roleHelp.RECRUITER");
  return t("settings.roleHelp.REVIEWER");
}
