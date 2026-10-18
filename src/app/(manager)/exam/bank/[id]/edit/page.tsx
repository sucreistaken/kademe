import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ItemEditor } from "@/components/panel/item-editor";
import { draftFromItem } from "@/components/panel/item-editor-model";
import { db } from "@/db";
import { items, stimuli } from "@/db/schema";
import { can } from "@/lib/authorize";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Every field of one bank question: stem, options and key per type, level and Kolay / Orta / Zor. */
export default async function EditBankItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("bank:write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ item: items, title: stimuli.title, body: stimuli.body })
    .from(items)
    .leftJoin(stimuli, eq(stimuli.id, items.stimulusId))
    .where(and(eq(items.id, id), eq(items.orgId, user.orgId)));
  if (!row) notFound();
  const { item } = row;
  const initial = draftFromItem({
    type: item.type,
    section: item.section,
    level: item.level,
    difficulty: item.difficulty,
    prompt: item.prompt,
    content: item.content,
    key: item.answerKey,
    rubric: item.rubric,
    explanation: item.explanation,
    skillTag: item.skillTag,
  });
  return (
    <main className="mx-auto w-full max-w-[1080px] px-page pt-6">
      <ItemEditor
        mode="edit"
        itemId={item.id}
        initial={initial}
        status={item.status}
        canApprove={can(user, "bank:approve")}
        sharedText={row.body !== null ? { title: row.title ?? "", body: row.body } : null}
        backHref={`/exam/bank/${item.id}`}
      />
    </main>
  );
}
