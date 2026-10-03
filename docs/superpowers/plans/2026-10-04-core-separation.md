# Core Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Kademe into a shared core and a `language-exam` solution (schema, versioned migrations, solution registry, candidate API prefixes, panel routes, grouped menu, shared Today) without changing how the exam behaves.

**Architecture:** Schema moves in expand/contract order with reviewed, versioned SQL migrations (`drizzle/migrations/`): a baseline equal to today's pushed schema, an additive "expand" migration with hand-written backfills, a role rename, and a "contract" migration that drops what became redundant. Between expand and contract the code dual-writes, then switches every reader, so `tsc` proves no reader of a dropped column is left. Core code reaches solutions only through `src/solutions/registry.ts` (client-safe manifests) and `src/solutions/registry.server.ts` (server modules), enforced by ESLint and by a boundary test that ratchets down the remaining known couplings.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10, postgres.js, PostgreSQL 17 (local Docker, port 5434), vitest 5 (node), tsx, pnpm 11, Claude in Chrome for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-03-platform-solutions-design.md` (sections 2, 3, 4, 6, 7; sub-project 2 of section 8). Also binding: `docs/design/HIRING-UX.md` section 4.1 (grouped sidebar), section 8 (tokens, via the UI foundation plan), and the coordinator decision of 2026-10-04: the role `TEACHER` becomes `MANAGER` (TR "Yönetici", EN "Manager").

**Depends on:** `docs/superpowers/plans/2026-10-04-ui-foundation-shadcn.md` must be merged before Task 10 (it provides `@/components/ui/sidebar`, `@/hooks/use-mobile`, the `brand-soft` and `sidebar` tokens). Tasks 1-9 do not depend on it.

## Global Constraints

- Exam behaviour does not change. `pnpm verify:exam` passes with the same checks after every task that touches the candidate flow. The only intended visible change is the panel shell in Task 10 (top bar becomes the HIRING-UX 4.1 sidebar); page contents stay the same.
- Database work happens on a dedicated local database `kademe_platform` (a copy of `kademe` on the same Docker server, port 5434). Every command that touches it sets `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform` inline. The shared `kademe` database is only read (pg_dump); other Claude sessions use it.
- Never run `pnpm db:seed` or `pnpm db:reset`.
- Production is out of scope: no command in this plan connects to the production database or the VM. Rolling out is a separate approval (spec 2.2).
- `drizzle-kit push` is no longer used against any persistent database. It is used only to build throw-away reference databases for schema comparison.
- Every generated migration is reviewed. Hand edits are only the ones written in this plan, and each migration is proven equal to the TypeScript schema by `pnpm db:fingerprint` (Task 1) on a fresh push database versus a fresh migrated database.
- Dev server: `pnpm dev --port 3100` with the `kademe_platform` URL in its environment. If a peer session already serves 3100, coordinate (see memory note on parallel sessions) instead of killing it.
- `PROCTOR_DEV_FAKE` is never written to `.env`. If an automated Chrome run needs fake media, set it only in the dev server's shell environment and restart without it before handing over.
- Browser checks: Claude in Chrome only (`mcp__claude-in-chrome__*`). Never Playwright.
- Code, comments, identifiers, commit messages in English. User-facing text Turkish first, English second. Never write the em-dash character.
- Commits on branch `platform/solutions`, only the files the task names (`git add <paths>`), message: imperative subject, body, final line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gates for every task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test` (467 tests at the start; the count only grows), and where the task says so `pnpm build` and `pnpm verify:exam`.

## Facts this plan relies on (verified 2026-10-04 in a scratch copy, not in this repo)

- drizzle-kit 0.31.10 `generate` with `out: "./drizzle/migrations"` produced a baseline whose schema fingerprint is identical to `drizzle-kit push` of the same schema plus `drizzle/sql/0002_single_active_link.sql` (PostgreSQL 16 scratch cluster).
- For the expand schema below, drizzle-kit generated `ADD COLUMN "solution" "solution" NOT NULL` and `ADD COLUMN "attempt_id" uuid NOT NULL`, which fail on existing rows; the reviewed 0001 below adds them nullable, backfills, then sets NOT NULL.
- For `TEACHER` to `MANAGER`, drizzle-kit generated a drop-and-recreate of `user_role` that fails on every existing `TEACHER` row; `ALTER TYPE ... RENAME VALUE` keeps the rows and the column default follows the rename (verified: default reads `'MANAGER'::user_role`).
- For the contract schema, drizzle-kit generated the drops without any interactive prompt.
- On a database seeded with an exam invitation, an attempt, a section run, a recording and two proctor events, the chain 0000 + reviewed 0001 + reviewed 0002 + generated 0003, run in one transaction, kept every row, backfilled `solution`, `attempt_id` and `segment_*`, renamed the role, and ended with a fingerprint identical to `drizzle-kit push` of the final schema.
- `src/db/migrate.mts` below (adopt + migrate + drizzle/sql) was run against a pushed database: without `--adopt-baseline` it refuses with exit 2; with it, it adopts and applies 0001-0003; a second run is a no-op; a fresh empty database migrates to the same fingerprint.
- drizzle-orm's migrator runs all pending migrations in one transaction and decides what is pending by `created_at` versus the journal `when`; the hash it stores is sha256 of the whole file (`node_modules/drizzle-orm/pg-core/dialect.js`, `migrator.js`).
- Next.js docs used: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md` (redirects run before the filesystem, query strings pass through, `:path*` matches zero or more segments, `permanent: false` is 307), `.../rewrites.md` (an array return is applied after the filesystem and before dynamic routes), `01-app/03-api-reference/03-file-conventions/route.md` (route handler `params` is a Promise), `01-app/03-api-reference/03-file-conventions/route-groups.md` (moving folders inside `(manager)` keeps the group layout), `01-app/03-api-reference/03-file-conventions/layout.md`.
- ESLint `no-restricted-imports` with `patterns: [{ group: ["@/solutions/*", "!@/solutions/registry", ...] }]` flags `@/solutions/language-exam` and `@/solutions/language-exam/x` and allows the negated paths (checked with the repo's ESLint 9 on stdin).

## Every hit of the moved columns (grep at commit 1f36643)

`assessments.blueprintId|blueprintName|blueprintSnapshot|mode|claimedLevel` and their row reads:
- `src/db/schema/assessment.ts:72-94` (definitions and check)
- `src/server/invite.ts:52-60` (insert), `:85` (audit meta, no column read)
- `src/lib/exam-flow.ts:82-86, 130-134` (context type and resolve), `:929-932` (closeSectionRun reads `ctxRow.assessment.*`); `:174` updates `assessments.locale` (core column, stays)
- `src/lib/exam-results.ts:283, 345-346` (recomputeResult), `:378` (finalizeResult)
- `src/server/panel.ts:108, 115-117` (listStudents), `:195` (loadResultView)
- `src/app/(manager)/students/[id]/page.tsx:42, 81-82, 90` (reads `view.assessment.*`)
- `src/app/(manager)/exams/page.tsx:26-29` (usage count by blueprint)
- `src/db/seed.ts:219-224` (listening tweak on the demo invitation)
- Callers that pass `blueprintId`/`claimedLevel` into `createInvitation` (API unchanged, no edit needed): `src/app/(manager)/students/new/actions.ts:38`, `src/db/seed.ts:203-215`, `scripts/verify-exam-flow.ts:52-59, 147, 218`, `scripts/dev-link.ts:33-36`
- Candidate state fields with the same names (not columns, unchanged): `src/components/candidate/IntroConsent.tsx:66-67`, `src/components/panel/invite-form.tsx:76`

`mediaAssets.sectionRunId` (joins that find a recording's attempt):
- `src/lib/candidate-media.ts:99` (insert), `:151` (resolveOwnedMedia)
- `src/lib/transcribe-job.ts:44`
- `src/lib/retention.ts:385, 400, 538, 549`
- `src/lib/close-expired.ts:81` (salvage reads the section clock; stays on `section_run_id`, see Task 7)
- `scripts/verify-retention.ts:71`, `scripts/verify-speaking-chain.ts:51` (insert)

`proctorEvents.sectionRunId`:
- `src/db/schema/proctoring.ts:44` (definition)
- `src/server/proctoring.ts:152-155, 164-167, 197` (runningSectionRunId and upsertEvent)
- Inserts without the column (no change): `src/server/proctoring.ts:71`, `src/db/seed.ts:295`, `scripts/verify-proctor.ts:36`

`itemResponses.sectionRunId` is the exam's own link and is NOT moved (appears in exam-flow, exam-results, panel, actions, seed, scripts).

## File Structure

| Path | Responsibility |
|---|---|
| `drizzle.config.ts` | `out: "./drizzle/migrations"`. |
| `drizzle/migrations/0000_baseline.sql` + `meta/` | Generated baseline = today's schema. |
| `drizzle/migrations/0001_platform_expand.sql` | Reviewed expand migration with backfills. |
| `drizzle/migrations/0002_manager_role.sql` | Reviewed role rename. |
| `drizzle/migrations/0003_platform_contract.sql` | Generated contract migration. |
| `drizzle/sql/*.sql` | Unchanged role: idempotent invariants, re-applied after migrations. |
| `src/db/migration-files.ts` (+ test) | Journal reading, drizzle-compatible hash, baseline row. |
| `src/db/migrations-sql.test.ts` | Static checks of the reviewed SQL. |
| `src/db/migrate.mts` | The only way a database changes shape: adopt, migrate, re-apply drizzle/sql. Replaces `src/db/migrate-sql.mts`. |
| `scripts/schema-fingerprint.ts` | Prints a column-order-independent schema fingerprint. |
| `scripts/verify-platform-migration.ts` | Captures data before and checks it after the platform migrations. |
| `src/lib/candidate-context.ts` | Core candidate context: token, link, invitation, person, consent, current attempt. |
| `src/lib/exam-flow.ts` | Exam engine; gains `ExamCandidateContext`, `loadExamContext`, `resolveExamToken`. |
| `src/lib/candidate-api.ts` | Core route plumbing; gains `notFoundForSolution`, `withSolution`. |
| `src/lib/exam-candidate-api.ts` (+ test) | `withExamCandidate`: exam endpoints answer only exam invitations. |
| `src/app/api/c/[token]/exam/**` | Exam-only candidate endpoints (moved). |
| `src/lib/legacy-routes.ts` (+ test) | Temporary rewrites for old candidate API paths, redirects for old panel paths. |
| `src/solutions/types.ts` | The solution contract. |
| `src/solutions/registry.ts` | Client-safe manifests and `buildNav`. |
| `src/solutions/registry.server.ts` | Server modules. |
| `src/solutions/language-exam/manifest.ts`, `module.ts`, `today.ts` | The exam's manifest and module. |
| `src/solutions/registry.test.ts`, `src/solutions/boundary.test.ts` | Registry rules; core-to-exam import ratchet. |
| `src/server/links.ts` | `expiringLinks`, moved out of the exam read model. |
| `src/app/(manager)/exam/{students,exams,bank}/**` | Exam panel pages (moved). |
| `src/components/manager/nav.tsx`, `src/app/(manager)/layout.tsx` | Grouped sidebar driven by the registry. |
| `src/app/(manager)/dashboard/page.tsx` | Shared Today reading `today()` from every module. |
| `scripts/verify-solution-guard.ts` | HTTP check: cross-solution 404, legacy paths, unknown token parity. |
| `docs/STATUS.md` | Run commands, routes, role name, verification record. |

---

### Task 1: Versioned migrations with a baseline, and the working database

**Files:**
- Modify: `drizzle.config.ts`
- Create: `drizzle/migrations/0000_baseline.sql`, `drizzle/migrations/meta/_journal.json`, `drizzle/migrations/meta/0000_snapshot.json` (generated)
- Create: `src/db/migration-files.ts`, `src/db/migration-files.test.ts`, `src/db/migrate.mts`, `scripts/schema-fingerprint.ts`
- Delete: `src/db/migrate-sql.mts`
- Modify: `package.json` (scripts), `scripts/db-reset.ts`, `scripts/setup-production.ts`

**Interfaces:**
- Produces: `MIGRATIONS_FOLDER: string`, `readJournal(folder?): JournalEntry[]`, `migrationHash(sqlText: string): string`, `baselineRow(folder?): { tag: string; hash: string; createdAt: number }` in `src/db/migration-files.ts`.
- Produces: `pnpm db:generate --name <x>`, `pnpm db:migrate [--adopt-baseline]`, `pnpm db:fingerprint`.
- Produces: the local database `kademe_platform`, adopted at the baseline.

- [ ] **Step 1: Write the failing test**

```ts
// src/db/migration-files.test.ts
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
```

Run: `pnpm exec vitest run src/db/migration-files.test.ts`
Expected: FAIL, `Failed to resolve import "./migration-files"` (and the journal does not exist yet).

- [ ] **Step 2: Point drizzle-kit at the migrations folder and generate the baseline**

In `drizzle.config.ts` change `out: "./drizzle",` to `out: "./drizzle/migrations",`.

Add to `package.json` `scripts` (and remove `db:push`, `db:sql`, `db:setup:local`; change `db:setup`):
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx src/db/migrate.mts",
"db:setup": "tsx src/db/migrate.mts",
"db:fingerprint": "tsx scripts/schema-fingerprint.ts",
```

Run:
```bash
pnpm db:generate --name baseline
ls drizzle/migrations drizzle/migrations/meta
```
Expected: `0000_baseline.sql`, `meta/_journal.json`, `meta/0000_snapshot.json`. No prompt (the schema has not changed).

- [ ] **Step 3: Write `src/db/migration-files.ts`**

```ts
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
```

Run: `pnpm exec vitest run src/db/migration-files.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Write the runner and the fingerprint script**

```ts
// src/db/migrate.mts
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
```

```ts
// scripts/schema-fingerprint.ts
/**
 * Prints the public schema as sorted lines: every column (type, nullability,
 * default), constraint, index and enum. Column ORDER is ignored on purpose: a
 * migration that adds a column appends it, `drizzle-kit push` places it where
 * the TypeScript says, and both are the same schema.
 *
 *   DATABASE_URL=... pnpm db:fingerprint > /tmp/a.txt
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql<{ line: string }[]>`
    select 'column ' || c.table_name || '.' || c.column_name || ' ' || c.udt_name
           || ' null=' || c.is_nullable || ' default=' || coalesce(c.column_default, '-') as line
      from information_schema.columns c where c.table_schema = 'public'
    union all
    select 'constraint ' || cl.relname || '.' || co.conname || ' ' || pg_get_constraintdef(co.oid)
      from pg_constraint co
      join pg_class cl on cl.oid = co.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public'
    union all
    select 'index ' || indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
    union all
    select 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname
    order by 1`;
  for (const r of rows) console.log(r.line);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Delete `src/db/migrate-sql.mts` (`git rm src/db/migrate-sql.mts`); `migrate.mts` now applies `drizzle/sql`.

- [ ] **Step 5: Point the reset and the legacy production script at the runner**

In `scripts/db-reset.ts` replace
```ts
  console.log("Schema dropped. Pushing...");
  for (const cmd of [["drizzle-kit", "push", "--force"], ["tsx", "src/db/migrate-sql.mts"]]) {
```
with
```ts
  console.log("Schema dropped. Migrating...");
  for (const cmd of [["tsx", "src/db/migrate.mts"]]) {
```
and in its header comment replace "then pushes the current one" with "then applies every migration", and the paragraph about `drizzle-kit push` prompts with: "Migrations are reviewed SQL files, so nothing here asks questions."
Also run `DROP SCHEMA IF EXISTS drizzle CASCADE;` in the same `sql.unsafe` string, so the migration history goes with the tables:
```ts
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS pgboss CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE;");
```

In `scripts/setup-production.ts` make the same two replacements (`DROP SCHEMA IF EXISTS drizzle CASCADE;` added to its `sql.unsafe` string, and the spawn list becomes `[["tsx", "src/db/migrate.mts"]]`), and add to its header comment: "Superseded for schema changes by versioned migrations (pnpm db:migrate). Kept for the record of the 2026-09-30 switch; do not run it on a database with data you want to keep."

Do NOT run `pnpm db:reset`.

- [ ] **Step 6: Prove the baseline equals the pushed schema**

```bash
docker compose up -d
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
```
Expected: `migrations applied`, `applied drizzle/sql/0002_single_active_link.sql`, then `IDENTICAL`. Any diff means the baseline does not describe the pushed schema: stop and report.

- [ ] **Step 7: Back up `kademe` and create the working database**

```bash
docker exec kademe-db psql -U kademe -d kademe -Atc "select (select count(*) from organizations), (select count(*) from exam_blueprints where status = 'PUBLISHED'), (select count(*) from items where status = 'APPROVED')"
```
Expected: three numbers, the first at least 1, the second at least 2, the third above 0. If not, the local data is not seeded: stop and ask the user (do not seed).

```bash
mkdir -p ~/kademe-backups
docker exec kademe-db pg_dump -U kademe -Fc kademe > ~/kademe-backups/kademe-local-before-platform.dump
ls -l ~/kademe-backups/kademe-local-before-platform.dump
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_platform" -c "create database kademe_platform"
docker exec -i kademe-db pg_restore -U kademe -d kademe_platform --no-owner < ~/kademe-backups/kademe-local-before-platform.dump
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
echo "exit $?"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate --adopt-baseline
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
```
Expected: the dump is non-empty; the first migrate refuses with exit 2; the second prints `adopted 0000_baseline as already applied` and `migrations applied`; the third prints `migrations applied` without adopting.

- [ ] **Step 8: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
git add drizzle.config.ts drizzle/migrations src/db/migration-files.ts src/db/migration-files.test.ts src/db/migrate.mts scripts/schema-fingerprint.ts scripts/db-reset.ts scripts/setup-production.ts package.json
git status --short src/db/migrate-sql.mts   # shows "D" (staged by git rm in Step 4)
git commit -m "Switch from drizzle-kit push to versioned migrations" -m "Adds a generated baseline equal to the pushed schema (fingerprints identical on fresh databases), a runner that applies migrations in one transaction and then the idempotent drizzle/sql files, and an explicit --adopt-baseline path for databases created by push. Local reset and the legacy production script use the runner." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: `verify:exam` prints `All checks passed.`

---

### Task 2: Expand the schema (migration 0001) and dual-write

**Files:**
- Modify: `src/db/schema/enums.ts`, `src/db/schema/assessment.ts`, `src/db/schema/exam.ts`, `src/db/schema/proctoring.ts`
- Create: `drizzle/migrations/0001_platform_expand.sql` (generated, then replaced by the reviewed text below), `drizzle/migrations/meta/0001_snapshot.json`, journal entry
- Create: `src/db/migrations-sql.test.ts`, `scripts/verify-platform-migration.ts`
- Modify (dual writes): `src/server/invite.ts`, `src/lib/exam-flow.ts` (`workingAttempt`), `src/lib/candidate-media.ts` (`createMediaAsset`), `src/server/proctoring.ts` (`upsertEvent`), `src/db/seed.ts` (listening tweak), `scripts/verify-speaking-chain.ts`
- Modify: `package.json` (script `verify:migration`)

**Interfaces:**
- Produces schema: `solution` pgEnum (`"LANGUAGE_EXAM" | "HIRING"`); `linkStatus` gains `"RETAKE_AVAILABLE"`; `assessments.solution` (not null); `examAssessments` table `{ assessmentId, blueprintId, blueprintName, blueprintSnapshot, mode, claimedLevel }`; `attempts.solution` (not null) with composite FK to `assessments(id, solution)`; `mediaAssets.attemptId` (not null); `proctorEvents.segmentKind: string | null`, `proctorEvents.segmentRunId: string | null`.
- The old `assessments` exam columns become nullable and stay until Task 8; writers fill both places.

- [ ] **Step 1: Write the failing SQL test**

```ts
// src/db/migrations-sql.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "./migration-files";

/**
 * Migrations that move data are written by hand. These checks keep the parts
 * that protect existing rows from being lost in a later "regenerate".
 */
const read = (tag: string) => readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

describe("0001_platform_expand", () => {
  const sql = read("0001_platform_expand");
  const at = (needle: string) => {
    const i = sql.indexOf(needle);
    expect(i, needle).toBeGreaterThanOrEqual(0);
    return i;
  };

  it("copies the exam terms before anything else changes", () => {
    expect(at('INSERT INTO "exam_assessments"')).toBeLessThan(
      at('ALTER TABLE "assessments" DROP CONSTRAINT "claimed_for_verification"'),
    );
  });

  it.each([
    [
      'ALTER TABLE "assessments" ADD COLUMN "solution" "solution";',
      `UPDATE "assessments" SET "solution" = 'LANGUAGE_EXAM';`,
      'ALTER TABLE "assessments" ALTER COLUMN "solution" SET NOT NULL;',
    ],
    [
      'ALTER TABLE "attempts" ADD COLUMN "solution" "solution";',
      'UPDATE "attempts" AS t SET "solution" = a."solution"',
      'ALTER TABLE "attempts" ALTER COLUMN "solution" SET NOT NULL;',
    ],
    [
      'ALTER TABLE "media_assets" ADD COLUMN "attempt_id" uuid;',
      'UPDATE "media_assets" AS m SET "attempt_id" = r."attempt_id"',
      'ALTER TABLE "media_assets" ALTER COLUMN "attempt_id" SET NOT NULL;',
    ],
  ])("adds %s nullable, backfills, then requires it", (add, fill, require) => {
    expect(at(add)).toBeLessThan(at(fill));
    expect(at(fill)).toBeLessThan(at(require));
  });

  it("never adds a required column in one step", () => {
    expect(sql).not.toMatch(/ADD COLUMN "(solution|attempt_id)" [^;]*NOT NULL/);
  });

  it("stops instead of guessing when a recording has no attempt", () => {
    expect(sql).toContain("RAISE EXCEPTION");
  });

  it("carries the proctoring segment over", () => {
    expect(sql).toContain(`SET "segment_kind" = 'section_run', "segment_run_id" = "section_run_id"`);
  });

  it("keeps one attempt per exam invitation in the database", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "one_attempt_per_exam_assessment" ON "attempts" USING btree \("assessment_id"\) WHERE solution = 'LANGUAGE_EXAM'/,
    );
    expect(sql).toMatch(/CREATE UNIQUE INDEX "attempt_number_per_assessment"/);
  });

  it("drops no table and no column", () => {
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN)/);
  });
});
```

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts`
Expected: FAIL, `ENOENT ... 0001_platform_expand.sql`.

