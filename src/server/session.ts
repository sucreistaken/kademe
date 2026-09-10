import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, SESSION_COOKIE, type SessionUser } from "@/lib/auth";
import { authorize, type Capability } from "@/lib/authorize";

/** Reads the session cookie. Returns null rather than throwing, for layouts. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Use this at the top of every manager page and action. It both authenticates
 * and, when given a capability, authorises. Nothing manager-side should read
 * the database before calling it.
 */
export async function requireUser(capability?: Capability) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (capability) authorize(user, capability);
  return user;
}
