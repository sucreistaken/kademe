/**
 * One-time switch of a database from the recruitment product to the exam
 * product. DESTRUCTIVE: every table is dropped and recreated.
 *
 * What survives: organisations and panel users (with their password hashes,
 * so everybody keeps their login; RECRUITER becomes TEACHER). Everything else
 * (candidates, recordings, evaluations, audit log) is gone.
 *
 * Then it adds what a school needs to start: the consent text, the starter
 * question bank (listening audio is reused from storage when present,
 * otherwise made with Gemini TTS) and two published exams. No demo students.
 *
 * Run with, and only with, the database host spelled out:
 *   npx tsx scripts/setup-production.ts --confirm-host=<host of DATABASE_URL>
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

type OldOrg = { id: string; name: string };
type OldUser = {
  id: string;
  org_id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  totp_secret: string | null;
  totp_confirmed_at: Date | null;
  disabled_at: Date | null;
};

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  const confirm = process.argv.find((a) => a.startsWith("--confirm-host="))?.split("=")[1];
  if (confirm !== host) {
    console.error(`Refusing. Re-run with --confirm-host=${host} if this is really the database to reset.`);
    process.exit(2);
  }
  const sql = postgres(url, { max: 1 });
  const hasUsers = (await sql`select to_regclass('public.users') as t`)[0].t !== null;
  const orgs: OldOrg[] = hasUsers ? await sql<OldOrg[]>`select id, name from organizations` : [];
  const users: OldUser[] = hasUsers
    ? await sql<OldUser[]>`select id, org_id, email, name, password_hash, role::text as role, totp_secret, totp_confirmed_at, disabled_at from users`
    : [];
  console.log(`Keeping ${orgs.length} organisation(s) and ${users.length} user(s).`);

  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS pgboss CASCADE;");
  await sql.end();
  for (const cmd of [["drizzle-kit", "push", "--force"], ["tsx", "src/db/migrate-sql.mts"]]) {
    const r = spawnSync("npx", cmd, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { CONSENT_EN, CONSENT_TR } = await import("../src/db/consent-text");
  const { importSeedBank } = await import("../src/server/bank-import");
  const { defaultBlueprint } = await import("../src/lib/exam/blueprint");

  const kept = orgs.length ? orgs : [{ id: undefined as unknown as string, name: "Kademe" }];
  for (const o of kept) {
    const [org] = await db
      .insert(s.organizations)
      .values({ ...(o.id ? { id: o.id } : {}), name: o.name })
      .returning();
    for (const u of users.filter((x) => x.org_id === o.id)) {
      await db.insert(s.users).values({
        id: u.id,
        orgId: org.id,
        email: u.email,
        name: u.name,
        passwordHash: u.password_hash,
        role: u.role === "OWNER" ? "OWNER" : u.role === "REVIEWER" ? "REVIEWER" : "TEACHER",
        totpSecret: u.totp_secret,
        totpConfirmedAt: u.totp_confirmed_at,
        disabledAt: u.disabled_at,
      });
    }
    await db.insert(s.consentTexts).values({ orgId: org.id, version: 1, body: { tr: CONSENT_TR, en: CONSENT_EN } });
    const bank = await importSeedBank(org.id, { log: (m) => console.log(m) });
    console.log(`${org.name}: ${bank.items} items, ${bank.stimuli} texts/clips, audio made ${bank.audioMade}, reused ${bank.audioReused}, failed ${bank.audioFailed}`);
    const owner = users.find((u) => u.org_id === o.id && u.role === "OWNER");
    await db.insert(s.examBlueprints).values([
      {
        orgId: org.id,
        name: "Almanca seviye tespit sınavı",
        description: "A1-C2 arası seviyeyi sıfırdan belirler.",
        mode: "PLACEMENT",
        status: "PUBLISHED",
        publishedAt: new Date(),
        config: defaultBlueprint("PLACEMENT"),
        createdBy: owner?.id ?? null,
      },
      {
        orgId: org.id,
        name: "Seviye doğrulama sınavı",
        description: "Öğrencinin beyan ettiği seviyeyi taşıyıp taşımadığını ölçer.",
        mode: "LEVEL_VERIFICATION",
        status: "PUBLISHED",
        publishedAt: new Date(),
        config: defaultBlueprint("LEVEL_VERIFICATION"),
        createdBy: owner?.id ?? null,
      },
    ]);
  }
  if (users.length === 0) console.log("No users existed: create the owner with a setup link before anyone can sign in.");
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
