/**
 * Panel password login: one shared password, set by the operator, that opens
 * the panel as the organisation's owner. The e-mail form stays for local
 * development and tests, and is what runs whenever this is not configured.
 *
 * The password itself never lives anywhere in the app. The server holds only
 * its argon2 hash in `PANEL_PASSWORD_HASH`, produced by `pnpm panel:hash`.
 */

export const PANEL_HASH_ENV = "PANEL_PASSWORD_HASH";

/** A PHC-format argon2 string, e.g. `$argon2id$v=19$m=...,t=...,p=...$salt$hash`. */
const ARGON2_PHC = /^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

/**
 * Reads the configured hash, or null when panel login is off.
 *
 * An argon2 hash is full of `$`. Next's `.env` loader expands `$` even inside
 * single quotes, and a sourced shell file does unless single-quoted, which
 * silently mangles it. So the script prints the hash base64url-encoded and
 * this accepts either form. A value that is set but is not a well-formed
 * argon2 hash in either form is treated as not configured (with a loud log),
 * so a quoting mistake falls back to the e-mail login instead of locking
 * everybody out.
 */
export function panelPasswordHash(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env[PANEL_HASH_ENV]?.trim();
  if (!raw) return null;
  if (ARGON2_PHC.test(raw)) return raw;
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  if (ARGON2_PHC.test(decoded)) return decoded;
  console.error(
    `${PANEL_HASH_ENV} is set but is not an argon2 hash; falling back to e-mail login. Regenerate it with pnpm panel:hash.`,
  );
  return null;
}

export const PANEL_LOGIN_LIMIT = {
  /** Failed attempts allowed per client within the window. */
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
  /** How long a client stays locked out once it hits the limit. */
  lockoutMs: 15 * 60 * 1000,
};

type Entry = { failures: number; windowStart: number; lockedUntil: number };

/**
 * Counts failed panel-password attempts per client IP, in this server
 * process's memory. Production runs one `next start` process behind Caddy, so
 * one map sees every attempt; it resets on restart, which is acceptable for a
 * 15 minute lockout. Several processes would each keep their own count.
 */
export function createFailureLimiter(
  options = PANEL_LOGIN_LIMIT,
  now: () => number = Date.now,
) {
  const entries = new Map<string, Entry>();

  function current(key: string): Entry | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    const t = now();
    if (entry.lockedUntil > t) return entry;
    if (t - entry.windowStart >= options.windowMs) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    isLocked(key: string): boolean {
      const entry = current(key);
      return !!entry && entry.lockedUntil > now();
    },
    recordFailure(key: string): void {
      const t = now();
      const entry = current(key) ?? { failures: 0, windowStart: t, lockedUntil: 0 };
      entry.failures += 1;
      if (entry.failures >= options.maxFailures) {
        entry.lockedUntil = t + options.lockoutMs;
        // The next window starts once the lockout ends.
        entry.windowStart = entry.lockedUntil;
        entry.failures = 0;
      }
      entries.set(key, entry);
      // Keep the map from growing without bound under a spray of addresses.
      if (entries.size > 10_000) {
        for (const k of entries.keys()) {
          if (!current(k)) entries.delete(k);
        }
      }
    },
    reset(key: string): void {
      entries.delete(key);
    },
    clear(): void {
      entries.clear();
    },
  };
}

export const panelLoginLimiter = createFailureLimiter();

/**
 * The client address as the reverse proxy reports it. The last
 * X-Forwarded-For entry is the one the proxy itself wrote; any earlier entry
 * may come from the client and is never trusted for counting.
 */
export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  const last = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last || realIp?.trim() || "unknown";
}
