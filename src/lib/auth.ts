import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
export const SESSION_COOKIE = "kademe_session";

/** argon2id with sensible cost. Never store or log a raw password. */
export function hashPassword(plain: string) {
  return hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(digest: string, plain: string) {
  return verify(digest, plain);
}

/**
 * Tokens are stored hashed. A database read never yields anything that can be
 * replayed as a credential, which matters because this database also holds
 * candidate video keys.
 */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function mintToken(bytes = 32) {
  const raw = randomBytes(bytes).toString("base64url");
  return { raw, hash: sha256(raw) };
}

/** Constant-time compare for anything derived from user input. */
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const token = mintToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: token.hash,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { token: token.raw, expiresAt };
}

export type SessionUser = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: "OWNER" | "TEACHER" | "REVIEWER";
};

/** Resolves a raw cookie value to a user, or null. Expired sessions never resolve. */
export async function resolveSession(
  rawToken: string | undefined,
): Promise<SessionUser | null> {
  if (!rawToken) return null;
  const rows = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      email: users.email,
      name: users.name,
      role: users.role,
      disabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256(rawToken)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.disabledAt) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export async function destroySession(rawToken: string | undefined) {
  if (!rawToken) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(rawToken)));
}
