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

/**
 * Recording runs only for an invitation whose accepted text announces it
 * (consent_texts.covers_recording). The migration that adds the flag has to
 * mark exactly the current text, wherever its version number stands, and
 * leave every other text (the old version 1 included) unmarked.
 */
const coversFile = readdirSync(MIGRATIONS_FOLDER).find((f) => f.endsWith("_consent_covers_recording.sql"));
const covers = coversFile ? readFileSync(path.join(MIGRATIONS_FOLDER, coversFile), "utf8") : "";

describe("consent covers_recording migration", () => {
  it("adds the flag as false for every existing text", () => {
    expect(coversFile).toBeTruthy();
    expect(covers).toContain('ALTER TABLE "consent_texts" ADD COLUMN "covers_recording" boolean DEFAULT false NOT NULL;');
  });

  it("marks only the exact current text, by its words and not by its version", () => {
    expect(covers).toContain(`"body"->>'tr' = ${sqlLiteral(CONSENT_TR)}`);
    expect(covers).toContain(`"body"->>'en' = ${sqlLiteral(CONSENT_EN)}`);
    expect(covers).toContain(`"solution" = 'LANGUAGE_EXAM'`);
    expect(covers).not.toContain(sqlLiteral(CONSENT_V1_TR));
    expect(covers).not.toMatch(/"version"/);
    expect(covers).not.toMatch(/\b(DELETE|DROP|INSERT)\b/);
  });

  it("runs after the migration that writes the current text as the next version", () => {
    expect(file && coversFile && coversFile > file).toBe(true);
  });
});
