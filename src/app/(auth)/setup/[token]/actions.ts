"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, createSession, hashPassword } from "@/lib/auth";
import {
  PASSWORD_MIN_LENGTH,
  consumeSetupToken,
  resolveSetupToken,
  writeSettingsAudit,
} from "@/server/settings";

/**
 * The other half of an invitation: the invited person sets their own password
 * and lands in the panel already signed in.
 *
 * Errors travel as codes, like the invitation form, so the screen's language
 * decides what is read. A rejected token always answers with the same code,
 * whether it expired, was already spent, never existed or belongs to a disabled
 * account: telling a stranger which of the four they are holding is free
 * reconnaissance.
 */
export type SetupErrorCode = "TOO_SHORT" | "MISMATCH" | "TOKEN_INVALID";

export type SetupState = { error?: SetupErrorCode };

export async function completeSetup(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  // Never trimmed: a leading space is part of a password somebody chose.
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < PASSWORD_MIN_LENGTH) return { error: "TOO_SHORT" };
  if (password !== confirm) return { error: "MISMATCH" };

  const target = await resolveSetupToken(token);
  if (!target) return { error: "TOKEN_INVALID" };

  // Spend the token before writing the password. Two tabs submitting the same
  // link race here and exactly one of them wins.
  const won = await consumeSetupToken(target.tokenId);
  if (!won) return { error: "TOKEN_INVALID" };

  const now = new Date();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), lastLoginAt: now })
    .where(eq(users.id, target.userId));

  // The actor is the person themselves: nobody else was in the room.
  await writeSettingsAudit(
    { id: target.userId, orgId: target.orgId },
    "user.setup_complete",
    "user",
    target.userId,
    { email: target.email },
  );

  const head = await headers();
  const session = await createSession(target.userId, {
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

  redirect("/dashboard");
}
