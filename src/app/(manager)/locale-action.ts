"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAuthLocale } from "@/i18n/locale";
import {
  MANAGER_LOCALE_COOKIE,
  MANAGER_LOCALE_MAX_AGE,
} from "@/i18n/manager-locale";

/**
 * Switches the panel language, and the sign-in screen's (which offers four). No session write and no database round trip: the
 * preference is per browser, so the cookie is the whole of it.
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
  revalidatePath("/", "layout");
}
