"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  verifyPassword,
  createSession,
  SESSION_COOKIE,
  hashPassword,
} from "@/lib/auth";

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

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
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

  const head = await headers();
  const session = await createSession(user.id, {
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
    .where(eq(users.id, user.id));

  redirect("/dashboard");
}
