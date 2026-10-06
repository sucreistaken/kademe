/**
 * Check of the ready hiring templates, in process, against a THROW-AWAY
 * database (name ends in _check) with every migration applied. A fresh
 * organisation with no library and no default rating scale opens one opening
 * per template; the library, the anchors, a filled position, an archived
 * competency and publishing are checked afterwards.
 *
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_templates_check pnpm verify:hiring-templates
 */
import "dotenv/config";
import { refuseUnlessThrowAwayDb } from "../src/db/working-db-guard";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};
const check = (condition: boolean, label: string, detail?: string) => (condition ? ok(label) : bad(detail ? `${label}: ${detail}` : label));

async function main() {
  const refusal = refuseUnlessThrowAwayDb(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
  }
  const { and, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { ensureDefaultScale } = await import("@/db/library-seed");
  const { DEFAULT_LOCALE } = await import("@/i18n/locale");
  const { createPosition } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { loadCompetencyFacts, loadVersionContent } = await import("@/solutions/hiring/server/content");
  const { publishDraft } = await import("@/solutions/hiring/server/publish");
  const { publishProblems } = await import("@/solutions/hiring/rules/gate");
  const { usedCompetencyIds } = await import("@/solutions/hiring/rules/content");
  const { TEMPLATES, templateByKey } = await import("@/solutions/hiring/templates/index");
  const { templateMinutes, templateQuestionCount, templateCompetencyKeys } = await import("@/solutions/hiring/templates/materialise");
  const { templateCompetency } = await import("@/solutions/hiring/templates/competencies");

  const stamp = Date.now();
  const newOrg = async (label: string) => {
    const [org] = await db.insert(s.organizations).values({ name: `Templates check ${label}` }).returning();
    const [manager] = await db
      .insert(s.users)
      .values({ orgId: org.id, email: `manager-${label}-${stamp}@check.local`, name: `Check Manager ${label}`, role: "MANAGER", passwordHash: "x" })
      .returning();
    return { orgId: org.id, user: { id: manager.id, orgId: org.id } };
  };

  const { orgId, user } = await newOrg("A");
  const library = () => db.select().from(s.competencies).where(eq(s.competencies.orgId, orgId));
  const scalesOf = async (id: string) => (await db.select().from(s.ratingScales).where(eq(s.ratingScales.orgId, id))).length;

  console.log("\nA fresh organisation");
  check((await library()).length === 0, "no library");
  check((await scalesOf(orgId)) === 0, "no default rating scale");
  const sales = await createPosition(orgId, user.id, { name: "Satış Temsilcisi" });
  if (!sales.ok) throw new Error("position");
  const [salesRow] = await db.select().from(s.positions).where(eq(s.positions.id, sales.id));
  const salesProfile = await db.select().from(s.positionCompetencies).where(eq(s.positionCompetencies.positionId, sales.id));
  check(!salesRow.jobDescription?.trim() && salesProfile.length === 0, "the position Satış Temsilcisi has no ad and no profile");

  console.log(`\nEvery template (${TEMPLATES.length})`);
  const openingByTemplate = new Map<string, { openingId: string }>();
  for (const template of TEMPLATES) {
    const label = template.key;
    const created = await openings.createOpening(user, { position: { kind: "new", name: template.name.tr, jobDescription: "" }, start: "TEMPLATE", copyFrom: null, templateKey: template.key });
    if (!created.ok) {
      bad(`${label}: createOpening refused ${created.code}`);
      continue;
    }
    check(created.next === `/hiring/openings/${created.openingId}/assessment/edit`, `${label}: opens the builder`, created.next);
    const [version] = await versions.versionsOf(orgId, created.openingId);
    const content = await loadVersionContent(orgId, version.id);
    if (!content) {
      bad(`${label}: no content`);
      continue;
    }
    const facts = await loadCompetencyFacts(orgId, [...usedCompetencyIds(content), ...Object.keys(content.draftWeights ?? {})]);
    const problems = publishProblems(content, facts);
    check(problems.length === 0, `${label}: publishProblems is empty`, JSON.stringify(problems));
    const questions = content.stages.reduce((n, st) => n + st.activities.length, 0);
    check(content.stages.length === template.stages.length, `${label}: ${template.stages.length} stages`, String(content.stages.length));
    check(questions === templateQuestionCount(template), `${label}: ${templateQuestionCount(template)} questions (${templateMinutes(template)} min)`, String(questions));
    const total = Object.values(content.draftWeights ?? {}).reduce((a, b) => a + b, 0);
    check(content.weightsEnabled && total === 100, `${label}: weighting on, weights add up to 100`, `enabled ${content.weightsEnabled}, total ${total}`);
    openingByTemplate.set(template.key, { openingId: created.openingId });
  }
  check((await scalesOf(orgId)) === 1, "the default rating scale was created once, inside the first opening");

  console.log("\nThe library after every template");
  const rows = await library();
  const expectedKeys = [...new Set(TEMPLATES.flatMap(templateCompetencyKeys))];
  const seedKeys = rows.map((r) => r.seedKey);
  check(rows.length === expectedKeys.length, `one competency per distinct key (${expectedKeys.length})`, `${rows.length} rows`);
  check(new Set(seedKeys).size === seedKeys.length && expectedKeys.every((k) => seedKeys.includes(k)), "no duplicates, every key present");
  check(rows.every((r) => r.archivedAt === null), "none archived");
  const anchorRows = rows.length ? await db.select().from(s.competencyAnchors).where(inArray(s.competencyAnchors.competencyId, rows.map((r) => r.id))) : [];
  const badAnchors = rows.filter((r) => anchorRows.filter((a) => a.competencyId === r.id).map((a) => a.value).sort().join() !== "1,3,5");
  check(badAnchors.length === 0, "every competency has anchors 1, 3 and 5", badAnchors.map((r) => r.seedKey).join());

  console.log("\nAn existing position is filled once");
  const sr = templateByKey("sales-representative");
  if (!sr) throw new Error("sales-representative template missing");
  const first = await openings.createOpening(user, { position: { kind: "existing", id: sales.id }, start: "TEMPLATE", copyFrom: null, templateKey: sr.key });
  check(first.ok, "the template opening on Satış Temsilcisi is created", JSON.stringify(first));
  const snapshot = async () => {
    const [p] = await db.select().from(s.positions).where(eq(s.positions.id, sales.id));
    const profile = await db.select().from(s.positionCompetencies).where(eq(s.positionCompetencies.positionId, sales.id));
    return {
      ad: p.jobDescription,
      profile: profile
        .map((r) => `${r.competencyId}:${r.weight}:${r.orderIndex}`)
        .sort()
        .join("|"),
      count: profile.length,
    };
  };
  const afterFirst = await snapshot();
  check(afterFirst.ad === sr.jobAd[DEFAULT_LOCALE], "the position has the template job ad");
  check(afterFirst.count === 3, "and 3 profile rows", String(afterFirst.count));
  const second = await openings.createOpening(user, { position: { kind: "existing", id: sales.id }, start: "TEMPLATE", copyFrom: null, templateKey: sr.key });
  check(second.ok, "a second template opening on it is created");
  const afterSecond = await snapshot();
  check(afterSecond.ad === afterFirst.ad && afterSecond.profile === afterFirst.profile, "the ad and the profile are unchanged (no second fill)");
  const edited = "Ekibimizin kendi yazdığı ilan.";
  await db.update(s.positions).set({ jobDescription: edited }).where(eq(s.positions.id, sales.id));
  await openings.createOpening(user, { position: { kind: "existing", id: sales.id }, start: "TEMPLATE", copyFrom: null, templateKey: sr.key });
  check((await snapshot()).ad === edited, "an ad the team wrote is never replaced");

  console.log("\nAn archived competency comes back");
  const target = TEMPLATES[0];
  const targetKey = templateCompetencyKeys(target)[0];
  const [before] = await db.select().from(s.competencies).where(and(eq(s.competencies.orgId, orgId), eq(s.competencies.seedKey, targetKey)));
  await db.update(s.competencies).set({ archivedAt: new Date() }).where(eq(s.competencies.id, before.id));
  const again = await openings.createOpening(user, { position: { kind: "new", name: `${target.name.tr} 2`, jobDescription: "" }, start: "TEMPLATE", copyFrom: null, templateKey: target.key });
  check(again.ok, "another opening that uses it is created");
  const [restored] = await db.select().from(s.competencies).where(eq(s.competencies.id, before.id));
  check(restored.archivedAt === null, `${targetKey} is active again`);
  check((await library()).length === expectedKeys.length, "and no second row was made");
  const [restoreAudit] = await db
    .select()
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.orgId, orgId), eq(s.auditLogs.subjectId, before.id), eq(s.auditLogs.action, "library.competency.restore")));
  check(Boolean(restoreAudit), "the restore is audited");

  console.log("\nA reused competency gets only the anchors it lacks");
  const other = await newOrg("B");
  const seed = templateCompetency(targetKey);
  if (!seed) throw new Error("seed competency");
  const scale = await ensureDefaultScale(other.orgId);
  const [own] = await db.insert(s.competencies).values({ orgId: other.orgId, name: seed.name, description: seed.description, scaleId: scale.id, seedKey: null }).returning();
  const custom = { tr: "Ekibin kendi 3. düzey çapası", en: "" };
  await db.insert(s.competencyAnchors).values({ competencyId: own.id, value: 3, body: custom });
  const reuse = await openings.createOpening(other.user, { position: { kind: "new", name: target.name.tr, jobDescription: "" }, start: "TEMPLATE", copyFrom: null, templateKey: target.key });
  check(reuse.ok, "a template opening in an organisation with its own same-named competency is created");
  const ownAnchors = await db.select().from(s.competencyAnchors).where(eq(s.competencyAnchors.competencyId, own.id));
  check(ownAnchors.map((a) => a.value).sort().join() === "1,3,5", "the team's own row got anchors 1 and 5", ownAnchors.map((a) => a.value).join());
  check(ownAnchors.find((a) => a.value === 3)?.body.tr === custom.tr, "its own anchor 3 is untouched");
  const sameNamed = (await db.select().from(s.competencies).where(eq(s.competencies.orgId, other.orgId))).filter((c) => c.name.tr === seed.name.tr);
  check(sameNamed.length === 1 && sameNamed[0].id === own.id, "the row was reused, not duplicated", String(sameNamed.length));

  console.log("\nPublishing a template opening");
  const pick = openingByTemplate.get(TEMPLATES[0].key);
  if (!pick) throw new Error("no opening to publish");
  const outcome = await publishDraft(orgId, pick.openingId, user.id);
  check(outcome.ok, "publishDraft succeeds", JSON.stringify(outcome));
  const [published] = await versions.versionsOf(orgId, pick.openingId);
  check(published?.status === "PUBLISHED", "the version is published", published?.status);

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks ok");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
