/**
 * Runs a real job ad through the AI builder pipeline and prints what came back.
 *
 * Without OPENROUTER_API_KEY it proves the one thing that matters in that
 * state: the pipeline refuses out loud and writes nothing. It never fabricates
 * a draft to make this script look green, because a fake assessment is
 * indistinguishable from a real one once it is on the screen.
 *
 * The suggestions are printed only. Nothing is written to any template: that
 * happens on the /versions/[v]/ai screen when the manager accepts a card.
 *
 * Run with:
 *   npx tsx scripts/verify-ai-draft.ts
 *   npx tsx scripts/verify-ai-draft.ts path/to/job-ad.txt
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { aiRuns, competencies, organizations } from "../src/db/schema";
import { users } from "../src/db/schema";
import { getAiProvider } from "../src/lib/ai";
import { generateTemplateDraft } from "../src/lib/template-draft-job";
import { draftTotalSeconds } from "../src/lib/template-draft";

const SAMPLE_AD = `Kıdemli Ürün Tasarımcısı arıyoruz.

B2B SaaS ürünümüzün onboarding ve aktivasyon akışlarından sorumlu olacaksınız.
Yeni kaydolan takımların ilk değerli anına ulaşma oranını ölçmek, düşüş
noktalarını tespit etmek ve akışı yeniden kurgulamak işin merkezinde.

Beklentilerimiz:
- Veriyle çalışan, ölçüm kuran, hipotez kurup test eden bir tasarım yaklaşımı
- Mühendislerle doğrudan iletişim kurabilme, teknik kısıtları anlayıp tasarımı
  ona göre uyarlayabilme
- Karmaşık akışları basitleştirme ve kararlarını yazılı olarak savunabilme
- Tasarım sistemine katkı verme ve mevcut bileşenleri disiplinli kullanma

Aranan nitelikler: en az 5 yıl ürün tasarımı deneyimi, B2B ürünlerde çalışmış
olmak, İngilizce dokümantasyon yazabilmek.`;

let failed = 0;
const ok = (m: string) => console.log(`   ok   ${m}`);
const bad = (m: string) => {
  console.log(`   FAIL ${m}`);
  failed = 1;
};
const say = (m: string) => console.log(`\n== ${m}`);

async function main() {
  const file = process.argv[2];
  const jobDescription = file ? readFileSync(file, "utf8") : SAMPLE_AD;

  say("provider");
  const provider = getAiProvider();
  console.log(
    `   provider=${provider.name} available=${provider.available} model=${provider.model}`,
  );

  const [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    bad("no organisation in the database, run pnpm db:seed first");
    process.exit(1);
  }
  const [user] = await db.select().from(users).where(eq(users.orgId, org.id)).limit(1);
  if (!user) {
    bad("no user in the database, run pnpm db:seed first");
    process.exit(1);
  }

  const library = await db
    .select({ name: competencies.name })
    .from(competencies)
    .where(eq(competencies.orgId, org.id));

  say("draft");
  const before = Date.now();
  const outcome = await generateTemplateDraft({
    orgId: org.id,
    requestedBy: user.id,
    positionId: crypto.randomUUID(),
    positionName: "Kıdemli Ürün Tasarımcısı",
    jobDescription,
    locales: ["tr"],
    existingCompetencies: library.map((row) => row.name.tr || row.name.en),
  });
  const elapsed = ((Date.now() - before) / 1000).toFixed(1);

  if (outcome.status === "UNCONFIGURED") {
    ok(`refused without a key, wrote nothing: ${outcome.code}`);
    console.log(
      "\n   Set GOOGLE_AI_API_KEY in .env and run this again to see a real draft.",
    );
  } else if (outcome.status === "FAILED") {
    bad(`draft failed after ${elapsed}s: ${outcome.code}${outcome.detail ? `: ${outcome.detail}` : ""}`);
  } else {
    ok(
      `${outcome.draft.stages.length} stages, ${outcome.draft.competencies.length} competencies in ${elapsed}s` +
        (outcome.repaired ? " (needed one repair attempt)" : ""),
    );
    console.log(
      `   model=${outcome.model} cost=${outcome.costUsd ?? "?"} USD total=${Math.round(
        draftTotalSeconds(outcome.draft) / 60,
      )} min\n`,
    );
    for (const stage of outcome.draft.stages) {
      console.log(
        `   [${stage.key}] ${stage.nameTr} (${Math.round(stage.durationSeconds / 60)} dk)`,
      );
      console.log(`        gerekçe: ${stage.rationale}`);
      for (const activity of stage.activities) {
        console.log(
          `        - ${activity.type} ${activity.thinkSeconds}/${activity.answerSeconds} sn: ${activity.promptTr}`,
        );
        if (activity.redFlags.length) {
          console.log(`          kırmızı bayrak: ${activity.redFlags.join(" · ")}`);
        }
      }
    }
    for (const competency of outcome.draft.competencies) {
      console.log(
        `   yetkinlik: ${competency.nameTr} -> ${competency.stageKeys.join(", ") || "(bağlı aşama yok)"}`,
      );
    }
  }

  // Nothing is called when the provider is missing, so there is nothing to
  // find in ai_runs either. Only a real call is expected to leave a row.
  if (outcome.status === "UNCONFIGURED") {
    console.log(failed ? "\nFAILED" : "\nOK");
    process.exit(failed);
  }

  say("ai_runs");
  const runs = await db
    .select()
    .from(aiRuns)
    .where(eq(aiRuns.orgId, org.id))
    .orderBy(desc(aiRuns.at))
    .limit(3);
  const drafts = runs.filter((run) => run.purpose === "TEMPLATE_DRAFT");
  if (drafts.length === 0) {
    bad("no TEMPLATE_DRAFT row was written for this run");
  } else {
    for (const run of drafts) {
      ok(
        `${run.at.toISOString()} model=${run.model} tokens=${run.inputTokens ?? "-"}/${
          run.outputTokens ?? "-"
        } cost=${run.costUsd ?? "-"}${run.error ? ` error=${run.error.slice(0, 120)}` : ""}`,
      );
    }
  }

  console.log(failed ? "\nFAILED" : "\nOK");
  process.exit(failed);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
