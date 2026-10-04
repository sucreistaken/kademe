/**
 * End to end check of the hiring setup (plan 1), in process, against a
 * THROW-AWAY database (name ends in _check) with every migration applied:
 * openings, versions, draft editing, copying, publishing, weight sets after
 * publishing, and the publish lock order on two connections.
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
  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition, savePosition, setCompetencyArchived, setPositionArchived } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { loadCompetencyFacts, loadVersionContent, positionProfile } = await import("@/solutions/hiring/server/content");
  const { publishDraft } = await import("@/solutions/hiring/server/publish");
  const { addWeightSet } = await import("@/solutions/hiring/server/weight-sets");
  const { saveCompetency, createCompetency } = await import("@/server/library-write");
  const postgres = (await import("postgres")).default;
  const { frozenAsConflict } = await import("@/solutions/hiring/server/errors");
  const { emptyActivity, MAX_ACTIVITIES_PER_STAGE } = await import("@/solutions/hiring/rules/patches");

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
  const created = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!created.ok) throw new Error(created.code);
  const id = created.openingId;
  const opening = await openings.loadOpening(org.id, id);
  check(opening?.status === "DRAFT" && opening.ownerId === owner.id && opening.decisionMakerId === owner.id, "DRAFT, owned and decided by its creator");
  check(created.next === `/hiring/openings/${id}/assessment/edit`, "a blank start opens the builder (C7)", created.next);
  const [v1] = await versions.versionsOf(org.id, id);
  check(v1?.number === 1 && v1.status === "DRAFT", "v1 is a draft");
  const refused = await openings.createOpening(user, { position: { kind: "new", name: "İlansız", jobDescription: " " }, start: "AI", copyFrom: null });
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
  const other = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
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
  check(!half.ok && half.code === "NOT_100" && half.total === 90, "weights that do not add up to 100 are refused with the total", JSON.stringify(half));
  const notWhole = await versions.saveDraftWeights(org.id, id, { enabled: true, weights: { [communication]: 70.5, [problem]: 29.5 } });
  check(!notWhole.ok && notWhole.code === "NOT_WHOLE", "a weight that is not whole is NOT_WHOLE, not NOT_100 (it adds up to 100)", JSON.stringify(notWhole));
  const staleDraft = await versions.saveDraftWeights(org.id, id, { versionId: (await versions.versionsOf(org.id, other.openingId))[0].id, enabled: true, weights: { [communication]: 75, [problem]: 25 } });
  check(!staleDraft.ok && staleDraft.code === "STALE", "weights for another version than the draft are STALE", JSON.stringify(staleDraft));
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
  const intro = { tr: "Hoş geldiniz", en: "Welcome" };
  await db
    .update(s.hiringVersions)
    .set({ defaultLocale: "en", localeSet: ["tr", "en"], introTitle: intro, introBody: intro, proctorLevel: "STRICT", practiceEnabled: false, weightsEnabled: true, draftWeights: { [communication]: 75, [problem]: 25 } })
    .where(eq(s.hiringVersions.id, v1.id));
  const copy = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id });
  if (!copy.ok) throw new Error(copy.code);
  check(copy.next === `/hiring/openings/${copy.openingId}/assessment/edit`, "a copied start opens the builder (C7)", copy.next);
  const [copyVersion] = await versions.versionsOf(org.id, copy.openingId);
  const copied = await loadVersionContent(org.id, copyVersion.id);
  const source = await loadVersionContent(org.id, v1.id);
  check(copied!.stages.length === source!.stages.length && copied!.stages[0].activities.length === source!.stages[0].activities.length, "same structure");
  check(copied!.stages[0].id !== source!.stages[0].id, "new ids; the source is untouched");
  check(
    JSON.stringify(copied!.stages[0].activities.map((a) => a.competencyIds)) === JSON.stringify(source!.stages[0].activities.map((a) => a.competencyIds)),
    "competencies copied in their order",
  );
  const [copiedRow] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, copyVersion.id));
  check(
    copiedRow.defaultLocale === "en" &&
      copiedRow.localeSet.join() === "tr,en" &&
      copiedRow.introTitle?.en === "Welcome" &&
      copiedRow.introBody?.tr === "Hoş geldiniz" &&
      copiedRow.proctorLevel === "STRICT" &&
      !copiedRow.practiceEnabled,
    "languages, intro, proctoring and practice come with the copy",
  );
  check(!copiedRow.weightsEnabled && copiedRow.draftWeights === null, "weights do not");
  // Back to the defaults, so later sections start from a plain draft.
  await db
    .update(s.hiringVersions)
    .set({ defaultLocale: "tr", localeSet: ["tr"], introTitle: null, introBody: null, proctorLevel: "BASIC", practiceEnabled: true, weightsEnabled: false, draftWeights: null })
    .where(eq(s.hiringVersions.id, v1.id));

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
  const foreignPosition = await openings.createOpening(userB, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  check(!foreignPosition.ok && foreignPosition.code === "POSITION_NOT_FOUND", "a position of another organisation is not found");
  const foreignCopy = await openings.createOpening(userB, { position: { kind: "new", name: "B pozisyonu", jobDescription: "" }, start: "COPY", copyFrom: id });
  check(!foreignCopy.ok && foreignCopy.code === "COPY_SOURCE_NOT_FOUND", "an opening of another organisation is not a copy source");
  await expectCode(
    "a user of another organisation cannot open an opening here",
    () => openings.createOpening({ id: ownerB.id, orgId: org.id }, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null }),
    "NOT_FOUND",
  );
  const bOpenings = await db.select().from(s.hiringOpenings).where(eq(s.hiringOpenings.orgId, orgB.id));
  const bPositions = await db.select().from(s.positions).where(eq(s.positions.orgId, orgB.id));
  check(bOpenings.length === 0 && bPositions.length === 0, "and no refused start wrote a row", `${bOpenings.length} openings, ${bPositions.length} positions`);

  console.log("\nArchived library rows are read-only");
  const spare = await createPosition(org.id, owner.id, { name: "Arşivlik pozisyon" });
  if (!spare.ok) throw new Error("spare position");
  await setPositionArchived(org.id, owner.id, spare.id, true);
  const archivedStart = await openings.createOpening(user, { position: { kind: "existing", id: spare.id }, start: "BLANK", copyFrom: null });
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

  console.log("\nUndo gives back what a delete removed");
  const keptGone = await versions.deleteActivity(org.id, id, kept);
  const keptBack = await versions.insertActivity(org.id, id, keptGone.stageId, keptGone.payload, keptGone.index, { restore: true });
  content = await loadVersionContent(org.id, v1.id);
  check(
    content!.stages[0].activities.find((a) => a.id === keptBack)?.competencyIds.join() === teamwork,
    "a question with a competency archived since comes back with it",
  );
  await expectCode("a new question may still not bring the archived competency", () => versions.insertActivity(org.id, id, restored, keptGone.payload), "COMPETENCY");
  await versions.deleteActivity(org.id, id, keptBack);
  await setCompetencyArchived(org.id, owner.id, teamwork, false);
  for (let i = 1; i < MAX_ACTIVITIES_PER_STAGE; i += 1) await versions.addActivity(org.id, other.openingId, fresh, i % 2 ? "LONG_TEXT" : "VIDEO");
  await expectCode(`a stage holds at most ${MAX_ACTIVITIES_PER_STAGE} questions`, () => versions.addActivity(org.id, other.openingId, fresh, "VIDEO"), "STAGE_FULL");
  await expectCode("also through an insert", () => versions.insertActivity(org.id, other.openingId, fresh, emptyActivity("VIDEO")), "STAGE_FULL");
  const fullGone = await versions.deleteStage(org.id, other.openingId, fresh);
  const fullBack = await versions.insertStage(org.id, other.openingId, fullGone.payload, fullGone.index, { restore: true });
  const [otherVersion] = await versions.versionsOf(org.id, other.openingId);
  const otherContent = await loadVersionContent(org.id, otherVersion.id);
  check(
    otherContent!.stages.length === 1 && otherContent!.stages[0].id === fullBack && otherContent!.stages[0].activities.length === MAX_ACTIVITIES_PER_STAGE,
    "a full stage comes back whole after delete and undo",
    `${otherContent!.stages[0]?.activities.length} questions`,
  );

  console.log("\nA closed opening is history");
  const closing = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!closing.ok) throw new Error(closing.code);
  await db.update(s.hiringOpenings).set({ status: "CLOSED", closedAt: new Date() }).where(eq(s.hiringOpenings.id, closing.openingId));
  await expectCode("its draft cannot be edited", () => versions.addStage(org.id, closing.openingId), "CLOSED");
  await expectCode("no new draft can be opened", () => versions.ensureDraftVersion(org.id, closing.openingId), "CLOSED");

  console.log("\nA published version is frozen");
  const frozen = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id });
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

  console.log("\nThe preview stamp (Önizleme yapıldı)");
  const previewedOf = async (versionId: string) =>
    (await db.select({ at: s.hiringVersions.previewedAt }).from(s.hiringVersions).where(eq(s.hiringVersions.id, versionId)))[0].at;
  await expectCode("another organisation cannot stamp it", () => versions.markPreviewed(orgB.id, frozen.openingId, v2.versionId), "NOT_FOUND");
  check((await previewedOf(v2.versionId)) === null, "and the draft is not stamped by it");
  check((await versions.markPreviewed(org.id, frozen.openingId, fv1.id)) === false, "the published v1 is never stamped (only a draft is)");
  check((await previewedOf(fv1.id)) === null, "v1 has no stamp");
  check((await versions.markPreviewed(org.id, frozen.openingId, v2.versionId)) === true, "the draft the preview showed is stamped");
  check((await previewedOf(v2.versionId)) !== null && (await previewedOf(fv1.id)) === null, "v2 is stamped, v1 still is not");
  await expectCode("a closed opening's draft is not stamped", () => versions.markPreviewed(org.id, closing.openingId), "CLOSED");

  console.log("\nTeam and rules (Ekip ve kurallar)");
  const { deadlineToDate } = await import("@/solutions/hiring/rules/opening-rules");
  const { ORG_TIMEZONE, orgDay } = await import("@/lib/org-timezone");
  const person = async (role: "MANAGER" | "REVIEWER", name: string, disabled = false) =>
    (
      await db
        .insert(s.users)
        .values({ orgId: org.id, email: `${name.toLowerCase()}-${Date.now()}@check.local`, name, role, passwordHash: "x", disabledAt: disabled ? new Date() : null })
        .returning()
    )[0];
  const manager = await person("MANAGER", "Manager");
  const reviewer = await person("REVIEWER", "Reviewer");
  const bystander = await person("REVIEWER", "Bystander");
  const gone = await person("MANAGER", "Gone", true);
  const team = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!team.ok) throw new Error(team.code);
  const rules = {
    name: "Tasarımcı · Ekip",
    memberIds: [reviewer.id, manager.id],
    decisionMakerId: owner.id,
    backupDecisionMakerId: manager.id,
    minEvaluations: 3,
    blindMode: true,
    deadline: "2099-12-31",
    feedbackDays: 14,
    candidateContactEmail: "ik@check.local",
  };
  const teamRow = async () => (await db.select().from(s.hiringOpenings).where(eq(s.hiringOpenings.id, team.openingId)))[0];
  const panelOf = async () => (await db.select().from(s.hiringOpeningMembers).where(eq(s.hiringOpeningMembers.openingId, team.openingId))).map((m) => m.userId).sort();
  const saved = await openings.saveOpeningRules(org.id, owner.id, team.openingId, rules);
  check(saved.ok, "the rules save", JSON.stringify(saved));
  const afterSave = await teamRow();
  check(
    afterSave.name === rules.name && afterSave.decisionMakerId === owner.id && afterSave.backupDecisionMakerId === manager.id && afterSave.minEvaluations === 3 && afterSave.blindMode && afterSave.feedbackDays === 14 && afterSave.candidateContactEmail === "ik@check.local",
    "name, decision maker, backup, minimum, blind mode, reply promise and address are stored",
  );
  check(afterSave.deadlineAt?.getTime() === deadlineToDate("2099-12-31").getTime(), "the deadline is stored as the end of that day", afterSave.deadlineAt?.toISOString());
  const [wall] = await db.execute<{ local: string }>(sql`select to_char(deadline_at at time zone ${ORG_TIMEZONE}, 'YYYY-MM-DD HH24:MI:SS') as local from hiring_openings where id = ${team.openingId}`);
  check(wall.local === "2099-12-31 23:59:59", `in ${ORG_TIMEZONE} it reads 23:59:59 on the day (database clock)`, wall.local);
  check(orgDay(afterSave.deadlineAt!) === "2099-12-31", "and the form shows the same day back");
  check((await panelOf()).join() === [reviewer.id, manager.id].sort().join(), "the panel holds the two evaluators");
  const [audit] = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.subjectId, team.openingId), eq(s.auditLogs.action, "hiring.opening.rules")));
  check(audit?.actorId === owner.id && audit.orgId === org.id, "the change is audited with who made it");

  const refusedWith = async (label: string, patch: Partial<typeof rules>, problem: string) => {
    const result = await openings.saveOpeningRules(org.id, owner.id, team.openingId, { ...rules, ...patch });
    check(!result.ok && result.problems.includes(problem as never), label, JSON.stringify(result));
  };
  await refusedWith("another organisation's user cannot be on the panel", { memberIds: [ownerB.id] }, "MEMBER_UNKNOWN");
  await refusedWith("nor decide", { decisionMakerId: ownerB.id }, "DECISION_MAKER_ROLE");
  await refusedWith("a disabled manager cannot be the backup", { backupDecisionMakerId: gone.id }, "BACKUP_ROLE");
  await refusedWith("a reviewer cannot decide", { decisionMakerId: reviewer.id }, "DECISION_MAKER_ROLE");
  await refusedWith("the backup is someone else", { backupDecisionMakerId: owner.id }, "BACKUP_SAME");
  await refusedWith("a past deadline is refused", { deadline: "2020-01-01" }, "DEADLINE_PAST");
  await refusedWith("so is an address that is not one", { candidateContactEmail: "ik@" }, "EMAIL");
  await expectCode("another organisation cannot change the rules", () => openings.saveOpeningRules(orgB.id, ownerB.id, team.openingId, rules), "NOT_FOUND");
  await expectCode("a user of another organisation cannot change them here", () => openings.saveOpeningRules(org.id, ownerB.id, team.openingId, rules), "NOT_FOUND");
  check((await teamRow()).updatedAt.getTime() === afterSave.updatedAt.getTime() && (await panelOf()).length === 2, "and no refusal changed anything");

  // Fix round 1: a passed deadline blocks only a change of it; a rename stays unique in the organisation.
  const passedDay = orgDay(new Date(Date.now() - 3 * 24 * 3600 * 1000));
  await db.update(s.hiringOpenings).set({ deadlineAt: deadlineToDate(passedDay) }).where(eq(s.hiringOpenings.id, team.openingId));
  const keptPassed = await openings.saveOpeningRules(org.id, owner.id, team.openingId, { ...rules, deadline: passedDay, feedbackDays: 21 });
  check(keptPassed.ok && (await teamRow()).feedbackDays === 21, "with the deadline passed, the rest still saves when the deadline is left as it is", JSON.stringify(keptPassed));
  check((await teamRow()).deadlineAt?.getTime() === deadlineToDate(passedDay).getTime(), "and the passed deadline is kept as it was");
  await refusedWith("moving it to another past day is refused", { deadline: orgDay(new Date(Date.now() - 2 * 24 * 3600 * 1000)) }, "DEADLINE_PAST");
  check((await openings.saveOpeningRules(org.id, owner.id, team.openingId, rules)).ok, "moving it to a future day saves");
  const twin = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!twin.ok) throw new Error(twin.code);
  const renamed = await openings.saveOpeningRules(org.id, owner.id, twin.openingId, rules);
  check(renamed.ok && renamed.name === `${rules.name} (2)`, "renaming another opening to a taken name numbers it", JSON.stringify(renamed));
  const sameName = await openings.saveOpeningRules(org.id, owner.id, team.openingId, rules);
  check(sameName.ok && sameName.name === rules.name, "saving an opening under its own name keeps it", JSON.stringify(sameName));
  const [rulesAudit] = await db
    .select({ meta: s.auditLogs.meta })
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.subjectId, twin.openingId), eq(s.auditLogs.action, "hiring.opening.rules")));
  const meta = rulesAudit?.meta as { name?: string; candidateContactEmail?: string } | undefined;
  check(meta?.name === `${rules.name} (2)` && meta?.candidateContactEmail === "ik@check.local", "the audit row records the stored name and the contact address");

  const seen = async (who: { id: string; role: "OWNER" | "MANAGER" | "REVIEWER" }) =>
    (await openings.listOpenings(org.id, who, "DRAFT")).some((o) => o.id === team.openingId);
  check(await seen({ id: reviewer.id, role: "REVIEWER" }), "a reviewer on the panel sees the opening");
  check(!(await seen({ id: bystander.id, role: "REVIEWER" })), "a reviewer outside it does not");
  check((await openings.saveOpeningRules(org.id, owner.id, team.openingId, { ...rules, memberIds: [manager.id] })).ok, "taking the reviewer off the panel saves");
  check(!(await seen({ id: reviewer.id, role: "REVIEWER" })), "and the opening is gone from their list");

  await expectCode("another organisation cannot close it", () => openings.setOpeningClosed(orgB.id, ownerB.id, team.openingId, true), "NOT_FOUND");
  await openings.setOpeningClosed(org.id, owner.id, team.openingId, true);
  const closedRow = await teamRow();
  check(closedRow.status === "CLOSED" && closedRow.closedAt !== null, "closing makes it CLOSED with the time");
  await expectCode("a closed opening's rules cannot change", () => openings.saveOpeningRules(org.id, owner.id, team.openingId, rules), "CLOSED");
  await openings.setOpeningClosed(org.id, owner.id, team.openingId, true);
  check((await teamRow()).closedAt?.getTime() === closedRow.closedAt?.getTime(), "closing it again changes nothing");
  await openings.setOpeningClosed(org.id, owner.id, team.openingId, false);
  const reopened = await teamRow();
  check(reopened.status === "DRAFT" && reopened.closedAt === null, "reopening without a published version gives DRAFT");
  const trail = await db.select({ action: s.auditLogs.action }).from(s.auditLogs).where(eq(s.auditLogs.subjectId, team.openingId));
  check(
    trail.filter((a) => a.action === "hiring.opening.close").length === 1 && trail.filter((a) => a.action === "hiring.opening.reopen").length === 1,
    "one close and one reopen are audited",
    trail.map((a) => a.action).join(),
  );
  const liveTeam = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!liveTeam.ok) throw new Error(liveTeam.code);
  const [liveV1] = await versions.versionsOf(org.id, liveTeam.openingId);
  await db
    .update(s.hiringVersions)
    .set({ status: "PUBLISHED", scorecard: { scale: { min: 1, max: 5, levels: [] }, competencies: [], weightsEnabled: false }, publishedAt: new Date(), publishedBy: owner.id })
    .where(eq(s.hiringVersions.id, liveV1.id));
  await openings.setOpeningClosed(org.id, owner.id, liveTeam.openingId, true);
  await openings.setOpeningClosed(org.id, owner.id, liveTeam.openingId, false);
  check((await db.select().from(s.hiringOpenings).where(eq(s.hiringOpenings.id, liveTeam.openingId)))[0].status === "OPEN", "reopening with a published version gives OPEN");

  console.log("\nThe publish gate");
  const bare = await createCompetency(org.id, owner.id, { name: { tr: "Analitik düşünme", en: "" }, description: { tr: "", en: "" } });
  if (!bare.ok) throw new Error("competency");
  const [live1] = await versions.versionsOf(org.id, id);
  const firstStage = (await loadVersionContent(org.id, live1.id))!.stages[0];
  // Found by type: the editing sections above leave the choice question first.
  const videoId = firstStage.activities.find((a) => a.type === "VIDEO")!.id;
  const choiceId = firstStage.activities.find((a) => a.type === "SINGLE_CHOICE")!.id;
  await versions.setActivityCompetencies(org.id, id, videoId, [communication, bare.id]);
  let outcome = await publishDraft(org.id, id, owner.id);
  check(
    !outcome.ok && outcome.problems.some((p) => p.code === "ANCHOR_MISSING" && p.competencyId === bare.id && p.level === 1),
    "a competency without anchors blocks publishing",
    JSON.stringify(outcome),
  );
  check(!outcome.ok && outcome.problems.some((p) => p.code === "CHOICE_NEEDS_ANSWER" || p.code === "CHOICE_NEEDS_OPTIONS"), "so does a choice question without options");
  check((await versions.versionsOf(org.id, id))[0].status === "DRAFT", "a refused publish changes nothing");
  await saveCompetency(org.id, owner.id, bare.id, {
    name: { tr: "Analitik düşünme", en: "" },
    description: { tr: "", en: "" },
    anchors: {
      1: { tr: "Veriye bakmadan sonuca atlıyor.", en: "" },
      3: { tr: "Veriyi iki boyutta ayırıyor ve bir sonuç çıkarıyor.", en: "" },
      5: { tr: "Veriyi ayırıyor, sonucu sınıyor ve eksik veriyi söylüyor.", en: "" },
    },
    tags: [],
    markReviewed: false,
  });
  await versions.updateActivity(org.id, id, choiceId, {
    prompt: { tr: "Hangisi bir kullanıcı araştırması yöntemidir?", en: "" },
    config: {
      choices: [
        { id: "a", label: { tr: "Görüşme", en: "Interview" }, correct: true },
        { id: "b", label: { tr: "Fatura", en: "Invoice" } },
      ],
    },
  });
  await versions.setActivityCompetencies(org.id, id, videoId, [communication, problem]);
  await expectCode("another organisation cannot publish it", () => publishDraft(orgB.id, id, ownerB.id), "NOT_FOUND");
  await expectCode("a user of another organisation cannot publish here", () => publishDraft(org.id, id, ownerB.id), "NOT_FOUND");
  check((await versions.versionsOf(org.id, id))[0].status === "DRAFT", "and neither refusal changed anything");
  outcome = await publishDraft(org.id, id, owner.id);
  check(outcome.ok, "a complete draft publishes", JSON.stringify(outcome));

  console.log("\nWhat publishing wrote");
  const [published] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(published.status === "PUBLISHED" && published.publishedBy === owner.id && published.publishedAt !== null, "v1 is published, by whom and when");
  check(published.scorecard!.competencies.map((c) => c.id).join() === [communication, problem].join(), "the scorecard lists exactly the measured competencies");
  check(published.scorecard!.competencies.map((c) => c.weight).join() === "75,25", "weights come from the profile, scaled to 100", published.scorecard!.competencies.map((c) => c.weight).join());
  check(published.scorecard!.weightsEnabled === false, "weighting is off by default (plain average)");
  const sets = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  check(sets.length === 1 && sets[0].isActive === false, "the first weight set is written from the scorecard");
  const firstWeights = await db.select().from(s.hiringWeights).where(eq(s.hiringWeights.weightSetId, sets[0].id));
  check(
    firstWeights.length === 2 && Number(firstWeights.find((w) => w.competencyId === communication)?.percentage) === 75 && Number(firstWeights.find((w) => w.competencyId === problem)?.percentage) === 25,
    "with the scorecard's percentages",
    JSON.stringify(firstWeights),
  );
  check((await openings.loadOpening(org.id, id))?.status === "OPEN", "the opening is open");
  const publishAudit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.orgId, org.id), eq(s.auditLogs.action, "hiring.version.publish")));
  check(publishAudit.length === 1 && publishAudit[0].subjectId === live1.id && publishAudit[0].actorId === owner.id, "the publish is in the audit log");

  console.log("\nThe library changes, the published scorecard does not");
  const anchorBefore = published.scorecard!.competencies[0].anchors[3].tr;
  await db.update(s.competencyAnchors).set({ body: { tr: "DEĞİŞTİ", en: "" } }).where(eq(s.competencyAnchors.competencyId, communication));
  const [after] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(after.scorecard!.competencies[0].anchors[3].tr === anchorBefore, "anchor text in v1 is unchanged");

  console.log("\nThe database refuses edits to the published version");
  const raw = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await expectCode("a direct update of a published stage", () => raw`update hiring_stages set duration_seconds = 900 where id = ${firstStage.id}`, "23514");
  await raw.end();
  await expectCode("the builder has no draft to edit", () => versions.addStage(org.id, id), "NO_DRAFT");
  await expectCode("publishing again finds no draft", () => publishDraft(org.id, id, owner.id), "NO_DRAFT");

  console.log("\nWeights after publishing (HIRING-UX 5.7, R10)");
  const refusedReason = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: " " }, owner.id);
  check(!refusedReason.ok && refusedReason.code === "REASON_REQUIRED", "a reason is required");
  const refused95 = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 25 }, reason: "Kalibrasyon" }, owner.id);
  check(!refused95.ok && refused95.code === "NOT_100" && refused95.total === 95, "the total must be 100");
  const refusedHalf = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70.5, [problem]: 29.5 }, reason: "Kalibrasyon" }, owner.id);
  check(!refusedHalf.ok && refusedHalf.code === "NOT_WHOLE", "a weight that is not whole is NOT_WHOLE, never NOT_100 with a total of 100", JSON.stringify(refusedHalf));
  const { liveWeights } = await import("@/solutions/hiring/server/weight-sets");
  const { loadScorecard } = await import("@/solutions/hiring/server/content");
  const liveSet = await liveWeights(org.id, live1.id);
  check(
    (await loadScorecard(org.id, live1.id)) !== null && liveSet !== null && Object.keys(liveSet.weights).sort().join() === [communication, problem].sort().join(),
    "the scorecard page reads the live card and its newest weight set (the one publishing wrote)",
    JSON.stringify(liveSet),
  );
  check((await loadScorecard(orgB.id, live1.id)) === null && (await liveWeights(orgB.id, live1.id)) === null, "another organisation reads neither");
  const added = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: "Kalibrasyon sonrası" }, owner.id);
  check(added.ok, "a new weight set with a reason is added");
  const same = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: "Aynısı" }, owner.id);
  check(!same.ok && same.code === "NO_CHANGE", "the same weights again are NO_CHANGE, no new set", JSON.stringify(same));
  const setsAfter = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  check(setsAfter.length === 2 && setsAfter.filter((x) => x.isActive).length === 1, "it is the one active set");
  const [stillSame] = await db.select().from(s.hiringVersions).where(eq(s.hiringVersions.id, live1.id));
  check(stillSame.scorecard!.competencies.map((c) => c.weight).join() === "75,25", "the published scorecard keeps its weights");
  await expectCode("another organisation cannot change them", () => addWeightSet(orgB.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: "Kalibrasyon" }, ownerB.id), "NOT_FOUND");
  await expectCode("nor a user of another organisation here", () => addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30 }, reason: "Kalibrasyon" }, ownerB.id), "NOT_FOUND");
  const draftOnly = await addWeightSet(org.id, other.openingId, { versionId: live1.id, enabled: true, weights: { [communication]: 100 }, reason: "Kalibrasyon" }, owner.id);
  check(!draftOnly.ok && draftOnly.code === "NO_LIVE", "an opening with nothing published has no weight sets");
  const plain = await addWeightSet(org.id, id, { versionId: live1.id, enabled: false, weights: {}, reason: "Düz ortalamaya dönüş" }, owner.id);
  const setsPlain = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  check(plain.ok && setsPlain.length === 3 && setsPlain.every((x) => !x.isActive), "switching weighting off leaves no active set (plain average)");
  const extra = await addWeightSet(
    org.id,
    id,
    { versionId: live1.id, enabled: true, weights: { [communication]: 70, [problem]: 30, [byKey("teamwork")]: 0, [foreignCompetency.id]: 0 }, reason: "Kalibrasyon sonrası" },
    owner.id,
  );
  const [newest] = await db
    .select()
    .from(s.hiringWeightSets)
    .where(and(eq(s.hiringWeightSets.versionId, live1.id), eq(s.hiringWeightSets.isActive, true)));
  const newestRows = newest ? await db.select().from(s.hiringWeights).where(eq(s.hiringWeights.weightSetId, newest.id)) : [];
  check(
    extra.ok && newestRows.map((w) => w.competencyId).sort().join() === [communication, problem].sort().join(),
    "a set holds exactly the published competencies, never an extra or foreign one",
    newestRows.map((w) => w.competencyId).join(),
  );

  console.log("\nEditing after publishing opens v2");
  const draft2 = await versions.ensureDraftVersion(org.id, id);
  check(draft2.created, "v2 is created");
  const againDraft = await versions.ensureDraftVersion(org.id, id);
  check(!againDraft.created && againDraft.versionId === draft2.versionId, "asking again returns the same draft");
  const v2draft = await loadVersionContent(org.id, draft2.versionId);
  check(v2draft!.number === 2 && v2draft!.stages.length === 1 && v2draft!.stages[0].id !== firstStage.id, "v2 is a copy with new ids");
  check(v2draft!.weightsEnabled && v2draft!.draftWeights?.[communication] === 70, "v2 starts from the newest weight set");
  const whileDraft = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 65, [problem]: 35 }, reason: "Taslak varken" }, owner.id);
  const v2stillDraft = await loadVersionContent(org.id, draft2.versionId);
  check(whileDraft.ok && v2stillDraft!.status === "DRAFT" && v2stillDraft!.draftWeights?.[communication] === 70, "the live weights still change while v2 is a draft, and the draft keeps its own", JSON.stringify(whileDraft));
  const missingDraft = await versions.saveDraftWeights(org.id, id, { enabled: true, weights: { [communication]: 100 } });
  check(!missingDraft.ok && missingDraft.code === "WEIGHTS_MISSING", "draft weights leaving a measured competency out are WEIGHTS_MISSING, not a silent 0", JSON.stringify(missingDraft));
  await versions.updateStage(org.id, id, v2draft!.stages[0].id, { durationSeconds: 900 });
  const v1again = await loadVersionContent(org.id, live1.id);
  check(v1again!.stages[0].durationSeconds === firstStage.durationSeconds, "editing v2 leaves v1 alone");
  outcome = await publishDraft(org.id, id, owner.id);
  check(outcome.ok && outcome.number === 2, "v2 publishes");
  const finalList = await versions.versionsOf(org.id, id);
  check(finalList.map((v) => `${v.number}${v.status[0]}`).join() === "2P,1P", "both versions stay published", finalList.map((v) => `${v.number}${v.status}`).join());
  const v2sets = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, draft2.versionId));
  check(v2sets.length === 1 && v2sets[0].isActive, "v2's first set is active, as its weighting is on");
  const stale = await addWeightSet(org.id, id, { versionId: live1.id, enabled: true, weights: { [communication]: 60, [problem]: 40 }, reason: "Eski sekmeden" }, owner.id);
  const v1setsAfter = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, live1.id));
  const v2setsAfter = await db.select().from(s.hiringWeightSets).where(eq(s.hiringWeightSets.versionId, draft2.versionId));
  check(!stale.ok && stale.code === "STALE" && v1setsAfter.length === 5 && v2setsAfter.length === 1, "a form loaded for v1 is STALE once v2 is live, and writes no set", JSON.stringify(stale));

  console.log("\nThe scorecard's anchor Sheet writes the library, never a published card");
  const { saveAnchors } = await import("@/server/library-write");
  const { loadScorecard: scorecardOf } = await import("@/solutions/hiring/server/content");
  const anchorText = (card: Awaited<ReturnType<typeof scorecardOf>>) => card!.competencies.find((c) => c.id === communication)!.anchors[3]?.tr;
  const [v1Card, v2Card] = [await scorecardOf(org.id, live1.id), await scorecardOf(org.id, draft2.versionId)];
  const sheetAnchors = { "1": { tr: " Soruyu tekrar etmeden cevaplar ", en: "" }, "3": { tr: "Ana noktayı özetler", en: "" }, "5": { tr: "Karşı tarafın sorusunu özetler", en: "" } };
  const savedAnchors = await saveAnchors(org.id, owner.id, communication, sheetAnchors);
  check(savedAnchors.ok && savedAnchors.anchors[1]?.tr === "Soruyu tekrar etmeden cevaplar", "the Sheet's anchors are saved trimmed and handed back", JSON.stringify(savedAnchors));
  check((await loadCompetencyFacts(org.id, [communication])).get(communication)?.anchors[3]?.tr === "Ana noktayı özetler", "the library competency now has them");
  check(
    anchorText(await scorecardOf(org.id, live1.id)) === anchorText(v1Card) && anchorText(await scorecardOf(org.id, draft2.versionId)) === anchorText(v2Card) && anchorText(v2Card) !== "Ana noktayı özetler",
    "the published v1 and v2 scorecards keep their copies",
  );
  const foreignAnchors = await saveAnchors(orgB.id, ownerB.id, communication, sheetAnchors);
  check(!foreignAnchors.ok && foreignAnchors.code === "NOT_FOUND", "another organisation cannot change them");
  const missingThree = await saveAnchors(org.id, owner.id, communication, { "1": sheetAnchors["1"], "5": sheetAnchors["5"] });
  check(!missingThree.ok && missingThree.code === "ANCHORS_REQUIRED", "level 3 is required");
  await setCompetencyArchived(org.id, owner.id, problem, true);
  const archivedAnchors = await saveAnchors(org.id, owner.id, problem, sheetAnchors);
  check(!archivedAnchors.ok && archivedAnchors.code === "ARCHIVED", "an archived competency is read-only");
  await setCompetencyArchived(org.id, owner.id, problem, false);
  const anchorAudit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.orgId, org.id), eq(s.auditLogs.action, "library.competency.anchors")));
  check(anchorAudit.length === 1 && anchorAudit[0].subjectId === communication, "the change is in the audit log once");

  console.log("\nAI draft accepts (Task 17): strict inserts, no draft opened here, archive never delete");
  const { findOrCreateCompetency, archiveCompetencyIfUnused, setPositionJobAdIfEmpty } = await import("@/server/library-write");
  const aiStage = (competencyIds: string[]) => ({
    name: { tr: "Araştırma", en: "" },
    description: { tr: "", en: "" },
    internalPurpose: "Bulguyu sade anlatma",
    durationSeconds: 480,
    graceSeconds: 0,
    onTimeout: "AUTO_SUBMIT" as const,
    backNavigation: false,
    activities: [{ ...emptyActivity("VIDEO"), prompt: { tr: "Bir araştırma bulgusunu paydaşlara nasıl anlattığını anlat.", en: "" }, answerExamples: { 3: "Bulguyu ve bir örneği verir." }, competencyIds }],
  });
  const aiAnchors = { "1": { tr: "Veriye bakmadan karar verir.", en: "" }, "3": { tr: "Kararını bir veriyle gerekçelendirir.", en: "" }, "5": { tr: "Veriyi sınar ve eksik veriyi söyler.", en: "" } };
  const liveVersions = (await versions.versionsOf(org.id, id)).length;
  await expectCode("accepting a stage on a live opening is NO_DRAFT", () => versions.insertStage(org.id, id, aiStage([communication])), "NO_DRAFT");
  check((await versions.versionsOf(org.id, id)).length === liveVersions, "and no draft was opened by it (C5)");
  const aiStart = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "AI", copyFrom: null });
  if (!aiStart.ok) throw new Error(aiStart.code);
  check(aiStart.next === `/hiring/openings/${aiStart.openingId}/assessment/ai`, "an AI start opens the AI screen (C7)", aiStart.next);
  const via = `hiring-ai:${aiStart.openingId}`;
  const reusedComp = await findOrCreateCompetency(org.id, owner.id, { name: { tr: " iletişim ", en: "" }, description: { tr: "", en: "" }, anchors: aiAnchors }, via);
  check(reusedComp.ok && !reusedComp.created && reusedComp.id === communication, "a proposal named like an active competency reuses it (any case)", JSON.stringify(reusedComp));
  const problemName = library.find((c) => c.id === problem)!.name.tr;
  await setCompetencyArchived(org.id, owner.id, problem, true);
  const notRevived = await findOrCreateCompetency(org.id, owner.id, { name: { tr: problemName, en: "" }, description: { tr: "", en: "" }, anchors: aiAnchors }, via);
  const [problemRow] = await db.select().from(s.competencies).where(eq(s.competencies.id, problem));
  check(notRevived.ok && notRevived.created && notRevived.id !== problem && problemRow.archivedAt !== null, "an archived competency with that name is not brought back; a new row is made", JSON.stringify(notRevived));
  await setCompetencyArchived(org.id, owner.id, problem, false);
  const aiComp = await findOrCreateCompetency(org.id, owner.id, { name: { tr: "Veriyle karar", en: "" }, description: { tr: "", en: "" }, anchors: aiAnchors }, via);
  if (!aiComp.ok) throw new Error("aiComp competency");
  const freshAnchors = (await loadCompetencyFacts(org.id, [aiComp.id])).get(aiComp.id)?.anchors ?? {};
  check(aiComp.created && freshAnchors[3]?.tr === "Kararını bir veriyle gerekçelendirir.", "a new proposal joins the library with its 1/3/5 anchors");
  const aiStageId = await versions.insertStage(org.id, aiStart.openingId, aiStage([communication, aiComp.id]));
  const aiContent = await loadVersionContent(org.id, (await versions.versionsOf(org.id, aiStart.openingId))[0].id);
  check(
    aiContent!.stages[0].id === aiStageId && aiContent!.stages[0].activities[0].competencyIds.join() === [communication, aiComp.id].join() && aiContent!.stages[0].activities[0].answerExamples[3] === "Bulguyu ve bir örneği verir.",
    "an accepted stage lands in the draft with its competencies and examples",
  );
  const foreignUndo = await archiveCompetencyIfUnused(orgB.id, ownerB.id, aiComp.id, via);
  check(!foreignUndo.ok && foreignUndo.code === "NOT_FOUND", "another organisation cannot archive it");
  const inUse = await archiveCompetencyIfUnused(org.id, owner.id, aiComp.id, via);
  check(!inUse.ok && inUse.code === "IN_USE", "undo while a question measures it keeps it active", JSON.stringify(inUse));
  const notOurs = await archiveCompetencyIfUnused(org.id, owner.id, communication, via);
  const [communicationRow] = await db.select().from(s.competencies).where(eq(s.competencies.id, communication));
  check(!notOurs.ok && notOurs.code === "NOT_CREATED" && communicationRow.archivedAt === null, "a reused library competency is never archived by an undo");
  await versions.deleteStage(org.id, aiStart.openingId, aiStageId);
  const undone = await archiveCompetencyIfUnused(org.id, owner.id, aiComp.id, via);
  const [freshRow] = await db.select().from(s.competencies).where(eq(s.competencies.id, aiComp.id));
  check(undone.ok && freshRow !== undefined && freshRow.archivedAt !== null, "undo after the stage is gone archives it, the row stays (C1: no delete)", JSON.stringify(undone));
  const archiveAudit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.orgId, org.id), eq(s.auditLogs.subjectId, aiComp.id), eq(s.auditLogs.action, "library.competency.archive")));
  check(archiveAudit.length === 1 && (archiveAudit[0].meta as { reason?: string } | null)?.reason === "hiring-ai-undo", "the archive is audited once with its reason");
  await expectCode("a strict insert refuses the archived competency", () => versions.insertStage(org.id, aiStart.openingId, aiStage([aiComp.id])), "COMPETENCY");
  const adBefore = (await db.select().from(s.positions).where(eq(s.positions.id, position.id)))[0].jobDescription;
  await setPositionJobAdIfEmpty(org.id, owner.id, position.id, "Başka bir ilan metni, kısa değil.");
  check((await db.select().from(s.positions).where(eq(s.positions.id, position.id)))[0].jobDescription === adBefore, "a written job ad is never overwritten");
  const adless = await createPosition(org.id, owner.id, { name: "İlansız pozisyon", jobDescription: "" });
  if (!adless.ok) throw new Error("adless position");
  await setPositionJobAdIfEmpty(orgB.id, ownerB.id, adless.id, "Yabancı ilan metni.");
  check(!(await db.select().from(s.positions).where(eq(s.positions.id, adless.id)))[0].jobDescription, "another organisation cannot write it");
  await setPositionJobAdIfEmpty(org.id, owner.id, adless.id, "  Yeni ilan metni.  ");
  check((await db.select().from(s.positions).where(eq(s.positions.id, adless.id)))[0].jobDescription === "Yeni ilan metni.", "an empty position gets the pasted ad, trimmed");

  console.log("\nTwo connections: publish takes the opening lock first (READ COMMITTED)");
  // Deterministic: every step waits for a state Postgres reports (pg_stat_activity, NOWAIT), never for a time.
  const race = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "COPY", copyFrom: id });
  if (!race.ok) throw new Error(race.code);
  const [raceDraft] = await versions.versionsOf(org.id, race.openingId);
  const stagesBefore = (await loadVersionContent(org.id, raceDraft.id))!.stages.length;
  const holder = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const probe = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const lockWaiters = async () => {
    const [row] = await probe`
      select count(*)::int as n from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and wait_event_type = 'Lock' and query ilike '%from "hiring_openings"%for update%'`;
    return row.n as number;
  };
  const waitForWaiters = async (n: number) => {
    // A guard against a hang, not a timing assumption: the state is polled until it appears.
    for (let i = 0; i < 1000; i += 1) {
      if ((await lockWaiters()) >= n) return true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return false;
  };
  // An in-flight draft write holds the opening.
  await holder`begin`;
  await holder`select id from hiring_openings where id = ${race.openingId} for update`;
  const publishing = publishDraft(org.id, race.openingId, owner.id).then(
    (value) => ({ value, error: null as unknown }),
    (error: unknown) => ({ value: null, error }),
  );
  check(await waitForWaiters(1), "a publish waits while a draft write holds the opening");
  let versionFree = true;
  try {
    await probe.begin((sql) => sql`select id from hiring_versions where id = ${raceDraft.id} for update nowait`);
  } catch (error) {
    if ((error as { code?: string }).code === "55P03") versionFree = false;
    else throw error;
  }
  check(versionFree, "and it has not locked the version yet: the opening comes first");
  const editing = versions.addStage(org.id, race.openingId).then(
    (value) => ({ value, error: null as unknown }),
    (error: unknown) => ({ value: null, error }),
  );
  check(await waitForWaiters(2), "a second draft write queues behind the publish");
  await holder`commit`;
  await holder.end();
  const published2 = await publishing;
  check(published2.value?.ok === true && published2.value.number === 1, "the publish goes first", String(published2.error ?? JSON.stringify(published2.value)));
  const edited = await editing;
  check((edited.error as { code?: string } | null)?.code === "NO_DRAFT", "the queued draft write is refused NO_DRAFT, not 23514", String(edited.error ?? edited.value));
  check((await loadVersionContent(org.id, raceDraft.id))!.stages.length === stagesBefore, "and the published version did not change");
  await probe.end();

  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
