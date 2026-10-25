/**
 * A candidate with no German at all, end to end in process: the placement and
 * the level check (claims A1 and A2) taken by a student who answers everything
 * at random ("guess") or leaves everything blank ("blank"), writing and
 * speaking included. Round 2 (2026-10-24) meant the result of such a student
 * to be A0 and, for a level check, FAIL; this runs the real flow (invitation,
 * sections, closing, the rule that proposes A0 for an empty answer, the result
 * computation) and prints what comes out for each student.
 *
 * It writes invitations and attempts, so it only runs against a throw-away
 * local copy of the database, never `kademe` nor `kademe_platform`:
 *   docker exec kademe-db createdb -U kademe kademe_wp5   (then restore a dump into it)
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_wp5 pnpm tsx scripts/verify-no-german.ts
 * Options: STUDENTS=n per case (default 4).
 */
import "dotenv/config";
import { refuseUnlessWorkingDb } from "../src/db/working-db-guard";
import type { ItemAnswer, ItemSnapshot } from "../src/lib/exam/types";

type Behaviour = "guess" | "blank";

async function main() {
  const refusal = refuseUnlessWorkingDb(process.env.DATABASE_URL);
  const name = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname : "";
  if (refusal || name === "/kademe_platform") {
    console.error(`Refusing: ${refusal ?? "kademe_platform is the shared working database. Use a copy."}`);
    process.exit(2);
    return;
  }
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { createInvitation } = await import("../src/server/invite");
  const { ensureTemplateBlueprint } = await import("../src/server/template-blueprint");
  const { examTemplateByKey } = await import("../src/lib/exam/templates");
  const { mulberry32 } = await import("../src/lib/exam/adaptive");
  const flow = await import("../src/lib/exam-flow");

  const [org] = await db.select().from(s.organizations).limit(1);
  const [user] = await db.select().from(s.users).limit(1);
  if (!org || !user) throw new Error("no organisation or user: the copy needs seed data");

  const blueprintFor = async (key: "placement" | "level-check") => {
    const template = examTemplateByKey(key)!;
    const result = await ensureTemplateBlueprint(org.id, user.id, template, "en");
    if (!result.ok) throw new Error(`template ${key}: ${result.code}`);
    return result.blueprint;
  };

  /** A random answer for an objective item, as a student who knows no German would give: whatever is offered. */
  const guess = (snap: ItemSnapshot, rng: () => number, alias: (id: string) => string): ItemAnswer => {
    const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];
    const c = snap.content;
    if (c.kind === "CHOICE") {
      const n = Math.max(1, c.pick ?? 1);
      const shuffled = [...c.options].sort(() => rng() - 0.5).slice(0, n);
      return { choiceIds: shuffled.map((o) => alias(o.id)) };
    }
    if (c.kind === "TFNG") {
      const values = c.twoWay ? (["R", "F"] as const) : (["R", "F", "NG"] as const);
      return { tfng: Object.fromEntries(c.statements.map((st) => [st.id, pick([...values])])) };
    }
    if (c.kind === "GAP") {
      // A typed gap stays empty (nobody guesses a German word); a drop-down gets a random choice.
      return { gaps: Object.fromEntries(c.gaps.map((g) => [g.id, g.choices?.length ? pick(g.choices) : ""])) };
    }
    if (c.kind === "MATCHING") {
      const rights = c.right.map((r) => alias(r.id));
      const order = [...rights].sort(() => rng() - 0.5);
      return { matches: Object.fromEntries(c.left.map((l, i) => [l.id, order[i % order.length]])) };
    }
    return {};
  };

  async function take(rawToken: string, behaviour: Behaviour, rng: () => number) {
    const resolved = await flow.resolveExamToken(rawToken);
    if (!resolved.ok) throw new Error(`token does not resolve: ${resolved.problem}`);
    const ctx = resolved.ctx;
    if (!(await flow.hasConsented(ctx.assessment.id))) {
      const text = await flow.getConsentText(ctx);
      await flow.recordConsent(ctx, text.id, "127.0.0.1", "kademe-verify-no-german");
    }
    const { attempt } = await flow.workingAttempt(ctx.assessment.id);
    await flow.recordDeviceCheck(attempt.id);
    for (let guard = 0; guard < 600; guard++) {
      const state = await flow.loadState(ctx);
      if (state.step === "DONE") return attempt.id;
      if (state.step === "SECTION_INTRO") {
        const started = await flow.startSection(ctx, state.current!.position);
        if (!started.ok) throw new Error(`section start refused: ${started.code}`);
        continue;
      }
      if (state.step === "ITEM" && state.current?.nav?.review) {
        const current = await flow.currentSection(ctx);
        if (!current?.run) throw new Error("review step without an open section");
        await flow.closeSectionRun(current.run.id, "SUBMIT");
        continue;
      }
      if (state.step !== "ITEM" || !state.current?.item) throw new Error(`unexpected step ${state.step}`);
      const { position } = state.current;
      const sequence = state.current.item.sequence;
      const check = await flow.checkWrite(ctx, position, sequence);
      if (!check.ok) throw new Error(`write refused: ${check.code}`);
      const [row] = await db
        .select()
        .from(s.itemResponses)
        .where(and(eq(s.itemResponses.sectionRunId, check.run.id), eq(s.itemResponses.sequence, sequence)));
      const snap = row.itemSnapshot;
      const alias = (id: string) => row.presentation.alias?.[id] ?? id;
      let answer: ItemAnswer;
      if (snap.content.kind === "WRITING") answer = { text: "" };
      else if (snap.content.kind === "SPEAKING") answer = { text: "", usedTextAlternative: true };
      else answer = behaviour === "guess" ? guess(snap, rng, alias) : {};
      await flow.commitAnswer(ctx, check.run, check.response, answer);
    }
    throw new Error("the exam did not finish");
  }

  const cases: Array<{ label: string; key: "placement" | "level-check"; claimed: "A1" | "A2" | null }> = [
    { label: "placement", key: "placement", claimed: null },
    { label: "level check, claim A1", key: "level-check", claimed: "A1" },
    { label: "level check, claim A2", key: "level-check", claimed: "A2" },
  ];
  const students = Number(process.env.STUDENTS ?? 4);
  let failed = 0;
  for (const c of cases) {
    const blueprint = await blueprintFor(c.key);
    for (const behaviour of ["guess", "blank"] as const) {
      const tally = new Map<string, number>();
      let n = 0;
      for (let i = 0; i < students; i++) {
        const invite = await createInvitation({
          orgId: org.id,
          blueprintId: blueprint.id,
          fullName: `No German ${c.label} ${behaviour} ${i}`,
          email: `no-german-${c.key}-${behaviour}-${i}-${Date.now()}@example.com`,
          claimedLevel: c.claimed,
          locale: "en",
          invitedBy: null,
        });
        if (!invite.ok) throw new Error(invite.code);
        const attemptId = await take(invite.rawToken, behaviour, mulberry32(1000 + i * 31 + (behaviour === "guess" ? 7 : 0)));
        const [result] = await db.select().from(s.examResults).where(eq(s.examResults.attemptId, attemptId));
        const computed = result?.computed;
        const skills = Object.entries(computed?.skills ?? {})
          .map(([section, sk]) => `${section.slice(0, 4)}=${sk?.level ?? "?"}`)
          .join(" ");
        const outcome = computed?.verification?.outcome ?? "-";
        const line = `overall ${computed?.overall ?? "null"}, status ${result?.status}, verification ${outcome}${computed?.reviewReasons?.length ? ` (${computed.reviewReasons.join(",")})` : ""}`;
        if (i === 0) console.log(`  e.g. ${c.label}, ${behaviour}: ${line}; skills ${skills}`);
        const gradings = await db
          .select({ g: s.responseGradings })
          .from(s.responseGradings)
          .innerJoin(s.itemResponses, eq(s.itemResponses.id, s.responseGradings.itemResponseId))
          .innerJoin(s.sectionRuns, eq(s.sectionRuns.id, s.itemResponses.sectionRunId))
          .where(eq(s.sectionRuns.attemptId, attemptId));
        const ruled = gradings.filter(({ g }) => g.status === "AI_PROPOSED" && g.aiModel === "rule" && g.aiLevel === "A0").length;
        const key = `${computed?.overall ?? "null"} / ${outcome} / ${ruled}of${gradings.length} blank tasks A0 by rule`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
        n++;
      }
      console.log(`${c.label}, ${behaviour}: ${n} students`);
      for (const [key, count] of tally) console.log(`    ${count} x ${key}`);
      const allA0 = [...tally.keys()].every((k) => k.startsWith("A0 /"));
      const allFail = c.claimed === null || [...tally.keys()].every((k) => k.includes("/ FAIL /"));
      if (!allA0 || !allFail) {
        failed++;
        console.log(`    NOT as round 2 meant (A0${c.claimed ? " and FAIL" : ""} for every student)`);
      }
    }
  }
  console.log(failed === 0 ? "\nAll no-German cases came out A0 (and FAIL for a level check)." : `\n${failed} case(s) did not come out as round 2 meant.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
