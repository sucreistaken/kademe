/**
 * Proves the hiring immutability triggers (migration 0006) and the schema
 * guards (migration 0007) on a real database.
 *
 * Every row it writes lives in ONE transaction that is always rolled back, so
 * the database is left exactly as it was. Rolling back is also the only way to
 * remove these rows: a published version cannot be deleted, by design. Each
 * check runs in its own savepoint, so a refused statement does not end the run.
 * Local Docker database on port 5434 only, never the shared `kademe`.
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

/** Thrown at the end to roll the whole run back. */
class RollBack extends Error {}
/** Thrown inside a savepoint when a write that should be refused went through, to undo it. */
class WasAllowed extends Error {}

async function main() {
  const refusal = refuseUnlessWorkingDb(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }
  const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const countRows = async () =>
    (await client`select (select count(*) from organizations) + (select count(*) from hiring_versions) as n`)[0].n as string;
  const before = await countRows();

  try {
    await client.begin(async (sql) => {
      const json = (v: unknown) => sql.json(v as Parameters<typeof sql.json>[0]);
      const text = { tr: "Metin", en: "Text" };
      type Tx = typeof sql;

      /** 23514 = check_violation (triggers and CHECKs), 23505 = unique_violation. */
      async function refused(label: string, run: (tx: Tx) => Promise<unknown>, expected = "23514") {
        try {
          // A write that wrongly goes through is undone, so it cannot change what later checks see.
          await sql.savepoint(async (tx) => {
            await run(tx);
            throw new WasAllowed();
          });
        } catch (error) {
          if (error instanceof WasAllowed) return bad(`${label}: was allowed`);
          const code = (error as { code?: string }).code;
          if (code === expected) ok(`${label}: refused (${expected})`);
          else bad(`${label}: ${code} ${(error as Error).message}`);
        }
      }
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
      await refused("a third competency on one question", (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c3.id}, 2)`);
      await allowed("remove the second competency", (tx) => tx`delete from hiring_activity_competencies where activity_id = ${act.id} and competency_id = ${c2.id}`);
      await allowed("update a draft stage", (tx) => tx`update hiring_stages set duration_seconds = 700 where id = ${stage.id}`);
      await allowed("update a draft question", (tx) => tx`update hiring_activities set think_seconds = 30 where id = ${act.id}`);
      await refused(
        "publish without a scorecard",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), published_by = ${user.id} where id = ${v1.id}`,
      );

      console.log("\nPublishing is the one legal change");
      const scorecard = { scale: { min: 1, max: 5, levels: [] }, competencies: [], weightsEnabled: false };
      await allowed(
        "publish v1",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), published_by = ${user.id}, scorecard = ${json(scorecard)} where id = ${v1.id}`,
      );

      console.log("\nA published version and everything under it is frozen");
      await refused("update the published version", (tx) => tx`update hiring_versions set intro_title = ${json(text)} where id = ${v1.id}`);
      await refused("delete the published version", (tx) => tx`delete from hiring_versions where id = ${v1.id}`);
      await refused("update a published stage", (tx) => tx`update hiring_stages set duration_seconds = 900 where id = ${stage.id}`);
      await refused("delete a published stage", (tx) => tx`delete from hiring_stages where id = ${stage.id}`);
      await refused("add a stage to a published version", (tx) => tx`insert into hiring_stages (version_id, order_index, name) values (${v1.id}, 1, ${json(text)})`);
      await refused("update a published question", (tx) => tx`update hiring_activities set think_seconds = 90 where id = ${act.id}`);
      await refused("delete a published question", (tx) => tx`delete from hiring_activities where id = ${act.id}`);
      await refused("add a question to a published stage", (tx) => tx`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage.id}, 1, 'VIDEO', ${json(text)})`);
      await refused("add a competency to a published question", (tx) => tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act.id}, ${c2.id}, 1)`);
      await refused("remove a competency from a published question", (tx) => tx`delete from hiring_activity_competencies where activity_id = ${act.id}`);

      console.log("\nMoving draft rows into a published version is refused too");
      const [v2] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 2) returning id`;
      const [stage2] = await sql`insert into hiring_stages (version_id, order_index, name) values (${v2.id}, 0, ${json(text)}) returning id`;
      const [act2] = await sql`insert into hiring_activities (stage_id, order_index, type, prompt) values (${stage2.id}, 0, 'VIDEO', ${json(text)}) returning id`;
      await refused("move a draft stage into the published version", (tx) => tx`update hiring_stages set version_id = ${v1.id} where id = ${stage2.id}`);
      await refused("move a draft question into a published stage", (tx) => tx`update hiring_activities set stage_id = ${stage.id} where id = ${act2.id}`);
      await allowed("edit the new draft", (tx) => tx`update hiring_stages set duration_seconds = 800 where id = ${stage2.id}`);
      await refused(
        "a second draft for the same opening",
        (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening.id}, 3)`,
        "23505",
      );

      console.log("\nWeight sets stay writable after publishing (HIRING-UX R10)");
      await allowed("add a weight set to the published version", (tx) => tx`insert into hiring_weight_sets (version_id, label, reason) values (${v1.id}, 'v1-b', 'check')`);

      console.log("\nSchema guards (migration 0007)");
      const [otherOrg] = await sql`insert into organizations (name) values ('Immutability check, other') returning id`;
      const [opening2] = await sql`insert into hiring_openings (org_id, position_id, name) values (${org.id}, ${position.id}, 'Check 2') returning id`;
      await refused(
        "a version under another organisation's opening",
        (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number) values (${otherOrg.id}, ${opening2.id}, 1)`,
        "23503",
      );
      const [v3] = await sql`insert into hiring_versions (org_id, opening_id, version_number) values (${org.id}, ${opening2.id}, 1) returning id`;
      await refused("version number 0", (tx) => tx`insert into hiring_versions (org_id, opening_id, version_number, status, published_at, published_by, scorecard)
        values (${org.id}, ${opening2.id}, 0, 'PUBLISHED', now(), ${user.id}, ${json(scorecard)})`);
      await refused(
        "publish without a publisher",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_at = now(), scorecard = ${json(scorecard)} where id = ${v3.id}`,
      );
      await refused(
        "publish without a date",
        (tx) => tx`update hiring_versions set status = 'PUBLISHED', published_by = ${user.id}, scorecard = ${json(scorecard)} where id = ${v3.id}`,
      );
      await refused("a default locale outside the locale set", (tx) => tx`update hiring_versions set default_locale = 'en' where id = ${v3.id}`);
      await allowed(
        "a default locale inside the locale set",
        (tx) => tx`update hiring_versions set locale_set = ${json(["tr", "en"])}, default_locale = 'en' where id = ${v3.id}`,
      );
      await refused("a negative grace period", (tx) => tx`update hiring_stages set grace_seconds = -1 where id = ${stage2.id}`);
      await refused("a negative stage position", (tx) => tx`update hiring_stages set order_index = -1 where id = ${stage2.id}`);
      await refused("a zero answer time", (tx) => tx`update hiring_activities set answer_seconds = 0 where id = ${act2.id}`);
      await refused("a negative question position", (tx) => tx`update hiring_activities set order_index = -1 where id = ${act2.id}`);
      await allowed("no answer time limit", (tx) => tx`update hiring_activities set answer_seconds = null where id = ${act2.id}`);
      await allowed("deleting a draft question removes its competency links", async (tx) => {
        await tx`insert into hiring_activity_competencies (activity_id, competency_id, order_index) values (${act2.id}, ${c1.id}, 0)`;
        await tx`delete from hiring_activities where id = ${act2.id}`;
        const [{ n }] = await tx`select count(*)::int as n from hiring_activity_competencies where activity_id = ${act2.id}`;
        if (n !== 0) throw new Error(`${n} link(s) left`);
      });
      await allowed("deleting a draft-only opening removes its versions", async (tx) => {
        await tx`delete from hiring_openings where id = ${opening2.id}`;
        const [{ n }] = await tx`select count(*)::int as n from hiring_versions where id = ${v3.id}`;
        if (n !== 0) throw new Error(`${n} version(s) left`);
      });

      throw new RollBack();
    });
  } catch (error) {
    if (!(error instanceof RollBack)) throw error;
  }

  const after = await countRows();
  if (after === before) ok("rolled back: no row left behind");
  else bad(`rows left behind: organisations + versions went from ${before} to ${after}`);

  await client.end();
  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
