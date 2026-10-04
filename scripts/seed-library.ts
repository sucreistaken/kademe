/**
 * Writes the starter library (default scale, eight competencies with anchors
 * and tags) for every organisation in the database. Idempotent. Local only:
 * refuses anything but the Docker database on port 5434 and refuses the shared
 * `kademe` database, which other sessions use.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:seed-library
 */
import "dotenv/config";
import { refuseUnlessWorkingDb } from "../src/db/working-db-guard";

async function main() {
  const refusal = refuseUnlessWorkingDb(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  for (const org of await db.select({ id: organizations.id, name: organizations.name }).from(organizations)) {
    const result = await seedLibrary(org.id);
    console.log(`${org.name}: scale ${result.scaleCreated ? "created" : "kept"}, competencies created ${result.competenciesCreated}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