- [ ] **Step 2: Change the schema**

`src/db/schema/enums.ts`: replace the `linkStatus` line with
```ts
/**
 * Which solution an invitation belongs to. A new solution adds one value here
 * and nothing else in the core schema.
 */
export const solution = pgEnum("solution", ["LANGUAGE_EXAM", "HIRING"]);

/**
 * RETAKE_AVAILABLE belongs to hiring: a retake reuses the same link and opens
 * a new attempt. The language exam never produces it.
 */
export const linkStatus = pgEnum("link_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "RETAKE_AVAILABLE"]);
```

`src/db/schema/assessment.ts`:
- In the `drizzle-orm/pg-core` import replace `check,` with `foreignKey,\n  unique,` (keep `uniqueIndex`).
- Add `solution,` to the `./enums` import.
- Replace the block from `blueprintId: uuid("blueprint_id")` through `claimedLevel: cefrLevel("claimed_level"),` with:
```ts
    /** Copied onto every attempt; decides which solution's endpoints answer. */
    solution: solution("solution").notNull(),
    /** DEPRECATED: moved to exam_assessments. Dropped by migration 0003. */
    blueprintId: uuid("blueprint_id").references(() => examBlueprints.id, { onDelete: "restrict" }),
    /** DEPRECATED: moved to exam_assessments. Dropped by migration 0003. */
    blueprintName: text("blueprint_name"),
    /** DEPRECATED: moved to exam_assessments. Dropped by migration 0003. */
    blueprintSnapshot: jsonb("blueprint_snapshot").$type<BlueprintConfig>(),
    /** DEPRECATED: moved to exam_assessments. Dropped by migration 0003. */
    mode: examMode("mode"),
    /** DEPRECATED: moved to exam_assessments. Dropped by migration 0003. */
    claimedLevel: cefrLevel("claimed_level"),
```
- In the `assessments` table callback replace the `check("claimed_for_verification", ...)` entry with:
```ts
    /** Target of the composite key on attempts, so an attempt's solution always matches its invitation. */
    unique("assessments_id_solution_unique").on(t.id, t.solution),
```
- In `attempts`, before `attemptNumber` add:
```ts
    /** Copied from the assessment; the composite key below keeps the two equal. */
    solution: solution("solution").notNull(),
```
  and replace `uniqueIndex("one_attempt_per_assessment").on(t.assessmentId),` with:
```ts
    /** The language exam keeps "one attempt per invitation" in the database. */
    uniqueIndex("one_attempt_per_exam_assessment")
      .on(t.assessmentId)
      .where(sql`solution = 'LANGUAGE_EXAM'`),
    /** Hiring retakes open attempt 2, 3, ... on the same invitation. */
    uniqueIndex("attempt_number_per_assessment").on(t.assessmentId, t.attemptNumber),
```
  and after `index("attempts_assessment_idx").on(t.assessmentId),` add:
```ts
    foreignKey({
      name: "attempts_assessment_solution_fk",
      columns: [t.assessmentId, t.solution],
      foreignColumns: [assessments.id, assessments.solution],
    }).onDelete("cascade"),
```
  Update the doc comment above `attempts` to: "One sitting. The language exam allows exactly one per invitation (partial unique index); hiring retakes add attempt 2, 3 on the same invitation."
- In `mediaAssets`, after `orgId` add:
```ts
    /** Retention, transcription and salvage find a recording's attempt through this. */
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
```
  put the comment `/** The exam's own link: which section recorded it. Null for other solutions. */` above `sectionRunId`, and after `index("media_run_idx").on(t.sectionRunId),` add `index("media_attempt_idx").on(t.attemptId),`.

`src/db/schema/exam.ts`:
- Replace the `drizzle-orm/pg-core` import block (it has two blank lines inside) with:
```ts
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
```
- Change `import { attempts, itemResponses } from "./assessment";` to `import { assessments, attempts, itemResponses } from "./assessment";`.
- Insert before `/** A reading passage or a listening clip that several items share. */`:
```ts
/**
 * The language exam's half of an invitation. The blueprint is copied here at
 * invite time, so the exam this student takes never changes under them. The
 * core `assessments` row knows nothing about this table.
 */
export const examAssessments = pgTable(
  "exam_assessments",
  {
    assessmentId: uuid("assessment_id")
      .primaryKey()
      .references(() => assessments.id, { onDelete: "cascade" }),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => examBlueprints.id, { onDelete: "restrict" }),
    blueprintName: text("blueprint_name").notNull(),
    blueprintSnapshot: jsonb("blueprint_snapshot").$type<BlueprintConfig>().notNull(),
    mode: examMode("mode").notNull(),
    /** The level the student says they hold. Required for a verification exam. */
    claimedLevel: cefrLevel("claimed_level"),
  },
  (t) => [
    index("exam_assessments_blueprint_idx").on(t.blueprintId),
    check(
      "claimed_for_verification",
      sql`${t.mode} <> 'LEVEL_VERIFICATION' OR ${t.claimedLevel} IS NOT NULL`,
    ),
  ],
);
```

`src/db/schema/proctoring.ts`:
- Add `import { sql } from "drizzle-orm";` and `check` to the pg-core import.
- Above `sectionRunId` add `/** DEPRECATED: replaced by segment_kind + segment_run_id. Dropped by migration 0003. */`, and after it add:
```ts
    /**
     * Which part of the attempt was running, as the solution names it
     * ("section_run" for the exam). No foreign key: proctoring records, it does
     * not need to know the solution's tables.
     */
    segmentKind: text("segment_kind"),
    segmentRunId: uuid("segment_run_id"),
```
- After `index("proctor_events_attempt_idx").on(t.attemptId, t.startedAt),` add:
```ts
    check("proctor_events_segment_pair", sql`(${t.segmentKind} IS NULL) = (${t.segmentRunId} IS NULL)`),
```

- [ ] **Step 3: Generate, then replace the SQL with the reviewed version**

```bash
pnpm db:generate --name platform_expand
cat drizzle/migrations/0001_platform_expand.sql
```
Expected: a file containing `ADD COLUMN "solution" "solution" NOT NULL` (the unsafe generated form) and no prompt. Keep the generated `meta/0001_snapshot.json` and journal entry. Replace the whole SQL file with:

```sql
-- Platform core, expand step. Reviewed by hand; see
-- docs/superpowers/plans/2026-10-04-core-separation.md, Task 2.
--
-- Everything here is additive or loosens a constraint, so code written for the
-- old shape keeps working. Columns that become required are added nullable,
-- backfilled, and only then set NOT NULL. Migration 0003 drops what this one
-- makes redundant.
CREATE TYPE "public"."solution" AS ENUM('LANGUAGE_EXAM', 'HIRING');--> statement-breakpoint
ALTER TYPE "public"."link_status" ADD VALUE 'RETAKE_AVAILABLE';--> statement-breakpoint
CREATE TABLE "exam_assessments" (
	"assessment_id" uuid PRIMARY KEY NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"blueprint_name" text NOT NULL,
	"blueprint_snapshot" jsonb NOT NULL,
	"mode" "exam_mode" NOT NULL,
	"claimed_level" "cefr_level",
	CONSTRAINT "claimed_for_verification" CHECK ("exam_assessments"."mode" <> 'LEVEL_VERIFICATION' OR "exam_assessments"."claimed_level" IS NOT NULL)
);
--> statement-breakpoint
-- Hand-written: every existing invitation is a language exam; copy its terms.
INSERT INTO "exam_assessments" ("assessment_id", "blueprint_id", "blueprint_name", "blueprint_snapshot", "mode", "claimed_level")
SELECT "id", "blueprint_id", "blueprint_name", "blueprint_snapshot", "mode", "claimed_level" FROM "assessments";--> statement-breakpoint
ALTER TABLE "assessments" DROP CONSTRAINT "claimed_for_verification";--> statement-breakpoint
DROP INDEX "one_attempt_per_assessment";--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "blueprint_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "mode" DROP NOT NULL;--> statement-breakpoint
-- Hand-written: add nullable, backfill, then require.
ALTER TABLE "assessments" ADD COLUMN "solution" "solution";--> statement-breakpoint
UPDATE "assessments" SET "solution" = 'LANGUAGE_EXAM';--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "solution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "solution" "solution";--> statement-breakpoint
UPDATE "attempts" AS t SET "solution" = a."solution" FROM "assessments" AS a WHERE a."id" = t."assessment_id";--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "solution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "attempt_id" uuid;--> statement-breakpoint
UPDATE "media_assets" AS m SET "attempt_id" = r."attempt_id" FROM "section_runs" AS r WHERE r."id" = m."section_run_id";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "media_assets" WHERE "attempt_id" IS NULL) THEN
    RAISE EXCEPTION 'media_assets: % row(s) have no section run, so their attempt cannot be derived. Resolve them by hand, then migrate again.',
      (SELECT count(*) FROM "media_assets" WHERE "attempt_id" IS NULL);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "attempt_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD COLUMN "segment_kind" text;--> statement-breakpoint
ALTER TABLE "proctor_events" ADD COLUMN "segment_run_id" uuid;--> statement-breakpoint
UPDATE "proctor_events" SET "segment_kind" = 'section_run', "segment_run_id" = "section_run_id" WHERE "section_run_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_assessments" ADD CONSTRAINT "exam_assessments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_assessments" ADD CONSTRAINT "exam_assessments_blueprint_id_exam_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."exam_blueprints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_assessments_blueprint_idx" ON "exam_assessments" USING btree ("blueprint_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_id_solution_unique" UNIQUE("id","solution");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_solution_fk" FOREIGN KEY ("assessment_id","solution") REFERENCES "public"."assessments"("id","solution") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_attempt_per_exam_assessment" ON "attempts" USING btree ("assessment_id") WHERE solution = 'LANGUAGE_EXAM';--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_number_per_assessment" ON "attempts" USING btree ("assessment_id","attempt_number");--> statement-breakpoint
CREATE INDEX "media_attempt_idx" ON "media_assets" USING btree ("attempt_id");--> statement-breakpoint
ALTER TABLE "proctor_events" ADD CONSTRAINT "proctor_events_segment_pair" CHECK (("proctor_events"."segment_kind" IS NULL) = ("proctor_events"."segment_run_id" IS NULL));
```

Compare the generated file's constraint and index NAMES with the ones above before replacing it; if drizzle-kit produced a different name for any of them, use the generated name in the reviewed file (the fingerprint in Step 6 will fail otherwise). Do not hand-edit `meta/*`.

`ALTER TYPE ... ADD VALUE` runs inside the migrator's transaction; PostgreSQL 12+ allows that as long as the new value is not used in the same transaction, and nothing here uses `RETAKE_AVAILABLE`.

Run: `pnpm exec vitest run src/db/migrations-sql.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 4: Dual-write in every writer**

`src/server/invite.ts`: add `examAssessments` to the schema import and replace the assessment insert inside the transaction with:
```ts
    const [assessment] = await tx
      .insert(assessments)
      .values({
        orgId: input.orgId,
        candidateId: candidate.id,
        solution: "LANGUAGE_EXAM",
        // Dual write until migration 0003 drops these columns (Task 8).
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        blueprintSnapshot: blueprint.config,
        mode: blueprint.mode,
        claimedLevel: blueprint.mode === "LEVEL_VERIFICATION" ? input.claimedLevel : null,
        locale: input.locale,
        invitedBy: input.invitedBy,
      })
      .returning();
    await tx.insert(examAssessments).values({
      assessmentId: assessment.id,
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
      blueprintSnapshot: blueprint.config,
      mode: blueprint.mode,
      claimedLevel: blueprint.mode === "LEVEL_VERIFICATION" ? input.claimedLevel : null,
    });
```

`src/lib/exam-flow.ts` `workingAttempt`: change the insert values to
```ts
    .values({ assessmentId, solution: "LANGUAGE_EXAM", attemptNumber: 1, isPrimary: true })
```

`src/lib/candidate-media.ts` `createMediaAsset`: add `attemptId: run.attemptId,` to the insert values, directly after `orgId`.

`src/server/proctoring.ts` `upsertEvent`: in the insert values, after `sectionRunId,` add
```ts
      segmentKind: sectionRunId ? "section_run" : null,
      segmentRunId: sectionRunId,
```

`src/db/seed.ts` (listening tweak, lines 219-224): replace the block inside `if (!listeningReady) { ... }` with
```ts
    const [a] = await db.select().from(s.examAssessments).where(eq(s.examAssessments.assessmentId, demo.assessmentId));
    const snapshot = { ...a.blueprintSnapshot, sections: a.blueprintSnapshot.sections.map((x) => (x.section === "LISTENING" ? { ...x, enabled: false } : x)) };
    await db.update(s.examAssessments).set({ blueprintSnapshot: snapshot }).where(eq(s.examAssessments.assessmentId, demo.assessmentId));
    // Dual write until migration 0003 (Task 8).
    await db.update(s.assessments).set({ blueprintSnapshot: snapshot }).where(eq(s.assessments.id, demo.assessmentId));
