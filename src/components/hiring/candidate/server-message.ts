/**
 * The server's own words for a refusal (it answers in the candidate's
 * language with a code); null for anything else, such as a dropped
 * connection, whose raw browser text the candidate never sees.
 */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof Error) || !("code" in err) || !("status" in err)) return null;
  const { code, status } = err as Error & { code: unknown; status: unknown };
  return typeof code === "string" && code !== "UNKNOWN" && typeof status === "number" && err.message ? err.message : null;
}
