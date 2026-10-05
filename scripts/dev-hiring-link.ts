/**
 * Mints a hiring invitation for a browser check and prints its link. Only on a
 * THROW-AWAY copy (local, port 5434, database name ending in _check), because it
 * publishes an opening (frozen rows that can never be deleted). Uses the
 * database's first organisation and its first active owner, so the panel login
 * of the copy works too.
 *
 * The copy is made from kademe_platform, which `create database ... template`
 * can only read while nobody else is connected to it. Check first, and if a
 * session (a dev server, another Claude session) is connected, coordinate or
 * migrate a fresh database instead (ruling C26):
 *   docker exec kademe-db psql -U kademe -d postgres -c "select pid, application_name, state from pg_stat_activity where datname = 'kademe_platform'"
 *   docker exec kademe-db psql -U kademe -d postgres -c "create database kademe_ui_check template kademe_platform"
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_ui_check pnpm dev:hiring-link [--kind text|written|file] [--lang en] [--name "Elif Kaya"] [--sentinels]
 *
 * --sentinels marks visible texts LEAKVISIBLE_* and fills every team-only field
 * with TEAMSECRET_*, for a page-level leak scan (ruling C10). Drop the copy after:
 *   docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_ui_check"
 */
import "dotenv/config";
import { refuseUnlessThrowAwayDb } from "../src/db/working-db-guard";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const { and, asc, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { buildPublishedOpening } = await import("./hiring-fixture");
  const { createHiringInvitation } = await import("@/solutions/hiring/server/invitations");
  const [org] = await db.select().from(s.organizations).orderBy(asc(s.organizations.createdAt)).limit(1);
  if (!org) throw new Error("no organisation in this database");
  const [owner] = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.orgId, org.id), eq(s.users.role, "OWNER"), isNull(s.users.disabledAt)))
    .limit(1);
  if (!owner) throw new Error("no active owner in this organisation");
  const kind = arg("kind") === "text" ? "text" : arg("kind") === "written" ? "written" : arg("kind") === "file" ? "file" : "full";
  const sentinels = process.argv.includes("--sentinels");
  const { openingId } = await buildPublishedOpening({ orgId: org.id, ownerId: owner.id, memberIds: [owner.id], kind, sentinels });
  const result = await createHiringInvitation(
    { id: owner.id, orgId: org.id },
    { openingId, fullName: arg("name") ?? "Elif Kaya", email: `aday-${Date.now()}@example.com`, locale: arg("lang") === "en" ? "en" : "tr", deadline: null },
    { baseUrl: process.env.VERIFY_BASE_URL ?? "http://localhost:3100" },
  );
  if (!result.ok) throw new Error(result.code);
  console.log(`opening: /hiring/openings/${openingId}${sentinels ? " (sentinels)" : ""}`);
  console.log(result.url);
  process.exit(0);
}

// Checked before the database module is even loaded: nothing connects to a refused url.
const refusal = refuseUnlessThrowAwayDb(process.env.DATABASE_URL);
if (refusal) {
  console.error(`Refusing: ${refusal} This publishes an opening; use a throw-away *_check copy.`);
  process.exit(2);
} else {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