```

`scripts/verify-speaking-chain.ts:51`: add `attemptId: row.run.attemptId,` to the `s.mediaAssets` insert values.

- [ ] **Step 5: Write the data check script**

```ts
// scripts/verify-platform-migration.ts
/**
 * Proves the platform migrations moved data without loss.
 *
 *   capture: run on the OLD shape (before 0001), writes counts and digests.
 *   check:   run on the NEW shape (after 0001, and again after 0003), reads the
 *            same facts from their new homes and compares.
 *
 *   DATABASE_URL=... pnpm verify:migration capture /tmp/before.json
 *   DATABASE_URL=... pnpm verify:migration check /tmp/before.json
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

type Facts = {
  assessments: number;
  attempts: number;
  media: number;
  events: number;
  users: number;
  managers: number;
  examTerms: string;
  mediaAttempts: string;
  eventSegments: string;
};

async function main() {
  const [mode, file] = process.argv.slice(2);
  if ((mode !== "capture" && mode !== "check") || !file) {
    console.error("usage: pnpm verify:migration capture|check <file.json>");
    process.exit(2);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [counts] = await sql<Omit<Facts, "examTerms" | "mediaAttempts" | "eventSegments">[]>`
    select (select count(*)::int from assessments) as assessments,
           (select count(*)::int from attempts) as attempts,
           (select count(*)::int from media_assets) as media,
           (select count(*)::int from proctor_events) as events,
           (select count(*)::int from users) as users,
           (select count(*)::int from users where role::text in ('TEACHER', 'MANAGER')) as managers`;

  if (mode === "capture") {
    const [d] = await sql<{ examTerms: string; mediaAttempts: string; eventSegments: string }[]>`
      select
        (select md5(coalesce(string_agg(id::text || '|' || blueprint_id::text || '|' || blueprint_name || '|' || blueprint_snapshot::text
                 || '|' || mode::text || '|' || coalesce(claimed_level::text, '-'), ',' order by id), '')) from assessments) as "examTerms",
        (select md5(coalesce(string_agg(m.id::text || '|' || r.attempt_id::text, ',' order by m.id), ''))
           from media_assets m join section_runs r on r.id = m.section_run_id) as "mediaAttempts",
        (select md5(coalesce(string_agg(id::text || '|' || section_run_id::text, ',' order by id), ''))
           from proctor_events where section_run_id is not null) as "eventSegments"`;
    writeFileSync(file, JSON.stringify({ ...counts, ...d }, null, 2));
    console.log(`captured to ${file}`);
    await sql.end();
    return;
  }

  const before = JSON.parse(readFileSync(file, "utf8")) as Facts;
  const [d] = await sql<{
    examTerms: string;
    mediaAttempts: string;
    eventSegments: string;
    nonExam: number;
    attemptMismatch: number;
    mediaWithoutAttempt: number;
  }[]>`
    select
      (select md5(coalesce(string_agg(assessment_id::text || '|' || blueprint_id::text || '|' || blueprint_name || '|' || blueprint_snapshot::text
               || '|' || mode::text || '|' || coalesce(claimed_level::text, '-'), ',' order by assessment_id), '')) from exam_assessments) as "examTerms",
      (select md5(coalesce(string_agg(id::text || '|' || attempt_id::text, ',' order by id), ''))
         from media_assets where section_run_id is not null) as "mediaAttempts",
      (select md5(coalesce(string_agg(id::text || '|' || segment_run_id::text, ',' order by id), ''))
         from proctor_events where segment_kind = 'section_run') as "eventSegments",
      (select count(*)::int from assessments where solution <> 'LANGUAGE_EXAM') as "nonExam",
      (select count(*)::int from attempts a join assessments s on s.id = a.assessment_id where a.solution <> s.solution) as "attemptMismatch",
      (select count(*)::int from media_assets where attempt_id is null) as "mediaWithoutAttempt"`;
  const after: Facts = { ...counts, examTerms: d.examTerms, mediaAttempts: d.mediaAttempts, eventSegments: d.eventSegments };
  let failed = 0;
  for (const key of Object.keys(before) as Array<keyof Facts>) {
    const same = before[key] === after[key];
    if (!same) failed += 1;
    console.log(`${same ? "ok  " : "FAIL"} ${key}: ${before[key]} -> ${after[key]}`);
  }
  for (const [key, value] of Object.entries({ nonExam: d.nonExam, attemptMismatch: d.attemptMismatch, mediaWithoutAttempt: d.mediaWithoutAttempt })) {
    if (value !== 0) failed += 1;
    console.log(`${value === 0 ? "ok  " : "FAIL"} ${key}: ${value}`);
  }
  await sql.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add to `package.json` scripts: `"verify:migration": "tsx scripts/verify-platform-migration.ts"`.

- [ ] **Step 6: Prove 0001 equals the schema, then migrate the working database**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"

DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:migration capture /tmp/kademe-platform-before-0001.json
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:migration check /tmp/kademe-platform-before-0001.json
```
Expected: `IDENTICAL`; the check prints only `ok` lines and exits 0. Stop the dev server (if this session started one) before `capture` so nothing writes between capture and migrate.

- [ ] **Step 7: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
git add src/db/schema drizzle/migrations src/db/migrations-sql.test.ts scripts/verify-platform-migration.ts src/server/invite.ts src/lib/exam-flow.ts src/lib/candidate-media.ts src/server/proctoring.ts src/db/seed.ts scripts/verify-speaking-chain.ts package.json
git commit -m "Expand the schema for solutions and copy exam data into its own table" -m "Migration 0001 adds the solution enum and columns, exam_assessments, media_assets.attempt_id, proctor_events segment columns and RETAKE_AVAILABLE, with hand-written backfills reviewed against the generated SQL. One attempt per exam invitation stays a database rule as a partial unique index. Writers fill both the old and the new places until the contract migration." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rename the TEACHER role to MANAGER (migration 0002)

**Files:**
- Modify: `src/db/schema/enums.ts`, `src/db/schema/org.ts`
- Create: `drizzle/migrations/0002_manager_role.sql` (generated, replaced), snapshot, journal entry
- Modify: `src/db/migrations-sql.test.ts`
- Create: `src/lib/authorize.test.ts`
- Modify: `src/lib/authorize.ts`, `src/lib/auth.ts`, `src/server/settings.ts`, `src/app/(manager)/settings/page.tsx`, `src/app/(manager)/settings/users/new/page.tsx`, `src/db/seed.ts`, `scripts/setup-production.ts`, `src/i18n/messages/settings.tr.json`, `src/i18n/messages/settings.en.json`

**Interfaces:**
- Produces: `SessionUser["role"]` = `"OWNER" | "MANAGER" | "REVIEWER"`; `ROLE_ORDER = ["OWNER", "MANAGER", "REVIEWER"]`.
- Not renamed (they mean "decided by a teacher" inside the exam): `decider` enum `TEACHER`, `item_origin` enum `TEACHER`, `source.TEACHER` and `bank.originTEACHER` messages, `TEACHER_CONFIRMED_MULTIPLIER`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/authorize.test.ts
import { describe, expect, it, vi } from "vitest";

// src/server/settings.ts opens the database client at import; these checks never query it.
vi.mock("@/db", () => ({ db: {} }));

import { can } from "./authorize";
import { isRole, ROLE_ORDER } from "@/server/settings";
import type { SessionUser } from "./auth";

const user = (role: SessionUser["role"]): SessionUser => ({ id: "u", orgId: "o", email: "u@x", name: "U", role });

describe("roles", () => {
  it("lists MANAGER between OWNER and REVIEWER", () => {
    expect(ROLE_ORDER).toEqual(["OWNER", "MANAGER", "REVIEWER"]);
    expect(isRole("TEACHER")).toBe(false);
  });

  it("gives MANAGER what TEACHER had", () => {
    for (const capability of ["blueprint:write", "bank:write", "bank:approve", "student:invite", "result:grade", "result:finalize", "integrity:decide", "media:view"] as const) {
      expect(can(user("MANAGER"), capability), capability).toBe(true);
    }
    expect(can(user("MANAGER"), "settings:write")).toBe(false);
    expect(can(user("MANAGER"), "audit:read")).toBe(false);
  });
});
```

Append to `src/db/migrations-sql.test.ts`:
```ts
describe("0002_manager_role", () => {
  const sql = read("0002_manager_role");
  it("renames the value in place instead of recreating the enum", () => {
    expect(sql).toContain(`ALTER TYPE "public"."user_role" RENAME VALUE 'TEACHER' TO 'MANAGER';`);
    expect(sql).not.toMatch(/DROP TYPE/);
    expect(sql).not.toMatch(/SET DATA TYPE/);
  });
});
```

Run: `pnpm exec vitest run src/lib/authorize.test.ts src/db/migrations-sql.test.ts`
Expected: FAIL (`ROLE_ORDER` still has `TEACHER`; `0002_manager_role.sql` missing).

- [ ] **Step 2: Change the schema and generate**

`src/db/schema/enums.ts`: replace `  "TEACHER", // build exams, run the bank, invite, grade, finalize` with `  "MANAGER", // build exams and assessments, run the bank, invite, grade, finalize`.
`src/db/schema/org.ts`: replace `.default("TEACHER")` with `.default("MANAGER")`.

```bash
pnpm db:generate --name manager_role < /dev/null
cat drizzle/migrations/0002_manager_role.sql
```
Expected: drizzle-kit generates `SET DATA TYPE text`, `DROP TYPE "public"."user_role"`, `CREATE TYPE ...`, `SET DATA TYPE "public"."user_role" USING ...`: a recreate that would fail on every TEACHER row. Replace the whole file with:

```sql
-- TEACHER becomes MANAGER: the platform hosts more than the exam now.
-- Reviewed by hand. drizzle-kit generated a drop-and-recreate of the enum,
-- which fails on every existing TEACHER row; RENAME VALUE keeps the rows, the
-- value's position and the column default (the default refers to the value,
-- not to its spelling, so it follows the rename).
ALTER TYPE "public"."user_role" RENAME VALUE 'TEACHER' TO 'MANAGER';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
```

- [ ] **Step 3: Update every reference**

- `src/lib/authorize.ts`: rename the `TEACHER:` key of `BY_ROLE` to `MANAGER:`.
- `src/lib/auth.ts:61`: `role: "OWNER" | "MANAGER" | "REVIEWER";`
- `src/server/settings.ts:21`: `export const ROLE_ORDER = ["OWNER", "MANAGER", "REVIEWER"] as const;`
- `src/app/(manager)/settings/page.tsx:512-526` and `src/app/(manager)/settings/users/new/page.tsx:74,80`: every `"TEACHER"` in `roleLabel`, `roleHelp`, `asRole` becomes `"MANAGER"`, and `settings.roles.TEACHER` / `settings.roleHelp.TEACHER` become `settings.roles.MANAGER` / `settings.roleHelp.MANAGER`.
- `src/db/seed.ts:150`: `role: "MANAGER",`
- `scripts/setup-production.ts:75`: `"TEACHER"` becomes `"MANAGER"`; header comment "RECRUITER becomes TEACHER" becomes "RECRUITER becomes MANAGER".
- `src/i18n/messages/settings.tr.json`: in `roles` replace `"TEACHER": "Öğretmen"` with `"MANAGER": "Yönetici"`; in `roleHelp` replace the `TEACHER` entry with
  `"MANAGER": "Sınavları ve değerlendirmeleri kurar, soru bankasını yönetir, davet eder, puanlar ve sonucu kesinleştirir. Ayarlara ve denetim kaydına giremez."`
- `src/i18n/messages/settings.en.json`: `"MANAGER": "Manager"` and `"MANAGER": "Builds exams and assessments, runs the question bank, invites people, grades and finalizes results. No settings, no audit log."`

Then:
```bash
grep -rn '"TEACHER"\|roles.TEACHER\|roleHelp.TEACHER' src scripts | grep -v 'decider\|origin\|source\.' 
```
Expected: only lines about `decider`, `itemOrigin`, `source.TEACHER`, `originTEACHER`, `Decider` in `src/lib/exam/result.ts`, `src/lib/exam-results.ts`, `src/app/(manager)/students/**`, `src/components/panel/result/grading-card.tsx`, `src/db/schema/enums.ts:28,57`, `src/db/schema/exam.ts:80,113,181`, `src/lib/exam/result.test.ts`. No user role reference remains.

- [ ] **Step 4: Prove, migrate, test**

```bash
pnpm exec vitest run src/lib/authorize.test.ts src/db/migrations-sql.test.ts src/i18n/messages.test.ts
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select role, count(*) from users group by role order by role"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select role, count(*) from users group by role order by role" -c "select column_default from information_schema.columns where table_name = 'users' and column_name = 'role'"
```
Expected: tests PASS; `IDENTICAL`; the user counts are equal before and after, with `TEACHER` rows reported as `MANAGER` after; the default reads `'MANAGER'::user_role`.

- [ ] **Step 5: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/db/schema/enums.ts src/db/schema/org.ts drizzle/migrations src/db/migrations-sql.test.ts src/lib/authorize.ts src/lib/authorize.test.ts src/lib/auth.ts src/server/settings.ts "src/app/(manager)/settings/page.tsx" "src/app/(manager)/settings/users/new/page.tsx" src/db/seed.ts scripts/setup-production.ts src/i18n/messages/settings.tr.json src/i18n/messages/settings.en.json
git commit -m "Rename the TEACHER role to MANAGER" -m "The platform hosts more than the exam, so the general panel role is Manager (Yönetici). Migration 0002 renames the enum value in place; the generated drop-and-recreate would have failed on every existing row. Exam-internal uses of TEACHER (who decided a grade, who wrote an item) keep their name." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Core candidate context, exam guard, exam API under /exam

**Files:**
- Create: `src/lib/candidate-context.ts`, `src/lib/exam-candidate-api.ts`, `src/lib/exam-candidate-api.test.ts`, `src/lib/legacy-routes.ts`, `src/lib/legacy-routes.test.ts`, `scripts/verify-solution-guard.ts`
- Modify: `src/lib/exam-flow.ts`, `src/lib/candidate-api.ts`, `src/lib/candidate-media.ts`, `src/server/proctoring.ts`, `src/server/simulate.ts`, `scripts/verify-exam-flow.ts`, `next.config.ts`, `package.json`
- Move (git mv) and edit: `src/app/api/c/[token]/{answer,answer/commit,section/start,section/submit,listening-audio,media/init}/route.ts` to `src/app/api/c/[token]/exam/...`
- Modify routes that stay: `consent`, `info`, `state`, `device-check`, `heartbeat`, `problem`, `proctor/{events,evidence,heartbeat,session}` (temporarily exam-bound)
- Modify pages: `src/app/a/[token]/{shared.tsx,page.tsx,info/page.tsx,check/page.tsx,done/page.tsx,rights/page.tsx}`, `src/components/candidate/LinkProblem.tsx`
- Modify client: `src/components/candidate/exam/ExamRunner.tsx`, `src/components/candidate/exam/MediaItems.tsx`, `src/lib/client/recorder.ts`

**Interfaces:**
- Produces in `@/lib/candidate-context`: `type LinkProblem`, `type SolutionKind`, `type CandidateContext` (with `assessment: { id: string; orgId: string; solution: SolutionKind }`), `type ResolveResult<C extends CandidateContext = CandidateContext>`, `resolveToken(raw)`, `recordFirstSeen`, `supportedLocales`, `setAssessmentLocale`, `getConsentText`, `hasConsented`, `recordConsent`, `currentAttempt(assessment: { id: string; solution: SolutionKind })`, `recordDeviceCheck`.
- Produces in `@/lib/exam-flow`: `type ExamTerms`, `type ExamCandidateContext`, `loadExamContext(ctx): Promise<ExamCandidateContext | null>`, `resolveExamToken(raw): Promise<ResolveResult<ExamCandidateContext>>`; all exam functions take `ExamCandidateContext`; `workingAttempt(assessmentId)` kept as the exam wrapper; re-exports of the moved core functions so existing imports keep compiling.
- Produces in `@/lib/candidate-api`: `type CandidateRouteOptions`, `notFoundForSolution(ctx): Response`.
- Produces in `@/lib/exam-candidate-api`: `withExamCandidate(req, params, handler: (req, ctx: ExamCandidateContext) => Promise<Response>, options?)`.
- Produces: `LEGACY_CANDIDATE_API_REWRITES` in `@/lib/legacy-routes` (and in Task 9 `LEGACY_PANEL_REDIRECTS`).
- Client paths: `/exam/answer`, `/exam/answer/commit`, `/exam/section/start`, `/exam/section/submit`, `/exam/listening-audio`, `/exam/media/init`. `ChunkedUploader.open(token, initPath, target, mime, onStatus?)`.

- [ ] **Step 1: Write the failing guard test**

```ts
// src/lib/exam-candidate-api.test.ts
import { describe, expect, it, vi } from "vitest";

// Any database access in these cases is a bug: a hiring invitation must be
// turned away before the exam tables are read.
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));

import { notFoundForSolution } from "@/lib/candidate-api";
import type { CandidateContext } from "@/lib/candidate-context";
import { loadExamContext } from "@/lib/exam-flow";

function ctx(solution: CandidateContext["assessment"]["solution"]): CandidateContext {
  return {
    link: { id: "l", status: "NOT_STARTED", expiresAt: new Date(), notBefore: null, firstSeenIp: null },
    assessment: { id: "a", orgId: "o", solution },
    candidate: { id: "c", fullName: null, email: null, phone: null, location: null },
    orgName: "Org",
    locale: "tr",
    contactEmail: null,
    contactName: null,
    mediaRetentionDays: 180,
    evidenceRetentionDays: 90,
  };
}

describe("exam endpoints and other solutions", () => {
  it("do not read a hiring invitation as an exam", async () => {
    expect(await loadExamContext(ctx("HIRING"))).toBeNull();
  });

  it("answer a solution mismatch exactly like an unknown token", async () => {
    const res = notFoundForSolution(ctx("HIRING"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(["error", "message"]);
    expect(body.error).toBe("INVALID");
  });
});
```

Run: `pnpm exec vitest run src/lib/exam-candidate-api.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/candidate-context"`.

- [ ] **Step 2: Create `src/lib/candidate-context.ts`**

Move these from `src/lib/exam-flow.ts` verbatim, with the changes marked: `LinkProblem` (line 69), `CandidateContext` (71-101, changed), `ResolveResult` (103-105, made generic), `resolveToken` (107-160, changed), `recordFirstSeen` (162-168), `supportedLocales` (171), `setAssessmentLocale` (173-176), `getConsentText` (178-187), `hasConsented` (189-192), `recordConsent` (194-207), `workingAttempt` (209-221, renamed and changed), `recordDeviceCheck` (223-228). The resulting file:

```ts
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentLinks,
  assessments,
  attempts,
  candidates,
  consents,
  consentTexts,
  organizations,
} from "@/db/schema";
import { sha256 } from "@/lib/auth";
import type { Locale } from "@/i18n/locale";

/**
 * The candidate side of the core, server only. Every solution's candidate flow
 * starts here: the token is the only credential, and everything else (link,
 * invitation, person, organisation) is derived from it on the server.
 *
 * Nothing in this file knows what a solution does with the invitation. The
 * exam reads its own terms through `loadExamContext` in exam-flow.
 */

export type LinkProblem = "INVALID" | "NOT_YET" | "EXPIRED" | "COMPLETED";
export type SolutionKind = (typeof assessments.$inferSelect)["solution"];

export type CandidateContext = {
  link: {
    id: string;
    status: (typeof assessmentLinks.$inferSelect)["status"];
    expiresAt: Date;
    notBefore: Date | null;
    firstSeenIp: string | null;
  };
  assessment: {
    id: string;
    orgId: string;
    solution: SolutionKind;
  };
  candidate: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
  };
  orgName: string;
  locale: Locale;
  contactEmail: string | null;
  contactName: string | null;
  mediaRetentionDays: number;
  evidenceRetentionDays: number;
};

export type ResolveResult<C extends CandidateContext = CandidateContext> =
  | { ok: true; ctx: C }
  | { ok: false; problem: LinkProblem; ctx?: C };

export async function resolveToken(rawToken: string): Promise<ResolveResult> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return { ok: false, problem: "INVALID" };
  const [row] = await db
    .select({ link: assessmentLinks, assessment: assessments, candidate: candidates, org: organizations })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .innerJoin(organizations, eq(organizations.id, assessments.orgId))
    .where(eq(assessmentLinks.tokenHash, sha256(rawToken)))
    .limit(1);
  if (!row || row.candidate.deletedAt) return { ok: false, problem: "INVALID" };

  const ctx: CandidateContext = {
    link: {
      id: row.link.id,
      status: row.link.status,
      expiresAt: row.link.expiresAt,
      notBefore: row.link.notBefore,
      firstSeenIp: row.link.firstSeenIp,
    },
    assessment: {
      id: row.assessment.id,
      orgId: row.assessment.orgId,
      solution: row.assessment.solution,
    },
    candidate: {
      id: row.candidate.id,
      fullName: row.candidate.fullName,
      email: row.candidate.email,
      phone: row.candidate.phone,
      location: row.candidate.location,
    },
    orgName: row.org.name,
    locale: row.assessment.locale,
    contactEmail: row.org.contactEmail,
    contactName: row.org.name,
    mediaRetentionDays: row.org.mediaRetentionDays,
    evidenceRetentionDays: row.org.evidenceRetentionDays,
  };

  const now = Date.now();
  if (row.link.status === "COMPLETED") return { ok: false, problem: "COMPLETED", ctx };
  if (row.link.status === "EXPIRED") return { ok: false, problem: "EXPIRED", ctx };
  if (row.link.notBefore && row.link.notBefore.getTime() > now) return { ok: false, problem: "NOT_YET", ctx };
  // A candidate already inside keeps going past the link's expiry; the
  // solution's own clocks, not the link, decide when writing stops.
  if (row.link.expiresAt.getTime() < now && row.link.status === "NOT_STARTED")
    return { ok: false, problem: "EXPIRED", ctx };
  return { ok: true, ctx };
}

export async function recordFirstSeen(ctx: CandidateContext, ip: string | null, userAgent: string | null) {
  if (ctx.link.firstSeenIp) return;
  await db
    .update(assessmentLinks)
    .set({ firstSeenIp: ip ?? "unknown", firstSeenUserAgent: userAgent })
    .where(and(eq(assessmentLinks.id, ctx.link.id), isNull(assessmentLinks.firstSeenIp)));
}

/** Interface languages offered to every candidate. */
export const supportedLocales = (ctx: CandidateContext): Locale[] => (ctx ? ["tr", "en"] : ["tr"]);

export async function setAssessmentLocale(ctx: CandidateContext, locale: Locale) {
  await db.update(assessments).set({ locale }).where(eq(assessments.id, ctx.assessment.id));
  ctx.locale = locale;
}

export async function getConsentText(ctx: CandidateContext) {
  const [text] = await db
    .select()
    .from(consentTexts)
    .where(eq(consentTexts.orgId, ctx.assessment.orgId))
    .orderBy(desc(consentTexts.version))
    .limit(1);
  if (!text) throw new Error("no consent text configured for this organisation");
  return text;
}

export async function hasConsented(assessmentId: string) {
  const [row] = await db.select({ id: consents.id }).from(consents).where(eq(consents.assessmentId, assessmentId)).limit(1);
  return !!row;
}

export async function recordConsent(
  ctx: CandidateContext,
  consentTextId: string,
  ip: string | null,
  userAgent: string | null,
) {
  await db.insert(consents).values({
    assessmentId: ctx.assessment.id,
    consentTextId,
    locale: ctx.locale,
    ip,
    userAgent,
  });
}

