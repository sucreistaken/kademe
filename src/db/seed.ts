/**
 * Development seed for the German exam product.
 *
 * Gives every screen real rows: the starter bank (with listening audio when a
 * TTS key is present), two published exams, and three students:
 *   1. a fresh placement link,
 *   2. a fresh B1 verification link,
 *   3. a finished verification exam whose writing and speaking wait for a
 *      teacher, with a few proctoring flags, so the review screen has work.
 *
 * Run with: pnpm db:seed   (TRUNCATEs everything first)
 */

import "dotenv/config";
import { resolve } from "node:path";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { hash as argon2Hash } from "@node-rs/argon2";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { defaultBlueprint } from "../lib/exam/blueprint";
import { BAND_CENTER } from "../lib/exam/cefr";
import { mulberry32 } from "../lib/exam/adaptive";
import type { GradingProposal } from "../lib/exam/grading";
import { getStorage, proctorEvidenceKey } from "../lib/storage";
import { importSeedBank } from "../server/bank-import";
import { createInvitation } from "../server/invite";
import { simulateStudent } from "../server/simulate";
import { recomputeIntegrity } from "../server/proctoring";
import { recomputeResult } from "../lib/exam-results";
import { CONSENT_EN, CONSENT_TR } from "./consent-text";

const DEV_PASSWORD = "kademe-dev-2026";
const OWNER_EMAIL = "kadiraycareer@gmail.com";
const log = (m: string) => console.log(m);

async function reset() {
  const localRoot = process.env.LOCAL_STORAGE_DIR
    ? resolve(process.env.LOCAL_STORAGE_DIR)
    : resolve(process.cwd(), ".storage");
  // Recordings and proctoring frames go; bank audio stays, it is content
  // addressed and costs money to make again.
  rmSync(resolve(localRoot, "media"), { recursive: true, force: true });
  rmSync(resolve(localRoot, "proctor"), { recursive: true, force: true });
  await db.execute(sql`
    TRUNCATE TABLE
      organizations, users, sessions, audit_logs, user_setup_tokens,
      exam_blueprints, stimuli, items,
      candidates, assessments, assessment_links, attempts, section_runs,
      item_responses, media_assets, transcripts,
      response_gradings, response_grading_revisions, exam_results, exam_result_revisions,
      proctor_sessions, proctor_events, proctor_evidence, proctor_ai_reviews,
      consent_texts, consents, ai_runs, message_outbox, deletion_requests
    RESTART IDENTITY CASCADE
  `);
}

const WRITING_B1 = `Liebe Frau Schneider,

vielen Dank für Ihre Einladung zum Sommerfest. Leider kann ich am Samstag nicht kommen, weil meine Schwester an diesem Tag heiratet. Ich finde es sehr schade, denn ich wollte die anderen Kursteilnehmer gern wiedersehen. Könnten wir uns vielleicht nächste Woche treffen? Ich habe am Dienstag und am Donnerstag Zeit. Ich möchte Ihnen auch ein kleines Geschenk für den Kurs geben, weil Sie uns so viel geholfen haben.

Viele Grüße
Ayşe`;

const WRITING_B1_COMPLAINT = `Sehr geehrte Damen und Herren,

vor drei Wochen habe ich bei Ihnen eine Kaffeemaschine bestellt, aber die Lieferung kam erst gestern. Leider funktioniert die Maschine nicht richtig, weil das Wasser nicht warm wird. Außerdem fehlt die Bedienungsanleitung im Paket. Ich bin sehr enttäuscht, denn ich habe für die schnelle Lieferung extra bezahlt. Bitte schicken Sie mir eine neue Maschine oder geben Sie mir mein Geld zurück. Ich erwarte Ihre Antwort bis Ende der Woche.

Mit freundlichen Grüßen
Zeynep Arslan`;

/** Three short verbatim fragments, so the seeded evidence really is in the text. */
function fragments(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.split(" ").length >= 6)
    .slice(1, 4)
    .map((x) => x.split(" ").slice(0, 7).join(" "));
}

let usedWriting = WRITING_B1;

const SPEAKING_B1 = `also ich wohne seit drei jahren in izmir und ich arbeite in einem büro am wochenende gehe ich oft mit meiner familie spazieren oder wir fahren ans meer ich lerne deutsch weil ich später in deutschland studieren möchte das ist nicht immer einfach aber es macht mir spaß besonders die grammatik ist manchmal schwierig`;

