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
  // Pre-drop drift gate: while the deprecated assessments exam columns still exist,
  // they must agree with exam_assessments. After migration 0003 they are gone and
  // the gate is skipped, so this script keeps working on the final shape.
  const [{ legacy }] = await sql<{ legacy: number }[]>`
    select count(*)::int as legacy from information_schema.columns
    where table_schema = 'public' and table_name = 'assessments'
      and column_name in ('blueprint_id', 'blueprint_name', 'blueprint_snapshot', 'mode', 'claimed_level')`;
  if (legacy === 5) {
    const [{ drift }] = await sql<{ drift: number }[]>`
      select count(*)::int as drift
      from assessments s
      left join exam_assessments e on e.assessment_id = s.id
      where (s.solution = 'LANGUAGE_EXAM' and e.assessment_id is null)
         or (e.assessment_id is not null and (
              s.blueprint_id is distinct from e.blueprint_id
           or s.blueprint_name is distinct from e.blueprint_name
           or s.blueprint_snapshot is distinct from e.blueprint_snapshot
           or s.mode is distinct from e.mode
           or s.claimed_level is distinct from e.claimed_level))`;
    if (drift !== 0) failed += 1;
    console.log(`${drift === 0 ? "ok  " : "FAIL"} dualWriteDrift: ${drift}`);
  } else if (legacy === 0) {
    console.log("dualWriteDrift: skipped (columns already dropped)");
  } else {
    failed += 1;
    console.log(`FAIL dualWriteDrift: ${legacy} of 5 deprecated columns exist (partial state)`);
  }
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