/**
 * The invitation's latest attempt, created on first need. The language exam
 * has exactly one (the database enforces it); a hiring retake adds attempt 2,
 * 3 and this returns the newest.
 */
export async function currentAttempt(assessment: { id: string; solution: SolutionKind }) {
  const latest = () =>
    db
      .select()
      .from(attempts)
      .where(eq(attempts.assessmentId, assessment.id))
      .orderBy(desc(attempts.attemptNumber))
      .limit(1);
  const [existing] = await latest();
  if (existing) return { attempt: existing, finished: !!existing.completedAt || !!existing.terminatedAt };
  const [created] = await db
    .insert(attempts)
    .values({ assessmentId: assessment.id, solution: assessment.solution, attemptNumber: 1, isPrimary: true })
    .onConflictDoNothing()
    .returning();
  if (created) return { attempt: created, finished: false };
  const [again] = await latest();
  return { attempt: again, finished: !!again.completedAt || !!again.terminatedAt };
}

export async function recordDeviceCheck(attemptId: string) {
  await db
    .update(attempts)
    .set({ deviceCheckedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.deviceCheckedAt)));
}
```

`onConflictDoNothing()` without a target covers the partial unique index and `(assessment_id, attempt_number)`, exactly like it covered `one_attempt_per_assessment` before.

- [ ] **Step 3: Narrow `src/lib/exam-flow.ts` to the exam**

1. Delete lines 69-228 (everything moved in Step 2) except `policyOf` (230), which stays.
2. In the schema import remove `assessmentLinks`? No: `startSection` and `finishAttempt` still use it. Remove only `candidates`, `consents`, `consentTexts`, `organizations`; add `examAssessments`. Remove the `sha256` import. Keep `assessments` (closeSectionRun still reads it until Task 7).
3. Remove imports that become unused (`desc`, `sha256` and others ESLint reports in Step 10). Add after the module doc comment:

```ts
import {
  currentAttempt,
  hasConsented,
  resolveToken,
  type CandidateContext,
  type ResolveResult,
} from "@/lib/candidate-context";

// Core helpers the exam flow used to own. Re-exported so existing imports keep
// working; new code imports them from @/lib/candidate-context.
export {
  getConsentText,
  hasConsented,
  recordConsent,
  recordDeviceCheck,
  recordFirstSeen,
  setAssessmentLocale,
  supportedLocales,
  type LinkProblem,
} from "@/lib/candidate-context";

/** What the language exam froze onto the invitation (exam_assessments). */
export type ExamTerms = {
  blueprintId: string;
  examName: string;
  mode: ExamMode;
  claimedLevel: Cefr | null;
  config: BlueprintConfig;
};

/** The core candidate context plus the exam's terms. Every exam function takes this. */
export type ExamCandidateContext = Omit<CandidateContext, "assessment"> & {
  assessment: CandidateContext["assessment"] & ExamTerms;
};

/**
 * The exam's view of an invitation, or null when it is not a language exam.
 * Null is answered with the same 404 as an unknown token, so an exam endpoint
 * never reveals that a hiring invitation exists.
 */
export async function loadExamContext(ctx: CandidateContext): Promise<ExamCandidateContext | null> {
  if (ctx.assessment.solution !== "LANGUAGE_EXAM") return null;
  const [exam] = await db.select().from(examAssessments).where(eq(examAssessments.assessmentId, ctx.assessment.id)).limit(1);
  if (!exam) return null;
  return {
    ...ctx,
    assessment: {
      ...ctx.assessment,
      blueprintId: exam.blueprintId,
      examName: exam.blueprintName,
      mode: exam.mode,
      claimedLevel: exam.claimedLevel,
      config: exam.blueprintSnapshot,
    },
  };
}

/** resolveToken for exam pages and scripts: a non-exam invitation is INVALID here. */
export async function resolveExamToken(rawToken: string): Promise<ResolveResult<ExamCandidateContext>> {
  const resolved = await resolveToken(rawToken);
  if (!resolved.ok && !resolved.ctx) return { ok: false, problem: resolved.problem };
  const exam = await loadExamContext(resolved.ctx!);
  if (!exam) return { ok: false, problem: "INVALID" };
  return resolved.ok ? { ok: true, ctx: exam } : { ok: false, problem: resolved.problem, ctx: exam };
}

/** The single attempt of this exam invitation, created on first need. */
export async function workingAttempt(assessmentId: string) {
  return currentAttempt({ id: assessmentId, solution: "LANGUAGE_EXAM" });
}
```

4. Replace every remaining `CandidateContext` type annotation in the file with `ExamCandidateContext`:
```bash
sed -i '' -E 's/(ctx|ctxRow): CandidateContext\b/\1: ExamCandidateContext/g' src/lib/exam-flow.ts
grep -n "CandidateContext" src/lib/exam-flow.ts
```
Expected: the remaining hits are the import, the `ExamCandidateContext` definition, `loadExamContext`'s parameter (core type on purpose) and `policyOf`, which must read `(ctx: ExamCandidateContext)`; fix it by hand if sed missed it.

- [ ] **Step 4: Core API helpers and the exam guard**

`src/lib/candidate-api.ts`:
- Replace the exam-flow import with
```ts
import {
  recordFirstSeen,
  resolveToken,
  type CandidateContext,
  type LinkProblem,
} from "@/lib/candidate-context";
```
- Replace the inline `options: { ... } = {}` type of `withCandidate` with `options: CandidateRouteOptions = {}` and add above `withCandidate`:
```ts
export type CandidateRouteOptions = {
  limit?: number;
  windowMs?: number;
  /**
   * Endpoints that must keep working on a link that is expired, not yet open
   * or already finished. Data rights and problem reports are the two: a
   * candidate whose link just closed still needs a way to reach a human.
   */
  allowProblems?: LinkProblem[];
};
```
- Add at the end:
```ts
/**
 * A valid token for another solution's invitation gets exactly the answer an
 * unknown token gets (spec 6: no leak). Only the language differs, because the
 * invitation's own locale is known.
 */
export function notFoundForSolution(ctx: CandidateContext) {
  return candidateJson(
    { error: "INVALID", message: message(ctx.locale, "INVALID") },
    { status: PROBLEM_STATUS.INVALID },
  );
}
```

Create `src/lib/exam-candidate-api.ts`:
```ts
import type { NextRequest } from "next/server";
import { notFoundForSolution, withCandidate, type CandidateRouteOptions } from "@/lib/candidate-api";
import { loadExamContext, type ExamCandidateContext } from "@/lib/exam-flow";

export type ExamHandler = (req: NextRequest, ctx: ExamCandidateContext) => Promise<Response>;

/**
 * `withCandidate` for the language exam's endpoints. The token is resolved by
 * the core; anything that is not a language exam invitation is answered with
 * the unknown-token 404 before a single exam table is read.
 */
export function withExamCandidate(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: ExamHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const exam = await loadExamContext(ctx);
      if (!exam) return notFoundForSolution(ctx);
      return handler(request, exam);
    },
    options,
  );
}
```

`src/lib/candidate-media.ts`: change `import type { CandidateContext } from "@/lib/exam-flow";` to `import type { CandidateContext } from "@/lib/candidate-context";`.

`src/server/proctoring.ts`: change the exam-flow import to
```ts
import { closeSectionRun, currentSection, finishAttempt, type ExamCandidateContext as CandidateContext } from "@/lib/exam-flow";
```
(temporary alias; Task 6 removes the exam dependency).

Run: `pnpm exec vitest run src/lib/exam-candidate-api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Move the exam endpoints**

```bash
cd "src/app/api/c/[token]"
mkdir -p exam/section exam/media
git mv answer exam/answer
git mv section/start exam/section/start
git mv section/submit exam/section/submit
git mv listening-audio exam/listening-audio
git mv media/init exam/media/init
rmdir section 2>/dev/null; cd -
```
(`answer/commit` moves with `answer`.)

In each of the six moved `route.ts` files:
- replace `import { ..., withCandidate } from "@/lib/candidate-api";` with the same import minus `withCandidate`, and add `import { withExamCandidate } from "@/lib/exam-candidate-api";`;
- replace the call `withCandidate(` with `withExamCandidate(`.
Nothing else changes: the handlers already used the exam fields of `ctx`.

In these routes that stay, make the same two replacements (temporary, Task 6 moves them to the registry): `consent/route.ts` (both `GET` and `POST`), `info/route.ts`, `state/route.ts`, `device-check/route.ts`, `heartbeat/route.ts`, `problem/route.ts`, `proctor/events/route.ts`, `proctor/evidence/route.ts`, `proctor/heartbeat/route.ts`, `proctor/session/route.ts`. In `consent/route.ts` also change the import of `getConsentText, hasConsented, recordConsent` to `@/lib/candidate-context` (keep `loadState` from exam-flow).

Routes that need no change: `rights`, `bandwidth`, `media/part`, `media/part-done`, `media/part-urls`, `media/complete` (they use only core fields of `ctx`).

- [ ] **Step 6: Candidate pages and scripts**

- `src/app/a/[token]/shared.tsx`: import `loadState, progressSummary, resolveExamToken, type CandidateState, type ExamCandidateContext` from `@/lib/exam-flow` and `setAssessmentLocale, supportedLocales` from `@/lib/candidate-context`; delete the separate `import { resolveToken } from "@/lib/exam-flow";`; in `PageEntry` and `settleLocale` and `headerMeta` use `ExamCandidateContext`; call `resolveExamToken(token)` instead of `resolveToken(token)`.
- `src/app/a/[token]/page.tsx`: import `getConsentText, supportedLocales` from `@/lib/candidate-context`.
- `src/app/a/[token]/info/page.tsx`, `check/page.tsx`: import `supportedLocales` from `@/lib/candidate-context`.
- `src/app/a/[token]/done/page.tsx`: import `loadState, progressSummary, resolveExamToken` from `@/lib/exam-flow`; call `resolveExamToken(token)`.
- `src/app/a/[token]/rights/page.tsx`: import `resolveToken` from `@/lib/candidate-context` (data rights are core and stay reachable for any solution).
- `src/components/candidate/LinkProblem.tsx`: `import type { LinkProblem as Problem } from "@/lib/candidate-context";`
- `src/server/simulate.ts`: replace `resolveToken` with `resolveExamToken` in the import list and in the call.
- `scripts/verify-exam-flow.ts`: replace the three `flow.resolveToken(` calls with `flow.resolveExamToken(`.

The candidate pages stay bound to the exam in this plan (LANGUAGE_EXAM is the only solution with candidate screens); a hiring token on them renders the INVALID screen. Per-solution page dispatch belongs to sub-project 3.

- [ ] **Step 7: Client paths**

- `src/components/candidate/exam/ExamRunner.tsx`: `"/answer"` becomes `"/exam/answer"` (line 94), `"/section/submit"` becomes `"/exam/section/submit"` (123), `"/section/start"` becomes `"/exam/section/start"` (195), both `"/answer/commit"` become `"/exam/answer/commit"` (244, 257). `/state` stays (core).
- `src/components/candidate/exam/MediaItems.tsx:54`: `"/listening-audio"` becomes `"/exam/listening-audio"`; line 194 becomes
  `const uploader = await ChunkedUploader.open(token, "/exam/media/init", { sectionPosition, sequence: item.sequence }, mime || "video/webm");`
- `src/lib/client/recorder.ts` `open`: new signature and body:
```ts
  static async open(
    token: string,
    /** The solution's init endpoint, e.g. "/exam/media/init". The parts and completion are core. */
    initPath: string,
    target: { sectionPosition: number; sequence: number },
    mime: string,
    onStatus?: (status: UploaderStatus) => void,
  ) {
    const init = await apiSend<InitResponse>(token, initPath, {
      sectionPosition: target.sectionPosition,
      sequence: target.sequence,
      mime,
    });
    return new ChunkedUploader(token, init, onStatus);
  }
```

- [ ] **Step 8: Legacy rewrites, with a test that their targets exist**

```ts
// src/lib/legacy-routes.ts
/**
 * Old URLs that still have to work for a while.
 *
 * Candidate API: a student who opened the exam before a deploy still runs the
 * old JavaScript, which calls the pre-/exam paths. These rewrites (server side,
 * no redirect, body and method intact) keep that tab working. Remove them one
 * release after the /exam move is live. The rewritten request lands on the
 * guarded exam route, so a non-exam token still gets a 404.
 */
export const LEGACY_CANDIDATE_API_REWRITES = [
  { source: "/api/c/:token/answer", destination: "/api/c/:token/exam/answer" },
  { source: "/api/c/:token/answer/commit", destination: "/api/c/:token/exam/answer/commit" },
  { source: "/api/c/:token/section/start", destination: "/api/c/:token/exam/section/start" },
  { source: "/api/c/:token/section/submit", destination: "/api/c/:token/exam/section/submit" },
  { source: "/api/c/:token/listening-audio", destination: "/api/c/:token/exam/listening-audio" },
  { source: "/api/c/:token/media/init", destination: "/api/c/:token/exam/media/init" },
];
```

```ts
// src/lib/legacy-routes.test.ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_CANDIDATE_API_REWRITES } from "./legacy-routes";

const app = path.resolve(process.cwd(), "src/app");

describe("legacy candidate API rewrites", () => {
  it.each(LEGACY_CANDIDATE_API_REWRITES)("$source lands on an existing route", ({ source, destination }) => {
    const file = path.join(app, destination.replace(":token", "[token]"), "route.ts");
    expect(existsSync(file), file).toBe(true);
    const old = path.join(app, source.replace(":token", "[token]"), "route.ts");
    expect(existsSync(old), `${old} must be gone, or the rewrite is never used`).toBe(false);
  });
});
```

`next.config.ts`: add `import { LEGACY_CANDIDATE_API_REWRITES } from "./src/lib/legacy-routes";` and, inside `nextConfig`, after `headers()`:
```ts
  /** See src/lib/legacy-routes.ts. An array is applied after the filesystem (rewrites.md). */
  async rewrites() {
    return LEGACY_CANDIDATE_API_REWRITES;
  },
```

Run: `pnpm exec vitest run src/lib/legacy-routes.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 9: The cross-solution HTTP check**

```ts
// scripts/verify-solution-guard.ts
/**
 * Spec 6 and 7: a solution's candidate endpoints never answer another
 * solution's invitation, and the answer is indistinguishable from an unknown
 * token. Runs against a dev server (default http://localhost:3100) on the same
 * database as DATABASE_URL. Adds two invitations and removes them at the end.
 *
 *   DATABASE_URL=... pnpm verify:guard
 */
import "dotenv/config";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};

async function call(method: "GET" | "POST" | "PUT", path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { mintToken } = await import("../src/lib/auth");
  const { createInvitation } = await import("../src/server/invite");

  const [org] = await db.select().from(s.organizations).limit(1);
  const [placement] = await db.select().from(s.examBlueprints).where(eq(s.examBlueprints.mode, "PLACEMENT")).limit(1);
  if (!org || !placement) throw new Error("no organisation or placement exam in this database");

  const exam = await createInvitation({
    orgId: org.id, blueprintId: placement.id, fullName: "Guard exam", email: `guard-${Date.now()}@example.com`,
    claimedLevel: null, locale: "tr", invitedBy: null,
  });
  if (!exam.ok) throw new Error(exam.code);

  // A hiring invitation exists only as core rows until sub-project 3.
  const token = mintToken();
  const [person] = await db.insert(s.candidates).values({ orgId: org.id, fullName: "Guard hiring", email: `guard-h-${Date.now()}@example.com` }).returning();
  const [hiring] = await db.insert(s.assessments).values({ orgId: org.id, candidateId: person.id, solution: "HIRING", locale: "tr" }).returning();
  await db.insert(s.assessmentLinks).values({ assessmentId: hiring.id, tokenHash: token.hash, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) });

  try {
    console.log("\nExam endpoints refuse a hiring invitation");
    for (const [method, path] of [
      ["PUT", "/exam/answer"],
      ["POST", "/exam/answer/commit"],
      ["POST", "/exam/section/start"],
      ["POST", "/exam/section/submit"],
      ["POST", "/exam/listening-audio"],
      ["POST", "/exam/media/init"],
      ["PUT", "/answer"],
    ] as const) {
      const r = await call(method, `/api/c/${token.raw}${path}`, {});
      if (r.status === 404 && r.json?.error === "INVALID") ok(`${method} ${path}: 404 INVALID`);
      else bad(`${method} ${path}: ${r.status} ${JSON.stringify(r.json)}`);
    }

    console.log("\nCore endpoints refuse a solution with no registered module");
    const state = await call("GET", `/api/c/${token.raw}/state`);
    if (state.status === 404) ok("GET /state: 404");
    else bad(`GET /state: ${state.status}`);

    console.log("\nThe answer looks like an unknown token");
    const unknown = await call("GET", `/api/c/${"x".repeat(43)}/state`);
    const hiringAnswer = await call("PUT", `/api/c/${token.raw}/exam/answer`, {});
    const keys = (j: Record<string, unknown> | null) => Object.keys(j ?? {}).sort().join(",");
    if (unknown.status === hiringAnswer.status && keys(unknown.json) === keys(hiringAnswer.json) && unknown.json?.error === hiringAnswer.json?.error)
      ok(`same status (${unknown.status}), same fields (${keys(unknown.json)}), same code`);
    else bad(`unknown ${unknown.status} ${JSON.stringify(unknown.json)} vs hiring ${hiringAnswer.status} ${JSON.stringify(hiringAnswer.json)}`);

    console.log("\nThe exam invitation still reaches its endpoints");
    const examState = await call("GET", `/api/c/${exam.rawToken}/state`);
    if (examState.status === 200 && examState.json?.step === "CONSENT") ok("GET /state: 200 CONSENT");
    else bad(`GET /state: ${examState.status} ${JSON.stringify(examState.json)}`);
    const start = await call("POST", `/api/c/${exam.rawToken}/exam/section/start`, { sectionPosition: 1 });
    if (start.status === 409 && start.json?.error === "NOT_READY") ok("POST /exam/section/start before consent: 409 NOT_READY");
    else bad(`POST /exam/section/start: ${start.status} ${JSON.stringify(start.json)}`);
    const legacy = await call("PUT", `/api/c/${exam.rawToken}/answer`, { sectionPosition: 1, sequence: 1, answer: {} });
    if (legacy.status === 409) ok(`PUT /answer (legacy path, rewritten): 409 ${legacy.json?.error}`);
    else bad(`PUT /answer legacy: ${legacy.status} ${JSON.stringify(legacy.json)}`);
  } finally {
    await db.delete(s.candidates).where(eq(s.candidates.id, person.id));
    await db.delete(s.candidates).where(eq(s.candidates.id, exam.candidateId));
  }

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add to `package.json` scripts: `"verify:guard": "tsx scripts/verify-solution-guard.ts"`.

Check `mintToken` returns `{ raw, hash }` (it is used that way in `src/server/invite.ts:42-68`). `candidates` deletion cascades to assessments, links, exam_assessments and attempts.

- [ ] **Step 10: Gates, live checks, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
Start the dev server on the working database in a separate shell (or background task):
```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100
```
Then:
```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
```
Expected: build succeeds (route count +0: six routes moved, none added); `verify:exam` prints `All checks passed.`; `verify:guard` prints `All checks passed.` with 12 `ok` lines.

