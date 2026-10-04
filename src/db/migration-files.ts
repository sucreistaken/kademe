import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The migration folder as drizzle's migrator reads it. Kept apart from the
 * runner so its rules can be tested without a database.
 */
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle/migrations");

export type JournalEntry = { idx: number; when: number; tag: string; breakpoints: boolean };

export function readJournal(folder: string = MIGRATIONS_FOLDER): JournalEntry[] {
  const raw = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  return raw.entries;
}

/** The hash drizzle-orm's migrator stores: sha256 of the whole file. */
export function migrationHash(sqlText: string): string {
  return createHash("sha256").update(sqlText).digest("hex");
}

/**
 * The row the migrator would have written had it applied the baseline itself.
 * Inserting it into a database created by `drizzle-kit push` tells the
 * migrator "this schema already exists, start after it".
 */
export function baselineRow(folder: string = MIGRATIONS_FOLDER): { tag: string; hash: string; createdAt: number } {
  const [first] = readJournal(folder);
  if (!first || !first.tag.endsWith("_baseline")) throw new Error("the first migration must be the baseline");
  const text = readFileSync(path.join(folder, `${first.tag}.sql`), "utf8");
  return { tag: first.tag, hash: migrationHash(text), createdAt: first.when };
}
