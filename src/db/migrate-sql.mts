import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

/**
 * Applies the hand written SQL in drizzle/sql. These are the invariants that
 * cannot be expressed in the schema DSL: the triggers that freeze a published
 * template version, and anything else the database itself must guarantee rather
 * than trust every caller to remember.
 *
 * Every file is idempotent (CREATE OR REPLACE, DROP IF EXISTS), so this is safe
 * to run on every deploy. Run it after `drizzle-kit push`.
 */
const dir = path.resolve(process.cwd(), "drizzle/sql");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const body = await readFile(path.join(dir, file), "utf8");
  await sql.unsafe(body);
  console.log(`applied ${file}`);
}
await sql.end();
console.log(`${files.length} sql file(s) applied`);
