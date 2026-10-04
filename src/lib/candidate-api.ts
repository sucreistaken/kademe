import type { NextRequest } from "next/server";
import { candidateJson } from "@/lib/candidate-safe";
import {
  recordFirstSeen,
  resolveToken,
  type CandidateContext,
  type LinkProblem,
  type SolutionKind,
} from "@/lib/candidate-context";
import { candidateT, type CandidateMessages } from "@/i18n/candidate";
import { localeFromAcceptLanguage, type Locale } from "@/i18n/locale";
import { solutionModule } from "@/solutions/registry.server";
import type { SolutionModule } from "@/solutions/types";

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

export type CandidateRouteOptions = {
  limit?: number;
  windowMs?: number;
  /**
   * Endpoints that must keep working on a link that is expired, not yet open
   * or already finished. Data rights and problem reports are the two: a
   * candidate whose link just closed still needs a way to reach a human.
   */
  allowProblems?: LinkProblem[];
  /**
   * Which solutions' invitations this endpoint serves. Checked the moment the
   * token resolves, before link problems and before anything is recorded, so a
   * mismatch is answered exactly like an unknown token whatever the link's state.
   */
  acceptSolution?: (kind: SolutionKind) => boolean;
};

/**
 * The one answer for a token this endpoint will not serve: an unknown token, or
 * another solution's invitation. Both go through here so they cannot drift. The
 * language is the browser's, because an unknown token has no other hint and a
 * known one must not reveal itself through the invitation's own language.
 */
function unknownTokenResponse(req: NextRequest) {
  const locale = localeFromAcceptLanguage(req.headers.get("accept-language"));
  return candidateJson(
    { error: "INVALID", message: message(locale, "INVALID") },
    { status: PROBLEM_STATUS.INVALID },
  );
}

/**
 * Resolves the token, applies the rate limit, and hands the handler a context it
 * can trust. A handler never sees a raw id from the client.
 */
export async function withCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: Handler,
  options: CandidateRouteOptions = {},
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
  if (resolved.ctx && options.acceptSolution && !options.acceptSolution(resolved.ctx.assessment.solution)) {
    return unknownTokenResponse(req);
  }
  if (!resolved.ok) {
    const tolerated =
      !!resolved.ctx && (options.allowProblems ?? []).includes(resolved.problem);
    if (!tolerated) {
      if (!resolved.ctx) return unknownTokenResponse(req);
      const locale = resolved.ctx.locale as Locale;
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

export type SolutionHandler = (
  req: NextRequest,
  ctx: CandidateContext,
  solution: SolutionModule,
) => Promise<Response>;

/**
 * `withCandidate` for core endpoints whose answer depends on the solution
 * (state, consent, proctoring). An invitation of a solution with no registered
 * module gets the unknown-token 404. The check runs inside `withCandidate`, as
 * soon as the token resolves, so it cannot be told apart from an unknown token
 * by the link's state either.
 */
export function withSolution(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: SolutionHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const solution = solutionModule(ctx.assessment.solution);
      if (!solution) return notFoundForSolution(request);
      return handler(request, ctx, solution);
    },
    { ...options, acceptSolution: (kind) => solutionModule(kind) !== null },
  );
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

/**
 * A valid token for another solution's invitation gets exactly the answer an
 * unknown token gets (spec 6: no leak), in the browser's language.
 */
export function notFoundForSolution(req: NextRequest) {
  return unknownTokenResponse(req);
}
