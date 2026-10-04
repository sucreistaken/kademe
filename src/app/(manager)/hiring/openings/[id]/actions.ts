"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { publishDraft } from "@/solutions/hiring/server/publish";
import { openingFor } from "./access";

/**
 * What the page says after "Yayınla", carried in `?publish=`. Every refusal
 * the server can give has its own sentence; a raw error never reaches the
 * screen.
 */
export type PublishNotice = "refused" | "nodraft" | "closed" | "invalid" | "failed";

function noticeFor(error: unknown): PublishNotice | null {
  if (error instanceof HiringConflict) return error.code === "CLOSED" ? "closed" : error.code === "NO_DRAFT" ? "nodraft" : "failed";
  if (error instanceof HiringInvalid) return "invalid";
  if (error instanceof HiringNotFound) return "failed";
  return null;
}

/** "Yayınla" on the overview (and later the builder bar). The gate runs again on the server. */
export async function publishOpeningAction(formData: FormData) {
  const openingId = String(formData.get("openingId") ?? "");
  // Only the builder (Task 15) sends "builder"; until it exists every publish returns to the overview.
  const back = formData.get("back") === "builder" ? "builder" : "overview";
  const { user, opening } = await openingFor(openingId, "edit");
  const target = back === "builder" ? `/hiring/openings/${opening.id}/assessment/edit` : `/hiring/openings/${opening.id}`;
  let destination: string;
  try {
    const result = await publishDraft(user.orgId, opening.id, user.id);
    destination = result.ok ? `${target}?published=${result.number}` : `${target}?publish=refused`;
  } catch (error) {
    const notice = noticeFor(error);
    if (!notice) throw error;
    destination = `${target}?publish=${notice}`;
  }
  revalidatePath("/hiring/openings", "layout");
  // redirect() throws, so it stays outside the try.
  redirect(destination);
}
