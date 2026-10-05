import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { consentTexts, organizations } from "@/db/schema";
import { HIRING_CONSENT_EN, HIRING_CONSENT_TR } from "../consent-default";

/**
 * The organisation's current hiring consent text, created from the built-in
 * text on first need (decision 3). Always a HIRING text of the caller's own
 * organisation (the same-version invariant of schema/hiring.ts that the
 * database does not enforce for hiring_assessments.consent_text_id). The
 * organisation row is locked first, so two invitations at the same moment
 * write one text, not two. The lock is FOR NO KEY UPDATE: it still makes two
 * ensure calls run one at a time, but unlike FOR UPDATE it does not conflict
 * with the FOR KEY SHARE that every foreign key insert takes on the
 * organisation row, so the organisation's other writes never wait for it.
 * Pass the invitation's transaction as `x` so the lock is held until the
 * invitation that freezes the text commits.
 */
export async function ensureHiringConsentText(orgId: string, x: Executor = db): Promise<string> {
  const newest = () =>
    x
      .select({ id: consentTexts.id, version: consentTexts.version })
      .from(consentTexts)
      .where(and(eq(consentTexts.orgId, orgId), eq(consentTexts.solution, "HIRING")))
      .orderBy(desc(consentTexts.version))
      .limit(1);
  const [found] = await newest();
  if (found) return found.id;
  await x.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).for("no key update");
  const [again] = await newest();
  if (again) return again.id;
  const [created] = await x
    .insert(consentTexts)
    .values({ orgId, solution: "HIRING", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } })
    .returning({ id: consentTexts.id });
  return created.id;
}
