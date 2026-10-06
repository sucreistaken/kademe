"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import {
  verifyPassword,
  createSession,
  SESSION_COOKIE,
  hashPassword,
} from "@/lib/auth";
import { clientKey, panelLoginLimiter, panelPasswordHash } from "@/lib/panel-login";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Burned when the email is unknown, so a wrong address and a wrong password
 *  cost the same time and the endpoint cannot be used to enumerate accounts. */
const DUMMY_HASH_INPUT = "kademe-timing-equaliser";

/**
 * A code, not a sentence. The screen renders it in the language the visitor is
 * reading, and one code for every failure keeps the answer identical whether
 * the address exists, the password is wrong or the account is disabled.
 */
export type LoginState = { code?: "INVALID" };

/**
 * One entry point for both forms. With `PANEL_PASSWORD_HASH` set the panel is
 * opened by the shared panel password alone and the e-mail form is off; without
 * it the e-mail login runs exactly as before.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const panelHash = panelPasswordHash();
  if (panelHash) return loginWithPanelPassword(panelHash, formData);
  return loginWithEmail(formData);
}

async function loginWithEmail(formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { code: "INVALID" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user || user.disabledAt) {
    await hashPassword(DUMMY_HASH_INPUT);
    return { code: "INVALID" };
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) {
    return { code: "INVALID" };
  }

  await startSession(user.id);
  redirect("/dashboard");
}

async function loginWithPanelPassword(
  panelHash: string,
  formData: FormData,
): Promise<LoginState> {
  const head = await headers();
  const key = clientKey(head.get("x-forwarded-for"), head.get("x-real-ip"));

  // A locked client is not even checked, so guessing during a lockout is wasted.
  if (panelLoginLimiter.isLocked(key)) return { code: "INVALID" };

  // Never trimmed: a leading space is part of a password somebody chose.
  const password = String(formData.get("password") ?? "");
  let ok = false;
  if (password) {
    try {
      ok = await verifyPassword(panelHash, password);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    panelLoginLimiter.recordFailure(key);
    if (panelLoginLimiter.isLocked(key)) {
      console.warn(`panel login: too many failed attempts, locked client ${key}`);
    }
    return { code: "INVALID" };
  }

  // Single organisation: the panel password stands for its first active owner.
  const [owner] = await db
    .select({ id: users.id, orgId: users.orgId })
    .from(users)
    .where(and(eq(users.role, "OWNER"), isNull(users.disabledAt)))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!owner) return { code: "INVALID" };

  panelLoginLimiter.reset(key);
  await startSession(owner.id);

  // A shared credential leaves a trace of every use. Never the password.
  await db.insert(auditLogs).values({
    orgId: owner.orgId,
    actorId: owner.id,
    action: "auth.panel_login",
    subjectType: "user",
    subjectId: owner.id,
    meta: { method: "panel_password" },
    ip: key,
  });

  redirect("/dashboard");
}

async function startSession(userId: string) {
  const head = await headers();
  const session = await createSession(userId, {
    ip: head.get("x-forwarded-for") ?? undefined,
    userAgent: head.get("user-agent") ?? undefined,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}