```bash
git add src/lib/candidate-context.ts src/lib/exam-flow.ts src/lib/candidate-api.ts src/lib/exam-candidate-api.ts src/lib/exam-candidate-api.test.ts src/lib/candidate-media.ts src/server/proctoring.ts src/server/simulate.ts scripts/verify-exam-flow.ts scripts/verify-solution-guard.ts src/lib/legacy-routes.ts src/lib/legacy-routes.test.ts next.config.ts package.json "src/app/api/c/[token]" src/app/a src/components/candidate/LinkProblem.tsx src/components/candidate/exam/ExamRunner.tsx src/components/candidate/exam/MediaItems.tsx src/lib/client/recorder.ts
git commit -m "Move exam-only candidate endpoints under /exam and guard them by solution" -m "The core candidate context (token, link, invitation with its solution, person, consent, current attempt) moves to candidate-context.ts. Exam endpoints live under /api/c/[token]/exam and answer only language exam invitations; any other token gets the same 404 an unknown token gets. Old paths are rewritten for one release so open exam tabs survive a deploy. verify:guard checks it over HTTP." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The solution contract, registry, exam module and import boundary

**Files:**
- Create: `src/solutions/types.ts`, `src/solutions/registry.ts`, `src/solutions/registry.server.ts`, `src/solutions/language-exam/manifest.ts`, `src/solutions/language-exam/module.ts`, `src/solutions/language-exam/today.ts`, `src/solutions/registry.test.ts`, `src/solutions/boundary.test.ts`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces `@/solutions/types`: `SolutionKind`, `SolutionKey`, `I18nLabel`, `NavLink`, `CandidateStepState`, `SolutionManifest`, `TodayCell`, `TodayItem`, `SegmentRef`, `MediaAssetRow`, `SolutionModule`.
- Produces `@/solutions/registry`: `SOLUTION_MANIFESTS`, `manifestByKind(kind)`, `type NavGroupView`, `buildNav(locale, shared)`.
- Produces `@/solutions/registry.server`: `solutionModules()`, `solutionModule(kind)`.
- Consumes: `CandidateContext` (Task 4), `loadExamContext`, `loadState`, `currentSection`, `closeSectionRun`, `finishAttempt` (exam-flow), `reopenGradingForMedia` (exam-results), `listStudents` (server/panel), `stepPath` (candidate-routes).

- [ ] **Step 1: Write the failing registry test**

```ts
// src/solutions/registry.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { buildNav, manifestByKind, SOLUTION_MANIFESTS } from "./registry";
import { solutionModule, solutionModules } from "./registry.server";

describe("solution registry", () => {
  it("knows the language exam by its database kind", () => {
    expect(manifestByKind("LANGUAGE_EXAM")?.key).toBe("language-exam");
    expect(solutionModule("LANGUAGE_EXAM")?.key).toBe("language-exam");
  });

  it("has no hiring module until sub-project 3 registers one", () => {
    expect(manifestByKind("HIRING")).toBeNull();
    expect(solutionModule("HIRING")).toBeNull();
  });

  it("keeps manifests and modules in the same order with the same keys", () => {
    expect(solutionModules().map((m) => m.key)).toEqual(SOLUTION_MANIFESTS.map((m) => m.key));
  });

  it("keeps every solution's menu under its own base path", () => {
    for (const m of SOLUTION_MANIFESTS) {
      expect(m.nav.length).toBeGreaterThan(0);
      for (const item of m.nav) expect(item.href.startsWith(`${m.basePath}/`), item.href).toBe(true);
      expect(m.inviteHref.startsWith(`${m.basePath}/`)).toBe(true);
    }
    const keys = SOLUTION_MANIFESTS.map((m) => m.dbKind);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("maps exam steps to the same screens as before", () => {
    const m = manifestByKind("LANGUAGE_EXAM")!;
    expect(m.candidateStepPath("tok", { step: "CONSENT" })).toBe("/a/tok");
    expect(m.candidateStepPath("tok", { step: "INFO" })).toBe("/a/tok/info");
    expect(m.candidateStepPath("tok", { step: "CHECK" })).toBe("/a/tok/check");
    expect(m.candidateStepPath("tok", { step: "ITEM" })).toBe("/a/tok/exam");
    expect(m.candidateStepPath("tok", { step: "DONE" })).toBe("/a/tok/done");
    expect(m.candidateStepPath("tok", { step: "SOMETHING_ELSE" })).toBe("/a/tok");
  });

  it("builds the HIRING-UX 4.1 menu: Today, solutions, Settings, no group header for a single solution", () => {
    const nav = buildNav("tr", { today: "Bugün", settings: "Ayarlar" });
    expect(nav.map((g) => g.key)).toEqual(["today", "language-exam", "settings"]);
    expect(nav[1].label).toBeNull();
    expect(nav[1].items.map((i) => i.label)).toEqual(["Öğrenciler", "Sınavlar", "Soru bankası"]);
    expect(buildNav("en", { today: "Today", settings: "Settings" })[1].items[2].label).toBe("Question bank");
  });
});
```

Run: `pnpm exec vitest run src/solutions/registry.test.ts`
Expected: FAIL, `Failed to resolve import "./registry"`.

- [ ] **Step 2: Write the contract**

```ts
// src/solutions/types.ts
import type { StatusTone } from "@/components/ui/status-dot";
import type { mediaAssets } from "@/db/schema";
import type { solution } from "@/db/schema/enums";
import type { Locale } from "@/i18n/locale";
import type { CandidateContext } from "@/lib/candidate-context";
import type { ProctoringPolicy } from "@/lib/proctor/policy";

/**
 * The solution contract (spec 3). Core code knows solutions only through
 * these types and the two registries; ESLint forbids importing a solution's
 * folder from anywhere else.
 */

/** The database value. A new solution adds one value to the `solution` enum. */
export type SolutionKind = (typeof solution.enumValues)[number];
export type SolutionKey = "language-exam" | "hiring";
export type I18nLabel = { tr: string; en: string };
export type NavLink = { href: string; label: I18nLabel };
/** The part of a solution's candidate state the core routes on. */
export type CandidateStepState = { step: string };

/** Client-safe: plain data and pure functions only. */
export interface SolutionManifest {
  key: SolutionKey;
  dbKind: SolutionKind;
  basePath: "/exam" | "/hiring";
  /** Menu group header (shown only when more than one solution is registered). */
  label: I18nLabel;
  /** Menu entries, in menu order. Only routes that exist (RULES.md rule 7). */
  nav: NavLink[];
  /** Where "invite" on the shared Today screen leads for this solution. */
  inviteHref: string;
  /** Where `/a/[token]` sends the candidate for a given state of this solution. */
  candidateStepPath(token: string, state: CandidateStepState): string;
}

export type TodayCell =
  | { kind: "text"; text: string }
  | { kind: "level"; text: string | null; final: boolean }
  | { kind: "dot"; tone: StatusTone; text: string };

/** One row on the shared Today screen. */
export type TodayItem = {
  id: string;
  solution: SolutionKey;
  /** "review": waiting for a person, oldest first. "running": in progress now. */
  lane: "review" | "running";
  title: string;
  subtitle: string | null;
  href: string;
  sortAt: Date | null;
  /** review: exactly four cells (detail, level, status, integrity). running: one dot. */
  cells: TodayCell[];
};

/** A running part of an attempt, as the solution names it (proctor_events.segment_*). */
export type SegmentRef = { kind: string; runId: string };
export type MediaAssetRow = typeof mediaAssets.$inferSelect;

/** Server-only: everything a solution answers for the core. */
export interface SolutionModule extends SolutionManifest {
  /** Rows for the shared Today screen. */
  today(orgId: string, userId: string, locale: Locale): Promise<TodayItem[]>;
  /** The proctoring policy frozen on this invitation; null when the solution has no proctoring. */
  proctorPolicy(assessmentId: string): Promise<ProctoringPolicy | null>;
  candidate: {
    /** The state document the candidate screens read; its `step` drives routing. */
    loadState(ctx: CandidateContext): Promise<CandidateStepState>;
    /** What the invitation is called, for problem reports. */
    title(ctx: CandidateContext): Promise<string>;
    /** Keeps the solution's clock alive; returns the running deadline, if any. */
    heartbeat(ctx: CandidateContext): Promise<{ deadlineAt: Date | null }>;
  };
  attempts: {
    /** The timed part of the attempt that is running now, for proctoring records. */
    openSegment(attemptId: string): Promise<SegmentRef | null>;
    /** Close whatever is open and finish the attempt (termination by policy). */
    terminate(attemptId: string): Promise<void>;
    /** A recording finished uploading; attach it wherever the solution keeps answers. */
    onMediaComplete(asset: MediaAssetRow): Promise<void>;
  };
}
```

Deviations from the spec's draft interface, and why: `today` takes the viewer's `locale` (rows are rendered strings); `candidate`/`attempts` hooks are added because the core candidate routes and proctoring must not import the exam engine (spec 6, last bullet); `personSummary` is left out until `/people/[id]` exists (sub-project 3), because nothing would call it.

- [ ] **Step 3: Write the manifest, the registries and the module**

```ts
// src/solutions/language-exam/manifest.ts
import { stepPath } from "@/lib/candidate-routes";
import type { CandidateStepState, SolutionManifest } from "@/solutions/types";

const EXAM_STEPS = ["CONSENT", "INFO", "CHECK", "SECTION_INTRO", "ITEM", "DONE"] as const;
type ExamStep = (typeof EXAM_STEPS)[number];
const isExamStep = (step: string): step is ExamStep => (EXAM_STEPS as readonly string[]).includes(step);

export const languageExamManifest: SolutionManifest = {
  key: "language-exam",
  dbKind: "LANGUAGE_EXAM",
  basePath: "/exam",
  label: { tr: "Sınav", en: "Language exam" },
  nav: [
    { href: "/exam/students", label: { tr: "Öğrenciler", en: "Students" } },
    { href: "/exam/exams", label: { tr: "Sınavlar", en: "Exams" } },
    { href: "/exam/bank", label: { tr: "Soru bankası", en: "Question bank" } },
  ],
  inviteHref: "/exam/students/new",
  candidateStepPath(token: string, state: CandidateStepState) {
    return isExamStep(state.step) ? stepPath(token, { step: state.step }) : `/a/${encodeURIComponent(token)}`;
  },
};
```

```ts
// src/solutions/registry.ts
import type { Locale } from "@/i18n/locale";
import { languageExamManifest } from "@/solutions/language-exam/manifest";
import type { SolutionKind, SolutionManifest } from "@/solutions/types";

/**
 * Every registered solution, in menu order (HIRING-UX 4.1: hiring will come
 * before the exam). Client-safe. Adding a solution: one folder, one line here,
 * one line in registry.server.ts, one enum value.
 */
export const SOLUTION_MANIFESTS: readonly SolutionManifest[] = [languageExamManifest];

export function manifestByKind(kind: SolutionKind): SolutionManifest | null {
  return SOLUTION_MANIFESTS.find((m) => m.dbKind === kind) ?? null;
}

export type NavGroupView = {
  key: string;
  /** Null renders the items without a header. */
  label: string | null;
  items: Array<{ href: string; label: string }>;
};

/**
 * The panel menu (HIRING-UX 4.1): Today, one group per solution, Settings.
 * Group headers appear only when more than one solution is registered ("nobody
 * sees the menu of something they do not use"). The Library group joins when
 * its routes exist (sub-project 3).
 */
export function buildNav(locale: Locale, shared: { today: string; settings: string }): NavGroupView[] {
  const several = SOLUTION_MANIFESTS.length > 1;
  return [
    { key: "today", label: null, items: [{ href: "/dashboard", label: shared.today }] },
    ...SOLUTION_MANIFESTS.map((m) => ({
      key: m.key,
      label: several ? m.label[locale] : null,
      items: m.nav.map((n) => ({ href: n.href, label: n.label[locale] })),
    })),
    { key: "settings", label: null, items: [{ href: "/settings", label: shared.settings }] },
  ];
}
```

```ts
// src/solutions/registry.server.ts
import { languageExamModule } from "@/solutions/language-exam/module";
import type { SolutionKind, SolutionModule } from "@/solutions/types";

/** Server modules, same order as SOLUTION_MANIFESTS (a test keeps them aligned). */
const MODULES: readonly SolutionModule[] = [languageExamModule];

export function solutionModules(): readonly SolutionModule[] {
  return MODULES;
}

export function solutionModule(kind: SolutionKind): SolutionModule | null {
  return MODULES.find((m) => m.dbKind === kind) ?? null;
}
```

```ts
// src/solutions/language-exam/today.ts
import { INTEGRITY_TONE, STATUS_TONE, shortDateTime } from "@/components/panel/bits";
import type { Locale } from "@/i18n/locale";
import { managerT } from "@/i18n/manager";
import { listStudents } from "@/server/panel";
import type { TodayItem } from "@/solutions/types";

/** The exam's rows for the shared Today screen: the same facts the old dashboard showed. */
export async function examToday(orgId: string, _userId: string, locale: Locale): Promise<TodayItem[]> {
  const t = managerT(locale);
  const rows = await listStudents(orgId);
  const review: TodayItem[] = rows
    .filter((r) => r.status === "AWAITING_REVIEW" || r.status === "AWAITING_GRADING")
    .map((r) => ({
      id: r.assessmentId,
      solution: "language-exam",
      lane: "review",
      title: r.name,
      subtitle: shortDateTime(r.completedAt, locale),
      href: `/exam/students/${r.assessmentId}`,
      sortAt: r.completedAt,
      cells: [
        { kind: "text", text: `${t(`mode.${r.mode}`)}${r.claimed ? ` · ${t("mode.claimed", { level: r.claimed })}` : ""}` },
        { kind: "level", text: r.level, final: r.levelFinal },
        {
          kind: "dot",
          tone: r.status === "AWAITING_GRADING" ? "neutral" : "warn",
          text:
            r.status === "AWAITING_GRADING"
              ? t("today.aiRunning")
              : r.aiProposals > 0
                ? t("today.aiPending", { n: r.aiProposals })
                : t("today.readyToFinalize"),
        },
        { kind: "dot", tone: INTEGRITY_TONE[r.integrity], text: t(`integrityLevel.${r.integrity}`) },
      ],
    }));
  const running: TodayItem[] = rows
    .filter((r) => r.status === "IN_EXAM")
    .map((r) => ({
      id: r.assessmentId,
      solution: "language-exam",
      lane: "running",
      title: r.name,
      subtitle: null,
      href: `/exam/students/${r.assessmentId}`,
      sortAt: null,
      cells: [
        {
          kind: "dot",
          tone: STATUS_TONE.IN_EXAM,
          text: r.currentSection ? t("today.sectionNow", { section: t(`sectionName.${r.currentSection}`) }) : t("status.IN_EXAM"),
        },
      ],
    }));
  return [...review, ...running];
}
```

```ts
// src/solutions/language-exam/module.ts
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { examAssessments, itemResponses, sectionRuns } from "@/db/schema";
import type { CandidateContext } from "@/lib/candidate-context";
import {
  closeSectionRun,
  currentSection,
  finishAttempt,
  loadExamContext,
  loadState,
  type ExamCandidateContext,
} from "@/lib/exam-flow";
import { reopenGradingForMedia } from "@/lib/exam-results";
import type { SolutionModule } from "@/solutions/types";
import { languageExamManifest } from "./manifest";
import { examToday } from "./today";

async function requireExam(ctx: CandidateContext): Promise<ExamCandidateContext> {
  const exam = await loadExamContext(ctx);
  if (!exam) throw new Error(`assessment ${ctx.assessment.id} has no exam terms`);
  return exam;
}

/**
 * The language exam as the core sees it. Each method is the code that used to
 * sit in a core route or in proctoring.ts, moved here unchanged in behaviour.
 */
export const languageExamModule: SolutionModule = {
  ...languageExamManifest,
  today: examToday,

  async proctorPolicy(assessmentId) {
    const [row] = await db
      .select({ config: examAssessments.blueprintSnapshot })
      .from(examAssessments)
      .where(eq(examAssessments.assessmentId, assessmentId))
      .limit(1);
    // The exam always returns its frozen policy, preset OFF included: core code
    // checks `preset` exactly as before. Null only for a missing exam row.
    return row?.config.proctoring ?? null;
  },

  candidate: {
    async loadState(ctx) {
      return loadState(await requireExam(ctx));
    },
    async title(ctx) {
      return (await requireExam(ctx)).assessment.examName;
    },
    async heartbeat(ctx) {
      const current = await currentSection(await requireExam(ctx));
      const run = current?.run;
      if (run?.startedAt && !run.submittedAt) {
        await db.update(sectionRuns).set({ lastHeartbeatAt: new Date() }).where(eq(sectionRuns.id, run.id));
      }
      return { deadlineAt: run?.deadlineAt ?? null };
    },
  },

  attempts: {
    async openSegment(attemptId) {
      const [run] = await db
        .select({ id: sectionRuns.id })
        .from(sectionRuns)
        .where(and(eq(sectionRuns.attemptId, attemptId), isNotNull(sectionRuns.startedAt), isNull(sectionRuns.submittedAt)))
        .limit(1);
      return run ? { kind: "section_run", runId: run.id } : null;
    },
    async terminate(attemptId) {
      const runs = await db.select().from(sectionRuns).where(eq(sectionRuns.attemptId, attemptId));
      for (const r of runs.filter((x) => x.startedAt && !x.submittedAt)) await closeSectionRun(r.id, "SUBMIT");
      await finishAttempt(attemptId);
    },
    async onMediaComplete(asset) {
      if (!asset.itemResponseId) return;
      const [response] = await db.select().from(itemResponses).where(eq(itemResponses.id, asset.itemResponseId));
      if (!response) return;
      // The newest take is the answer. It supersedes a typed alternative.
      const answer = { ...(response.answer ?? {}), mediaAssetId: asset.id };
      delete answer.usedTextAlternative;
      await db.update(itemResponses).set({ answer, updatedAt: new Date() }).where(eq(itemResponses.id, response.id));
      await reopenGradingForMedia(response.id);
    },
  },
};
```

Run: `pnpm exec vitest run src/solutions/registry.test.ts`
Expected: PASS (6 tests). If the import chain fails under the `@/db` mock (a module touching the database at import time), report the module and the error; do not weaken the test.

- [ ] **Step 4: ESLint boundary**

In `eslint.config.mjs`, add this entry to the array after `...nextTs,`:
```js
  {
    // Spec 3 and 6: core code reaches solutions only through the registries and
    // the contract. Solution folders and solution route folders are exempt.
    files: ["src/**/*.{ts,tsx,mts}"],
    ignores: ["src/solutions/**", "src/app/**/exam/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/solutions/*",
                "!@/solutions/registry",
                "!@/solutions/registry.server",
                "!@/solutions/types",
                "**/solutions/*",
                "**/solutions/*/**",
                "!**/solutions/registry",
                "!**/solutions/registry.server",
                "!**/solutions/types",
              ],
              message:
                "Core code reaches a solution only through @/solutions/registry, @/solutions/registry.server or @/solutions/types.",
            },
          ],
        },
      ],
    },
  },
```

Prove it bites (temporary file, deleted right after):
```bash
printf 'import { languageExamModule } from "@/solutions/language-exam/module";\nexport const x = languageExamModule;\n' > src/lib/zz-boundary-probe.ts
pnpm exec eslint src/lib/zz-boundary-probe.ts; echo "exit $?"
rm src/lib/zz-boundary-probe.ts
```
Expected: one `no-restricted-imports` error and exit 1.

- [ ] **Step 5: The ratchet test for remaining core-to-exam imports**

```ts
// src/solutions/boundary.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Core files that still import the exam engine directly. The list may only
 * shrink: a new core-to-exam import fails this test, and removing a coupling
 * means deleting its line here. ESLint guards @/solutions; this guards the exam
 * modules that predate it (they live in src/lib and src/server).
 *
 * Exam modules: @/lib/exam-flow, @/lib/exam-results, @/lib/exam-candidate-api,
 * @/lib/exam/*, @/server/{panel,invite,simulate,bank-import,item-generation-job}.
 * The codebase imports them only through the @/ alias.
 */
