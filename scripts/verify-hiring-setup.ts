/**
 * End to end check of the hiring setup (plan 1), in process, against a
 * THROW-AWAY database (name ends in _check) with every migration applied:
 * openings, versions, draft editing, copying; Task 12 adds publishing.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-setup
 */
import "dotenv/config";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};
const check = (condition: boolean, label: string, detail?: string) => (condition ? ok(label) : bad(detail ? `${label}: ${detail}` : label));

async function expectCode(label: string, run: () => Promise<unknown>, code: string) {
  try {
    await run();
    bad(`${label}: was allowed`);
  } catch (error) {
    const got = (error as { code?: string }).code;
    if (got === code) ok(label);
    else bad(`${label}: ${got ?? ""} ${(error as Error).message}`);
  }
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
  if (!url.pathname.endsWith("_check")) {
    console.error(`Refusing: ${url.pathname} is not a throw-away *_check database.`);
    process.exit(2);
  }
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition, savePosition, setCompetencyArchived, setPositionArchived } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { loadCompetencyFacts, loadVersionContent, positionProfile } = await import("@/solutions/hiring/server/content");
  const { frozenAsConflict } = await import("@/solutions/hiring/server/errors");
  const { emptyActivity } = await import("@/solutions/hiring/rules/patches");

  const [org] = await db.insert(s.organizations).values({ name: "Hiring setup check" }).returning();
  const [owner] = await db
    .insert(s.users)
    .values({ orgId: org.id, email: `owner-${Date.now()}@check.local`, name: "Check Owner", role: "OWNER", passwordHash: "x" })
    .returning();
  const user = { id: owner.id, orgId: org.id, email: owner.email, name: owner.name, role: "OWNER" as const };
  await seedLibrary(org.id);
  const library = await db.select().from(s.competencies).where(eq(s.competencies.orgId, org.id));
  const byKey = (key: string) => library.find((c) => c.seedKey === key)!.id;
  const communication = byKey("communication");
  const problem = byKey("problem_solving");

  console.log("\nA position with a profile");
  const position = await createPosition(org.id, owner.id, { name: "Kıdemli Ürün Tasarımcısı", jobDescription: "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz." });
  if (!position.ok) throw new Error("position");
  await savePosition(org.id, owner.id, position.id, {
    name: "Kıdemli Ürün Tasarımcısı",
    team: "Ürün",
    shortDescription: "",
    jobDescription: "Ürün ekibimize kullanıcı araştırmasını yönetecek bir tasarımcı arıyoruz.",
    skills: [],
    languages: [],
    profile: [
      { competencyId: communication, weight: 60, expectedLevel: 3 },
      { competencyId: problem, weight: 20, expectedLevel: null },
    ],
  });
  ok("position saved with İletişim 60 and Problem Çözme 20");

  console.log("\nOpening an opening");
  const created = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  if (!created.ok) throw new Error(created.code);
  const id = created.openingId;
  const opening = await openings.loadOpening(org.id, id);
  check(opening?.status === "DRAFT" && opening.ownerId === owner.id && opening.decisionMakerId === owner.id, "DRAFT, owned and decided by its creator");
  check(created.next === `/hiring/openings/${id}/assessment/edit`, "a blank start lands in the builder", created.next);
  const [v1] = await versions.versionsOf(org.id, id);
  check(v1?.number === 1 && v1.status === "DRAFT", "v1 is a draft");
  const refused = await openings.createOpening(user, { position: { kind: "new", name: "İlansız", jobDescription: " " }, start: "AI", copyFrom: null, locale: "tr" });
  check(!refused.ok && refused.code === "JOB_AD_REQUIRED", "an AI start without a job ad is refused");
  const positionsNow = await db.select().from(s.positions).where(eq(s.positions.orgId, org.id));
  check(positionsNow.length === 1, "and it wrote nothing", `${positionsNow.length} positions`);

  console.log("\nEditing the draft");
  const s1 = await versions.addStage(org.id, id);
  await versions.updateStage(org.id, id, s1, { name: { tr: "Tanışma", en: "Introduction" }, durationSeconds: 480 });
  const a1 = await versions.addActivity(org.id, id, s1, "VIDEO");
  await versions.updateActivity(org.id, id, a1, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "" } });
  await versions.setActivityCompetencies(org.id, id, a1, [communication, problem]);
  await expectCode("a third competency is refused", () => versions.setActivityCompetencies(org.id, id, a1, [communication, problem, byKey("teamwork")]), "TOO_MANY_COMPETENCIES");
  const choice = await versions.addActivity(org.id, id, s1, "SINGLE_CHOICE");
  await expectCode("a choice question cannot measure a competency", () => versions.setActivityCompetencies(org.id, id, choice, [communication]), "CHOICE_COMPETENCY");
  const s2 = await versions.addStage(org.id, id);
  const s3 = await versions.addStage(org.id, id);
  await versions.moveStage(org.id, id, s3, -1);
  let content = await loadVersionContent(org.id, v1.id);
  check(content!.stages.map((x) => x.id).join() === [s1, s3, s2].join(), "moving a stage up swaps it with its neighbour");
  check(content!.stages.map((x) => x.orderIndex).join() === "0,1,2", "order stays 0..n-1");
  const removed = await versions.deleteStage(org.id, id, s1);
  content = await loadVersionContent(org.id, v1.id);
  check(content!.stages.length === 2 && content!.stages.every((x, i) => x.orderIndex === i), "deleting renumbers the rest");
  const restored = await versions.insertStage(org.id, id, removed.payload, removed.index);
  content = await loadVersionContent(org.id, v1.id);
  check(
    content!.stages[0].id === restored && content!.stages[0].activities.length === 2 && content!.stages[0].activities[0].competencyIds.length === 2,
    "undo puts the stage back in place with its questions and competencies",
  );
  await versions.deleteStage(org.id, id, s2);
  await versions.deleteStage(org.id, id, s3);
  const other = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  if (!other.ok) throw new Error(other.code);
  await expectCode("a stage of one opening cannot be edited through another", () => versions.updateStage(org.id, other.openingId, restored, { durationSeconds: 300 }), "NOT_FOUND");

  console.log("\nQuestions inside a stage");
  const [q1, q2] = content!.stages[0].activities.map((a) => a.id);
  await versions.moveActivity(org.id, id, q2, -1);
  content = await loadVersionContent(org.id, v1.id);
  check(content!.stages[0].activities.map((a) => a.id).join() === [q2, q1].join(), "moving a question up swaps it, ids kept");
  await versions.moveActivity(org.id, id, q1, 1);
  content = await loadVersionContent(org.id, v1.id);
  check(content!.stages[0].activities.map((a) => a.orderIndex).join() === "0,1", "moving past the end changes nothing");
  const removedQuestion = await versions.deleteActivity(org.id, id, q1);
  content = await loadVersionContent(org.id, v1.id);
  check(content!.stages[0].activities.length === 1 && content!.stages[0].activities[0].orderIndex === 0, "deleting a question renumbers the rest");
  const q1back = await versions.insertActivity(org.id, id, removedQuestion.stageId, removedQuestion.payload, removedQuestion.index);
  content = await loadVersionContent(org.id, v1.id);
  const back = content!.stages[0].activities.find((a) => a.id === q1back);
  check(back?.orderIndex === removedQuestion.index && back.competencyIds.join() === [communication, problem].join(), "undo puts the question back in place with its competencies");
  await versions.updateActivity(org.id, id, q1back, { type: "MULTI_CHOICE" });
  content = await loadVersionContent(org.id, v1.id);
  const switched = content!.stages[0].activities.find((a) => a.id === q1back)!;
  check(switched.competencyIds.length === 0 && (switched.config.choices?.length ?? 0) === 2, "switching to a choice type drops its competencies and brings choices");
  await versions.updateActivity(org.id, id, q1back, { type: "VIDEO" });
  await versions.setActivityCompetencies(org.id, id, q1back, [communication, problem]);

  console.log("\nValues the database would refuse are refused first");
  await expectCode("a 30 second stage", () => versions.updateStage(org.id, id, restored, { durationSeconds: 30 }), "INVALID");
  await expectCode("nine takes", () => versions.updateActivity(org.id, id, q1back, { maxTakes: 9 }), "INVALID");
  await expectCode("a negative think time", () => versions.updateActivity(org.id, id, q1back, { thinkSeconds: -1 }), "INVALID");
  await expectCode("a stage payload with a 10 hour stage", () => versions.insertStage(org.id, id, { ...removed.payload, durationSeconds: 36000 }), "INVALID");
  content = await loadVersionContent(org.id, v1.id);
  check(content!.stages.length === 1 && content!.stages[0].durationSeconds === 480, "and nothing was written");

  console.log("\nDraft weights");
  const half = await versions.saveDraftWeights(org.id, id, { enabled: true, weights: { [communication]: 50, [problem]: 40 } });
  check(!half.ok && half.total === 90, "weights that do not add up to 100 are refused with the total", JSON.stringify(half));
  const full = await versions.saveDraftWeights(org.id, id, { enabled: true, weights: { [communication]: 75, [problem]: 25, [byKey("teamwork")]: 100 } });
  content = await loadVersionContent(org.id, v1.id);
  const savedWeights = content!.draftWeights ?? {};
  check(
    full.ok && content!.weightsEnabled && savedWeights[communication] === 75 && savedWeights[problem] === 25 && Object.keys(savedWeights).length === 2,
    "75/25 is saved, an unmeasured competency is dropped",
    JSON.stringify(savedWeights),
  );
  await versions.saveDraftWeights(org.id, id, { enabled: false, weights: {} });
  content = await loadVersionContent(org.id, v1.id);
  check(!content!.weightsEnabled && content!.draftWeights === null, "weighting off clears the draft weights");
  const again = await versions.ensureDraftVersion(org.id, id);
  check(!again.created && again.versionId === v1.id, "an opening with a draft keeps it");

  console.log("\nCopying an opening");
  const copy = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id, locale: "tr" });
  if (!copy.ok) throw new Error(copy.code);
  const [copyVersion] = await versions.versionsOf(org.id, copy.openingId);
  const copied = await loadVersionContent(org.id, copyVersion.id);
  const source = await loadVersionContent(org.id, v1.id);
  check(copied!.stages.length === source!.stages.length && copied!.stages[0].activities.length === source!.stages[0].activities.length, "same structure");
  check(copied!.stages[0].id !== source!.stages[0].id, "new ids; the source is untouched");
  check(
    JSON.stringify(copied!.stages[0].activities.map((a) => a.competencyIds)) === JSON.stringify(source!.stages[0].activities.map((a) => a.competencyIds)),
    "competencies copied in their order",
  );

  console.log("\nAnother organisation sees and changes nothing");
  const [orgB] = await db.insert(s.organizations).values({ name: "Hiring setup check B" }).returning();
  const [ownerB] = await db
    .insert(s.users)
    .values({ orgId: orgB.id, email: `owner-b-${Date.now()}@check.local`, name: "Check Owner B", role: "OWNER", passwordHash: "x" })
    .returning();
  const userB = { id: ownerB.id, orgId: orgB.id };
  await seedLibrary(orgB.id);
  const [foreignCompetency] = await db
    .select({ id: s.competencies.id })
    .from(s.competencies)
    .where(and(eq(s.competencies.orgId, orgB.id), eq(s.competencies.seedKey, "communication")));
  check((await openings.loadOpening(orgB.id, id)) === null, "the opening does not load");
  check((await versions.versionsOf(orgB.id, id)).length === 0, "its versions do not list");
  check((await loadVersionContent(orgB.id, v1.id)) === null, "its content does not load");
  check((await openings.listOpenings(orgB.id, { id: ownerB.id, role: "OWNER" }, "DRAFT")).length === 0, "it is not in the other list");
  check((await openings.copySources(orgB.id)).length === 0, "it is not a copy source there");
  check((await positionProfile(orgB.id, position.id)).length === 0, "the position profile does not load");
  check((await loadCompetencyFacts(orgB.id, [communication])).size === 0, "the competency facts do not load");
  await expectCode("its stage cannot be edited", () => versions.updateStage(orgB.id, id, restored, { durationSeconds: 300 }), "NOT_FOUND");
  await expectCode("no draft can be opened on it", () => versions.ensureDraftVersion(orgB.id, id), "NOT_FOUND");
  await expectCode("a competency of another organisation cannot be measured", () => versions.setActivityCompetencies(org.id, id, q1back, [foreignCompetency.id]), "COMPETENCY");
  await expectCode(
    "nor brought in by an undo payload",
    () => versions.insertActivity(org.id, id, restored, { ...emptyActivity("VIDEO"), competencyIds: [foreignCompetency.id] }),
    "COMPETENCY",
  );
  const foreignPosition = await openings.createOpening(userB, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  check(!foreignPosition.ok && foreignPosition.code === "POSITION_NOT_FOUND", "a position of another organisation is not found");
  const foreignCopy = await openings.createOpening(userB, { position: { kind: "new", name: "B pozisyonu", jobDescription: "" }, start: "COPY", copyFrom: id, locale: "tr" });
  check(!foreignCopy.ok && foreignCopy.code === "COPY_SOURCE_NOT_FOUND", "an opening of another organisation is not a copy source");
  await expectCode(
    "a user of another organisation cannot open an opening here",
    () => openings.createOpening({ id: ownerB.id, orgId: org.id }, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null, locale: "tr" }),
    "NOT_FOUND",
  );
  const bOpenings = await db.select().from(s.hiringOpenings).where(eq(s.hiringOpenings.orgId, orgB.id));
  const bPositions = await db.select().from(s.positions).where(eq(s.positions.orgId, orgB.id));
  check(bOpenings.length === 0 && bPositions.length === 0, "and no refused start wrote a row", `${bOpenings.length} openings, ${bPositions.length} positions`);

  console.log("\nArchived library rows are read-only");
  const spare = await createPosition(org.id, owner.id, { name: "Arşivlik pozisyon" });
  if (!spare.ok) throw new Error("spare position");
  await setPositionArchived(org.id, owner.id, spare.id, true);
  const archivedStart = await openings.createOpening(user, { position: { kind: "existing", id: spare.id }, start: "BLANK", copyFrom: null, locale: "tr" });
  check(!archivedStart.ok && archivedStart.code === "POSITION_NOT_FOUND", "an archived position cannot start an opening");
  const teamwork = byKey("teamwork");
  const kept = await versions.addActivity(org.id, id, restored, "LONG_TEXT");
  await versions.setActivityCompetencies(org.id, id, kept, [teamwork]);
  await setCompetencyArchived(org.id, owner.id, teamwork, true);
  await versions.setActivityCompetencies(org.id, id, kept, [teamwork]);
  ok("a question keeps a competency archived after it was chosen");
  const fresh = await versions.addStage(org.id, other.openingId);
  const freshQuestion = await versions.addActivity(org.id, other.openingId, fresh, "VIDEO");
  await expectCode("an archived competency cannot be newly chosen", () => versions.setActivityCompetencies(org.id, other.openingId, freshQuestion, [teamwork]), "COMPETENCY");
  await versions.deleteActivity(org.id, id, kept);
  await setCompetencyArchived(org.id, owner.id, teamwork, false);

  console.log("\nA published version is frozen");
  const frozen = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id, locale: "tr" });
  if (!frozen.ok) throw new Error(frozen.code);
  const [fv1] = await versions.versionsOf(org.id, frozen.openingId);
  // Task 12 owns publishing; this marks the version published directly to exercise the frozen paths.
  await db
    .update(s.hiringVersions)
    .set({ status: "PUBLISHED", scorecard: { scale: { min: 1, max: 5, levels: [] }, competencies: [], weightsEnabled: false }, publishedAt: new Date(), publishedBy: owner.id })
    .where(eq(s.hiringVersions.id, fv1.id));
  await expectCode("the builder has no draft to edit", () => versions.addStage(org.id, frozen.openingId), "NO_DRAFT");
  await expectCode(
    "a write that reaches the frozen version is answered NO_DRAFT, not 23514",
    () => frozenAsConflict(() => db.insert(s.hiringStages).values({ versionId: fv1.id, orderIndex: 9, name: { tr: "Sızma", en: "" } })),
    "NO_DRAFT",
  );
  const v2 = await versions.ensureDraftVersion(org.id, frozen.openingId);
  const list = await versions.versionsOf(org.id, frozen.openingId);
  check(v2.created && list.map((v) => `${v.number}${v.status[0]}`).join() === "2D,1P", "editing opens v2 as a draft", list.map((v) => `${v.number}${v.status[0]}`).join());
  const v2content = await loadVersionContent(org.id, v2.versionId);
  const v1content = await loadVersionContent(org.id, fv1.id);
  check(
    v2content!.stages.length === v1content!.stages.length && v2content!.stages[0].id !== v1content!.stages[0].id && v2content!.stages[0].activities.length === v1content!.stages[0].activities.length,
    "v2 is a copy with new ids",
  );
  await versions.updateStage(org.id, frozen.openingId, v2content!.stages[0].id, { durationSeconds: 900 });
  check((await loadVersionContent(org.id, fv1.id))!.stages[0].durationSeconds === v1content!.stages[0].durationSeconds, "editing v2 leaves v1 as published");

  // TASK 12: publishing checks go here.

  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