function proposal(level: "B1" | "A2" | "B2", evidence: string[], speaking: boolean): GradingProposal {
  const crit = (criterion: string, l: string, rationale: string, ev: string[] = []) => ({
    criterion,
    level: l,
    score: l === level ? 3 : 2,
    assessable: true,
    rationale,
    evidence: ev,
  });
  const criteria = [
    crit("TASK_ACHIEVEMENT", level, "Görevin istediği noktaların hepsi ele alınmış.", evidence.slice(0, 1)),
    crit("COHERENCE", level, "Bağlaçlarla (weil, denn) düzgün bağlanmış kısa paragraflar.", evidence.slice(1, 2)),
    crit("RANGE", "B1", "Günlük konular için yeterli kelime; kalıplar tekrarlanıyor."),
    crit("ACCURACY", level === "B2" ? "B1" : level, "Yan cümlelerde fiil sonda doğru; birkaç küçük hata.", evidence.slice(2, 3)),
    ...(speaking
      ? [
          crit("FLUENCY", "B1", "Kısa duraklamalarla akıcı; cümle sınırları belirsiz."),
          { criterion: "PRONUNCIATION", level: "B1", score: 0, assessable: false, rationale: "cannot be judged from a transcript", evidence: [] },
        ]
      : []),
  ];
  return {
    criteria,
    overallLevel: level,
    summary: speaking
      ? "Günlük konularda anlaşılır ve bağlantılı konuşuyor; B1 düzeyinde."
      : "Görevin istediği metin türünü uygun biçimde yazıyor; B1 düzeyinde.",
    flags: [],
  } as GradingProposal;
}

