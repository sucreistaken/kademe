import type { z } from "zod";

/** Thrown when an id is not in the caller's organisation, opening or draft. Pages answer 404. */
export class HiringNotFound extends Error {
  readonly code = "NOT_FOUND";
  constructor(readonly what: string) {
    super(`${what} not found`);
    this.name = "HiringNotFound";
  }
}

/**
 * CLOSED: the opening is closed, so it is history and nothing in it is edited.
 * STAGE_FULL: the stage already has MAX_ACTIVITIES_PER_STAGE questions.
 */
export type ConflictCode = "NO_DRAFT" | "COMPETENCY" | "CHOICE_COMPETENCY" | "TOO_MANY_COMPETENCIES" | "CLOSED" | "STAGE_FULL";

/** A request that is well formed but not allowed in the current state. */
export class HiringConflict extends Error {
  constructor(readonly code: ConflictCode) {
    super(code);
    this.name = "HiringConflict";
  }
}

export type InvalidIssue = { path: string; message: string };

/**
 * A value outside what the builder accepts (rules/patches), found before any
 * write, so a database CHECK never answers with a raw 23514. `issues` name the
 * fields for the form.
 */
export class HiringInvalid extends Error {
  readonly code = "INVALID";
  constructor(readonly issues: InvalidIssue[]) {
    super(`invalid: ${issues.map((i) => i.path || "(root)").join(", ")}`);
    this.name = "HiringInvalid";
  }
}

export function parseOrInvalid<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new HiringInvalid(result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })));
}

/** The constraint name every freeze trigger reports (migrations 0006 and 0008). */
export const FROZEN_CONSTRAINT = "hiring_version_frozen";

/**
 * True for the freeze triggers' refusal: SQLSTATE 23514 with constraint
 * hiring_version_frozen. Drizzle wraps the driver's error, so the cause chain
 * is followed.
 */
export function isFrozenRefusal(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const e = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (e.code === "23514" && e.constraint_name === FROZEN_CONSTRAINT) return true;
    current = e.cause;
  }
  return false;
}

/**
 * Runs a draft write. When the version was published under it (another tab
 * published between the draft lookup and this write), the database refuses
 * and the caller gets NO_DRAFT: "published, start editing a new version".
 */
export async function frozenAsConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isFrozenRefusal(error)) throw new HiringConflict("NO_DRAFT");
    throw error;
  }
}
