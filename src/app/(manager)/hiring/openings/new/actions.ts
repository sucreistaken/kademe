"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { managerLocale } from "@/i18n/manager-locale";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { requireUser } from "@/server/session";
import { HiringConflict, HiringInvalid, HiringNotFound } from "@/solutions/hiring/server/errors";
import { createOpening, type CreateOpeningResult } from "@/solutions/hiring/server/openings";

const schema = z.object({
  position: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.uuid() }),
    z.object({ kind: z.literal("new"), name: z.string().max(POSITION_NAME_MAX), jobDescription: z.string().max(POSITION_JOB_AD_MAX) }),
  ]),
  start: z.enum(["AI", "COPY", "BLANK"]),
  copyFrom: z.uuid().nullable(),
});

export type CreateOpeningActionResult = CreateOpeningResult | { ok: false; code: "INVALID" | "FAILED" };

/** "Alımı oluştur" (HIRING-UX 5.3). Every refusal comes back as a code the form turns into a sentence. */
export async function createOpeningAction(input: z.input<typeof schema>): Promise<CreateOpeningActionResult> {
  const user = await requireUser("opening:write");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  let result: CreateOpeningResult;
  try {
    result = await createOpening(user, { ...parsed.data, locale: await managerLocale() });
  } catch (error) {
    // A disabled creator or a row gone meanwhile: a sentence, never a raw error.
    if (error instanceof HiringNotFound || error instanceof HiringConflict || error instanceof HiringInvalid) return { ok: false, code: "FAILED" };
    throw error;
  }
  if (result.ok) revalidatePath("/hiring/openings");
  return result;
}
