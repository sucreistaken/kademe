import { BankUploadWizard } from "@/components/panel/bank-upload-wizard";
import { managerLocale } from "@/i18n/manager-locale";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** A school's own questions from a spreadsheet, as a guided flow. They land as drafts. */
export default async function BankUploadPage() {
  await requireUser("bank:write");
  const locale = await managerLocale();
  return (
    <main className="mx-auto w-full max-w-[1080px] px-page pt-6">
      <BankUploadWizard locale={locale} />
    </main>
  );
}
