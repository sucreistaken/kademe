import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_EN, CONSENT_TR, CONSENT_V1_EN, CONSENT_V1_TR } from "./consent-text";
import { MIGRATIONS_FOLDER } from "./migration-files";

/**
 * The exam consent text has to say what is recorded, and the migration that
 * moves schools to it has to carry exactly these strings: a single changed
 * character in its version 1 match would leave every school on the old promise.
 * Found by name suffix, because migration numbers are reassigned at merge time.
 */
const sqlLiteral = (s: string) => `'${s.replaceAll("'", "''")}'`;
const file = readdirSync(MIGRATIONS_FOLDER).find((f) => f.endsWith("_exam_consent_recording.sql"));
const migration = file ? readFileSync(path.join(MIGRATIONS_FOLDER, file), "utf8") : "";

describe("exam consent text", () => {
  it("says the whole exam is recorded, in both languages", () => {
    expect(CONSENT_TR).toContain("Sınavın tamamı kaydedilir");
    expect(CONSENT_EN).toContain("The whole exam is recorded");
    expect(CONSENT_V1_TR).not.toContain("Sınavın tamamı kaydedilir");
  });

  it("contains no em dash", () => {
    for (const text of [CONSENT_TR, CONSENT_EN, CONSENT_V1_TR, CONSENT_V1_EN]) expect(text).not.toContain("—");
  });

  it("is written by the migration with the exact current text, only over the exact version 1", () => {
    expect(file).toBeTruthy();
    expect(migration).toContain(`'tr', ${sqlLiteral(CONSENT_TR)}`);
    expect(migration).toContain(`'en', ${sqlLiteral(CONSENT_EN)}`);
    expect(migration).toContain(`c."body"->>'tr' = ${sqlLiteral(CONSENT_V1_TR)}`);
    expect(migration).toContain(`c."body"->>'en' = ${sqlLiteral(CONSENT_V1_EN)}`);
    expect(migration).toContain(`c."solution" = 'LANGUAGE_EXAM'`);
    expect(migration).not.toMatch(/\b(DELETE|UPDATE|DROP)\b/);
  });
});
