/**
 * Proves the hiring immutability triggers (migrations 0006 and 0008) and the
 * schema guards (migrations 0007 and 0009) on a real database.
 *
 * Part 1 writes every row inside ONE transaction that is always rolled back, so
 * the database is left exactly as it was. Rolling back is also the only way to
 * remove these rows: a published version cannot be deleted, by design. Each
 * check runs in its own savepoint, so a refused statement does not end the run.
 *
 * Part 2 (two connections, a publish racing a child edit) has to COMMIT, so it
 * only runs against a throw-away database whose name ends in "_check" and is
 * skipped elsewhere. Local Docker database on port 5434 only, never `kademe`.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability
 */
import "dotenv/config";
import postgres from "postgres";
import { refuseUnlessWorkingDb } from "../src/db/working-db-guard";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};

/** The constraint name every freeze trigger reports, so the app has a stable key. */
const FROZEN = "hiring_version_frozen";
const text = { tr: "Metin", en: "Text" };
const scorecard = { scale: { min: 1, max: 5, levels: [] }, competencies: [], weightsEnabled: false };

/** Thrown at the end to roll the whole run back. */
class RollBack extends Error {}
/** Thrown inside a savepoint when a write that should be refused went through, to undo it. */
class WasAllowed extends Error {}

type PgError = { code?: string; constraint_name?: string; message?: string };
/** Checks SQLSTATE and constraint name. 23514 check_violation, 23505 unique, 23503 foreign key. */
function judge(label: string, error: unknown, code: string, constraint: string) {
  const e = error as PgError;
  if (e.code === code && e.constraint_name === constraint) ok(`${label}: refused (${code} ${constraint})`);
  else bad(`${label}: expected ${code} ${constraint}, got ${e.code} ${e.constraint_name ?? "-"} ${e.message}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  const refusal = refuseUnlessWorkingDb(url);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }
  const client = postgres(url!, { max: 1, onnotice: () => {} });
  const countRows = async () =>
    (await client`select (select count(*) from organizations) + (select count(*) from hiring_versions) as n`)[0].n as string;
  const before = await countRows();

  try {
    await client.begin(async (sql) => {
      const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);
      type Tx = typeof sql;

      async function refused(label: string, run: (tx: Tx) => Promise<unknown>, constraint: string, code = "23514") {
        try {
          // A write that wrongly goes through is undone, so it cannot change what later checks see.
          await sql.savepoint(async (tx) => {
            await run(tx);
            throw new WasAllowed();
          });
        } catch (error) {
          if (error instanceof WasAllowed) return bad(`${label}: was allowed`);
          judge(label, error, code, constraint);
        }
      }
      const frozen = (label: string, run: (tx: Tx) => Promise<unknown>) => refused(label, run, FROZEN);
      async function allowed(label: string, run: (tx: Tx) => Promise<unknown>) {
        try {
          await sql.savepoint((tx) => run(tx));
          ok(label);
        } catch (error) {
          bad(`${label}: ${(error as Error).message}`);
        }
      }

      const [org] = await sql`insert into organizations (name) values ('Immutability check') returning id`;
      const [user] = await sql`insert into users (org_id, email, name, password_hash)
        values (${org.id}, ${`immutability-check-${Date.now()}@kademe.local`}, 'Immutability check', 'x') returning id`;
      const [scale] = await sql`insert into rating_scales (org_id, name, is_default) values (${org.id}, 'Default', true) returning id`;
      const [c1] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
      const [c2] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
      const [c3] = await sql`insert into competencies (org_id, name, scale_id) values (${org.id}, ${json(text)}, ${scale.id}) returning id`;
      const [position] = await sql`insert into positions (org_id, name) values (${org.id}, 'Check') returning id`;
      const [opening] = await sql`insert into hiring_openings (org_id, position_id, name) values (${org.id}, ${position.id}, 'Check') returning id`;
      const [v1] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 1) returning id`;
      const [stage] = await sql`insert into hiring_stages (version_id, order_index, name) values (${v1.id}, 0, ${json(text)}) returning id`;
      const [act] = await sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 0, 'VIDEO', ${json(text)}) returning id`;

      console.log("\nA draft version is editable");
      await allowed("add a first competency", (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c1.id}, 0)`);
      await allowed("add a second competency", (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c2.id}, 1)`);
      await refused(
        "a third competency on one question",
        (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c3.id}, 2)`,
        "hiring_at_most_two_competencies",
      );
      await allowed("remove the second competency", (tx) => tx`delete from hiring_activity_competencies where activity_id = ${act.id} and competency_id = ${c2.id}`);
      await allowed("update a draft stage", (tx) => tx`update hiring_stages set duration_seconds = 700 where id = ${stage.id}`);
      await allowed("update a draft question", (tx) => tx`update hiring_activities set think_seconds = 30 where id = ${act.id}`);
      await refused(
        "publish without a scorecard",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), published_by = ${user.id} where id = ${v1.id}`,
        "hiring_published_has_scorecard",
      );

      console.log("\nPublishing is the one legal change");
      await allowed(
        "publish v1",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), published_by = ${user.id}, scorecard = ${json(scorecard)} where id = ${v1.id}`,
      );

      console.log("\nA published version and everything under it is frozen");
      await frozen("update the published version", (tx) => tx`update hiring_versions set intro_title = ${json(text)} where id = ${v1.id}`);
      await frozen("delete the published version", (tx) => tx`delete from hiring_versions where id = ${v1.id}`);
      await frozen("update a published stage", (tx) => tx`update hiring_stages set duration_seconds = 900 where id = ${stage.id}`);
      await frozen("delete a published stage", (tx) => tx`delete from hiring_stages where id = ${stage.id}`);
      await frozen("add a stage to a published version", (tx) => tx`insert into hiring_stages (version_id, order_index, name) values (${v1.id}, 1, ${json(text)})`);
      await frozen("update a published question", (tx) => tx`update hiring_activities set think_seconds = 90 where id = ${act.id}`);
      await frozen("delete a published question", (tx) => tx`delete from hiring_activities where id = ${act.id}`);
      await frozen("add a question to a published stage", (tx) => tx`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 1, 'VIDEO', ${json(text)})`);
      await frozen("add a competency to a published question", (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c2.id}, 1)`);
      await frozen("remove a competency from a published question", (tx) => tx`delete from hiring_activity_competencies where activity_id = ${act.id}`);
      await frozen("delete an opening that has a published version", (tx) => tx`delete from hiring_openings where id = ${opening.id}`);

      console.log("\nMoving draft rows into a published version is refused too");
      const [v2] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 2) returning id`;
      const [stage2] = await sql`insert into hiring_stages (version_id, order_index, name) values (${v2.id}, 0, ${json(text)}) returning id`;
      const [act2] = await sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage2.id}, 0, 'VIDEO', ${json(text)}) returning id`;
      await sql`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act2.id}, ${c3.id}, 1)`;
      await frozen("move a draft stage into the published version", (tx) => tx`update hiring_stages set version_id = ${v1.id} where id = ${stage2.id}`);
      await frozen("move a draft question into a published stage", (tx) => tx`update hiring_activities set stage_id = ${stage.id} where id = ${act2.id}`);
      await frozen(
        "move a draft competency link onto a published question",
        (tx) => tx`update hiring_activity_competencies set activity_id = ${act.id} where activity_id = ${act2.id} and competency_id = ${c3.id}`,
      );
      await allowed("edit the new draft", (tx) => tx`update hiring_stages set duration_seconds = 800 where id = ${stage2.id}`);
      await refused(
        "a second draft for the same opening",
        (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 3)`,
        "one_draft_per_opening",
        "23505",
      );

      console.log("\nWeight sets stay writable after publishing (HIRING-UX R10)");
      await allowed("add a weight set to the published version", (tx) => tx`insert into hiring_weight_sets (version_id, label, reason) values (${v1.id}, 'v1-b', 'check')`);

      console.log("\nSchema guards (migrations 0007 and 0009)");
      const [otherOrg] = await sql`insert into organizations (name) values ('Immutability check, other') returning id`;
      const [opening2] = await sql`insert into hiring_openings (org_id, position_id, name) values (${org.id}, ${position.id}, 'Check 2') returning id`;
      await refused(
        "a version under another organisation's opening",
        (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number) values (${otherOrg.id}, ${opening2.id}, 1)`,
        "hiring_versions_opening_org_fk",
        "23503",
      );
      const [v3] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening2.id}, 1) returning id`;
      await refused(
        "version number 0",
        (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number, status, published_at, published_by, scorecard)
          values (${org.id}, ${opening2.id}, 0, 'PUBLISHED', now(), ${user.id}, ${json(scorecard)})`,
        "hiring_version_number_positive",
      );
      await refused(
        "publish without a publisher",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), scorecard = ${json(scorecard)} where id = ${v3.id}`,
        "hiring_published_has_publisher",
      );
      await refused(
        "publish without a date",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_by = ${user.id}, scorecard = ${json(scorecard)} where id = ${v3.id}`,
        "hiring_published_has_publisher",
      );
      await refused("a default locale outside the locale set", (tx) => tx`update hiring_versions set default_locale = 'en' where id = ${v3.id}`, "hiring_default_locale_in_set");
      // `'"tr"'::jsonb ? 'tr'` is true, so only the array check stops a bare string.
      await refused("a locale set that is not an array", (tx) => tx`update hiring_versions set locale_set = ${json("tr")} where id = ${v3.id}`, "hiring_locale_set_is_array");
      await allowed(
        "a default locale inside the locale set",
        (tx) => tx`update hiring_versions set locale_set = ${json(["tr", "en"])}, default_locale = 'en' where id = ${v3.id}`,
      );
      await refused("a negative grace period", (tx) => tx`update hiring_stages set grace_seconds = -1 where id = ${stage2.id}`, "hiring_stage_grace");
      await refused("a negative stage position", (tx) => tx`update hiring_stages set order_index = -1 where id = ${stage2.id}`, "hiring_stage_order");
      await refused("a zero answer time", (tx) => tx`update hiring_activities set answer_seconds = 0 where id = ${act2.id}`, "hiring_activity_answer");
      await refused("a negative question position", (tx) => tx`update hiring_activities set order_index = -1 where id = ${act2.id}`, "hiring_activity_order");
      await allowed("no answer time limit", (tx) => tx`update hiring_activities set answer_seconds = null where id = ${act2.id}`);
      await allowed("deleting a draft question removes its competency links", async (tx) => {
        await tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act2.id}, ${c1.id}, 0)`;
        await tx`delete from hiring_activities where id = ${act2.id}`;
        const [{ n }] = await tx`select count(*)::int as n from hiring_activity_competencies where activity_id = ${act2.id}`;
        if (n !== 0) throw new Error(`${n} link(s) left`);
      });
      await allowed("deleting an opening cascades through its draft version, stages, questions and links", async (tx) => {
        const [s] = await tx`insert into hiring_stages (version_id, order_index, name) values (${v3.id}, 0, ${json(text)}) returning id`;
        const [a] = await tx`insert into hiring_activities (stage_id, order_index, type, prompt) values (${s.id}, 0, 'VIDEO', ${json(text)}) returning id`;
        await tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${a.id}, ${c1.id}, 0)`;
        await tx`delete from hiring_openings where id = ${opening2.id}`;
        const [left] = await tx`select
            (select count(*) from hiring_versions where id = ${v3.id})::int as v,
            (select count(*) from hiring_stages where id = ${s.id})::int as s,
            (select count(*) from hiring_activities where id = ${a.id})::int as a,
            (select count(*) from hiring_activity_competencies where activity_id = ${a.id})::int as m`;
        if (left.v + left.s + left.a + left.m !== 0) throw new Error(`left: ${JSON.stringify(left)}`);
      });

      throw new RollBack();
    });
  } catch (error) {
    if (!(error instanceof RollBack)) throw error;
  }

  const after = await countRows();
  if (after === before) ok("rolled back: no row left behind");
  else bad(`rows left behind: organisations + versions went from ${before} to ${after}`);

  if (new URL(url!).pathname.endsWith("_check")) await raceChecks(client, url!);
  else console.log('\nConcurrency checks skipped: they commit rows, run against a "*_check" database.');

  await client.end();
  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

/**
 * A publish racing a child edit, on two real connections. These commit, so they
 * run only on a throw-away *_check database. Deterministic: "waits" is proven
 * by lock_timeout (55P03) or by seeing the other backend in a Lock wait.
 */
async function raceChecks(client: postgres.Sql, url: string) {
  console.log("\nA publish and a child edit cannot interleave (two connections, commits rows)");
  const json = (v: unknown) => client.json(v as Parameters<typeof client.json>[0]);
  const [org] = await client`insert into organizations (name) values ('Immutability race') returning id`;
  const [user] = await client`insert into users (org_id, email, name, password_hash)
    values (${org.id}, ${`immutability-race-${Date.now()}@kademe.local`}, 'Race', 'x') returning id`;
  const [position] = await client`insert into positions (org_id, name) values (${org.id}, 'Race') returning id`;
  const [opening] = await client`insert into hiring_openings (org_id, position_id, name) values (${org.id}, ${position.id}, 'Race') returning id`;
  const [v] = await client`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 1) returning id`;
  const [stage] = await client`insert into hiring_stages (version_id, order_index, name) values (${v.id}, 0, ${json(text)}) returning id`;
  const [act] = await client`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 0, 'VIDEO', ${json(text)}) returning id`;

  const a = postgres(url, { max: 1, onnotice: () => {} });
  const b = postgres(url, { max: 1, onnotice: () => {} });
  const publish = () =>
    b`update hiring_versions set status = 'PUBLISHED', published_at = now(), published_by = ${user.id}, scorecard = ${b.json(scorecard)} where id = ${v.id}`;

  async function publishWaitsFor(label: string, edit: () => Promise<unknown>) {
    await a`begin`;
    await edit();
    await b`begin`;
    await b`set local lock_timeout = '1s'`;
    try {
      await publish();
      bad(`${label}: the publish went through while the edit was open`);
    } catch (error) {
      const code = (error as PgError).code;
      if (code === "55P03") ok(`${label}: the publish waits (lock_timeout 55P03)`);
      else bad(`${label}: ${code} ${(error as Error).message}`);
    }
    await b`rollback`;
    await a`rollback`;
  }
  await publishWaitsFor("an open stage insert", () => a`insert into hiring_stages (version_id, order_index, name) values (${v.id}, 1, ${a.json(text)})`);
  await publishWaitsFor("an open question delete", () => a`delete from hiring_activities where id = ${act.id}`);

  // Publish first (open), then an edit: it must wait, and fail once the publish commits.
  const [{ pid }] = await a`select pg_backend_pid() as pid`;
  await b`begin`;
  await publish();
  await a`begin`;
  const edit = (async () => {
    try {
      await a`insert into hiring_stages (version_id, order_index, name) values (${v.id}, 1, ${a.json(text)})`;
      return null;
    } catch (error) {
      return error;
    }
  })();
  let settled = false;
  void edit.then(() => (settled = true));
  let waited = false;
  for (let i = 0; i < 50 && !settled && !waited; i++) {
    const [row] = await client`select wait_event_type from pg_stat_activity where pid = ${pid}`;
    waited = row?.wait_event_type === "Lock";
    if (!waited) await new Promise((r) => setTimeout(r, 100));
  }
  await b`commit`;
  const outcome = await edit;
  await a`rollback`;
  const label = "a stage insert racing an open publish";
  if (!waited) bad(`${label}: did not wait for the publish (${outcome ? (outcome as PgError).code : "went through"})`);
  else if (outcome === null) bad(`${label}: waited, then went through into the published version`);
  else judge(`${label}: waits, then sees PUBLISHED`, outcome, "23514", FROZEN);

  await a.end();
  await b.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