const KNOWN_COUPLINGS = [
  "src/app/(manager)/dashboard/page.tsx",
  "src/app/a/[token]/done/page.tsx",
  "src/app/a/[token]/shared.tsx",
  "src/app/api/c/[token]/consent/route.ts",
  "src/app/api/c/[token]/device-check/route.ts",
  "src/app/api/c/[token]/heartbeat/route.ts",
  "src/app/api/c/[token]/info/route.ts",
  "src/app/api/c/[token]/media/complete/route.ts",
  "src/app/api/c/[token]/problem/route.ts",
  "src/app/api/c/[token]/proctor/events/route.ts",
  "src/app/api/c/[token]/proctor/evidence/route.ts",
  "src/app/api/c/[token]/proctor/heartbeat/route.ts",
  "src/app/api/c/[token]/proctor/session/route.ts",
  "src/app/api/c/[token]/state/route.ts",
  "src/app/api/cron/grade/route.ts",
  "src/components/candidate/Finished.tsx",
  "src/components/candidate/InfoForm.tsx",
  "src/components/candidate/IntroConsent.tsx",
  "src/components/candidate/proctor/SystemCheck.tsx",
  "src/lib/candidate-routes.ts",
  "src/lib/close-expired.ts",
  "src/lib/transcribe-job.ts",
  "src/server/proctor-review-job.ts",
  "src/server/proctoring.ts",
];

const EXEMPT = [
  /^src\/solutions\//,
  /^src\/app\/.*\/exam\//,
  /^src\/app\/\(manager\)\/(students|exams|bank)\//,
  /^src\/components\/panel\//,
  /^src\/components\/candidate\/exam\//,
  /^src\/lib\/exam\//,
  /^src\/lib\/(exam-flow|exam-results|exam-candidate-api)\.ts$/,
  /^src\/server\/(panel|invite|simulate|bank-import|item-generation-job)\.ts$/,
  /^src\/db\//,
  /\.test\.tsx?$/,
];
const EXAM_IMPORT = [
  /["']@\/lib\/(?:exam-flow|exam-results|exam-candidate-api|exam\/)/,
  /["']@\/server\/(?:panel|invite|simulate|bank-import|item-generation-job)["']/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx|mts)$/.test(name) ? [full] : [];
  });
}

describe("core to exam imports", () => {
  it("only the known couplings remain", () => {
    const root = process.cwd();
    const offenders = files(path.join(root, "src"))
      .map((f) => path.relative(root, f).split(path.sep).join("/"))
      .filter((f) => !EXEMPT.some((re) => re.test(f)))
      .filter((f) => {
        const text = readFileSync(path.join(root, f), "utf8");
        return EXAM_IMPORT.some((re) => re.test(text));
      })
      .sort();
    expect(offenders).toEqual([...KNOWN_COUPLINGS].sort());
  });
});
```

Run: `pnpm exec vitest run src/solutions/boundary.test.ts`
Expected: PASS. If it fails, the diff names the files. A file in the "received" list that is not in `KNOWN_COUPLINGS` means a coupling this plan did not foresee: stop and report it rather than adding it silently. A file missing from "received" means it is already clean: delete its line.

- [ ] **Step 6: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test
git add src/solutions eslint.config.mjs
git commit -m "Add the solution contract, the registries and the language exam module" -m "types.ts is the contract; registry.ts holds client-safe manifests and builds the HIRING-UX 4.1 menu; registry.server.ts holds server modules. The exam module wraps existing exam-flow code for the core hooks (state, title, heartbeat, open segment, termination, recording completion, Today rows). ESLint forbids core imports of solution folders, and a ratchet test lists the core files that still import the exam engine." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Core candidate routes and proctoring through the registry

**Files:**
- Modify: `src/lib/candidate-api.ts`, `src/server/proctoring.ts`, `src/solutions/boundary.test.ts`
- Modify routes: `src/app/api/c/[token]/{consent,info,state,device-check,heartbeat,problem,media/complete}/route.ts`, `src/app/api/c/[token]/proctor/{events,evidence,heartbeat,session}/route.ts`

**Interfaces:**
- Produces in `@/lib/candidate-api`: `type SolutionHandler = (req: NextRequest, ctx: CandidateContext, solution: SolutionModule) => Promise<Response>`, `withSolution(req, params, handler, options?)`.
- Changes in `@/server/proctoring`: `heartbeat(solution: SolutionModule, attemptId, sessionId, state)`, `ingestEvents(ctx: CandidateContext, solution: SolutionModule, attempt, sessionId, raw, clientOffsetMs)`, `terminateAttempt(solution: SolutionModule, attemptId, reason)`; `registerSession` and `storeEvidence` take the core `CandidateContext`.

- [ ] **Step 1: Shrink the ratchet first (test fails)**

Delete these lines from `KNOWN_COUPLINGS` in `src/solutions/boundary.test.ts`: `consent`, `device-check`, `heartbeat`, `info`, `media/complete`, `problem`, the four `proctor/*` routes, `state`, and `src/server/proctoring.ts`.

Run: `pnpm exec vitest run src/solutions/boundary.test.ts`
Expected: FAIL, the received list still contains those 12 files.

- [ ] **Step 2: `withSolution`**

In `src/lib/candidate-api.ts` add the imports
```ts
import { solutionModule } from "@/solutions/registry.server";
import type { SolutionModule } from "@/solutions/types";
```
and after `withCandidate`:
```ts
export type SolutionHandler = (
  req: NextRequest,
  ctx: CandidateContext,
  solution: SolutionModule,
) => Promise<Response>;

/**
 * `withCandidate` for core endpoints whose answer depends on the solution
 * (state, consent, proctoring). An invitation of a solution with no registered
 * module gets the unknown-token 404.
 */
export function withSolution(
  req: NextRequest,
  params: Promise<{ token: string }>,
  handler: SolutionHandler,
  options: CandidateRouteOptions = {},
): Promise<Response> {
  return withCandidate(
    req,
    params,
    async (request, ctx) => {
      const solution = solutionModule(ctx.assessment.solution);
      if (!solution) return notFoundForSolution(ctx);
      return handler(request, ctx, solution);
    },
    options,
  );
}
```

- [ ] **Step 3: Proctoring without the exam engine**

In `src/server/proctoring.ts`:
- Replace the exam-flow import with
```ts
import type { CandidateContext } from "@/lib/candidate-context";
import type { SegmentRef, SolutionModule } from "@/solutions/types";
```
  and remove `sectionRuns` from the schema import; add nothing else.
- Delete `runningSectionRunId`.
- Replace `heartbeat` with:
```ts
export async function heartbeat(
  solution: SolutionModule,
  attemptId: string,
  sessionId: unknown,
  state: Record<string, unknown>,
) {
  const session = await ownedSession(attemptId, sessionId);
  if (!session) return null;
  const now = new Date();
  const gap = now.getTime() - session.lastSeenAt.getTime();
  // Only a gap inside a running segment means anything: between sections and
  // on the check screen the candidate may simply be reading.
  if (gap > HEARTBEAT_GAP_MS && (await solution.attempts.openSegment(attemptId))) {
    await serverEvent(attemptId, "HEARTBEAT_GAP", { gapMs: gap }, session.lastSeenAt, now);
  }
  await db
    .update(proctorSessions)
    .set({ lastSeenAt: now, lastState: state })
    .where(eq(proctorSessions.id, session.id));
  return { serverNow: now.getTime() };
}
```
- Replace `ingestEvents` with:
```ts
export async function ingestEvents(
  ctx: CandidateContext,
  solution: SolutionModule,
  attempt: typeof attempts.$inferSelect,
  sessionId: unknown,
  raw: unknown,
  clientOffsetMs: number,
) {
  const session = await ownedSession(attempt.id, sessionId);
  const now = Date.now();
  const { accepted } = normalizeBatch(raw, {
    now,
    attemptStartedAt: (attempt.startedAt ?? attempt.createdAt).getTime(),
    clientOffsetMs: Number.isFinite(clientOffsetMs) ? clientOffsetMs : 0,
  });
  const segment = await solution.attempts.openSegment(attempt.id);
  const policy = await solution.proctorPolicy(ctx.assessment.id);
  for (const e of accepted) {
    const stored = await upsertEvent(attempt.id, session?.id ?? null, segment, e);
    if (stored.fresh && policy?.aiSecondLook && TAXONOMY[e.type].aiReview) {
      await maybeQueueReview(attempt.id, stored.id, policy.maxAiReviewsPerAttempt);
    }
  }
  await recomputeIntegrity(attempt.id);
  return checkTermination(solution, policy, attempt.id);
}
```
- In `upsertEvent` change the parameter `sectionRunId: string | null` to `segment: SegmentRef | null`, and the insert values `sectionRunId, segmentKind: ..., segmentRunId: sectionRunId,` to
```ts
      // Dual write until migration 0003 (Task 8).
      sectionRunId: segment?.kind === "section_run" ? segment.runId : null,
      segmentKind: segment?.kind ?? null,
      segmentRunId: segment?.runId ?? null,
```
- Replace `checkTermination` and `terminateAttempt` with:
```ts
async function checkTermination(
  solution: SolutionModule,
  policy: Awaited<ReturnType<SolutionModule["proctorPolicy"]>>,
  attemptId: string,
): Promise<boolean> {
  if (!policy?.termination.enabled) return false;
  const events = await db
    .select({ type: proctorEvents.type, startedAt: proctorEvents.startedAt, endedAt: proctorEvents.endedAt })
    .from(proctorEvents)
    .where(eq(proctorEvents.attemptId, attemptId));
  const decision = shouldTerminate(
    events.map((e) => ({ type: e.type, startedAt: e.startedAt.getTime(), endedAt: e.endedAt?.getTime() ?? null })),
    policy,
    Date.now(),
  );
  if (!decision.terminate) return false;
  await terminateAttempt(solution, attemptId, decision.reason ?? "POLICY");
  return true;
}

export async function terminateAttempt(solution: SolutionModule, attemptId: string, reason: string) {
  const updated = await db
    .update(attempts)
    .set({ terminatedAt: new Date(), terminationReason: reason })
    .where(and(eq(attempts.id, attemptId), sql`${attempts.terminatedAt} is null`))
    .returning();
  if (updated.length === 0) return;
  await serverEvent(attemptId, "TERMINATED", { reason });
  await solution.attempts.terminate(attemptId);
}
```
- `registerSession(ctx: CandidateContext, ...)` and `storeEvidence(ctx: CandidateContext, ...)` keep their bodies; only the type now comes from candidate-context.

- [ ] **Step 4: Core routes**

Each route below: `import { withSolution, ... } from "@/lib/candidate-api";` replaces `withExamCandidate`; remove the `@/lib/exam-candidate-api` and `@/lib/exam-flow` imports; handler signature `async (request, ctx, solution) => ...`. Full handler bodies:

`state/route.ts`:
```ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(req, params, async (_req, ctx, solution) => candidateJson(await solution.candidate.loadState(ctx)));
}
```

`consent/route.ts`: `GET` uses `withCandidate` (core only: `getConsentText`, `hasConsented` from candidate-context); `POST`:
```ts
  return withSolution(req, params, async (request, ctx, solution) => {
    const body = await readJson<{ accepted?: boolean }>(request);
    if (!body?.accepted) {
      return badRequest(ctx, "CONSENT_REQUIRED");
    }
    if (!(await hasConsented(ctx.assessment.id))) {
      const text = await getConsentText(ctx);
      await recordConsent(ctx, text.id, clientIp(request), userAgent(request));
    }
    return candidateJson(await solution.candidate.loadState(ctx));
  });
```

`info/route.ts`: wrap with `withSolution`, last line `return candidateJson(await solution.candidate.loadState(ctx));` (the `ctx.candidate = {...}` update before it stays).

`device-check/route.ts`:
```ts
import { currentAttempt, recordDeviceCheck } from "@/lib/candidate-context";
// ...
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(req, params, async (_request, ctx, solution) => {
    const { attempt, finished } = await currentAttempt(ctx.assessment);
    if (finished) return conflict(ctx, "ALREADY_COMPLETED");
    const policy = await solution.proctorPolicy(ctx.assessment.id);
    if (policy && policy.preset !== "OFF") {
      const [session] = await db
        .select({ id: proctorSessions.id })
        .from(proctorSessions)
        .where(eq(proctorSessions.attemptId, attempt.id))
        .limit(1);
      if (!session) return conflict(ctx, "SESSION_INVALID");
      if (policy.camera) {
        const [reference] = await db
          .select({ id: proctorEvidence.id })
          .from(proctorEvidence)
          .where(and(eq(proctorEvidence.attemptId, attempt.id), eq(proctorEvidence.trigger, "REFERENCE")))
          .limit(1);
        if (!reference) return conflict(ctx, "EVIDENCE_INVALID");
      }
    }
    await recordDeviceCheck(attempt.id);
    return candidateJson(await solution.candidate.loadState(ctx));
  });
}
```

`heartbeat/route.ts`:
```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withSolution(
    req,
    params,
    async (_request, ctx, solution) => {
      const { deadlineAt } = await solution.candidate.heartbeat(ctx);
      const now = new Date();
      return candidateJson({
        serverNow: now.toISOString(),
        deadlineAt: deadlineAt?.toISOString() ?? null,
        remainingMs: deadlineAt ? Math.max(0, deadlineAt.getTime() - now.getTime()) : null,
      });
    },
    { limit: 120 },
  );
}
```
(Remove the now unused `db`, `eq`, `sectionRuns` imports.)

`problem/route.ts`: `withSolution(req, params, async (request, ctx, solution) => { ... }, { limit: 5, windowMs: 60_000, allowProblems: ["EXPIRED", "NOT_YET", "COMPLETED"] })`; the line `` `Sınav: ${ctx.assessment.examName}\n` + `` becomes `` `Sınav: ${await solution.candidate.title(ctx)}\n` + `` (same text for the exam; hiring will need a neutral label, noted for sub-project 3).

`proctor/session/route.ts`:
```ts
import { currentAttempt } from "@/lib/candidate-context";
import { policyFromPreset } from "@/lib/proctor/policy";
// ...
  return withSolution(req, params, async (request, ctx, solution) => {
    const body = await readJson<Body>(request);
    const { attempt, finished } = await currentAttempt(ctx.assessment);
    if (finished) return conflict(ctx, "ALREADY_COMPLETED");
    if (typeof body?.clientSessionId !== "string" || body.clientSessionId.length < 8)
      return conflict(ctx, "SESSION_INVALID");
    const env = body.env && typeof body.env === "object" ? body.env : {};
    if (JSON.stringify(env).length > 4000) return conflict(ctx, "SESSION_INVALID");
    const session = await registerSession(ctx, attempt.id, body.clientSessionId, env, clientIp(request));
    return candidateJson({
      sessionId: session.id,
      // A solution without proctoring hands the tab the OFF preset, which starts nothing.
      policy: (await solution.proctorPolicy(ctx.assessment.id)) ?? policyFromPreset("OFF"),
      serverNow: Date.now(),
      devFakeMedia: process.env.NODE_ENV !== "production" && process.env.PROCTOR_DEV_FAKE === "1",
      maxFrameBytes: 512 * 1024,
    });
  });
```

`proctor/evidence/route.ts`: `withSolution(req, params, async (request, ctx, solution) => {...}, { limit: 240 })`; replace `if (ctx.assessment.config.proctoring.preset === "OFF") return badRequest(ctx, "EVIDENCE_INVALID");` with
```ts
      const policy = await solution.proctorPolicy(ctx.assessment.id);
      if (!policy || policy.preset === "OFF") return badRequest(ctx, "EVIDENCE_INVALID");
```
and `workingAttempt(ctx.assessment.id)` with `currentAttempt(ctx.assessment)` (import from `@/lib/candidate-context`).

`proctor/events/route.ts`: `withSolution(..., async (request, ctx, solution) => {...}, { limit: 300 })`; `currentAttempt(ctx.assessment)`; `ingestEvents(ctx, solution, attempt, body.sessionId, body.events, Number(body.clientOffsetMs ?? 0))`.

`proctor/heartbeat/route.ts`: `withSolution(..., { limit: 120 })`; `currentAttempt(ctx.assessment)`; `heartbeat(solution, attempt.id, body?.sessionId, state)`.

`media/complete/route.ts`: `withSolution(req, params, async (request, ctx, solution) => {...}, { allowProblems: ["COMPLETED"] })`; replace the whole `if (asset.itemResponseId) { ... }` block with `await solution.attempts.onMediaComplete(asset);`; remove the `db`, `eq`, `itemResponses`, `reopenGradingForMedia` imports.

- [ ] **Step 5: Tests, gates, live checks**

```bash
pnpm exec vitest run src/solutions/boundary.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
With the dev server running on `kademe_platform` (restart it so it picks up the change):
```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
```
Expected: boundary PASS; all gates pass; both verify scripts print `All checks passed.`

Live proctoring check with Claude in Chrome (dev server started with `PROCTOR_DEV_FAKE=1` in its shell only): create a link (`DATABASE_URL=... pnpm dev:link`), go through consent, info and the system check to the first section, switch tabs twice, wait 20 seconds. Then:
```bash
docker exec kademe-db psql -U kademe -d kademe_platform -Atc "select type, segment_kind, segment_run_id is not null, section_run_id is not null from proctor_events order by started_at desc limit 5"
```
Expected: the tab-switch events inside the running section show `section_run|t|t`; events from the check screen show `||f|f`. Restart the dev server without `PROCTOR_DEV_FAKE` afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/lib/candidate-api.ts src/server/proctoring.ts src/solutions/boundary.test.ts "src/app/api/c/[token]"
git commit -m "Route core candidate endpoints and proctoring through the solution registry" -m "State, consent, info, device check, heartbeat, problem reports, proctoring and recording completion ask the invitation's solution module instead of the exam engine. Proctor events record segment_kind and segment_run_id from the module. An invitation whose solution has no module gets the unknown-token 404." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Readers use the new homes (exam_assessments, attempt_id)

**Files:**
- Modify: `src/lib/exam-flow.ts` (`closeSectionRun`), `src/lib/exam-results.ts` (`recomputeResult`, `finalizeResult`), `src/server/panel.ts` (`listStudents`, `loadResultView`), `src/app/(manager)/exams/page.tsx`, `src/lib/retention.ts`, `src/lib/transcribe-job.ts`, `src/lib/candidate-media.ts` (`resolveOwnedMedia`), `scripts/verify-retention.ts`

**Interfaces:**
- `loadResultView` keeps returning `assessment` with `blueprintSnapshot`, `blueprintName`, `mode`, `claimedLevel` (now taken from `exam_assessments`), so `students/[id]/page.tsx` does not change.
- `resolveOwnedMedia(ctx, uploadRef)` returns `{ asset } | null` (the unused `run` is dropped).

- [ ] **Step 1: Exam terms**

`src/lib/exam-flow.ts` `closeSectionRun`: replace
```ts
  const [ctxRow] = await db
    .select({ assessment: assessments, attempt: attempts })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.id, run.attemptId));
  const cfg = ctxRow.assessment.blueprintSnapshot;
  const s = cfg.sections.find((x) => x.section === run.section)!;
  const mode = ctxRow.assessment.mode;
  const claimedLevel = ctxRow.assessment.claimedLevel;
```
with
```ts
  const [ctxRow] = await db
    .select({ exam: examAssessments })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, run.attemptId));
  const cfg = ctxRow.exam.blueprintSnapshot;
  const s = cfg.sections.find((x) => x.section === run.section)!;
  const mode = ctxRow.exam.mode;
  const claimedLevel = ctxRow.exam.claimedLevel;
```
and remove `assessments` from the schema import if nothing else in the file uses it (`grep -n "assessments\b" src/lib/exam-flow.ts`).

