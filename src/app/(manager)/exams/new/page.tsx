import { createBlueprint } from "@/app/(manager)/exams/actions";
import { PageHead } from "@/components/panel/bits";
import { requireUser } from "@/server/session";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

/** Two clear choices, one sentence each. Everything else is set in the editor. */
export default async function NewExamPage() {
  await requireUser("blueprint:write");
  const t = managerT(await managerLocale());
  return (
    <main className="mx-auto max-w-[720px] px-6 py-10">
      <PageHead title={t("exams.newTitle")} />
      <form action={createBlueprint} className="mt-8 flex flex-col gap-5">
        <label className="text-[13.5px] font-medium text-ink">
          {t("exams.nameLabel")}
          <input name="name" className="mt-1.5 h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[14.5px]" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {(["PLACEMENT", "LEVEL_VERIFICATION"] as const).map((m, i) => (
            <label key={m} className="flex cursor-pointer gap-3 rounded-[14px] border border-line bg-surface p-5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="mode" value={m} defaultChecked={i === 0} className="mt-1 accent-accent" />
              <span>
                <span className="block text-[15px] font-semibold text-ink">{t(`mode.${m}`)}</span>
                <span className="mt-1 block text-[13.5px] text-muted">{m === "PLACEMENT" ? t("exams.placementDesc") : t("exams.verificationDesc")}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover">
          {t("exams.create")}
        </button>
      </form>
    </main>
  );
}
