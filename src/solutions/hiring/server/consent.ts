import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Executor } from "@/db/executor";
import { consentTexts, organizations } from "@/db/schema";
import type { ConsentTextRow } from "@/solutions/types";
import { HIRING_CONSENT_EN, HIRING_CONSENT_PREVIOUS, HIRING_CONSENT_TR } from "../consent-default";

type Body = { tr?: string; en?: string } | null | undefined;
const isBuiltIn = (body: Body, text: { tr: string; en: string }) => body?.tr === text.tr && body?.en === text.en;

/**
 * The organisation's current hiring consent text, created from the built-in
 * text on first need (decision 3). Always a HIRING text of the caller's own
 * organisation (the same-version invariant of schema/hiring.ts that the
 * database does not enforce for hiring_assessments.consent_text_id). When the
 * newest version is an earlier built-in text (HIRING_CONSENT_PREVIOUS), the
 * current built-in text is written as the next version: new invitations
 * freeze it, invitations already sent keep the text they froze. A text that
 * was never built in is the organisation's own and is returned as it is.
 *
 * Any write happens under the organisation row's lock, so two invitations at
 * the same moment write one text, not two. The lock is FOR NO KEY UPDATE: it
 * still makes two ensure calls run one at a time, but unlike FOR UPDATE it
 * does not conflict with the FOR KEY SHARE that every foreign key insert
 * takes on the organisation row, so the organisation's other writes never
 * wait for it. Pass the invitation's transaction as `x` so the lock is held
 * until the invitation that freezes the text commits.
 */
export async function ensureHiringConsentText(orgId: string, x: Executor = db): Promise<string> {
  const newest = async () => {
    const [row] = await x
      .select({ id: consentTexts.id, version: consentTexts.version, body: consentTexts.body })
      .from(consentTexts)
      .where(and(eq(consentTexts.orgId, orgId), eq(consentTexts.solution, "HIRING")))
      .orderBy(desc(consentTexts.version))
      .limit(1);
    return row;
  };
  const current = { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN };
  const outdated = (row: { body: Body }) => HIRING_CONSENT_PREVIOUS.some((text) => isBuiltIn(row.body, text)) && !isBuiltIn(row.body, current);
  const found = await newest();
  if (found && !outdated(found)) return found.id;
  await x.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).for("no key update");
  const again = await newest();
  if (again && !outdated(again)) return again.id;
  const [created] = await x
    .insert(consentTexts)
    .values({ orgId, solution: "HIRING", version: (again?.version ?? 0) + 1, body: current })
    .returning({ id: consentTexts.id });
  return created.id;
}

/** The consent text frozen on an invitation, read inside its organisation. */
export async function loadConsentText(orgId: string, id: string, x: Executor = db): Promise<ConsentTextRow> {
  const [text] = await x
    .select()
    .from(consentTexts)
    .where(and(eq(consentTexts.id, id), eq(consentTexts.orgId, orgId)))
    .limit(1);
  if (!text) throw new Error(`consent text ${id} of organisation ${orgId} is missing`);
  return text;
}
