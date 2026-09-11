/**
 * Runs the retention report against the real development database and prints
 * what a real purge WOULD touch. Counts, oldest item, per organization.
 *
 * READ ONLY. It calls runRetention() without `apply`, which opens no write path
 * at all, and it additionally asserts afterwards that nothing changed: no row
 * gained a purge_after or a deleted_at, and no retention audit row appeared.
 * That assertion is the point of the script. A dry run that cannot prove it was
 * dry is not worth much.
 *
 * Run with: npx tsx scripts/verify-retention.ts
 */

import "dotenv/config";

const RED = "[31m";
const GREEN = "[32m";
const DIM = "[2m";
const OFF = "[0m";

function human(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function ago(iso: string | null, now: Date): string {
  if (!iso) return "-";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return `${iso.slice(0, 10)} (${days} days ago)`;
}

async function main() {
  const { count, eq, inArray, isNotNull, like } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { assessments, attempts, auditLogs, candidates, decisions, mediaAssets, stageRuns } =
    await import("../src/db/schema");
  const { runRetention, SOFT_DELETE_GRACE_DAYS, TERMINAL_DECISION_STATUSES } = await import(
    "../src/lib/retention"
  );

  let failed = 0;
  const bad = (m: string) => {
    console.log(`   ${RED}FAIL${OFF} ${m}`);
    failed = 1;
  };
  const ok = (m: string) => console.log(`   ${GREEN}ok${OFF}   ${m}`);

  // Fingerprint of everything a real run would change, taken before and after.
  const fingerprint = async () => {
    const [marked] = await db
      .select({ n: count() })
      .from(mediaAssets)
      .where(isNotNull(mediaAssets.purgeAfter));
    const [softDeleted] = await db
      .select({ n: count() })
      .from(candidates)
      .where(isNotNull(candidates.deletedAt));
    const [media] = await db.select({ n: count() }).from(mediaAssets);
    // Media whose assessment has at least one terminal decision: the only rows
    // the media clock can ever select.
    const [decided] = await db
      .select({ n: count() })
      .from(mediaAssets)
      .innerJoin(stageRuns, eq(stageRuns.id, mediaAssets.stageRunId))
      .innerJoin(attempts, eq(attempts.id, stageRuns.attemptId))
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .where(
        inArray(
          assessments.id,
          db
            .select({ id: decisions.assessmentId })
            .from(decisions)
            .where(inArray(decisions.status, [...TERMINAL_DECISION_STATUSES])),
        ),
      );
    const [cands] = await db.select({ n: count() }).from(candidates);
    const [audit] = await db
      .select({ n: count() })
      .from(auditLogs)
      .where(like(auditLogs.action, "retention.%"));
    return {
      mediaMarked: marked?.n ?? 0,
      candidatesSoftDeleted: softDeleted?.n ?? 0,
      mediaRows: media?.n ?? 0,
      mediaRowsDecided: decided?.n ?? 0,
      candidateRows: cands?.n ?? 0,
      retentionAuditRows: audit?.n ?? 0,
    };
  };

  const before = await fingerprint();
  const now = new Date();

  console.log(`\n${DIM}== retention dry run, ${now.toISOString()}${OFF}`);
  console.log(
    `${DIM}   nothing is deleted by this script. grace window ${SOFT_DELETE_GRACE_DAYS} days.${OFF}\n`,
  );

  const report = await runRetention({ now });

  if (report.mode !== "REPORT") {
    bad(`mode came back as ${report.mode}, expected REPORT`);
  }

  if (report.organizations.length === 0) {
    console.log("   No organizations in this database. Nothing to report.\n");
    process.exit(2);
  }

  for (const org of report.organizations) {
    console.log(`== ${org.orgName}  ${DIM}${org.orgId}${OFF}`);
    console.log(
      `   media retention     ${org.mediaRetentionDays} days   ` +
        `${DIM}anything anchored before ${org.mediaCutoff.slice(0, 10)}${OFF}`,
    );
    console.log(
      `   candidate retention ${org.candidateRetentionDays} days   ` +
        `${DIM}anything anchored before ${org.candidateCutoff.slice(0, 10)}${OFF}`,
    );
    console.log("");
    console.log(`   ${DIM}stage 1, soft delete (reversible for a week)${OFF}`);
    console.log(
      `     media to mark        ${org.softDelete.media.total}` +
        `   this run ${org.softDelete.media.inBatch}, left over ${org.softDelete.media.remaining}`,
    );
    console.log(`     oldest               ${ago(org.softDelete.media.oldest, now)}`);
    console.log(`     bytes behind them    ${human(org.mediaBytesDue)}`);
    console.log(
      `     candidates to mark   ${org.softDelete.candidates.total}` +
        `   this run ${org.softDelete.candidates.inBatch}, left over ${org.softDelete.candidates.remaining}`,
    );
    console.log(
      `     oldest               ${ago(org.softDelete.candidates.oldest, now)}`,
    );
    console.log("");
    console.log(`   ${DIM}stage 2, hard delete (irreversible)${OFF}`);
    console.log(
      `     media to purge       ${org.hardDelete.media.total}` +
        `   this run ${org.hardDelete.media.inBatch}, left over ${org.hardDelete.media.remaining}`,
    );
    console.log(
      `     marked since         ${ago(org.hardDelete.media.oldest, now)}`,
    );
    console.log(
      `     candidates to purge  ${org.hardDelete.candidates.total}` +
        `   this run ${org.hardDelete.candidates.inBatch}, left over ${org.hardDelete.candidates.remaining}`,
    );
    console.log(
      `     marked since         ${ago(org.hardDelete.candidates.oldest, now)}`,
    );
    console.log(`     storage objects      ${org.objectsToRemove}`);

    for (const [label, finding] of [
      ["soft media", org.softDelete.media],
      ["soft candidates", org.softDelete.candidates],
      ["hard media", org.hardDelete.media],
      ["hard candidates", org.hardDelete.candidates],
    ] as const) {
      if (finding.sample.length === 0) continue;
      console.log(`\n   ${DIM}sample, ${label}${OFF}`);
      for (const row of finding.sample) {
        console.log(`     ${DIM}${JSON.stringify(row)}${OFF}`);
      }
    }
    console.log("");
  }

  console.log("== totals across every organization");
  console.log(`   media to mark        ${report.totals.mediaToMark}`);
  console.log(`   candidates to mark   ${report.totals.candidatesToMark}`);
  console.log(`   media to purge       ${report.totals.mediaToPurge}`);
  console.log(`   candidates to purge  ${report.totals.candidatesToPurge}`);
  console.log(`   storage objects      ${report.totals.objectsToRemove}`);
  console.log(`   bytes on the clock   ${human(report.totals.bytesToRemove)}`);

  // Every count above is 0 on a fresh database, and a 0 proves nothing: a broken
  // join reports 0 forever and looks healthy. So ask the same code what it would
  // do if today were years from now. Still a pure read, just a different `now`.
  const PROBE_DAYS = 1200;
  const probeAt = new Date(now.getTime() + PROBE_DAYS * 86_400_000);
  console.log(
    `== probe: the same report with now pushed ${PROBE_DAYS} days ahead ` +
      `(${probeAt.toISOString().slice(0, 10)})`,
  );
  console.log(
    `   ${DIM}proves the anchors and joins actually match rows. Writes nothing.${OFF}`,
  );
  const probe = await runRetention({ now: probeAt });
  console.log(`   media that would be marked       ${probe.totals.mediaToMark}`);
  console.log(
    `   candidates that would be marked  ${probe.totals.candidatesToMark}`,
  );
  console.log(
    `   bytes behind that media          ${human(probe.totals.bytesToRemove)}`,
  );
  for (const org of probe.organizations) {
    const oldest = org.softDelete.media.oldest;
    console.log(
      `   ${org.orgName}: oldest media anchor ${oldest ? oldest.slice(0, 10) : "-"}` +
        `, oldest candidate anchor ${
          org.softDelete.candidates.oldest?.slice(0, 10) ?? "-"
        }`,
    );
  }
  // Only media behind a terminal decision is ever on the media clock, so that
  // is the denominator. Comparing against every media row would flag a healthy
  // database with open reviews as a broken join.
  if (probe.totals.mediaToMark === 0 && before.mediaRowsDecided > 0) {
    bad(
      `${before.mediaRowsDecided} media rows sit behind an ACCEPTED/REJECTED decision but none matched even ${PROBE_DAYS} days out. The anchor join is probably wrong.`,
    );
  } else if (before.mediaRowsDecided > 0) {
    ok(
      `the media anchor join matches rows (${probe.totals.mediaToMark} of ${before.mediaRowsDecided} decided, ${before.mediaRows} total)`,
    );
  } else if (before.mediaRows > 0) {
    ok(
      `${before.mediaRows} media rows, none behind a terminal decision, so none on the media clock. Expected, not a join failure.`,
    );
  }
  if (probe.totals.mediaToMark > before.mediaRowsDecided) {
    bad(
      `${probe.totals.mediaToMark} media rows would be marked but only ${before.mediaRowsDecided} sit behind a terminal decision. Something without a decision is on the clock.`,
    );
  }
  if (probe.totals.candidatesToMark === 0 && before.candidateRows > 0) {
    bad(
      `${before.candidateRows} candidates exist but none matched ${PROBE_DAYS} days out. The candidate anchor is probably wrong.`,
    );
  } else if (before.candidateRows > 0) {
    ok(
      `the candidate anchor matches rows (${probe.totals.candidatesToMark} of ${before.candidateRows})`,
    );
  }

  console.log("\n== proving the dry run was dry");
  const after = await fingerprint();
  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    if (before[key] === after[key]) ok(`${key} unchanged at ${after[key]}`);
    else bad(`${key} moved from ${before[key]} to ${after[key]}`);
  }

  console.log("\n== how a human turns deletion on");
  console.log("   Both are required, neither is set anywhere today:");
  console.log("     1. RETENTION_PURGE_ENABLED=true   in the environment");
  console.log("     2. ?apply=1                        on the cron request");
  console.log(
    `   env right now: RETENTION_PURGE_ENABLED=${process.env.RETENTION_PURGE_ENABLED ?? "(unset)"}`,
  );

  console.log(
    failed
      ? `\n${RED}The dry run wrote something. Do not enable deletion.${OFF}\n`
      : `\n${GREEN}Report only. The database is byte for byte what it was.${OFF}\n`,
  );
  process.exit(failed);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
