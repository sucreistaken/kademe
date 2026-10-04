import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { baselineRow, MIGRATIONS_FOLDER, migrationHash, readJournal } from "./migration-files";

describe("migration folder", () => {
  it("starts with the baseline", () => {
    expect(readJournal()[0]?.tag).toBe("0000_baseline");
  });

  it("has one SQL file per journal entry, in order", () => {
    const entries = readJournal();
    entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      expect(existsSync(path.join(MIGRATIONS_FOLDER, `${e.tag}.sql`)), e.tag).toBe(true);
      if (i > 0) expect(e.when).toBeGreaterThan(entries[i - 1].when);
    });
  });

  it("hashes a migration file exactly like drizzle's migrator", () => {
    const [first] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
    const text = readFileSync(path.join(MIGRATIONS_FOLDER, `${readJournal()[0].tag}.sql`), "utf8");
    expect(migrationHash(text)).toBe(first.hash);
  });

  it("adopts the baseline with exactly the row drizzle's migrator would write", () => {
    const [first] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
    const row = baselineRow();
    expect(row.hash).toBe(first.hash);
    expect(row.createdAt).toBe(first.folderMillis);
  });
});
