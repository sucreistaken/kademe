/**
 * Builds a published template version that exercises the written alternative,
 * plus a candidate and a link for it, and prints the URL.
 *
 * It exists because `activities.config.textAlternativeEnabled` cannot be turned
 * on in the seeded templates: a PUBLISHED version is frozen by a database
 * trigger, and disabling that trigger on a shared development database to poke
 * one row would be worse than adding a fixture. Everything here is additive.
 *
 * Run with: npx tsx scripts/dev-accessibility-fixture.ts
 */

import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  activities,
  assessmentLinks,
  assessments,
  candidates,
  organizations,
  positions,
  stages,
  templates,
  templateVersions,
} from "../src/db/schema";
import { mintToken } from "../src/lib/auth";

const i18n = (tr: string, en: string) => ({ tr, en });

async function main() {
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error("No organization. Run pnpm db:seed first.");

  const [position] = await db
    .select()
    .from(positions)
    .where(eq(positions.orgId, org.id))
    .limit(1);
  if (!position) throw new Error("No position. Run pnpm db:seed first.");

  const [template] = await db
    .insert(templates)
    .values({
      orgId: org.id,
      positionId: position.id,
      name: "Erişilebilirlik fixture",
    })
    .returning();

  // Stages and activities are written while the version is still DRAFT; the
  // immutability trigger refuses them once it is PUBLISHED.
  const [version] = await db
    .insert(templateVersions)
    .values({
      orgId: org.id,
      templateId: template.id,
      versionNumber: 1,
      status: "DRAFT",
      localeSet: ["tr", "en"],
      introTitle: i18n("Erişilebilirlik denemesi", "Accessibility check"),
      introBody: i18n(
        "Tek aşama, iki soru. İlk soruda kayıt yerine yazarak cevap verebilirsin.",
        "One stage, two questions. The first one accepts a written answer instead of a recording.",
      ),
    })
    .returning();

  const [stage] = await db
    .insert(stages)
    .values({
      versionId: version.id,
      orderIndex: 0,
      name: i18n("Erişilebilirlik", "Accessibility"),
      description: i18n(
        "Kayıt yapamıyorsan yazılı alternatif açık.",
        "A written alternative is available if you cannot record.",
      ),
      durationSeconds: 900,
      onTimeout: "AUTO_SUBMIT",
    })
    .returning();

  await db.insert(activities).values([
    {
      stageId: stage.id,
      orderIndex: 0,
      type: "VIDEO",
      isRequired: true,
      candidatePrompt: i18n(
        "Birlikte çalıştığın bir ekipte iletişimi nasıl kurduğunu anlat.",
        "Tell us how you set up communication in a team you worked with.",
      ),
      candidateNote: i18n(
        "Kayıt yapamıyorsan bu soruyu yazarak da cevaplayabilirsin.",
        "If you cannot record, you may answer this question in writing.",
      ),
      thinkSeconds: 15,
      answerSeconds: 120,
      maxTakes: 2,
      config: { textAlternativeEnabled: true, maxChars: 3000 },
    },
    {
      stageId: stage.id,
      orderIndex: 1,
      type: "LONG_TEXT",
      isRequired: true,
      candidatePrompt: i18n(
        "Aynı ekipte ters giden bir şeyi ve nasıl toparladığını yaz.",
        "Write about something that went wrong in that team and how you fixed it.",
      ),
      candidateNote: i18n("", ""),
      thinkSeconds: 0,
      answerSeconds: 600,
      config: { minChars: 50, maxChars: 2000 },
    },
  ]);

  await db
    .update(templateVersions)
    .set({ status: "PUBLISHED", publishedAt: new Date() })
    .where(eq(templateVersions.id, version.id));

  const [candidate] = await db
    .insert(candidates)
    .values({
      orgId: org.id,
      fullName: "Erişilebilirlik Testi",
      email: `a11y-${Date.now()}@ornek.com`,
    })
    .returning();

  const [assessment] = await db
    .insert(assessments)
    .values({
      orgId: org.id,
      candidateId: candidate.id,
      versionId: version.id,
      locale: "tr",
    })
    .returning();

  const token = mintToken();
  await db.insert(assessmentLinks).values({
    assessmentId: assessment.id,
    tokenHash: token.hash,
    status: "NOT_STARTED",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  const [check] = await db
    .select({ config: activities.config })
    .from(activities)
    .where(eq(activities.stageId, stage.id))
    .orderBy(desc(activities.orderIndex))
    .limit(1);

  console.log("\n  Accessibility fixture ready.");
  console.log(`  Template version : ${version.id} (PUBLISHED)`);
  console.log(`  Last activity cfg: ${JSON.stringify(check?.config)}`);
  console.log(`  Candidate link   : http://localhost:3100/a/${token.raw}\n`);
  process.exit(0);
}

void main();
