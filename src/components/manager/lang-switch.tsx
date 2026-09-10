import { setManagerLocale } from "@/app/(manager)/locale-action";
import { LOCALES, type Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { cn } from "@/lib/cn";

/**
 * Two words in the header, not a dropdown. The current language is one of the
 * three places the accent colour is allowed to appear (active state), and the
 * other one stays plain text so nothing competes with the screen's single
 * filled button.
 *
 * A form per locale rather than one select: it works before hydration, and the
 * switch is the kind of thing someone uses once.
 */
export function LangSwitch({ locale }: { locale: Locale }) {
  const t = managerT(locale);

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("nav.language")}>
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <form key={code} action={setManagerLocale}>
            <input type="hidden" name="locale" value={code} />
            <button
              type="submit"
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-[6px] px-1.5 py-1 text-[12px]",
                active
                  ? "text-accent font-medium"
                  : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {code === "tr" ? t("nav.languageTr") : t("nav.languageEn")}
            </button>
          </form>
        );
      })}
    </div>
  );
}