`src/lib/exam-results.ts`: add `examAssessments` to the schema import. In `recomputeResult` replace the head query with
```ts
  const [row] = await db
    .select({ attempt: attempts, exam: examAssessments })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
  if (!row) return;
  const cfg = row.exam.blueprintSnapshot;
```
and in its `computeResult({ ... })` call use `mode: row.exam.mode, claimed: row.exam.claimedLevel,`. In `finalizeResult` replace the config query with
```ts
  const [assessment] = await db
    .select({ config: examAssessments.blueprintSnapshot })
    .from(attempts)
    .innerJoin(examAssessments, eq(examAssessments.assessmentId, attempts.assessmentId))
    .where(eq(attempts.id, attemptId));
```
Check for any other `row.assessment` use in `recomputeResult` (`grep -n "row.assessment" src/lib/exam-results.ts`) and point it at `row.exam` or `row.attempt` as appropriate; remove `assessments` from the import if unused.

`src/server/panel.ts`: add `examAssessments` to the schema import.
- `listStudents`: add `exam: examAssessments,` to the select and `.innerJoin(examAssessments, eq(examAssessments.assessmentId, assessments.id))` after the candidates join; in the mapper destructure `exam` and use `exam.blueprintSnapshot.proctoring.preset`, `examName: exam.blueprintName`, `mode: exam.mode`, `claimed: exam.claimedLevel`.
- `loadResultView`: add `exam: examAssessments` to the select and the same inner join; `const cfg = head.exam.blueprintSnapshot;`; in the returned object replace `assessment: head.assessment,` with
```ts
    // The page reads the exam terms as fields of the invitation, as before.
    assessment: {
      ...head.assessment,
      blueprintId: head.exam.blueprintId,
      blueprintName: head.exam.blueprintName,
      blueprintSnapshot: head.exam.blueprintSnapshot,
      mode: head.exam.mode,
      claimedLevel: head.exam.claimedLevel,
    },
```

`src/app/(manager)/exams/page.tsx` counts: replace with
```ts
  const counts = await db
    .select({ id: examAssessments.blueprintId, n: sql<number>`count(*)::int` })
    .from(examAssessments)
    .innerJoin(assessments, eq(assessments.id, examAssessments.assessmentId))
    .where(eq(assessments.orgId, user.orgId))
    .groupBy(examAssessments.blueprintId);
```
(add `examAssessments` to its schema import).

- [ ] **Step 2: Recordings by attempt**

`src/lib/retention.ts`: in `planSoftMedia` (both queries) replace
```ts
    .leftJoin(sectionRuns, eq(sectionRuns.id, mediaAssets.sectionRunId))
    .leftJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
```
with
```ts
    .leftJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
```
and in `candidateMediaKeys` and `countCandidateObjects` replace
```ts
    .innerJoin(sectionRuns, eq(sectionRuns.id, mediaAssets.sectionRunId))
    .innerJoin(attempts, eq(attempts.id, sectionRuns.attemptId))
```
with
```ts
    .innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
```
Remove `sectionRuns` from the import. Update the comment above `MEDIA_ANCHOR_SQL`'s caller that mentions "an upload not attached to any stage run" to "an upload whose attempt has no terminal decision".

`src/lib/transcribe-job.ts` `runTranscription`: the same replacement of the two joins with `.leftJoin(attempts, eq(attempts.id, mediaAssets.attemptId))`; remove `sectionRuns` from its import.

`src/lib/candidate-media.ts` `resolveOwnedMedia`:
```ts
export async function resolveOwnedMedia(ctx: CandidateContext, uploadRef: unknown) {
  if (typeof uploadRef !== "string" || uploadRef.length !== 36) return null;
  const [row] = await db
    .select({ asset: mediaAssets })
    .from(mediaAssets)
    .innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))
    .where(and(eq(mediaAssets.id, uploadRef), eq(attempts.assessmentId, ctx.assessment.id)))
    .limit(1);
  return row ?? null;
}
```

`scripts/verify-retention.ts:71-72`: replace the two joins with `.innerJoin(attempts, eq(attempts.id, mediaAssets.attemptId))`; remove `sectionRuns` from its destructured import if now unused.

`src/lib/close-expired.ts` is deliberately unchanged: salvage reads the section clock (`deadlineAt`, `lastHeartbeatAt`, `completion`) through `media_assets.section_run_id`, which stays as the exam's own link (spec 2.1 item 4). A hiring recording has no section run and is handled by `decideSalvage({ run: null })`, as today.

- [ ] **Step 3: Prove no exam-term reader is left on `assessments`**

```bash
grep -rnE "assessments\.(blueprintId|blueprintName|blueprintSnapshot|mode|claimedLevel)|\.assessment\.(blueprintSnapshot|blueprintName)|mediaAssets\.sectionRunId" src scripts
```
Expected: only `src/server/invite.ts` (the dual write, removed in Task 8), `src/db/seed.ts` (dual write), `src/db/schema/assessment.ts` (definitions), `src/lib/candidate-media.ts` (`sectionRunId: run.id` insert) and `src/lib/close-expired.ts:81`. `src/app/(manager)/students/[id]/page.tsx` reads `assessment.blueprintSnapshot` from `loadResultView`, which is now fed by `exam_assessments`.

- [ ] **Step 4: Gates and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm exec tsx scripts/verify-retention.ts
git add src/lib/exam-flow.ts src/lib/exam-results.ts src/server/panel.ts "src/app/(manager)/exams/page.tsx" src/lib/retention.ts src/lib/transcribe-job.ts src/lib/candidate-media.ts scripts/verify-retention.ts
git commit -m "Read exam terms from exam_assessments and recordings by attempt" -m "The engine, results, panel read models and the usage count read the exam's own table. Retention, transcription and upload ownership find a recording's attempt through media_assets.attempt_id instead of section runs. Salvage keeps the section clock on purpose." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: `verify:exam` passes; `verify-retention.ts` exits 0 (read `scripts/verify-retention.ts` first: it is a dry-run comparison; if it reports it needs data it does not have, record that output in the commit body instead of seeding).

---

### Task 8: Contract migration 0003, end of dual writes, backup and restore rehearsal

**Files:**
- Modify: `src/db/schema/assessment.ts`, `src/db/schema/proctoring.ts`
- Create: `drizzle/migrations/0003_platform_contract.sql` (generated, kept as generated), snapshot, journal entry
- Modify: `src/db/migrations-sql.test.ts`, `src/server/invite.ts`, `src/server/proctoring.ts`, `src/db/seed.ts`

**Interfaces:**
- After this task `assessments` has no exam columns and `proctor_events` has no `section_run_id`; any leftover reader is a `tsc` error.

- [ ] **Step 1: Failing SQL test**

Append to `src/db/migrations-sql.test.ts`:
```ts
describe("0003_platform_contract", () => {
  const sql = read("0003_platform_contract");
  it("drops exactly the columns that moved, and nothing else", () => {
    const drops = [...sql.matchAll(/ALTER TABLE "(\w+)" DROP COLUMN "(\w+)"/g)].map((m) => `${m[1]}.${m[2]}`).sort();
    expect(drops).toEqual([
      "assessments.blueprint_id",
      "assessments.blueprint_name",
      "assessments.blueprint_snapshot",
      "assessments.claimed_level",
      "assessments.mode",
      "proctor_events.section_run_id",
    ]);
    expect(sql).not.toMatch(/DROP TABLE/);
  });
});
```
Run: `pnpm exec vitest run src/db/migrations-sql.test.ts` - Expected: FAIL (file missing).

- [ ] **Step 2: Remove the deprecated columns and generate**

In `src/db/schema/assessment.ts` delete the five `/** DEPRECATED ... */` columns from `assessments`; remove imports that become unused (`examBlueprints`, `BlueprintConfig`, `examMode`, `cefrLevel`, `jsonb` only if unused elsewhere in the file: check each with grep). Update the doc comment above `assessments` to: "One person invited to one solution's assessment. Solution-specific terms live in the solution's own table (exam_assessments for the language exam)." In `src/db/schema/proctoring.ts` delete the deprecated `sectionRunId` column and `sectionRuns` from its import.

```bash
pnpm db:generate --name platform_contract < /dev/null
cat drizzle/migrations/0003_platform_contract.sql
pnpm exec vitest run src/db/migrations-sql.test.ts
```
Expected: no prompt; the SQL drops the two foreign keys (`assessments_blueprint_id_exam_blueprints_id_fk`, `proctor_events_section_run_id_section_runs_id_fk`) and the six columns; tests PASS. Keep the file as generated.

- [ ] **Step 3: Stop dual writing**

- `src/server/invite.ts`: delete the five dual-write lines and the comment from the `assessments` insert.
- `src/server/proctoring.ts` `upsertEvent`: delete the `sectionRunId:` line and its comment.
- `src/db/seed.ts`: delete the dual-write `s.assessments` update and its comment.

```bash
pnpm exec tsc --noEmit
```
Expected: clean. A type error here is a reader Task 7 missed: fix it the Task 7 way (read `exam_assessments` or `attempt_id`), never by restoring a column.

- [ ] **Step 4: Fingerprint and working database**

```bash
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_push_check" -c "create database kademe_push_check" -c "drop database if exists kademe_mig_check" -c "create database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm exec drizzle-kit push --force < /dev/null
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_push_check pnpm -s db:fingerprint > /tmp/kademe-push.fp
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_mig_check pnpm -s db:fingerprint > /tmp/kademe-mig.fp
diff /tmp/kademe-push.fp /tmp/kademe-mig.fp && echo IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_push_check" -c "drop database kademe_mig_check"
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm db:migrate
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:migration check /tmp/kademe-platform-before-0001.json
```
Expected: `IDENTICAL`. The `check` against the Task 2 capture may now report different `assessments`/`attempts`/`media`/`events` counts, because Tasks 2-7 ran `verify:exam` and created invitations on `kademe_platform`; the digests `examTerms`, `mediaAttempts`, `eventSegments` will differ for the same reason. That is expected here; the real proof is Step 5.

- [ ] **Step 5: Backup and restore rehearsal on a fresh copy (local 5434 only)**

This rehearses on an untouched copy of `kademe` what a production rollout would do, from backup to verified result. Production itself is not touched.

```bash
STAMP=$(date +%Y%m%d-%H%M)
docker exec kademe-db pg_dump -U kademe -Fc kademe > ~/kademe-backups/kademe-local-$STAMP.dump
ls -l ~/kademe-backups/kademe-local-$STAMP.dump

# 1. Restore into a scratch database and capture the old shape.
docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_rehearsal" -c "create database kademe_rehearsal"
docker exec -i kademe-db pg_restore -U kademe -d kademe_rehearsal --no-owner < ~/kademe-backups/kademe-local-$STAMP.dump
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_rehearsal pnpm verify:migration capture /tmp/kademe-rehearsal-before.json

# 2. Migrate it exactly as production would be migrated, and check the data.
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_rehearsal pnpm db:migrate --adopt-baseline
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_rehearsal pnpm verify:migration check /tmp/kademe-rehearsal-before.json

# 3. Prove the backup restores: drop, restore again, capture, compare.
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_rehearsal" -c "create database kademe_rehearsal"
docker exec -i kademe-db pg_restore -U kademe -d kademe_rehearsal --no-owner < ~/kademe-backups/kademe-local-$STAMP.dump
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_rehearsal pnpm verify:migration capture /tmp/kademe-rehearsal-restored.json
diff /tmp/kademe-rehearsal-before.json /tmp/kademe-rehearsal-restored.json && echo RESTORE_IDENTICAL
docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_rehearsal"
```
Expected: step 2 prints `adopted 0000_baseline as already applied`, `migrations applied`, then only `ok` lines (including `managers` unchanged, `nonExam: 0`, `attemptMismatch: 0`, `mediaWithoutAttempt: 0`); step 3 prints `RESTORE_IDENTICAL`. Paste the step 2 output into the commit body. The dump stays in `~/kademe-backups/`, outside the repo, and is never uploaded anywhere.

- [ ] **Step 6: Gates and commit**

```bash
pnpm exec eslint src scripts && pnpm test && pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
git add src/db/schema drizzle/migrations src/db/migrations-sql.test.ts src/server/invite.ts src/server/proctoring.ts src/db/seed.ts
git commit -m "Drop the moved columns (migration 0003)" -m "assessments loses the exam columns and proctor_events loses section_run_id; writers stop dual writing and tsc confirms no reader is left. Rehearsed on a fresh restore of the local database: adopt, migrate, data check all ok, and the backup restores to identical facts." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Exam panel pages under /exam, with redirects

**Files:**
- Move: `src/app/(manager)/students` to `src/app/(manager)/exam/students`, `exams` to `exam/exams`, `bank` to `exam/bank`
- Modify (path strings and action imports): every moved file, `src/app/(manager)/dashboard/page.tsx`, `src/app/(manager)/layout.tsx`, `src/components/panel/{blueprint-editor,generate-form,invite-form}.tsx`, `src/components/panel/result/{grading-card,integrity-panel}.tsx`
- Modify: `src/lib/legacy-routes.ts`, `src/lib/legacy-routes.test.ts`, `next.config.ts`, `src/solutions/boundary.test.ts` (exempt pattern stays valid)

**Interfaces:**
- Produces `LEGACY_PANEL_REDIRECTS` in `@/lib/legacy-routes`.
- Panel URLs: `/exam/students`, `/exam/students/new`, `/exam/students/[id]`, `/exam/exams`, `/exam/exams/new`, `/exam/exams/[id]`, `/exam/bank`, `/exam/bank/[id]`.

- [ ] **Step 1: Failing tests for redirects and menu targets**

In `src/lib/legacy-routes.test.ts`, change the import from `./legacy-routes` to `import { LEGACY_CANDIDATE_API_REWRITES, LEGACY_PANEL_REDIRECTS } from "./legacy-routes";`, add `import { SOLUTION_MANIFESTS } from "@/solutions/registry";` next to it, and append:
```ts
const manager = path.resolve(process.cwd(), "src/app/(manager)");

describe("legacy panel redirects", () => {
  it.each(LEGACY_PANEL_REDIRECTS)("$source goes to an existing page", ({ source, destination, permanent }) => {
    const base = destination.replace("/:path*", "");
    expect(existsSync(path.join(manager, base, "page.tsx")), base).toBe(true);
    expect(existsSync(path.join(manager, source.replace("/:path*", "")))).toBe(false);
    expect(permanent).toBe(false);
  });
});

