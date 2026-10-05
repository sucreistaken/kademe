/**
 * A published hiring opening for checks on THROW-AWAY databases (names ending
 * in _check): publishing freezes rows that can never be deleted, so this never
 * runs on kademe_platform or anything shared. Both functions refuse any other
 * database before they touch it (refuseUnlessThrowAwayDb), whoever calls them.
 */
import { refuseUnlessThrowAwayDb } from "../src/db/working-db-guard";

function requireThrowAwayDb(): void {
  const refusal = refuseUnlessThrowAwayDb(process.env.DATABASE_URL);
  if (refusal) throw new Error(`hiring-fixture refuses: ${refusal}`);
}

export async function freshOrganisation(): Promise<{ orgId: string; ownerId: string; reviewerId: string }> {
  requireThrowAwayDb();
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const stamp = Date.now();
  const [org] = await db.insert(s.organizations).values({ name: "Örnek A.Ş.", contactEmail: "ik@ornek.test" }).returning();
  const [owner] = await db.insert(s.users).values({ orgId: org.id, email: `owner-${stamp}@flow.local`, name: "Deniz Yılmaz", role: "OWNER", passwordHash: "x" }).returning();
  const [reviewer] = await db.insert(s.users).values({ orgId: org.id, email: `reviewer-${stamp}@flow.local`, name: "Ece Kaya", role: "REVIEWER", passwordHash: "x" }).returning();
  return { orgId: org.id, ownerId: owner.id, reviewerId: reviewer.id };
}

