import { Card } from "@/components/ui/card";
import { InlineLink } from "@/components/ui/inline-link";
import { managerT } from "@/i18n/manager";
import { managerLocale } from "@/i18n/manager-locale";
import { PASSWORD_MIN_LENGTH, resolveSetupToken } from "@/server/settings";
import { SetupForm } from "./form";

export const dynamic = "force-dynamic";

/**
 * Where an invited person becomes a panel user. Public by definition: they have
 * no account to sign in with yet, the link is the only credential, and it is
 * spent the moment they choose a password.
 *
 * A token that is expired, spent, unknown or attached to a disabled account all
 * land on the same plain screen with the same sentence. Which of the four it
 * was is not the visitor's business, and saying it out loud would turn this
 * route into a probe.
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await managerLocale();
  const t = managerT(locale);
  const target = await resolveSetupToken(token);

  if (!target) {
    return (
      <main
        lang={locale}
        className="flex min-h-screen items-center justify-center px-6"
      >
        <div className="w-full max-w-[380px]">
          <p className="mb-8 text-[15px] font-semibold tracking-tight">Kademe</p>
          <Card className="p-7" elevated>
            <h1 className="text-[19px] font-semibold tracking-tight">
              {t("setup.invalidTitle")}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">{t("setup.invalidHint")}</p>
            <InlineLink href="/login" className="mt-4 inline-block text-[13px]">
              {t("setup.invalidBack")}
            </InlineLink>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main
      lang={locale}
      className="flex min-h-screen items-center justify-center px-6"
    >
      <div className="w-full max-w-[380px]">
        <p className="mb-8 text-[15px] font-semibold tracking-tight">Kademe</p>

        <Card className="p-7" elevated>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {t("setup.title")}
          </h1>
          {/* The name is typed by an owner and rendered as it was typed: never
              uppercased, because "Kıdemli" would become "KIDEMLI" here. */}
          <p className="mt-1.5 text-[13px] text-muted">
            {t("setup.greeting", { name: target.name })}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {t("setup.subtitle", { email: target.email })}
          </p>

          <SetupForm
            token={token}
            minLength={PASSWORD_MIN_LENGTH}
            labels={{
              password: t("setup.password"),
              passwordHint: t("setup.passwordHint", { min: PASSWORD_MIN_LENGTH }),
              confirm: t("setup.confirm"),
              submit: t("setup.submit"),
              submitting: t("setup.submitting"),
              errors: {
                TOO_SHORT: t("setupErrors.TOO_SHORT", { min: PASSWORD_MIN_LENGTH }),
                MISMATCH: t("setupErrors.MISMATCH"),
                TOKEN_INVALID: t("setupErrors.TOKEN_INVALID"),
              },
            }}
          />
        </Card>
      </div>
    </main>
  );
}