describe("menu", () => {
  it("links only to pages that exist (RULES.md rule 7)", () => {
    for (const m of SOLUTION_MANIFESTS) {
      for (const href of [...m.nav.map((n) => n.href), m.inviteHref]) {
        expect(existsSync(path.join(manager, href, "page.tsx")), href).toBe(true);
      }
    }
  });
});
```
(The `SOLUTION_MANIFESTS` import pulls only client-safe modules; no database mock is needed.)

Run: `pnpm exec vitest run src/lib/legacy-routes.test.ts`
Expected: FAIL (`LEGACY_PANEL_REDIRECTS` is not exported; `/exam/students` has no page).

- [ ] **Step 2: Move the folders and rewrite paths**

```bash
mkdir -p "src/app/(manager)/exam"
git mv "src/app/(manager)/students" "src/app/(manager)/exam/students"
git mv "src/app/(manager)/exams" "src/app/(manager)/exam/exams"
git mv "src/app/(manager)/bank" "src/app/(manager)/exam/bank"
cat > /tmp/kademe-panel-paths.mjs <<'EOF'
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const f = path.join(dir, n);
  return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
});
for (const file of walk("src")) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replace(/@\/app\/\(manager\)\/(students|exams|bank)\//g, "@/app/(manager)/exam/$1/")
    .replace(/(["'`])\/(students|exams|bank)(?=[/"'`?])/g, "$1/exam/$2");
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`rewrote ${file}`);
  }
}
EOF
node /tmp/kademe-panel-paths.mjs
grep -rnE "[\"'\`]/(students|exams|bank)\b|@/app/\(manager\)/(students|exams|bank)/" src
```
Expected: the script lists the files named in this task (moved pages and actions, dashboard, layout, five panel components); the final grep prints nothing. Review `git diff` for any rewritten string that was not a panel path (none expected: the only `"/bank`-like strings in `src` are panel paths, checked with grep on 2026-10-04).

- [ ] **Step 3: Redirects**

Append to `src/lib/legacy-routes.ts`:
```ts
/**
 * Panel: the exam pages moved under /exam (spec 4). Old bookmarks and links
 * pasted into chats keep working. Temporary (307) on purpose: HIRING-UX may
 * still rename the exam paths, and a cached 308 cannot be taken back.
 * `:path*` also matches the bare path, and the query string passes through.
 */
export const LEGACY_PANEL_REDIRECTS = [
  { source: "/students/:path*", destination: "/exam/students/:path*", permanent: false },
  { source: "/exams/:path*", destination: "/exam/exams/:path*", permanent: false },
  { source: "/bank/:path*", destination: "/exam/bank/:path*", permanent: false },
];
```
In `next.config.ts` import `LEGACY_PANEL_REDIRECTS` too and add:
```ts
  /** See src/lib/legacy-routes.ts. Redirects run before the filesystem (redirects.md). */
  async redirects() {
    return LEGACY_PANEL_REDIRECTS;
  },
```

Run: `pnpm exec vitest run src/lib/legacy-routes.test.ts src/solutions/boundary.test.ts`
Expected: PASS.

- [ ] **Step 4: Gates and HTTP check**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
With the dev server on `kademe_platform` (restart it after the move; Turbopack may need a clean `.next/dev`, per STATUS "Bilinen küçük pürüzler"):
```bash
COOKIE=$(DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform npx tsx scripts/dev-session.ts)
for p in /students /students/new "/students?tab=final" /exams /exams/new /bank; do curl -s -o /dev/null -w "$p %{http_code} %{redirect_url}\n" -H "Cookie: $COOKIE" "http://localhost:3100$p"; done
for p in /dashboard /exam/students /exam/students/new /exam/exams /exam/exams/new /exam/bank /settings; do curl -s -o /dev/null -w "$p %{http_code}\n" -H "Cookie: $COOKIE" "http://localhost:3100$p"; done
```
Expected: the first loop prints `307` with `http://localhost:3100/exam/...` (query kept); the second prints `200` for every path.

- [ ] **Step 5: Commit**

```bash
git add -A "src/app/(manager)" src/components/panel src/lib/legacy-routes.ts src/lib/legacy-routes.test.ts next.config.ts
git commit -m "Move the exam panel pages under /exam" -m "Students, exams and the question bank live at /exam/students, /exam/exams and /exam/bank; links, revalidations and action imports follow. The old paths redirect (307, query kept). A test keeps every menu entry pointing at a page that exists." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(`git add -A` is limited to the listed paths, which this task owns.)

---

### Task 10: Grouped sidebar (HIRING-UX 4.1) and the shared Today screen

Requires the UI foundation plan merged (`@/components/ui/sidebar`, `@/hooks/use-mobile` at 1024px, `bg-brand-soft`, `bg-sidebar`).

**Files:**
- Modify: `src/components/manager/nav.tsx` (whole file), `src/app/(manager)/layout.tsx` (whole file), `src/app/(manager)/dashboard/page.tsx` (whole file), `src/server/panel.ts` (remove `expiringLinks`), `src/solutions/boundary.test.ts`
- Create: `src/server/links.ts`

**Interfaces:**
- Consumes: `buildNav`, `NavGroupView` (registry), `solutionModules()` (registry.server), `TodayItem`, `TodayCell` (types).
- Produces: `expiringLinks(orgId)` in `@/server/links` (same query as before).

- [ ] **Step 1: Shrink the ratchet (test fails)**

Delete `"src/app/(manager)/dashboard/page.tsx",` from `KNOWN_COUPLINGS`.
Run: `pnpm exec vitest run src/solutions/boundary.test.ts` - Expected: FAIL (dashboard still imports `@/server/panel`).

- [ ] **Step 2: Move `expiringLinks`**

Create `src/server/links.ts` with the function moved verbatim from `src/server/panel.ts:164-180`:
```ts
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { assessmentLinks, assessments, candidates } from "@/db/schema";

/** Links nobody opened that lapse within 48 hours. Core: any solution's invitations. */
export async function expiringLinks(orgId: string) {
  const soon = new Date(Date.now() + 48 * 3600_000);
  return db
    .select({ link: assessmentLinks, name: candidates.fullName, assessmentId: assessments.id })
    .from(assessmentLinks)
    .innerJoin(assessments, eq(assessments.id, assessmentLinks.assessmentId))
    .innerJoin(candidates, eq(candidates.id, assessments.candidateId))
    .where(
      and(
        eq(assessments.orgId, orgId),
        eq(assessmentLinks.status, "NOT_STARTED"),
        lt(assessmentLinks.expiresAt, soon),
        gt(assessmentLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(assessmentLinks.expiresAt));
}
```
Delete it from `src/server/panel.ts` and drop imports there that become unused (`gt`, `lt` if unused: let ESLint tell you). `grep -rn "expiringLinks" src` must show only `links.ts` and the dashboard.

- [ ] **Step 3: The sidebar**

```tsx
// src/components/manager/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import type { NavGroupView } from "@/solutions/registry";

/**
 * HIRING-UX 4.1: one panel, a grouped side menu, no mode switch. The active
 * item is one of the three places the accent colour may appear: accent text on
 * the brand-soft ground with a 2px accent line on the left. Hover is the
 * neutral sidebar ground, never green.
 */
const ACTIVE =
  "relative data-[active=true]:bg-brand-soft data-[active=true]:font-medium data-[active=true]:text-accent " +
  "data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 " +
  "data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-accent";

export function ManagerNav({ groups, footer }: { groups: NavGroupView[]; footer: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight text-ink">
          Kademe
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key} className={group.key === "settings" ? "mt-auto border-t border-line" : undefined}>
            {group.label ? (
              <SidebarGroupLabel className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} className={cn("h-9 text-[13.5px] text-ink-2", ACTIVE)}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          {item.label}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-line px-4 py-3">{footer}</SidebarFooter>
    </Sidebar>
  );
}
```

```tsx
// src/app/(manager)/layout.tsx
import Link from "next/link";
import { requireUser } from "@/server/session";
import { ManagerNav } from "@/components/manager/nav";
import { LangSwitch } from "@/components/manager/lang-switch";
import { ManagerIntl } from "@/components/manager/Intl";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";
import { buildNav } from "@/solutions/registry";

/**
 * Panel shell (HIRING-UX 4.1): a 240px grouped side menu (Today, one group per
 * solution, Settings) and the page. Below 1024px the menu becomes a sheet
 * opened from a top bar. The menu comes from the solution registry and lists
 * only routes that exist; a test checks every entry against its page file.
 */
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  // Locale aware on purpose: `toUpperCase()` turns "İpek" into "IPEK".
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase(locale === "tr" ? "tr" : "en");
  const groups = buildNav(locale, { today: t("nav.dashboard"), settings: t("nav.settings") });

  return (
    <SidebarProvider lang={locale} style={{ "--sidebar-width": "240px" } as React.CSSProperties}>
      <ManagerNav
        groups={groups}
        footer={
          <div className="flex items-center gap-2.5">
            <LangSwitch locale={locale} />
            <span className="truncate text-[13px] text-muted">{user.name}</span>
            <span
              className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-[11px] font-semibold text-muted"
              aria-hidden
            >
              {initials}
            </span>
          </div>
        }
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <SidebarTrigger />
          <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
            Kademe
          </Link>
        </header>
        <ManagerIntl locale={locale}>{children}</ManagerIntl>
      </div>
    </SidebarProvider>
  );
}
```

`SidebarProvider` (radix-nova, checked in the scratch copy) takes `React.ComponentProps<"div">`, spreads the rest onto its wrapper `div` and applies `style` after its own `--sidebar-width`, so `lang` and the 240px width reach the DOM. Not done here (out of scope, note for sub-project 3): the ⌘K command menu and the "Bugün" count of items assigned to me (the exam has no per-person assignment).

- [ ] **Step 4: The shared Today screen**

```tsx
// src/app/(manager)/dashboard/page.tsx
import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dot, Level, PageHead, shortDateTime } from "@/components/panel/bits";
import { extendLink } from "@/app/(manager)/actions";
import { can } from "@/lib/authorize";
import { expiringLinks } from "@/server/links";
import { requireUser } from "@/server/session";
import { solutionModules } from "@/solutions/registry.server";
import type { TodayCell, TodayItem } from "@/solutions/types";
import { managerLocale } from "@/i18n/manager-locale";
import { managerT } from "@/i18n/manager";

export const dynamic = "force-dynamic";

function Cell({ cell }: { cell: TodayCell }) {
  if (cell.kind === "text") return <span className="text-[13.5px] text-ink-2">{cell.text}</span>;
  if (cell.kind === "level") return <Level level={cell.text} muted={!cell.final} />;
  return <Dot tone={cell.tone}>{cell.text}</Dot>;
}

/**
 * "Today": one question, "what should I look at?". Every registered solution
 * contributes rows (spec 3, `today()`); the review queue, oldest first, is the
 * page. Work in progress and links about to lapse come after. No stat tiles:
 * every row here leads to an action. With one solution this draws exactly what
 * the exam dashboard drew; the solution label column arrives with the second
 * solution (HIRING-UX 4.5).
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const locale = await managerLocale();
  const t = managerT(locale);
  const sp = await searchParams;
  const modules = solutionModules();
  const items: TodayItem[] = (await Promise.all(modules.map((m) => m.today(user.orgId, user.id, locale)))).flat();
  const queue = items
    .filter((i) => i.lane === "review")
    .sort((a, b) => (a.sortAt?.getTime() ?? 0) - (b.sortAt?.getTime() ?? 0));
  const running = items.filter((i) => i.lane === "running");
  const expiring = await expiringLinks(user.orgId);
  const canInvite = can(user, "student:invite");
  const inviteHref = modules[0]?.inviteHref ?? "/dashboard";

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-8">
      <PageHead
        title={t("today.title", { count: queue.length })}
        sub={queue[0]?.sortAt ? t("today.oldest", { date: shortDateTime(queue[0].sortAt, locale) }) : undefined}
        action={
          <div className="flex flex-col items-end">
            <Button asChild={canInvite} variant="primary" disabled={!canInvite} disabledReason={canInvite ? undefined : t("today.noInvitePermission")}>
              {canInvite ? <Link href={inviteHref}>{t("today.invite")}</Link> : t("today.invite")}
            </Button>
            {!canInvite ? <DisabledReason>{t("today.noInvitePermission")}</DisabledReason> : null}
          </div>
        }
      />

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.queueTitle")}</h2>
        {queue.length === 0 ? (
          <Card className="px-6 py-8 text-center">
            <p className="text-[15px] font-medium text-ink">{t("today.queueEmpty")}</p>
            <p className="mt-1 text-[13.5px] text-muted">{t("today.queueEmptyHint")}</p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {queue.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="grid grid-cols-1 items-center gap-2 px-5 py-4 hover:bg-canvas md:grid-cols-[1.6fr_1.3fr_0.6fr_1.4fr_1.2fr_auto]"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{r.title}</span>
                  <span className="text-[12.5px] text-muted">{r.subtitle}</span>
                </span>
                {r.cells.map((cell, i) => (
                  <Cell key={i} cell={cell} />
                ))}
                <span className="text-[13px] font-medium text-ink underline decoration-underline underline-offset-2">{t("today.review")}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.runningTitle")}</h2>
          <Card className="divide-y divide-line">
            {running.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">{t("today.runningEmpty")}</p>
            ) : (
              running.map((r) => (
                <Link key={r.id} href={r.href} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                  <span className="text-[14px] font-medium text-ink">{r.title}</span>
                  {r.cells.map((cell, i) => (
                    <Cell key={i} cell={cell} />
                  ))}
                </Link>
              ))
            )}
          </Card>
        </section>
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("today.expiringTitle")}</h2>
          {sp.extended ? <p className="mb-2 text-[13px] text-muted">{t("today.extended")}</p> : null}
          <Card className="divide-y divide-line">
            {expiring.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">-</p>
            ) : (
              expiring.map((e) => (
                <div key={e.link.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{e.name}</span>
                    <span className="text-[12.5px] text-muted">{shortDateTime(e.link.expiresAt, locale)}</span>
                  </span>
                  {canInvite ? (
                    <form action={extendLink}>
                      <input type="hidden" name="linkId" value={e.link.id} />
                      <input type="hidden" name="back" value="/dashboard" />
                      <Button type="submit" size="sm">
                        {t("today.extend")}
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Tests, gates, Chrome**

```bash
pnpm exec vitest run src/solutions/boundary.test.ts src/solutions/registry.test.ts src/lib/legacy-routes.test.ts
pnpm exec tsc --noEmit && pnpm exec eslint src scripts && pnpm test && pnpm build
```
Expected: PASS everywhere.

Claude in Chrome, dev server on `kademe_platform`, logged in as the owner, window 1440px: `/dashboard` shows the left menu with "Bugün", then "Öğrenciler", "Sınavlar", "Soru bankası" without a group header, then a separator and "Ayarlar", and at the bottom the TR/EN switch, the user name and the initials. The active entry has the light green ground, green text and a thin green line on the left; hover on another entry is light grey. The queue, running and expiring sections show the same rows as `/dashboard` on the shared `kademe` database before this plan, for the same data (compare against the Plan 1 Task 1 screenshot when the data matches; otherwise compare against `listStudents` counts). Click each menu entry and confirm its page renders. Resize the window to 900px: the menu disappears, a top bar with a menu button appears and opens the menu as a sheet. Log in as the teacher account (`ogretmen@kademe.local`, role now MANAGER) and confirm `/settings` shows "Yönetici" for that user.

- [ ] **Step 6: Commit**

```bash
git add src/components/manager/nav.tsx "src/app/(manager)/layout.tsx" "src/app/(manager)/dashboard/page.tsx" src/server/links.ts src/server/panel.ts src/solutions/boundary.test.ts
git commit -m "Group the panel menu by solution and build Today from the registry" -m "The panel shell becomes the HIRING-UX 4.1 side menu: Today, one group per registered solution (no header while there is only one), Settings, with the language switch and the user at the bottom; below 1024px it is a sheet. Today collects rows from every solution module's today(); with only the exam it draws the same queue, running and expiring sections as before." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Final gate and the status document

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Full gate on a clean tree**

```bash
git status --short
pnpm exec tsc --noEmit
pnpm exec eslint src scripts
pnpm test
pnpm build
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam
```
then with the dev server on `kademe_platform` (no `PROCTOR_DEV_FAKE`):
```bash
DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:guard
```
Expected: a clean `git status`; tsc and eslint silent; vitest prints its total (467 plus this plan's additions, all passing); the build lists its routes; both verify scripts print `All checks passed.` Keep the exact numbers for Step 3.

- [ ] **Step 2: Claude in Chrome walkthrough**

Load the Chrome tools in one call (`ToolSearch` `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests`). Dev server on `kademe_platform`.

Panel (owner login):
1. `/students` redirects to `/exam/students`; the list renders; open "Zeynep Arslan": summary, WRITING, SPEAKING and integrity tabs render; confirm an AI proposal and check that the page reloads on `/exam/students/<id>?tab=...`.
2. `/exam/students/new`: invite a student to the placement exam; the link is shown once.
3. `/exam/exams`, open one, `/exam/exams/new`; `/exam/bank`, open one item.
4. `/dashboard` from Task 10 Step 5; extend an expiring link if one exists (undo strip appears, 8 seconds).
5. `/settings`: roles read Sahip / Yönetici / Değerlendirici (EN: Owner / Manager / Reviewer).

Candidate (restart the dev server with `PROCTOR_DEV_FAKE=1` in its shell for this part only; the red DEV strip must be visible):
6. Open the invite link from step 2: consent, info, system check (7 rows), first section intro, answer two grammar items, reload the page and see the same item, finish one section early, reach the next intro.
7. In `read_network_requests`, confirm the calls go to `/api/c/<token>/exam/answer`, `/exam/answer/commit`, `/exam/section/start` and `/exam/section/submit`, and that `/state` and `/proctor/*` stay at the core paths. No 404 in the console.
8. Restart the dev server without `PROCTOR_DEV_FAKE`. Confirm the DEV strip is gone.

Not claimed by this plan (spec 7): the real-device run with real camera and microphone, and any hiring flow. Both are listed as open in STATUS.

- [ ] **Step 3: Update `docs/STATUS.md`**

Change the "Çalıştırma" block to:
```markdown
```bash
docker compose up -d        # Postgres 5434
pnpm db:migrate             # sürümlü göçler (drizzle/migrations) + drizzle/sql
pnpm db:reset               # SADECE yerel DB (5434 değilse reddeder): şemayı sıfırlar, göçleri baştan uygular
pnpm db:seed                # banka + sınavlar + 3 öğrenci; dinleme sesleri önbellekten
pnpm dev --port 3100
```

- Şema değişikliği: `src/db/schema` düzenle, `pnpm db:generate --name <ad>`, üretilen SQL'i gözden geçir (veri taşıyan adım elle yazılır), `pnpm db:fingerprint` ile boş bir push veritabanına karşı karşılaştır. `drizzle-kit push` kalıcı bir veritabanında artık kullanılmaz.
- Push ile kurulmuş eski bir veritabanı: önce `pg_dump`, sonra bir kez `pnpm db:migrate --adopt-baseline`.
- Platform yapısı: çekirdek + çözümler. Çözümler `src/solutions/<ad>/`, kayıt `src/solutions/registry.ts` (istemci) ve `registry.server.ts` (sunucu). Çekirdek kodun çözüm klasörüne doğrudan import'u ESLint ile yasak.
- Panel: sınav sayfaları `/exam/students`, `/exam/exams`, `/exam/bank` (eski adresler 307 ile yönlenir). Yan menü HIRING-UX 4.1.
- Aday API: sınava özel uçlar `/api/c/[token]/exam/*`; eski yollar bir sürüm boyunca rewrite ile çalışır (`src/lib/legacy-routes.ts`, sonra silinecek).
- Rol adı: `TEACHER` artık `MANAGER` ("Yönetici").
```
(Keep the panel login and `dev:link` lines that follow.)

Add rows to the "Doğrulananlar" table, with the numbers from Step 1:
```markdown
| Çekirdek ayrımı (yerel) | `tsc` temiz, `eslint src scripts` temiz, `pnpm test` <N>/<N>, `pnpm build` <R> rota; `pnpm verify:exam` ve `pnpm verify:guard` tüm kontroller geçti (`kademe_platform` veritabanında) |
| Göç provası (yerel 5434) | `kademe` yedeği geri yüklendi, `--adopt-baseline` ile 0001-0003 uygulandı, `verify:migration check` tüm satırlar ok; yedek ikinci kez geri yüklenip aynı sayımlar alındı |
```
where `<N>` is the test count vitest printed and `<R>` the route count `next build` printed in Step 1.

Add to "Hâlâ doğrulanmadı":
```markdown
5. Çekirdek ayrımı canlıda uygulanmadı. Canlı göç ayrı onay ister: canlı yedeğin yerel kopyasında (5434) prova, sonra servis durdur, `pg_dump`, `pnpm db:migrate --adopt-baseline`, deploy.
6. Çekirdek ayrımından sonra gerçek cihazla (sahte medya kapalı) uçtan uca sınav.
```

Add to "Kararlar ve sapmalar":
```markdown
- **Göç stratejisi:** expand (0001) / rol adı (0002) / contract (0003). Arada kod iki yere birden yazdı, sonra okuyucular taşındı; 0003'ten sonra `tsc` eski kolona okuyan kod kalmadığını kanıtladı.
- `proctorPolicy` sınavda kapalı (OFF) politikayı da döndürür; `null` yalnızca gözetimi olmayan çözüm içindir. Davranışı bire bir korumak için.
- `close-expired` kurtarma işi bölüm saatini `media_assets.section_run_id` üstünden okumaya devam eder (sınavın kendi bağı).
- Aday sayfaları (`/a/[token]`, `/info`, `/check`, `/done`) bu adımda sınava bağlı kaldı; işe alım için çözüme göre dağıtım alt proje 3'te.
```

- [ ] **Step 4: Commit**

```bash
git add docs/STATUS.md
git commit -m "Record the core separation in the status document" -m "Run commands for versioned migrations, the platform structure, new panel and candidate API paths, the MANAGER role, the local verification record and what is still open (production rollout, real-device run)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review

1. **Spec coverage.**
   - 2.1.1 solution enum: Task 2. 2.1.2 `assessments.solution` + exam columns and check to `exam_assessments` (PK/FK cascade), copy at invite: Tasks 2, 7, 8. 2.1.3 `attempts.solution`, partial unique index for LANGUAGE_EXAM, `(assessment_id, attempt_number)` unique; immutability via composite FK to `assessments(id, solution)`: Task 2. 2.1.4 `media_assets.attempt_id` not null cascade, retention/transcription by attempt: Tasks 2, 7 (salvage stays on section clock, reasoned). 2.1.5 `segment_kind` + `segment_run_id`, no FK: Tasks 2, 6, 8. 2.1.6 `RETAKE_AVAILABLE`: Task 2. 2.1.7 role names: overridden by the coordinator decision, `TEACHER` renamed `MANAGER` in Task 3.
   - 2.2: versioned migrations with reviewed SQL (Tasks 1-3, 8), pg_dump backup and local restore rehearsal (Task 8 Step 5), rollout excluded (Global Constraints). The second rehearsal on a copy of the PRODUCTION backup is part of the rollout plan, because it needs production access.
   - 3: contract, registry, ESLint rule (Task 5); `personSummary` deferred with reason.
   - 4: panel `/exam/*` with redirects (Task 9), shared `/dashboard` (Task 10); candidate API prefixes with solution check (Tasks 4, 6); `/people/[id]` and hiring routes are sub-project 3.
   - 6: cross-solution 404 identical to unknown token (Task 4 unit test + `verify:guard`); core does not import solution code (Task 5 ESLint + ratchet).
   - 7: gates per task, `verify:exam` unchanged in its checks, registry test, cross-solution test, Chrome walkthrough (Task 11).
2. **Placeholder scan.** No TBD/TODO. Every code step carries the code; "move verbatim" instructions name the exact source lines. Conditional steps (a generated constraint name that differs, a `lang` prop the sidebar provider may not accept, a leftover reader found by `tsc` in Task 8) say exactly what to do in each branch.
3. **Type consistency.** `currentAttempt(assessment: { id; solution })` (Task 4) is what Task 6 routes call; `workingAttempt(assessmentId)` remains the exam wrapper used by scripts. `ExamCandidateContext`, `loadExamContext`, `resolveExamToken` are defined in Task 4 and used in Tasks 5-7. `SolutionModule.attempts.openSegment/terminate/onMediaComplete`, `candidate.loadState/title/heartbeat`, `proctorPolicy`, `today(orgId, userId, locale)` match between `types.ts`, `module.ts`, `proctoring.ts` and the routes. `NavGroupView` and `buildNav(locale, { today, settings })` match between `registry.ts`, its test and `layout.tsx`. `LEGACY_CANDIDATE_API_REWRITES` (Task 4) and `LEGACY_PANEL_REDIRECTS` (Task 9) live in the same module that `next.config.ts` imports.
