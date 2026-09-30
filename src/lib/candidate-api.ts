import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  recordFirstSeen,
  resolveToken,
  type CandidateContext,
  type LinkProblem,
} from "@/lib/exam-flow";
import { candidateT, type CandidateMessages } from "@/i18n/candidate";
import { localeFromAcceptLanguage, type Locale } from "@/i18n/locale";

/**
 * Shared plumbing for `/api/c/*`. There is no cookie and no session here: the
 * token in the path is the whole credential, and everything else the handler
 * needs is derived from it on the server.
 *
 * Error bodies are translated too. They are rendered straight into the
 * candidate's screen, so an English-speaking candidate must not be handed a
 * Turkish sentence by a failed request.
 */

export type ErrorCode = keyof CandidateMessages["errors"];

export function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function userAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}

export function message(locale: Locale, code: ErrorCode): string {
  return candidateT(locale)(`errors.${code}`);
}

/**
 * Small in-process limiter so the token space cannot be probed and a stuck
 * client cannot hammer the database. Good enough for one Cloud Run instance;
 * a shared store is the next step if this ever runs at scale.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export const PROBLEM_STATUS: Record<LinkProblem, number> = {
  INVALID: 404,
  NOT_YET: 403,
  EXPIRED: 410,
  COMPLETED: 409,
};

export type Handler = (
  req: NextRequest,
  ctx: CandidateContext,
) => Promise<Response>;

/**
 * Resolves the token, applies the rate limit, and hands the handler a context it
 * can trust. A handler never sees a raw id from the client.
 */
export async function withCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: Handler,
  options: {
    limit?: number;
    windowMs?: number;
    /**
     * Endpoints that must keep working on a link that is expired, not yet open
     * or already finished. Data rights and problem reports are the two: a
     * candidate whose link just closed still needs a way to reach a human.
     */
    allowProblems?: LinkProblem[];
  } = {},
): Promise<Response> {
  const { token } = await params;
  const ip = clientIp(req) ?? "unknown";

  // Per endpoint, not per token: a shared counter would let a busy autosave
  // loop use up the small budget reserved for problem reports.
  const bucket = `${ip}:${token.slice(0, 12)}:${new URL(req.url).pathname}`;
  if (!rateLimit(bucket, options.limit ?? 240, options.windowMs ?? 60_000)) {
    const locale = localeFromAcceptLanguage(req.headers.get("accept-language"));
    return candidateJson(
      { error: "RATE_LIMITED", message: message(locale, "RATE_LIMITED") },
      { status: 429 },
    );
  }

  const resolved = await resolveToken(token);
  if (!resolved.ok) {
    const tolerated =
      !!resolved.ctx && (options.allowProblems ?? []).includes(resolved.problem);
    if (!tolerated) {
      // An unknown token tells us nothing about the person holding it, so the
      // only language hint left is the one their browser sent.
      const locale =
        (resolved.ctx?.locale as Locale | undefined) ??
        localeFromAcceptLanguage(req.headers.get("accept-language"));
      return candidateJson(
        { error: resolved.problem, message: message(locale, resolved.problem) },
        { status: PROBLEM_STATUS[resolved.problem] },
      );
    }
    return handler(req, resolved.ctx!);
  }

  await recordFirstSeen(resolved.ctx, ip === "unknown" ? null : ip, userAgent(req));
  return handler(req, resolved.ctx);
}

export function fail(ctx: CandidateContext, code: ErrorCode, status: number) {
  return candidateJson(
    { error: code, message: message(ctx.locale as Locale, code) },
    { status },
  );
}

export function badRequest(ctx: CandidateContext, code: ErrorCode) {
  return fail(ctx, code, 400);
}

export function conflict(ctx: CandidateContext, code: ErrorCode) {
  return fail(ctx, code, 409);
}

/** Reads a JSON body, tolerating an empty one. */
export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
