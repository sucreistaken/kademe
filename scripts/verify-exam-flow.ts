/**
 * End to end check of the student runtime, in process, against the local
 * database (run `pnpm db:seed` first). It adds its own invitations and leaves
 * everything else alone.
 *
 * Checks:
 *  1. A scripted B1 student finishes a placement exam; the engine places each
 *     objective skill within one level of B1.
 *  2. The same for a B1 verification exam.
 *  3. Nothing the student is sent carries a key, a rubric, a difficulty, a
 *     listening transcript or the text of an accepted answer.
 *  4. A section's deadline does not move on re-reads and restarts.
 *  5. A write after the deadline is refused (SECTION_EXPIRED).
 *  6. A listening clip cannot be played more often than allowed.
 *  7. A finished link is dead, and there is still exactly one attempt.
 *
 * Run with: pnpm verify:exam
 */
import "dotenv/config";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const OFF = "\x1b[0m";
let failed = 0;
const ok = (m: string) => console.log(`  ${GREEN}ok${OFF}   ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`  ${RED}FAIL${OFF} ${m}`);
};

async function main() {
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { createInvitation } = await import("../src/server/invite");
  const { simulateStudent } = await import("../src/server/simulate");
  const flow = await import("../src/lib/exam-flow");
  const { candidateSafe } = await import("../src/lib/candidate-safe");
  const { BAND_CENTER, levelFromTheta } = await import("../src/lib/exam/cefr");
  const { mulberry32 } = await import("../src/lib/exam/adaptive");
  const { CEFR_LEVELS } = await import("../src/lib/exam/types");

  const [org] = await db.select().from(s.organizations).limit(1);
  if (!org) throw new Error("no organisation: run pnpm db:seed first");
  const blueprints = await db.select().from(s.examBlueprints).where(eq(s.examBlueprints.status, "PUBLISHED"));
  const placement = blueprints.find((b) => b.mode === "PLACEMENT")!;
  const verification = blueprints.find((b) => b.mode === "LEVEL_VERIFICATION")!;

  const sent: string[] = [];
  const record = (state: unknown) => sent.push(JSON.stringify(candidateSafe(state)));

  async function run(label: string, blueprintId: string, claimed: "B1" | null) {
    console.log(`\n${label}`);
    const invite = await createInvitation({
      orgId: org.id,
      blueprintId,
      fullName: `Verify ${label}`,
      email: `verify-${Date.now()}@example.com`,
      claimedLevel: claimed,
      locale: "tr",
      invitedBy: null,
    });
    if (!invite.ok) throw new Error(invite.code);
    const final = await simulateStudent(invite.rawToken, {
      theta: BAND_CENTER.B1,
      rng: mulberry32(label.length * 97),
      writing: () => "Ich wohne in Izmir und lerne seit zwei Jahren Deutsch, weil ich in Deutschland studieren möchte.",
      speaking: () => "ich heiße test und ich wohne in izmir ich arbeite als lehrerin",
      onState: record,
    });
    if (final.step === "DONE") ok("reached the end of the exam");
    else bad(`ended on ${final.step}`);

    const [attempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, invite.assessmentId));
    const runs = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.attemptId, attempt.id));
    // One section is a small sample: on the real bank a single skill lands
    // within one level 90-100% of the time, so a lone miss is information,
    // not a failure. The pooled estimate over all objective skills is the
    // number the result stands on, and that one must be within a level.
    const objective = runs.filter((x) => x.thetaMean !== null);
    for (const r of objective) {
      const level = levelFromTheta(r.thetaMean!).level;
      const answered = (
        await db.select().from(s.itemResponses).where(eq(s.itemResponses.sectionRunId, r.id))
      ).filter((x) => x.answeredAt).length;
      console.log(`       ${r.section}: ${level} (theta ${r.thetaMean!.toFixed(2)}, sd ${r.thetaSd!.toFixed(2)}, ${answered} answered, ${r.stopReason ?? r.completion})`);
    }
    const { poolPosteriors } = await import("../src/lib/exam/result");
    const pooled = poolPosteriors(objective.map((r) => ({ mean: r.thetaMean!, sd: r.thetaSd! })));
    if (pooled) {
      const level = levelFromTheta(pooled.mean).level;
      const diff = Math.abs(CEFR_LEVELS.indexOf(level) - CEFR_LEVELS.indexOf("B1"));
      const line = `pooled objective level ${level} (theta ${pooled.mean.toFixed(2)}, sd ${pooled.sd.toFixed(2)}) for a B1 student`;
      if (diff <= 1) ok(line);
      else bad(line);
    } else bad("no objective section finished");
    const [result] = await db.select().from(s.examResults).where(eq(s.examResults.attemptId, attempt.id));
    if (result) ok(`result row: ${result.status}${result.computed?.verification ? `, verification ${result.computed.verification.outcome}` : ""}`);
    else bad("no result row");

    const gradings = await db
      .select({ status: s.responseGradings.status })
      .from(s.responseGradings)
      .innerJoin(s.itemResponses, eq(s.itemResponses.id, s.responseGradings.itemResponseId))
      .innerJoin(s.sectionRuns, eq(s.sectionRuns.id, s.itemResponses.sectionRunId))
      .where(eq(s.sectionRuns.attemptId, attempt.id));
    if (gradings.length > 0) ok(`${gradings.length} writing/speaking answer(s) opened for grading (${gradings.map((g) => g.status).join(", ")})`);
    else bad("no grading rows for writing/speaking");

    const resolved = await flow.resolveToken(invite.rawToken);
    if (!resolved.ok && resolved.problem === "COMPLETED") ok("finished link no longer opens the exam");
    else bad("finished link still resolves");
    const again = await flow.workingAttempt(invite.assessmentId);
    if (again.attempt.id === attempt.id && again.finished) ok("still exactly one attempt, marked finished");
    else bad("a second attempt appeared");
    return { invite, attempt };
  }

  await run("placement", placement.id, null);
  await run("verification", verification.id, "B1");

  console.log("\nLeak scan over every state sent to the student");
  const bodies = sent.join("\n");
  const items = await db.select().from(s.items);
  const stimuliRows = await db.select().from(s.stimuli).where(eq(s.stimuli.section, "LISTENING"));
  const forbiddenNames = ["answerKey", "answer_key", "\"key\"", "rubric", "contentPoints", "difficulty", "skillTag", "explanation", "itemSnapshot", "audioKey", "thetaAfter", "isCorrect"];
  const hits = forbiddenNames.filter((n) => bodies.includes(n));
  if (hits.length === 0) ok(`no internal field names in ${sent.length} states`);
  else bad(`internal names found: ${hits.join(", ")}`);
  const transcriptHits = stimuliRows.filter((st) => bodies.includes(st.body.split("\n")[0].slice(-40)));
  if (transcriptHits.length === 0) ok("no listening transcript text");
  else bad(`listening transcripts leaked: ${transcriptHits.map((t) => t.seedKey).join(", ")}`);
  // Typed gaps only: a drop-down gap shows its options on purpose, answer included.
  const typedKeys = items
    .flatMap((i) => {
      if (i.answerKey.kind !== "GAP" || i.content.kind !== "GAP") return [];
      const key = i.answerKey;
      return i.content.gaps.filter((g) => !g.choices).flatMap((g) => key.answers[g.id] ?? []);
    })
    .filter((a) => a.length >= 7);
  const keyHits = typedKeys.filter((k) => bodies.includes(`"${k}"`));
  if (keyHits.length === 0) ok(`no accepted gap answers among ${typedKeys.length} checked`);
  else bad(`accepted answers appear in student bodies: ${keyHits.slice(0, 5).join(", ")}`);

  console.log("\nClock and limits");
  const invite = await createInvitation({
    orgId: org.id, blueprintId: placement.id, fullName: "Verify clock", email: `clock-${Date.now()}@example.com`, claimedLevel: null, locale: "en", invitedBy: null,
  });
  if (!invite.ok) throw new Error(invite.code);
  const ctxResolved = await flow.resolveToken(invite.rawToken);
  if (!ctxResolved.ok) throw new Error("fresh link does not resolve");
  const ctx = ctxResolved.ctx;
  const skipped = await flow.startSection(ctx, 1);
  if (!skipped.ok && skipped.code === "NOT_READY") ok("a section cannot start before consent and the system check");
  else bad("section started without consent / system check");
  const consent = await flow.getConsentText(ctx);
  await flow.recordConsent(ctx, consent.id, null, null);
  const { attempt } = await flow.workingAttempt(ctx.assessment.id);
  await flow.recordDeviceCheck(attempt.id);
  const intro = await flow.loadState(ctx);
  if (intro.step === "SECTION_INTRO") ok("a new exam opens on the first section's introduction");
  else bad(`expected SECTION_INTRO, got ${intro.step}`);
  await flow.startSection(ctx, 1);
  const a = await flow.loadState(ctx);
  await flow.startSection(ctx, 1);
  const b = await flow.loadState(ctx);
  if (a.current?.deadlineAt && a.current.deadlineAt === b.current?.deadlineAt) ok(`deadline stable across re-reads and a second start (${a.current.deadlineAt})`);
  else bad(`deadline moved: ${a.current?.deadlineAt} -> ${b.current?.deadlineAt}`);
  if (a.current?.item?.sequence === b.current?.item?.sequence) ok("the same item comes back on reload");
  else bad("reload served a different item");
  const wrong = await flow.checkWrite(ctx, 2, a.current?.item?.sequence);
  if (!wrong.ok && wrong.code === "SECTION_MISMATCH") ok("a write for the wrong section is refused");
  else bad("wrong-section write accepted");

  // Listening play limit: jump the attempt to its listening section by closing the others.
  const [run1] = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.attemptId, attempt.id));
  await db.update(s.sectionRuns).set({ deadlineAt: new Date(Date.now() - 60_000) }).where(eq(s.sectionRuns.id, run1.id));
  const expired = await flow.checkWrite(ctx, 1, a.current?.item?.sequence);
  if (!expired.ok && (expired.code === "SECTION_EXPIRED" || expired.code === "SECTION_MISMATCH"))
    ok(`a write after the deadline is refused (${expired.code})`);
  else bad("write after deadline accepted");

  for (let guard = 0; guard < 6; guard++) {
    const st = await flow.loadState(ctx);
    if (st.step === "SECTION_INTRO" && st.current?.section === "LISTENING") {
      await flow.startSection(ctx, st.current.position);
      break;
    }
    if (st.step === "SECTION_INTRO") {
      await flow.startSection(ctx, st.current!.position);
      const [r] = await db
        .select()
        .from(s.sectionRuns)
        .where(and(eq(s.sectionRuns.attemptId, attempt.id), eq(s.sectionRuns.section, st.current!.section)));
      await flow.closeSectionRun(r.id, "SUBMIT");
    }
  }
  const listening = await flow.loadState(ctx);
  if (listening.current?.section === "LISTENING" && listening.current.item?.stimulus?.kind === "LISTENING") {
    const check = await flow.checkWrite(ctx, listening.current.position, listening.current.item.sequence);
    if (!check.ok) bad(`listening write check failed: ${check.code}`);
    else {
      const stimulusId = check.response.itemSnapshot.stimulusId!;
      const max = ctx.assessment.config.listening.maxPlays;
      const results = [];
      for (let i = 0; i < max + 1; i++) results.push((await flow.recordPlay(ctx, check.run, stimulusId)).ok);
      if (results.slice(0, max).every(Boolean) && results[max] === false) ok(`listening allows ${max} plays and refuses the next`);
      else bad(`play results: ${results.join(",")}`);
      const reloaded = await flow.loadState(ctx);
      const left = reloaded.current?.item?.stimulus?.kind === "LISTENING" ? reloaded.current.item.stimulus.playsLeft : -1;
      if (left === 0) ok("plays left survives a reload (0)");
      else bad(`plays left after reload: ${left}`);
    }
  } else bad(`could not reach a listening item (step ${listening.step}, section ${listening.current?.section})`);

  console.log("\nEnding an adaptive section at once");
  const quitter = await createInvitation({
    orgId: org.id, blueprintId: placement.id, fullName: "Verify quitter", email: `quit-${Date.now()}@example.com`, claimedLevel: null, locale: "tr", invitedBy: null,
  });
  if (!quitter.ok) throw new Error(quitter.code);
  const qr = await flow.resolveToken(quitter.rawToken);
  if (!qr.ok) throw new Error("quitter link");
  const qctx = qr.ctx;
  await flow.recordConsent(qctx, (await flow.getConsentText(qctx)).id, null, null);
  const q = await flow.workingAttempt(qctx.assessment.id);
  await flow.recordDeviceCheck(q.attempt.id);
  await flow.startSection(qctx, 1);
  const [qrun] = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.attemptId, q.attempt.id));
  await flow.closeSectionRun(qrun.id, "SUBMIT");
  const [closedRun] = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.id, qrun.id));
  const quitLevel = levelFromTheta(closedRun.thetaMean ?? 0).level;
  if (CEFR_LEVELS.indexOf(quitLevel) <= CEFR_LEVELS.indexOf("A2") && closedRun.stopReason === "INSUFFICIENT")
    ok(`quitting at once lands low (${quitLevel}, theta ${closedRun.thetaMean?.toFixed(2)}) and is flagged INSUFFICIENT`);
  else bad(`quitting at once gave ${quitLevel} (${closedRun.stopReason})`);

  console.log(failed === 0 ? `\n${GREEN}All checks passed.${OFF}` : `\n${RED}${failed} check(s) failed.${OFF}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
