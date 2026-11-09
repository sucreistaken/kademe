import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidates, examAssessments, examBlueprints, users } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { WEB_CHECK_KEY, webCheckTemplate } from "@/lib/exam/templates";
import { resolveSigningSecret } from "@/lib/signing-secret";
import { createInvitation, examLinkUrl, linkVerdict } from "@/server/invite";
import { ensureTemplateBlueprint } from "@/server/template-blueprint";
import type { PublicPlacementRequest, PublicPlacementResult } from "@/solutions/types";

/**
 * The public web check (2026-11-09): the school's website registers a visitor
 * and asks for a level-test link (POST /api/public/placement, server to
 * server; the route checks the secret and the body). Spec: campusg
 * research/09-kademe.md section 2 and docs/TRY-FLOW.md.
 *
 * - The same e-mail asking again within 24 hours gets its open link back (not
 *   started or in progress, not past its last day), so a double submit or a
 *   second visit never makes a second exam.
 * - Otherwise a new invitation to the web check (templates.ts), open for 3
 *   days; at most WEB_CHECK_DAILY_CAP of them per e-mail in 24 hours, counted
 *   in the database (candidates_org_email_lower_idx), so a restart does not
 *   reset it.
 * - Requests for one e-mail are answered one at a time in this process (one
 *   VM, one process), so two parallel requests cannot both miss the open link.
 *
 * The organisation is the panel's own (single tenant): the one of the first
 * active owner, as the panel password signs in (login/actions.ts).
 */

export const WEB_CHECK_TTL_DAYS = 3;
export const WEB_CHECK_REUSE_MS = 24 * 3_600_000;
/** New web-check invitations per e-mail in 24 hours. */
export const WEB_CHECK_DAILY_CAP = 3;

/** What the candidate row keeps about the visit (`candidates.extra`): when the website's consent was given, the lead and the UTM tags. */
export function visitExtra(request: PublicPlacementRequest, now: Date): Record<string, string> {
  return {
    websiteConsentAt: now.toISOString(),
    ...(request.crmLeadId ? { crmLeadId: request.crmLeadId } : {}),
    ...Object.fromEntries(Object.entries(request.utm).map(([k, v]) => [`utm_${k}`, v])),
  };
}

const queues = new Map<string, Promise<unknown>>();

/** Runs `task` after every earlier task with the same key has settled, failed ones included. Other keys run in parallel. */
export async function oneAtATime<T>(key: string, task: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve();
  const run = before.then(() => task());
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, settled);
  try {
    return await run;
  } finally {
    if (queues.get(key) === settled) queues.delete(key);
  }
}

/** The organisation the website's visitors are invited into: the first active owner's. */
async function publicOrgId(): Promise<string | null> {
  const [owner] = await db
    .select({ orgId: users.orgId })
    .from(users)
    .where(and(eq(users.role, "OWNER"), isNull(users.disabledAt)))
    .orderBy(asc(users.createdAt))
    .limit(1);
  return owner?.orgId ?? null;
}

/** Every link of this e-mail's web-check invitations made since `since`, newest invitation first. */
function recentWebChecks(orgId: string, email: string, since: Date) {
  return db
    .select({
      assessmentId: assessments.id,
      id: assessmentLinks.id,
      tokenHash: assessmentLinks.tokenHash,
      status: assessmentLinks.status,
      expiresAt: assessmentLinks.expiresAt,
    })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))
    .innerJoin(examBlueprints, eq(examBlueprints.id, examAssessments.blueprintId))
    .where(
      and(
        eq(candidates.orgId, orgId),
        sql`lower(${candidates.email}) = ${email.toLowerCase()}`,
        isNull(candidates.deletedAt),
        eq(assessments.orgId, orgId),
        eq(assessments.solution, "LANGUAGE_EXAM"),
        gte(assessments.createdAt, since),
        eq(examBlueprints.templateKey, WEB_CHECK_KEY),
      ),
    )
    .orderBy(desc(assessments.createdAt));
}

function linkSecret(): string | null {
  try {
    return resolveSigningSecret(process.env);
  } catch {
    return null;
  }
}

/**
 * The web-check link for this visitor: the open one from the last 24 hours,
 * else a new invitation (when the e-mail is under its daily cap and the bank
 * covers the web check). Without the server's link secret an open link cannot
 * be shown again, so a new one is made, still within the cap.
 */
export async function webCheckPlacement(request: PublicPlacementRequest, now: Date = new Date()): Promise<PublicPlacementResult> {
  return oneAtATime(`web-check:${request.email.toLowerCase()}`, async (): Promise<PublicPlacementResult> => {
    const orgId = await publicOrgId();
    if (!orgId) return { ok: false, code: "NOT_SET_UP" };

    const recent = await recentWebChecks(orgId, request.email, new Date(now.getTime() - WEB_CHECK_REUSE_MS));
    const secret = linkSecret();
    if (secret) {
      for (const link of recent) {
        const verdict = linkVerdict(link, now, secret);
        if (verdict.ok) return { ok: true, url: examLinkUrl(verdict.raw), expiresAt: link.expiresAt, reused: true };
      }
    }
    if (new Set(recent.map((r) => r.assessmentId)).size >= WEB_CHECK_DAILY_CAP) return { ok: false, code: "DAILY_LIMIT" };

    const ensured = await ensureTemplateBlueprint(orgId, null, webCheckTemplate(), DEFAULT_LOCALE);
    if (!ensured.ok) return { ok: false, code: ensured.code };
    const invited = await createInvitation({
      orgId,
      blueprintId: ensured.blueprint.id,
      fullName: request.fullName,
      email: request.email,
      claimedLevel: null,
      locale: request.locale,
      invitedBy: null,
      ttlDays: WEB_CHECK_TTL_DAYS,
      phone: request.phone,
      extra: visitExtra(request, now),
      via: "public-placement",
    });
    if (!invited.ok) return { ok: false, code: "INVITE_FAILED" };
    return { ok: true, url: invited.url, expiresAt: invited.expiresAt, reused: false };
  });
}
