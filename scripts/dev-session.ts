import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/org";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

/**
 * Mints a manager session and prints the cookie, so a screen can be fetched
 * from a script the way a logged-in person sees it.
 *
 * It exists because the panel is behind auth and the login form posts a server
 * action whose id changes on every build, which makes curl-ing through the form
 * a dead end. Verifying a manager screen without a session verifies the
 * redirect to /login, which proves only that the route did not throw.
 *
 *   npx tsx scripts/dev-session.ts [email]
 *   curl -s -H "Cookie: $(npx tsx scripts/dev-session.ts)" localhost:3100/dashboard
 *
 * Development only. It writes a real session row, so run it against the local
 * database and nothing else.
 */
async function main() {
  const email = process.argv[2] ?? "kadiraycareer@gmail.com";

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const { token } = await createSession(user.id, {
    ip: "127.0.0.1",
    userAgent: "scripts/dev-session",
  });

  console.log(`${SESSION_COOKIE}=${token}`);
  process.exit(0);
}

void main();
