/**
 * Adds the starter texts and items an organisation does not have yet (the
 * seed bank grew after it was seeded). Idempotent: a second run inserts
 * nothing. Old starter items get their seed key backfilled first.
 *
 * Refuses anything but a throw-away *_check database unless
 * --allow-working-db is given; the shared `kademe` database is always refused.
 * New listening clips have no audio yet: run `pnpm bank:tts` afterwards.
 *
 * --retire-stale also sets RETIRED on the starter items (origin SEED, now
 * APPROVED) that the current seed bank no longer has, in the same transaction
 * as the adding. Rows are never deleted and a school's own items are never
 * touched. The per-org summary, with the retire counts per section and level,
 * is printed before anything is written.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_bank_check pnpm bank:topup
 *   pnpm bank:topup --org <uuid>
 *   pnpm bank:topup --allow-working-db
 *   pnpm bank:topup --retire-stale
 *
 * Production (the only way onto the `kademe` database): both flags, and the
 * confirmation must equal host:port/database parsed from DATABASE_URL. A
 * per-org summary is printed, then applied in one transaction per org.
 *   pnpm bank:topup --production --confirm-db=127.0.0.1:5434/kademe
 */
import "dotenv/config";
import { bankTopUpRefusal, databaseTarget, formatRetireCounts } from "../src/server/bank-topup";

async function main() {
  const args = process.argv.slice(2);
  const production = args.includes("--production");
  const retireStale = args.includes("--retire-stale");
  const confirmDb = args.find((a) => a.startsWith("--confirm-db="))?.slice("--confirm-db=".length);
  const refusal = bankTopUpRefusal(process.env.DATABASE_URL, {
    allowWorkingDb: args.includes("--allow-working-db"),
    production,
    confirmDb,
  });
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }
  const orgFlag = args.indexOf("--org");
  const onlyOrg = orgFlag >= 0 ? args[orgFlag + 1] : undefined;
  if (orgFlag >= 0 && !onlyOrg) {
    console.error("--org needs an organisation id.");
    process.exit(2);
  }

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { organizations } = await import("../src/db/schema");
  const { previewTopUp, seedCounts, topUpSeedBank } = await import("../src/server/bank-import");

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(onlyOrg ? eq(organizations.id, onlyOrg) : undefined);
  if (onlyOrg && orgs.length === 0) {
    console.error(`No organisation ${onlyOrg}.`);
    process.exit(2);
  }
  if (production || retireStale) {
    const where = production ? `Production top-up on ${databaseTarget(process.env.DATABASE_URL)}` : "Top-up";
    console.log(`${where}${retireStale ? " with --retire-stale" : ""} (${orgs.length} organisation(s)):`);
    for (const org of orgs) {
      const p = await previewTopUp(org.id, { retireStale });
      const retire = retireStale ? `, retire ${p.retire.length} stale starter items` : "";
      console.log(`  ${org.name}: insert ${p.itemsToInsert} items and ${p.stimuliToInsert} texts/clips, backfill ${p.keysToBackfill} seed keys${retire}`);
      for (const line of formatRetireCounts(p.retire)) console.log(`    retire ${line}`);
    }
    console.log("Applying (one transaction per organisation)...");
  }
  for (const org of orgs) {
    const before = await seedCounts(org.id);
    const r = await topUpSeedBank(org.id, { retireStale });
    const after = await seedCounts(org.id);
    console.log(
      `${org.name}: items ${before.items} -> ${after.items} (+${r.itemsAdded}), approved starter items ${before.approved} -> ${after.approved}, texts/clips ${before.stimuli} -> ${after.stimuli} (+${r.stimuliAdded}), seed keys backfilled ${r.keysBackfilled}${retireStale ? `, retired ${r.itemsRetired}` : ""}`,
    );
    if (r.listeningWithoutAudio.length)
      console.log(`  new clips without audio (run pnpm bank:tts): ${r.listeningWithoutAudio.join(", ")}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
