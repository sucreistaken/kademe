import { activities, stages, templateVersions } from "@/db/schema";
import type { ActivityConfig, I18nText } from "@/db/schema/types";

/**
 * The one place the internal / candidate content split is enforced.
 *
 * The product's whole point is that a manager can write a hidden objective, a
 * list of expected behaviours and a red flag list next to a question, and the
 * candidate never sees any of it. Filtering that by hand in every endpoint is
 * how such a rule eventually leaks, so nothing on the candidate surface writes
 * its own projection: every response goes out through `candidateJson()`, which
 * runs `candidateSafe()` over the whole body first.
 *
 * The column pickers below are the first line of defence (the internal columns
 * are never even selected). `candidateSafe()` is the second, and it is the one
 * that holds if somebody later adds a query that forgets the picker.
 */

/** Every manager-only field name in the schema. Add here when the schema grows. */
export const INTERNAL_FIELDS = [
  "internalQuestion",
  "internalObjective",
  "internalPurpose",
  "expectedBehaviours",
  "redFlags",
  "managerNotes",
  /**
   * Which choice is the right one. It lives inside `activities.config.choices`
   * rather than in an `internal_*` column, so it would sail past a naming based
   * filter: an auto-scored question shipped with its answer key attached.
   */
  "correct",
  // snake_case spellings, in case a raw SQL row ever reaches this function
  "internal_question",
  "internal_objective",
  "internal_purpose",
  "expected_behaviours",
  "red_flags",
  "manager_notes",
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
 * The only way a candidate route is allowed to answer with a body. Using
 * `Response.json` directly on a candidate route is a bug.
 */
export function candidateJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(candidateSafe(data), init);
}

/** Drizzle column pickers: the internal columns are simply not selected. */
export const candidateStageColumns = {
  id: stages.id,
  orderIndex: stages.orderIndex,
  name: stages.name,
  description: stages.description,
  durationSeconds: stages.durationSeconds,
  graceSeconds: stages.graceSeconds,
  onTimeout: stages.onTimeout,
  backNavigation: stages.backNavigation,
} as const;

export const candidateActivityColumns = {
  id: activities.id,
  stageId: activities.stageId,
  orderIndex: activities.orderIndex,
  type: activities.type,
  isRequired: activities.isRequired,
  candidatePrompt: activities.candidatePrompt,
  candidateNote: activities.candidateNote,
  thinkSeconds: activities.thinkSeconds,
  answerSeconds: activities.answerSeconds,
  maxTakes: activities.maxTakes,
  config: activities.config,
} as const;

export const candidateVersionColumns = {
  id: templateVersions.id,
  defaultLocale: templateVersions.defaultLocale,
  localeSet: templateVersions.localeSet,
  introTitle: templateVersions.introTitle,
  introBody: templateVersions.introBody,
  consentTextId: templateVersions.consentTextId,
} as const;

export type CandidateLocale = "tr" | "en";

/** Pick one language out of a bilingual field, falling back to the other. */
export function pickText(
  value: I18nText | null | undefined,
  locale: CandidateLocale,
): string {
  if (!value) return "";
  const wanted = value[locale];
  if (wanted && wanted.trim()) return wanted;
  const other = locale === "tr" ? value.en : value.tr;
  return other ?? "";
}

/** What one activity looks like once it has crossed to the candidate side. */
export type CandidateActivity = {
  orderIndex: number;
  type: (typeof activities.$inferSelect)["type"];
  isRequired: boolean;
  prompt: string;
  note: string;
  thinkSeconds: number;
  answerSeconds: number | null;
  maxTakes: number;
  config: ActivityConfig;
};
