import type { NextRequest } from "next/server";
import { z } from "zod";
import type { CandidateContext } from "@/lib/candidate-context";
import { fail, notFoundForSolution, readJson, withCandidate, type CandidateRouteOptions, type ErrorCode } from "@/lib/candidate-api";
import { hiringManifest } from "../manifest";
import { loadHiringContext, type HiringContext } from "./candidate";

export type HiringHandler = (req: NextRequest, h: HiringContext) => Promise<Response>;

/**
 * `withCandidate` for `/api/c/[token]/hiring/*` (hiring solution design 7).
 * Anything that is not a HIRING invitation, a HIRING invitation while the
 * flow is not live, or one without hiring terms, is answered exactly like an
 * unknown token, before a single hiring table is written.
 *
 * Both checks run where the core runs its solution check (ruling C6): the
 * flag in `acceptSolution`, the hiring terms in `serves` (hiringServes: a
 * missing row is false, only an infrastructure failure throws). So a HIRING
 * invitation without terms is the unknown token whatever its link's state,
 * before the link's problem is named and before the first visit is recorded.
 * The terms `serves` loaded are handed to the handler, so they are read once.
 */
export function withHiringCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: HiringHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  const terms = new WeakMap<CandidateContext, HiringContext>();
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const h = terms.get(ctx) ?? (await loadHiringContext(ctx));
      if (!h) return notFoundForSolution(request);
      return handler(request, h);
    },
    {
      ...options,
      acceptSolution: (kind) => kind === "HIRING" && hiringManifest.candidateFlowLive,
      // hiringServes, keeping what it loaded for the handler.
      serves: async (ctx) => {
        const h = await loadHiringContext(ctx);
        if (h) terms.set(ctx, h);
        return h !== null;
      },
    },
  );
}

/** A refusal in the candidate's language. */
export function refuse(h: HiringContext, code: ErrorCode, status: number): Response {
  return fail(h, code, status);
}

/** Bad input, as opposed to a state the candidate cannot change by retrying. */
export const INPUT_CODES = new Set<string>([
  "EXTRA_TIME_INVALID",
  "FILE_TYPE_REJECTED",
  "FILE_TOO_LARGE",
  "FILE_EMPTY",
  "NOT_A_FILE",
  "NOT_A_RECORDING",
  "SURVEY_INVALID",
  "UPLOAD_NOT_FOUND",
  // A take of the wrong kind or above the cap is bad input like a rejected file.
  "RECORDING_TYPE_REJECTED",
  "RECORDING_TOO_LARGE",
  // A body that is not the endpoint's shape.
  "REQUEST_INVALID",
]);
export const statusOf = (code: string) => (code === "REQUIRED_MISSING" ? 422 : INPUT_CODES.has(code) ? 400 : 409);

/**
 * The request bodies (hiring candidate flow, Task 9). Shapes only: what a
 * position or a question id means is decided by the server under its locks.
 */
const position = z.number().int();
const activityId = z.string().min(1).max(200);
export const StageBody = z.object({ stagePosition: position });
export const AnswerBody = z.object({ stagePosition: position, activityId, answer: z.unknown().optional() });
export const ExtraTimeBody = z.object({ pct: z.union([z.literal(0), z.literal(25), z.literal(50)]) });
export const MediaInitBody = z.object({
  stagePosition: position,
  activityId,
  kind: z.enum(["recording", "file"]),
  mime: z.string().max(200),
  name: z.string().max(1000).optional(),
  bytes: z.number().optional(),
});
export const SurveyBody = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().nullish() });

/** The JSON body in the endpoint's shape, or null (empty, not JSON, or another shape). */
export async function readBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await readJson<unknown>(req));
  return parsed.success ? parsed.data : null;
}
