import { ItemEditor } from "@/components/panel/item-editor";
import { CREATE_SECTIONS, emptyDraft } from "@/components/panel/item-editor-model";
import { isCefr } from "@/lib/exam/cefr";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** A new bank question, written by a teacher, as a guided flow. It lands as a draft. */
export default async function NewBankItemPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("bank:write");
  const sp = await searchParams;
  const section = CREATE_SECTIONS.find((s) => s === sp.section) ?? "GRAMMAR";
  const level = isCefr(sp.level) ? sp.level : "B1";
  return (
    <main className="mx-auto w-full max-w-[1080px] px-page pt-6">
      <ItemEditor mode="create" itemId={null} initial={emptyDraft("SINGLE_CHOICE", section, level)} status={null} canApprove={false} sharedText={null} backHref="/exam/bank" />
    </main>
  );
}
