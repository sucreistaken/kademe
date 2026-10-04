/**
 * The server's signing secret (local playback URLs, the builder's undo
 * tickets). Pure so the rule can be tested without mutating NODE_ENV: a fixed
 * development string is fine on a laptop and a forgeable signature in
 * production, so there it is an error, not a default.
 */
export function resolveSigningSecret(env: {
  AUTH_SECRET?: string;
  NODE_ENV?: string;
}): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error(
      "[storage] AUTH_SECRET is not set. Local storage signs playback URLs with it, and production must not sign them with the development default.",
    );
  }
  return "dev-only-storage-secret";
}
