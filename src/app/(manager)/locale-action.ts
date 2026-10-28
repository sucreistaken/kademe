"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAuthLocale } from "@/i18n/locale";
import {
  MANAGER_LOCALE_COOKIE,
  MANAGER_LOCALE_MAX_AGE,
} from "@/i18n/manager-locale";
import { currentUser } from "@/server/session";

/**
 * Switches the panel language, and the sign-in screen's. The cookie carries
 * it in this browser; a signed-in person's choice is also kept on their
 * account, so a new browser opens the panel in it after signing in
 * (src/app/(auth)/login/actions.ts).
 */
export async function setManagerLocale(formData: FormData) {
  const next = formData.get("locale");
  if (!isAuthLocale(next)) return;
  const jar = await cookies();
  jar.set(MANAGER_LOCALE_COOKIE, next, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: MANAGER_LOCALE_MAX_AGE,
  });
  const user = await currentUser();
  if (user) await db.update(users).set({ locale: next }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}
