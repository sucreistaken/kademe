/**
 * Drops and recreates the LOCAL database schema, then pushes the current one.
 *
 * `drizzle-kit push` stops to ask "was this table renamed?" when the schema
 * changes shape, which stalls any unattended run. Against an empty schema it
 * never asks. This refuses to run against anything but the local Docker
 * database on port 5434.
 *
 * Run with: pnpm db:reset   (then pnpm db:seed)
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.port !== "5434") {
    console.error(`Refusing: DATABASE_URL is not the local database on port 5434 (${parsed.hostname}:${parsed.port}).`);
    process.exit(2);
  }
  const sql = postgres(url, { max: 1 });
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS pgboss CASCADE;");
  await sql.end();
  console.log("Schema dropped. Pushing...");
  for (const cmd of [["drizzle-kit", "push", "--force"], ["tsx", "src/db/migrate-sql.mts"]]) {
    const r = spawnSync("npx", cmd, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  console.log("Local database is empty and on the current schema.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
