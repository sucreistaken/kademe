import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { rateLimit } from "@/lib/candidate-api";
import { parsePlacementRequest } from "@/lib/public-placement";
import { solutionModules } from "@/solutions/registry.server";

export const dynamic = "force-dynamic";

/** Shorter secrets are treated as not set: the endpoint must not open on a placeholder. */
const MIN_SECRET_LENGTH = 32;
/** The body is a handful of short fields; anything bigger is refused before it is parsed. */
const MAX_BODY_BYTES = 8 * 1024;
/** In-process limits on top of the solution's daily cap per e-mail: all callers together, and one e-mail. */
const ALL_PER_MINUTE = 30;
const EMAIL_PER_MINUTE = 5;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  // The link in the answer is the student's whole credential: nothing may cache it.
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * The website asks for a level-test link for a visitor it registered (the
 * web check, 2026-11-09; contract in docs/STATUS.md "Web check"). Server to
 * server only: the caller sends `Authorization: Bearer <KADEME_PUBLIC_SECRET>`,
 * compared in constant time as the cron endpoints do. Without the secret on
 * this server the endpoint answers 503 and does nothing; it is never open.
 *
 * Body: { name, email, phone?, locale, consent: true, crmLeadId?, utm? }.
 * Answer: 201 { url, expiresAt } for a new invitation, 200 { url, expiresAt }
 * for the visitor's open one from the last 24 hours. The test itself is the
 * solution's (SolutionModule.publicPlacement, the language exam's web check);
 * this route only checks the caller and the body.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.KADEME_PUBLIC_SECRET ?? "";
  if (!secret) return json({ error: "KADEME_PUBLIC_SECRET is not set" }, 503);
  if (secret.length < MIN_SECRET_LENGTH) return json({ error: `KADEME_PUBLIC_SECRET is shorter than ${MIN_SECRET_LENGTH} characters` }, 503);
  const offered = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(offered, secret)) return json({ error: "forbidden" }, 403);

  if (!rateLimit("public-placement", ALL_PER_MINUTE, 60_000)) return json({ error: "RATE_LIMITED" }, 429, { "Retry-After": "60" });

  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ error: "BODY_TOO_LARGE" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  const parsed = parsePlacementRequest(body);
  if (!parsed.ok) return json(parsed.code === "INVALID_FIELD" ? { error: parsed.code, field: parsed.field } : { error: parsed.code }, 400);
  const { request } = parsed;

  if (!rateLimit(`public-placement:${request.email.toLowerCase()}`, EMAIL_PER_MINUTE, 60_000)) return json({ error: "RATE_LIMITED" }, 429, { "Retry-After": "60" });

  const solution = solutionModules().find((m) => m.publicPlacement);
  if (!solution?.publicPlacement) {
    console.error("[public-placement] no solution offers a public placement");
    return json({ error: "NOT_SET_UP" }, 503);
  }
  try {
    const result = await solution.publicPlacement(request);
    if (result.ok) return json({ url: result.url, expiresAt: result.expiresAt.toISOString() }, result.reused ? 200 : 201);
    switch (result.code) {
      case "DAILY_LIMIT":
        return json({ error: result.code }, 429);
      case "NOT_SET_UP":
      case "TEMPLATE_COVERAGE":
        console.error(`[public-placement] cannot invite: ${result.code}`);
        return json({ error: result.code }, 503);
      case "INVITE_FAILED":
        console.error("[public-placement] the invitation was refused");
        return json({ error: result.code }, 500);
    }
  } catch (error) {
    console.error("[public-placement] failed", error);
    return json({ error: "FAILED" }, 500);
  }
}
