import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { baselineRow, MIGRATIONS_FOLDER } from "./migration-files";

/**
 * Brings a database to the current schema with the reviewed SQL files in
 * drizzle/migrations, then re-applies the idempotent invariants in drizzle/sql.
 * Every pending migration runs in ONE transaction: a failure leaves the
 * database exactly as it was.
 *
 * A database made by the old `drizzle-kit push` has the schema but no history.
 * The migrator would then try to create every table again, so this refuses
 * unless `--adopt-baseline` is passed, which records the baseline as applied.
 * Take a pg_dump backup first; adoption checks the expected pre-platform shape
 * and refuses anything else.
 *
 *   pnpm db:migrate                      fresh or already versioned database
 *   pnpm db:migrate --adopt-baseline     a database created by drizzle-kit push
 */
const adopt = process.argv.includes("--adopt-baseline");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { max: 1, onnotice: () => {} });

const [{ pushed }] = await client<{ pushed: boolean }[]>`select to_regclass('public.users') is not null as pushed`;
const [{ versioned }] = await client<{ versioned: boolean }[]>`select to_regclass('drizzle.__drizzle_migrations') is not null as versioned`;
const applied = versioned
  ? (await client<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`)[0].n
  : 0;

if (pushed && applied === 0) {
  if (!adopt) {
    console.error(
      "Refusing: this database has tables but no migration history (it was made by drizzle-kit push).\n" +
        "Take a pg_dump backup, then re-run with --adopt-baseline.",
    );
    await client.end();
    process.exit(2);
  }
  // The baseline is the schema before the platform split. Adopt only that shape.
  const [shape] = await client<{ old_columns: number; exam_table: boolean }[]>`
    select
      (select count(*)::int from information_schema.columns
        where table_schema = 'public' and table_name = 'assessments' and column_name = 'blueprint_snapshot') as old_columns,
      to_regclass('public.exam_assessments') is not null as exam_table`;
  if (shape.old_columns !== 1 || shape.exam_table) {
    console.error("Refusing to adopt: the schema does not look like the pre-platform baseline.");
    await client.end();
    process.exit(2);
  }
  const base = baselineRow();
  await client`create schema if not exists drizzle`;
  await client`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  await client`insert into drizzle.__drizzle_migrations (hash, created_at) values (${base.hash}, ${base.createdAt})`;
  console.log(`adopted ${base.tag} as already applied`);
}

await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
console.log("migrations applied");

const sqlDir = path.resolve(process.cwd(), "drizzle/sql");
const files = (await readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await client.unsafe(await readFile(path.join(sqlDir, file), "utf8"));
  console.log(`applied drizzle/sql/${file}`);
}
await client.end();
