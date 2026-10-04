/**
 * Mints a fresh student invitation for development and prints its link.
 *
 * Run with an explicit working database (it refuses the shared `kademe`
 * database, any other host and any port but 5434):
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev:link
 *   DATABASE_URL=... pnpm dev:link --claimed B1             # B1 verification exam
 *   DATABASE_URL=... pnpm dev:link --name "Ayşe Demir" --lang en
 */
import "dotenv/config";
import { refuseUnlessWorkingDb } from "../src/db/working-db-guard";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { createInvitation } = await import("../src/server/invite");
  const claimed = arg("claimed") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
  const mode = claimed ? "LEVEL_VERIFICATION" : "PLACEMENT";
  const [org] = await db.select().from(s.organizations).limit(1);
  if (!org) throw new Error("no organisation: run pnpm db:seed first");
  const [blueprint] = await db
    .select()
    .from(s.examBlueprints)
    .where(and(eq(s.examBlueprints.mode, mode), eq(s.examBlueprints.status, "PUBLISHED")))
    .limit(1);
  if (!blueprint) throw new Error(`no published ${mode} exam`);
  const result = await createInvitation({
    orgId: org.id,
    blueprintId: blueprint.id,
    fullName: arg("name") ?? "Dev Öğrenci",
    email: arg("email") ?? `dev-${Date.now()}@example.com`,
    claimedLevel: claimed ?? null,
    locale: arg("lang") === "en" ? "en" : "tr",
    invitedBy: null,
  });
  if (!result.ok) throw new Error(result.code);
  console.log(`\n  ${blueprint.name}${claimed ? ` (claimed ${claimed})` : ""}\n  ${result.url}\n`);
  process.exit(0);
}

// Checked before the database module is even loaded: nothing connects to a refused url.
const refusal = refuseUnlessWorkingDb(process.env.DATABASE_URL);
if (refusal) {
  console.error(`Refusing: ${refusal}`);
  process.exit(2);
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
