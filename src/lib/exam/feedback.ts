import { z } from "zod";

/**
 * The end-of-exam survey (placement and level verification): its shape, shared
 * by the finished screen, the candidate route and the school's panel. Pure, so
 * every side applies the same limits.
 *
 * Only `overall` is required. The two quick questions and the technical-problem
 * answer are skipped by leaving them out (or null); the comment is free text.
 */

/** The database CHECK is `char_length(comment) <= 1000`; the field counts the same way (UTF-16 units never undercount characters). */
export const FEEDBACK_COMMENT_MAX = 1000;

export const FEEDBACK_SCALE = [1, 2, 3, 4, 5] as const;

export type FeedbackInput = {
  overall: number;
  clarity: number | null;
  usability: number | null;
  technicalProblem: boolean | null;
  comment: string | null;
};

/** The codes are keys of the candidate dictionary's `errors` (SURVEY_INVALID: "Choose a rating from 1 to 5."). */
export type FeedbackFault = "REQUEST_INVALID" | "SURVEY_INVALID";

const Rating = z.number().int().min(1).max(5);

/**
 * The body's shape. Ratings stay `unknown` here so that a rating of the wrong
 * kind or outside 1-5 is the survey's own refusal (SURVEY_INVALID), while a body
 * that is not an object, a flag that is not a boolean or a comment that is not
 * text (or is too long) is a malformed request (REQUEST_INVALID).
 */
const Shape = z.object({
  overall: z.unknown().optional(),
  clarity: z.unknown().optional(),
  usability: z.unknown().optional(),
  technicalProblem: z.boolean().nullish(),
  comment: z.string().max(FEEDBACK_COMMENT_MAX).nullish(),
});

/** A comment of only spaces is no comment; the rest is stored trimmed. */
export function cleanComment(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  return text ? text : null;
}

export function parseFeedbackBody(raw: unknown): { ok: true; value: FeedbackInput } | { ok: false; code: FeedbackFault } {
  const shape = Shape.safeParse(raw);
  if (!shape.success) return { ok: false, code: "REQUEST_INVALID" };
  const body = shape.data;
  const overall = Rating.safeParse(body.overall);
  if (!overall.success) return { ok: false, code: "SURVEY_INVALID" };
  const optional = (value: unknown): { ok: true; value: number | null } | { ok: false } => {
    if (value === undefined || value === null) return { ok: true, value: null };
    const parsed = Rating.safeParse(value);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
  };
  const clarity = optional(body.clarity);
  const usability = optional(body.usability);
  if (!clarity.ok || !usability.ok) return { ok: false, code: "SURVEY_INVALID" };
  return {
    ok: true,
    value: {
      overall: overall.data,
      clarity: clarity.value,
      usability: usability.value,
      technicalProblem: body.technicalProblem ?? null,
      comment: cleanComment(body.comment),
    },
  };
}
