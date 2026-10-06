/**
 * Fills an organisation's library for production: the starter rating scale and
 * competencies (seedLibrary), every ready-template competency, and one position
 * per ready hiring template (name, job ad and competency profile). Idempotent: a
 * position whose name already exists (any case) is left alone, competencies are
 * found by seed key or name before anything is created.
 *
 * Runs only with an explicit confirmation of the target database:
 *   pnpm library:production --confirm-db=127.0.0.1:5434/kademe
 */
import "dotenv/config";
import { databaseTarget } from "../src/server/bank-topup";

async function main() {
  const target = databaseTarget(process.env.DATABASE_URL);
  const confirm = process.argv.find((a) => a.startsWith("--confirm-db="))?.slice("--confirm-db=".length);
  if (!target || confirm !== target) {
    console.error(`Refusing: pass --confirm-db=${target ?? "<host:port/db>"} to fill this database.`);
    process.exit(2);
  }

  const { and, asc, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { organizations, positionCompetencies, positions, users } = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition } = await import("@/server/library-write");
  const { ensureTemplateCompetencies } = await import("@/solutions/hiring/server/templates");
  const { TEMPLATES } = await import("@/solutions/hiring/templates");
  const { templateCompetencyKeys } = await import("@/solutions/hiring/templates/materialise");

  for (const org of await db.select({ id: organizations.id, name: organizations.name }).from(organizations)) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, org.id), eq(users.role, "OWNER"), isNull(users.disabledAt)))
      .orderBy(asc(users.createdAt))
      .limit(1);
    if (!owner) {
      console.log(`${org.name}: no active owner, skipped`);
      continue;
    }
    const lib = await seedLibrary(org.id);
    console.log(`${org.name}: scale ${lib.scaleCreated ? "created" : "kept"}, starter competencies created ${lib.competenciesCreated}`);

    const taken = new Set(
      (await db.select({ name: positions.name }).from(positions).where(eq(positions.orgId, org.id))).map((p) => p.name.trim().toLocaleLowerCase("tr")),
    );
    let created = 0;
    for (const template of TEMPLATES) {
      if (taken.has(template.name.tr.trim().toLocaleLowerCase("tr"))) continue;
      await db.transaction(async (tx) => {
        const ids = await ensureTemplateCompetencies(tx, org.id, owner.id, templateCompetencyKeys(template));
        const position = await createPosition(org.id, owner.id, { name: template.name.tr, jobDescription: template.jobAd.tr }, tx);
        if (!position.ok) throw new Error(`position ${template.key}: ${position.code}`);
        const rows = Object.entries(template.weights)
          .sort((a, b) => b[1] - a[1])
          .map(([key, weight], orderIndex) => ({ positionId: position.id, competencyId: ids[key], weight, orderIndex }));
        await tx.insert(positionCompetencies).values(rows).onConflictDoNothing();
      });
      created += 1;
    }
    console.log(`${org.name}: positions created ${created} of ${TEMPLATES.length}`);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
