"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/authorize";
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
  // The builder sends "builder", the wizard's step 3 (HIRING-UX 5.20) "setup"; anything else returns to the overview.
  const sent = formData.get("back");
  const back = sent === "builder" ? "builder" : sent === "setup" ? "setup" : "overview";
  const { user, opening, access } = await openingFor(openingId, "view");
  const base = `/hiring/openings/${opening.id}`;
  const target = back === "builder" ? `${base}/assessment/edit` : base;
  // The wizard hears a refusal on its publish step; a success opens the overview with the invite Sheet.
  const refused = (notice: PublishNotice) => (back === "setup" ? `${base}/setup?publish=${notice}#publish` : `${target}?publish=${notice}`);
  // A closed opening is history: say so before the role check, which would answer "your role cannot".
  if (opening.status === "CLOSED") redirect(refused("closed"));
  if (!access.edit) throw new ForbiddenError("opening:write");
  let destination: string;
  try {
    const result = await publishDraft(user.orgId, opening.id, user.id);
    destination = result.ok ? `${target}?published=${result.number}${back === "setup" ? "&invite=1" : ""}` : refused("refused");
  } catch (error) {
    const notice = noticeFor(error);
    if (!notice) throw error;
    destination = refused(notice);
  }
  revalidatePath("/hiring/openings", "layout");
  // redirect() throws, so it stays outside the try.
  redirect(destination);
}
