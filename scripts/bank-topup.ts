/**
 * Adds the starter texts and items an organisation does not have yet (the
 * seed bank grew after it was seeded). Idempotent: a second run inserts
 * nothing. Old starter items get their seed key backfilled first.
 *
 * Refuses anything but a throw-away *_check database unless
 * --allow-working-db is given; the shared `kademe` database is always refused.
 * New listening clips have no audio yet: run `pnpm bank:tts` afterwards.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_bank_check pnpm bank:topup
 *   pnpm bank:topup --org <uuid>
 *   pnpm bank:topup --allow-working-db
 */
import "dotenv/config";
import { bankTopUpRefusal } from "../src/server/bank-topup";

async function main() {
  const args = process.argv.slice(2);
  const refusal = bankTopUpRefusal(process.env.DATABASE_URL, args.includes("--allow-working-db"));
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
  const { seedCounts, topUpSeedBank } = await import("../src/server/bank-import");

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(onlyOrg ? eq(organizations.id, onlyOrg) : undefined);
  if (onlyOrg && orgs.length === 0) {
    console.error(`No organisation ${onlyOrg}.`);
    process.exit(2);
  }
  for (const org of orgs) {
    const before = await seedCounts(org.id);
    const r = await topUpSeedBank(org.id);
    const after = await seedCounts(org.id);
    console.log(
      `${org.name}: items ${before.items} -> ${after.items} (+${r.itemsAdded}), texts/clips ${before.stimuli} -> ${after.stimuli} (+${r.stimuliAdded}), seed keys backfilled ${r.keysBackfilled}`,
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