export async function buildPublishedOpening(input: {
  orgId: string;
  ownerId: string;
  memberIds: string[];
  sentinels?: boolean;
  kind?: "full" | "text" | "written";
}): Promise<{ openingId: string; competencies: string[] }> {
  requireThrowAwayDb();
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { seedLibrary } = await import("@/db/library-seed");
  const { createPosition } = await import("@/server/library-write");
  const openings = await import("@/solutions/hiring/server/openings");
  const versions = await import("@/solutions/hiring/server/versions");
  const { publishDraft } = await import("@/solutions/hiring/server/publish");

  const org = input.orgId;
  const user = { id: input.ownerId, orgId: org };
  await seedLibrary(org);
  const key = async (seedKey: string) =>
    (await db.select({ id: s.competencies.id }).from(s.competencies).where(and(eq(s.competencies.orgId, org), eq(s.competencies.seedKey, seedKey))))[0].id;
  const communication = await key("communication");
  const problem = await key("problem_solving");
  const visible = (label: string) => (input.sentinels ? ` LEAKVISIBLE_${label}` : "");
  const team = input.sentinels
    ? {
        internalQuestion: "TEAMSECRET_PURPOSE",
        expectedBehaviours: ["TEAMSECRET_BEHAVIOUR"],
        redFlags: ["TEAMSECRET_FLAG"],
        managerNotes: "TEAMSECRET_NOTE",
        answerExamples: { 1: "TEAMSECRET_ONE", 3: "TEAMSECRET_THREE", 5: "TEAMSECRET_FIVE" },
      }
    : {};

  const position = await createPosition(org, input.ownerId, { name: `Ürün Tasarımcısı ${Date.now()}` });
  if (!position.ok) throw new Error("position");
  const created = await openings.createOpening(user, { position: { kind: "existing", id: position.id }, start: "BLANK", copyFrom: null });
  if (!created.ok) throw new Error(created.code);
  const id = created.openingId;

  const s1 = await versions.addStage(org, id);
  await versions.updateStage(org, id, s1, {
    name: { tr: `Tanışma${visible("STAGE")}`, en: "Introduction" },
    description: { tr: "Kısa bir tanışma.", en: "A short introduction." },
    durationSeconds: 600,
    internalPurpose: input.sentinels ? "TEAMSECRET_STAGE_PURPOSE" : null,
  });
  if (input.kind === "written") {
    // Stage 1: long text, single choice, optional short text. Stage 2 (going back allowed): long text, multiple choice.
    const long = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, long, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 } });
    await versions.setActivityCompetencies(org, id, long, [problem]);
    const single = await versions.addActivity(org, id, s1, "SINGLE_CHOICE");
    await versions.updateActivity(org, id, single, {
      prompt: { tr: "Bir tasarım kararını kim onaylar?", en: "Who approves a design decision?" },
      config: { choices: [{ id: "a", label: { tr: "Ürün ekibi", en: "The product team" }, correct: true }, { id: "b", label: { tr: "Yalnız ben", en: "Only me" } }, { id: "c", label: { tr: "Satış ekibi", en: "The sales team" } }] },
    });
    const short = await versions.addActivity(org, id, s1, "SHORT_TEXT");
    await versions.updateActivity(org, id, short, { prompt: { tr: "Eklemek istediğin bir şey var mı?", en: "Anything you want to add?" }, required: false });
    await versions.setActivityCompetencies(org, id, short, [communication]);
    const s2 = await versions.addStage(org, id);
    await versions.updateStage(org, id, s2, { name: { tr: "Vaka", en: "Case" }, durationSeconds: 300, backNavigation: true });
    const caseText = await versions.addActivity(org, id, s2, "LONG_TEXT");
    await versions.updateActivity(org, id, caseText, { prompt: { tr: "Bir müşteriye kötü bir haberi nasıl verirdin?", en: "How would you give a client bad news?" } });
    await versions.setActivityCompetencies(org, id, caseText, [communication]);
    const multi = await versions.addActivity(org, id, s2, "MULTI_CHOICE");
    await versions.updateActivity(org, id, multi, {
      prompt: { tr: "Hangileri bir planın parçasıdır?", en: "Which belong in a plan?" },
      config: { choices: [{ id: "a", label: { tr: "Hedef", en: "Goal" }, correct: true }, { id: "b", label: { tr: "Takvim", en: "Timeline" }, correct: true }, { id: "c", label: { tr: "Hava durumu", en: "Weather" } }] },
    });
  } else if (input.kind === "text") {
    const only = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, only, { prompt: { tr: `Son projende bir sorunu nasıl çözdüğünü anlat.${visible("PROMPT")}`, en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 }, ...team });
    await versions.setActivityCompetencies(org, id, only, [problem]);
  } else {
    const video = await versions.addActivity(org, id, s1, "VIDEO");
    await versions.updateActivity(org, id, video, {
      prompt: { tr: `Kendini kısaca tanıt ve bu role neden başvurduğunu anlat.${visible("PROMPT")}`, en: "Introduce yourself and tell us why you applied." },
      thinkSeconds: 20,
      flexibleThink: true,
      answerSeconds: 60,
      maxTakes: 2,
      config: { textAlternativeEnabled: true },
      ...team,
    });
    await versions.setActivityCompetencies(org, id, video, [communication]);
    const single = await versions.addActivity(org, id, s1, "SINGLE_CHOICE");
    await versions.updateActivity(org, id, single, {
      prompt: { tr: "Bir tasarım kararını kim onaylar?", en: "Who approves a design decision?" },
      config: {
        choices: [
          { id: "a", label: { tr: `Ürün ekibi${visible("CHOICE")}`, en: "The product team" }, correct: true },
          { id: "b", label: { tr: "Yalnız ben", en: "Only me" } },
        ],
      },
    });
    const long = await versions.addActivity(org, id, s1, "LONG_TEXT");
    await versions.updateActivity(org, id, long, { prompt: { tr: "Son projende bir sorunu nasıl çözdüğünü anlat.", en: "Tell us how you solved a problem in your last project." }, config: { minChars: 20, maxChars: 2000 } });
    await versions.setActivityCompetencies(org, id, long, [problem]);

    const s2 = await versions.addStage(org, id);
    await versions.updateStage(org, id, s2, { name: { tr: "Vaka", en: "Case" }, durationSeconds: 300 });
    const file = await versions.addActivity(org, id, s2, "FILE_UPLOAD");
    await versions.updateActivity(org, id, file, { prompt: { tr: "Hazırladığın kısa planı PDF olarak yükle.", en: "Upload your short plan as a PDF." }, config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1024 * 1024 } });
    await versions.setActivityCompetencies(org, id, file, [problem]);
    const audio = await versions.addActivity(org, id, s2, "AUDIO");
    await versions.updateActivity(org, id, audio, { prompt: { tr: "Planını bir müşteriye nasıl anlatırdın?", en: "How would you explain your plan to a client?" }, thinkSeconds: 10, answerSeconds: 30, maxTakes: 1 });
    await versions.setActivityCompetencies(org, id, audio, [communication]);
    const short = await versions.addActivity(org, id, s2, "SHORT_TEXT");
    await versions.updateActivity(org, id, short, { prompt: { tr: "Eklemek istediğin bir şey var mı?", en: "Anything you want to add?" }, required: false });
    await versions.setActivityCompetencies(org, id, short, [communication]);
    const multi = await versions.addActivity(org, id, s2, "MULTI_CHOICE");
    await versions.updateActivity(org, id, multi, {
      prompt: { tr: "Hangileri bir planın parçasıdır?", en: "Which belong in a plan?" },
      config: {
        choices: [
          { id: "a", label: { tr: "Hedef", en: "Goal" }, correct: true },
          { id: "b", label: { tr: "Takvim", en: "Timeline" }, correct: true },
          { id: "c", label: { tr: "Hava durumu", en: "Weather" } },
        ],
      },
    });
  }

  const rules = await openings.saveOpeningRules(org, input.ownerId, id, {
    name: `Ürün Tasarımcısı · Kontrol ${Date.now()}`,
    memberIds: input.memberIds,
    decisionMakerId: input.ownerId,
    backupDecisionMakerId: null,
    minEvaluations: 2,
    blindMode: false,
    deadline: null,
    feedbackDays: 7,
    candidateContactEmail: "deniz@ornek.test",
  });
  if (!rules.ok) throw new Error(`rules: ${rules.problems.join(",")}`);
  const published = await publishDraft(org, id, input.ownerId);
  if (!published.ok) throw new Error(`publish: ${published.problems.join(",")}`);
  return { openingId: id, competencies: [communication, problem] };
}