function tinyJpeg(color: string): Uint8Array | null {
  const target = join(tmpdir(), `kademe-seed-${randomUUID()}.jpg`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${color}:s=320x240`, "-frames:v", "1", target]);
  if (r.status !== 0) return null;
  try {
    return new Uint8Array(readFileSync(target));
  } finally {
    rmSync(target, { force: true });
  }
}

async function main() {
  const started = Date.now();
  log("Resetting...");
  await reset();

  const [org] = await db
    .insert(s.organizations)
    .values({ name: "Kademe Deutschschule", contactEmail: "sinav@kademe-deutschschule.local" })
    .returning();
  const [owner] = await db
    .insert(s.users)
    .values({ orgId: org.id, email: OWNER_EMAIL, name: "Kadir Ay", role: "OWNER", passwordHash: await argon2Hash(DEV_PASSWORD) })
    .returning();
  await db.insert(s.users).values({
    orgId: org.id,
    email: "ogretmen@kademe.local",
    name: "Elif Yıldız",
    role: "MANAGER",
    passwordHash: await argon2Hash(DEV_PASSWORD),
  });
  await db.insert(s.consentTexts).values({ orgId: org.id, version: 1, body: { tr: CONSENT_TR, en: CONSENT_EN } });

  log("Importing the starter bank (listening audio is made once and reused)...");
  const bank = await importSeedBank(org.id, { log });
  log(`  ${bank.items} items, ${bank.stimuli} texts and clips; audio made ${bank.audioMade}, reused ${bank.audioReused}, failed ${bank.audioFailed}`);

  const placementCfg = defaultBlueprint("PLACEMENT");
  const verificationCfg = defaultBlueprint("LEVEL_VERIFICATION");
  const [placement] = await db
    .insert(s.examBlueprints)
    .values({
      orgId: org.id,
      name: "Almanca seviye tespit sınavı",
      description: "A1-C2 arası seviyeyi sıfırdan belirler. Dilbilgisi, okuma ve dinleme uyarlanabilir.",
      mode: "PLACEMENT",
      status: "PUBLISHED",
      publishedAt: new Date(),
      config: placementCfg,
      createdBy: owner.id,
    })
    .returning();
  const [verification] = await db
    .insert(s.examBlueprints)
    .values({
      orgId: org.id,
      name: "Seviye doğrulama sınavı",
      description: "Öğrencinin beyan ettiği seviyeyi taşıyıp taşımadığını ölçer.",
      mode: "LEVEL_VERIFICATION",
      status: "PUBLISHED",
      publishedAt: new Date(),
      config: verificationCfg,
      createdBy: owner.id,
    })
    .returning();
  await db.insert(s.examBlueprints).values({
    orgId: org.id,
    name: "Kısa dilbilgisi kontrolü (taslak)",
    description: "Sadece dilbilgisi, 10 dakika, gözetimsiz.",
    mode: "PLACEMENT",
    status: "DRAFT",
    config: {
      ...placementCfg,
      sections: placementCfg.sections.map((x) => ({ ...x, enabled: x.section === "GRAMMAR", durationMinutes: x.section === "GRAMMAR" ? 10 : x.durationMinutes })),
      proctoring: { ...placementCfg.proctoring, preset: "OFF", camera: false, microphone: false, screenShare: false, fullscreen: false },
    },
    createdBy: owner.id,
  });

  const links: string[] = [];
  const fresh1 = await createInvitation({
    orgId: org.id, blueprintId: placement.id, fullName: "Ayşe Demir", email: "ayse.demir@example.com", claimedLevel: null, locale: "tr", invitedBy: owner.id,
  });
  const fresh2 = await createInvitation({
    orgId: org.id, blueprintId: verification.id, fullName: "Mehmet Kaya", email: "mehmet.kaya@example.com", claimedLevel: "B1", locale: "tr", invitedBy: owner.id,
  });
  if (fresh1.ok) links.push(`Placement (Ayşe Demir):        ${fresh1.url}`);
  if (fresh2.ok) links.push(`B1 verification (Mehmet Kaya): ${fresh2.url}`);

  const listeningReady = bank.audioMade + bank.audioReused > 0;
  const demoCfgNote = listeningReady ? "" : " (listening skipped: no audio)";
  // The finished demo: a real run through the engine, answering like a B1 student.
  const demo = await createInvitation({
    orgId: org.id, blueprintId: verification.id, fullName: "Zeynep Arslan", email: "zeynep.arslan@example.com", claimedLevel: "B1", locale: "tr", invitedBy: owner.id,
  });
  if (!demo.ok) throw new Error(`demo invite failed: ${demo.code}`);
  if (!listeningReady) {
    const [a] = await db.select().from(s.examAssessments).where(eq(s.examAssessments.assessmentId, demo.assessmentId));
    const snapshot = { ...a.blueprintSnapshot, sections: a.blueprintSnapshot.sections.map((x) => (x.section === "LISTENING" ? { ...x, enabled: false } : x)) };
    await db.update(s.examAssessments).set({ blueprintSnapshot: snapshot }).where(eq(s.examAssessments.assessmentId, demo.assessmentId));
  }
  log(`Running the demo student through the exam${demoCfgNote}...`);
  await simulateStudent(demo.rawToken, {
    theta: BAND_CENTER.B1 + 0.2,
    rng: mulberry32(7),
    writing: (snap) => {
      usedWriting = /Beschwerde|beschwer/i.test(snap.prompt) ? WRITING_B1_COMPLAINT : WRITING_B1;
      return usedWriting;
    },
    speaking: () => SPEAKING_B1,
  });

  // The simulated student finishes in seconds. Spread the attempt over a
  // realistic 45 minutes so the timeline and the dates read like a real exam.
  const [simulated] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, demo.assessmentId));
  const examStart = new Date(Date.now() - 50 * 60_000);
  const simRuns = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.attemptId, simulated.id));
  const slots = [15, 12, 8, 6, 4];
  let cursor = examStart.getTime();
  for (const [i, r] of simRuns.sort((a, b) => a.orderIndex - b.orderIndex).entries()) {
    const minutes = slots[i] ?? 5;
    await db
      .update(s.sectionRuns)
      .set({ startedAt: new Date(cursor), deadlineAt: new Date(cursor + minutes * 60_000 + 5 * 60_000), submittedAt: new Date(cursor + minutes * 60_000) })
      .where(eq(s.sectionRuns.id, r.id));
    cursor += minutes * 60_000 + 30_000;
  }
  await db
    .update(s.attempts)
    .set({ startedAt: examStart, deviceCheckedAt: new Date(examStart.getTime() - 3 * 60_000), completedAt: new Date(cursor) })
    .where(eq(s.attempts.id, simulated.id));

  // Stand in for the AI so the review screen has proposals without a key or a wait.
  const [attempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, demo.assessmentId));
  const runs = await db.select().from(s.sectionRuns).where(eq(s.sectionRuns.attemptId, attempt.id));
  const gradings = await db
    .select({ g: s.responseGradings, section: s.sectionRuns.section })
    .from(s.responseGradings)
    .innerJoin(s.itemResponses, eq(s.itemResponses.id, s.responseGradings.itemResponseId))
    .innerJoin(s.sectionRuns, eq(s.sectionRuns.id, s.itemResponses.sectionRunId))
    .where(inArray(s.sectionRuns.id, runs.map((r) => r.id)));
  for (const { g, section } of gradings) {
    if (g.status !== "PENDING") continue;
    const p =
      section === "WRITING"
        ? proposal("B1", fragments(usedWriting), false)
        : proposal("B1", ["ich lerne deutsch weil ich später in deutschland studieren möchte"], true);
    await db
      .update(s.responseGradings)
      .set({ status: "AI_PROPOSED", aiProposal: p, aiLevel: "B1", aiModel: "seed (no AI call)", proposedAt: new Date() })
      .where(eq(s.responseGradings.id, g.id));
  }
  await recomputeResult(attempt.id);

  // A few proctoring flags with frames, so the integrity tab is not empty.
  const [session] = await db
    .insert(s.proctorSessions)
    .values({ attemptId: attempt.id, clientSessionId: "seed-session", env: { browser: "Chrome 140", displaySurface: "MONITOR", isExtendedSupported: true, isExtended: false, model: "ready", fps: 2 } })
    .returning();
  const t0 = (attempt.startedAt ?? new Date()).getTime();
  const flags: Array<{ type: s.ProctorEventRowType; severity: "LOW" | "MEDIUM" | "HIGH" | "INFO"; source: "BROWSER" | "MODEL"; at: number; dur: number | null }> = [
    { type: "FOCUS_LOST", severity: "LOW", source: "BROWSER", at: 4 * 60_000, dur: 3_000 },
    { type: "TAB_HIDDEN", severity: "HIGH", source: "BROWSER", at: 11 * 60_000, dur: 14_000 },
    { type: "PASTE_ATTEMPT", severity: "LOW", source: "BROWSER", at: 19 * 60_000, dur: null },
    { type: "MULTIPLE_FACES", severity: "HIGH", source: "MODEL", at: 23 * 60_000, dur: 6_000 },
    { type: "GAZE_AWAY", severity: "LOW", source: "MODEL", at: 27 * 60_000, dur: 7_000 },
  ];
  const storage = getStorage();
  for (const [i, f] of flags.entries()) {
    const start = new Date(t0 + f.at);
    const [event] = await db
      .insert(s.proctorEvents)
      .values({
        attemptId: attempt.id,
        sessionId: session.id,
        clientEventId: `seed-${i}`,
        type: f.type,
        severity: f.severity,
        source: f.source,
        startedAt: start,
        endedAt: f.dur ? new Date(start.getTime() + f.dur) : null,
        durationMs: f.dur,
      })
      .returning();
    const jpeg = tinyJpeg(i % 2 ? "0x2b2b2b" : "0x6b7280");
    if (jpeg) {
      for (const kind of ["WEBCAM_FRAME", "SCREEN_FRAME"] as const) {
        const id = randomUUID();
        const key = proctorEvidenceKey({ orgId: org.id, assessmentId: demo.assessmentId, evidenceId: id, mime: "image/jpeg" });
        await storage.putObject(key, "image/jpeg", jpeg);
        await db.insert(s.proctorEvidence).values({
          id, orgId: org.id, attemptId: attempt.id, eventId: event.id, kind, trigger: "VIOLATION", capturedAt: start,
          storageKey: key, mime: "image/jpeg", bytes: jpeg.byteLength, width: 320, height: 240,
        });
      }
    }
    if (f.type === "MULTIPLE_FACES") {
      await db.insert(s.proctorAiReviews).values({
        eventId: event.id, status: "DONE", verdict: "CONFIRMED", model: "seed (no AI call)",
        summary: "Karede iki kişi görünüyor; ikinci kişi arka planda ayakta.",
        observations: { frames: [{ index: 0, personCount: 2, faceVisible: true, phoneOrDeviceVisible: false, lookingAwayFromScreen: false, nonExamContentOnScreen: null, notes: "İki kişi görünüyor." }] },
        reviewedAt: new Date(),
      });
    }
  }
  await recomputeIntegrity(attempt.id);

  log(`\nDone in ${Math.round((Date.now() - started) / 1000)} s.`);
  log(`Panel login: ${OWNER_EMAIL} / ${DEV_PASSWORD}   (teacher: ogretmen@kademe.local / same password)`);
  log("\nFresh student links (raw tokens are shown only here):");
  for (const l of links) log(`  ${l}`);
  log(`\nFinished demo (Zeynep Arslan, B1 verification) waits for review in the panel.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
