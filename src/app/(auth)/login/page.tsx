import { Card } from "@/components/ui/card";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { panelPasswordHash } from "@/lib/panel-login";
import { LoginForm } from "./login-form";

/**
 * The panel's front door, in the language the browser asked for.
 *
 * It used to be hardcoded Turkish, which meant an invited colleague could set
 * their password in English and then meet a Turkish login screen the next
 * morning. The locale comes from the same `kademe-lang` cookie the panel uses,
 * falling back to Accept-Language on a first visit.
 *
 * With `PANEL_PASSWORD_HASH` configured the screen asks for the panel password
 * only; the action checks the same setting, so the two cannot disagree.
 */
export default async function LoginPage() {
  const locale = await managerLocale();
  const t = managerT(locale);
  const panelMode = panelPasswordHash() !== null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6" lang={locale}>
      <div className="w-full max-w-[380px]">
        <p className="mb-8 text-[15px] font-semibold tracking-tight">Kademe</p>

        <Card className="p-7" elevated>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {t("login.title")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {t(panelMode ? "login.panelLead" : "login.lead")}
          </p>

          <LoginForm
            copy={
              panelMode
                ? {
                    password: t("login.panelPassword"),
                    submit: t("login.submit"),
                    checking: t("login.checking"),
                    invalid: t("login.panelInvalid"),
                  }
                : {
                    email: t("login.email"),
                    password: t("login.password"),
                    submit: t("login.submit"),
                    checking: t("login.checking"),
                    invalid: t("login.invalid"),
                  }
            }
          />
        </Card>

        <p className="mt-5 text-center text-[12.5px] text-muted">{t("login.candidate")}</p>
      </div>
    </main>
  );
}
