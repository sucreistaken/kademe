/**
 * The last line of defence on the student surface.
 *
 * Items reach the browser only through `toCandidateItem` (src/lib/exam/safe.ts),
 * which builds a whitelist per item type. Every student response still goes
 * out through `candidateJson()`, which walks the whole body and removes any
 * field whose name is known to be internal. So a later query that forgets the
 * whitelist still cannot ship an answer key.
 */

/** Every field name that must never reach a student. Add here when the schema grows. */
export const INTERNAL_FIELDS = [
  "answerKey",
  "answer_key",
  "key",
  "correct",
  "accepted",
  "answers",
  "pairs",
  "rubric",
  "contentPoints",
  "difficulty",
  "skillTag",
  "skill_tag",
  "explanation",
  "itemSnapshot",
  "item_snapshot",
  "itemPlan",
  "item_plan",
  "thetaAfter",
  "seAfter",
  "thetaMean",
  "thetaSd",
  "isCorrect",
  "is_correct",
  "score",
  "aiProposal",
  "ai_proposal",
  "transcript",
  "audioKey",
  "audio_key",
  "storageKey",
  "storage_key",
] as const;

const INTERNAL_SET: ReadonlySet<string> = new Set(INTERNAL_FIELDS);

/**
 * Deep copy with every internal field removed. Plain objects and arrays are
 * walked; Dates and other class instances are passed through untouched.
 */
export function candidateSafe<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (INTERNAL_SET.has(key)) continue;
    out[key] = strip(inner);
  }
  return out;
}

/**
 * The only way a student route is allowed to answer with a body. Using
 * `Response.json` directly on a student route is a bug.
 */
export function candidateJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(candidateSafe(data), init);
}

export type CandidateLocale = "tr" | "en";
