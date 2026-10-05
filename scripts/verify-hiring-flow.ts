/**
 * End to end check of the hiring candidate flow (plan 2), in process, against a
 * THROW-AWAY database (name ends in _check) with every migration applied. It
 * calls the real route handlers with NextRequest, so every body it scans is a
 * real candidate response; recordings and files go to a temporary local disk.
 * The leak scan covers every body the candidate received, and what a page can
 * reach in process (the module's title, the page hook), with a positive control.
 *
 *   docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_flow_check" -c "create database kademe_flow_check"
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm db:migrate
 *   DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_flow_check pnpm verify:hiring-flow
 *   docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_flow_check"
 */
import "dotenv/config";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { refuseUnlessThrowAwayDb } from "../src/db/working-db-guard";

let failed = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const bad = (m: string) => {
  failed += 1;
  console.log(`  FAIL ${m}`);
};
const check = (condition: boolean, label: string, detail?: unknown) => (condition ? ok(label) : bad(detail === undefined ? label : `${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`));

type Json = Record<string, unknown> & { error?: string; step?: string; position?: number; path?: string; current?: Record<string, unknown> | null };
type Handler = (req: unknown, ctx: { params: Promise<{ token: string }> }) => Promise<Response>;

async function main() {
  // Publishing freezes rows for good: only a local throw-away *_check database.
  const refusal = refuseUnlessThrowAwayDb(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing: ${refusal}`);
    process.exit(2);
    return;
  }
  // Local disk for this run, whatever the shell has.
  const storageDir = mkdtempSync(path.join(os.tmpdir(), "kademe-flow-"));
  process.env.LOCAL_STORAGE_DIR = storageDir;
  // Removed however the run ends, a crash included.
  process.on("exit", () => rmSync(storageDir, { recursive: true, force: true }));
  for (const name of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"]) delete process.env[name];

  const { NextRequest } = await import("next/server");
  const { and, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { mintToken } = await import("@/lib/auth");
  const { buildPublishedOpening, freshOrganisation } = await import("./hiring-fixture");
  const { createHiringInvitation, listOpeningCandidates, openingFunnel } = await import("@/solutions/hiring/server/invitations");
  const { expiringLinks } = await import("@/server/links");
  const { hiringModule } = await import("@/solutions/hiring/module");
  const { resolveToken } = await import("@/lib/candidate-context");
  const { solutionPage } = await import("@/lib/candidate-pages");
  const { feedbackDay, formatInviteDay } = await import("@/solutions/hiring/rules/invitation");
  const { ORG_TIMEZONE } = await import("@/lib/org-timezone");

  const routes: Record<string, Handler> = {
    "GET /state": (await import("@/app/api/c/[token]/state/route")).GET as Handler,
    "GET /consent": (await import("@/app/api/c/[token]/consent/route")).GET as Handler,
    "POST /consent": (await import("@/app/api/c/[token]/consent/route")).POST as Handler,
    "POST /info": (await import("@/app/api/c/[token]/info/route")).POST as Handler,
    "POST /device-check": (await import("@/app/api/c/[token]/device-check/route")).POST as Handler,
    "POST /heartbeat": (await import("@/app/api/c/[token]/heartbeat/route")).POST as Handler,
    "PUT /media/part": (await import("@/app/api/c/[token]/media/part/route")).PUT as Handler,
    "POST /media/complete": (await import("@/app/api/c/[token]/media/complete/route")).POST as Handler,
    "POST /rights": (await import("@/app/api/c/[token]/rights/route")).POST as Handler,
    "POST /problem": (await import("@/app/api/c/[token]/problem/route")).POST as Handler,
    "PUT /exam/answer": (await import("@/app/api/c/[token]/exam/answer/route")).PUT as Handler,
    "POST /hiring/stage/start": (await import("@/app/api/c/[token]/hiring/stage/start/route")).POST as Handler,
    "POST /hiring/stage/submit": (await import("@/app/api/c/[token]/hiring/stage/submit/route")).POST as Handler,
    "PUT /hiring/response": (await import("@/app/api/c/[token]/hiring/response/route")).PUT as Handler,
    "POST /hiring/response/commit": (await import("@/app/api/c/[token]/hiring/response/commit/route")).POST as Handler,
    "POST /hiring/extra-time": (await import("@/app/api/c/[token]/hiring/extra-time/route")).POST as Handler,
    "POST /hiring/media/init": (await import("@/app/api/c/[token]/hiring/media/init/route")).POST as Handler,
    "GET /hiring/media/play": (await import("@/app/api/c/[token]/hiring/media/play/route")).GET as Handler,
    "POST /hiring/survey": (await import("@/app/api/c/[token]/hiring/survey/route")).POST as Handler,
  };
  /** Every body a candidate received, for the leak scan. */
  const sent: string[] = [];
  async function call(route: string, token: string, body?: unknown, query = "", raw?: Uint8Array): Promise<{ status: number; json: Json }> {
    const [method, pathPart] = route.split(" ");
    const req = new NextRequest(`http://localhost/api/c/${token}${pathPart}${query}`, {
      method,
      headers: raw ? { "content-type": "application/octet-stream" } : { "content-type": "application/json" },
      body: method === "GET" ? undefined : raw ? Buffer.from(raw) : JSON.stringify(body ?? {}),
    });
    const res = await routes[route](req, { params: Promise.resolve({ token }) });
    const text = await res.text();
    sent.push(text);
    return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
  }
  const unknownToken = "u".repeat(43);

  console.log("\nA published opening, and an invitation to it");
  const team = await freshOrganisation();
  const fixture = await buildPublishedOpening({ orgId: team.orgId, ownerId: team.ownerId, memberIds: [team.ownerId, team.reviewerId], sentinels: true });
  const owner = { id: team.ownerId, orgId: team.orgId };
  const invite = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Elif Kaya", email: `elif-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!invite.ok) throw new Error(`invite: ${invite.code}`);
  const token = invite.url.split("/a/")[1];
  const [terms] = await db.select().from(s.hiringAssessments).where(eq(s.hiringAssessments.assessmentId, invite.assessmentId));
  const assignments = await db.select().from(s.hiringAssignments).where(eq(s.hiringAssignments.assessmentId, invite.assessmentId));
  const [consentText] = await db.select().from(s.consentTexts).where(eq(s.consentTexts.id, terms.consentTextId));
  check(terms.proctorLevel === "OFF" && terms.extraTimePct === 0, "the invitation froze proctoring OFF and no extra time", terms);
  check(assignments.length === 2, "the active panel (owner and reviewer) is assigned", assignments.length);
  check(consentText?.solution === "HIRING", "with the organisation's hiring consent text, not the exam's", consentText?.solution);
  const [outbox] = await db.select().from(s.messageOutbox).where(and(eq(s.messageOutbox.orgId, team.orgId), eq(s.messageOutbox.kind, "INVITE")));
  check(!!outbox && outbox.body.includes(invite.url) && outbox.body.includes("Merhaba Elif Kaya"), "the ready message is in the outbox with the link");

  console.log("\nOther tokens are answered like unknown ones");
  const unknownStart = await call("POST /hiring/stage/start", unknownToken, { stagePosition: 1 });
  check(unknownStart.status === 404 && unknownStart.json.error === "INVALID", "an unknown token: 404 INVALID");
  const examPerson = await db.insert(s.candidates).values({ orgId: team.orgId, fullName: "Sınav Adayı", email: "exam@example.com" }).returning();
  const [examAssessment] = await db.insert(s.assessments).values({ orgId: team.orgId, candidateId: examPerson[0].id, solution: "LANGUAGE_EXAM", locale: "tr" }).returning();
  const examToken = mintToken();
  await db.insert(s.assessmentLinks).values({ assessmentId: examAssessment.id, tokenHash: examToken.hash, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) });
  for (const route of ["POST /hiring/stage/start", "PUT /hiring/response", "POST /hiring/media/init", "POST /hiring/survey"]) {
    const r = await call(route, examToken.raw, {});
    check(r.status === 404 && JSON.stringify(r.json) === JSON.stringify(unknownStart.json), `an exam invitation on ${route}: same 404 as unknown`, r);
  }
  const bareToken = mintToken();
  const [barePerson] = await db.insert(s.candidates).values({ orgId: team.orgId, fullName: "Satırsız", email: "bare@example.com" }).returning();
  const [bare] = await db.insert(s.assessments).values({ orgId: team.orgId, candidateId: barePerson.id, solution: "HIRING", locale: "tr" }).returning();
  await db.insert(s.assessmentLinks).values({ assessmentId: bare.id, tokenHash: bareToken.hash, status: "NOT_STARTED", expiresAt: new Date(Date.now() + 86_400_000) });
  const bareState = await call("GET /state", bareToken.raw);
  const bareStart = await call("POST /hiring/stage/start", bareToken.raw, { stagePosition: 1 });
  check(bareState.status === 404 && bareStart.status === 404, "a HIRING invitation without hiring terms: 404 on core and hiring endpoints");
  const examOnHiring = await call("PUT /exam/answer", token, {});
  check(examOnHiring.status === 404 && examOnHiring.json.error === "INVALID", "an exam endpoint answers the hiring token like an unknown one");

  console.log("\nLanding, extra time, consent, device check");
  let state = await call("GET /state", token);
  check(state.status === 200 && state.json.step === "CONSENT" && state.json.path === "", "the landing comes first", state.json.step);
  state = await call("POST /hiring/extra-time", token, { pct: 25 });
  check(state.json.extraTimePct === 25, "+25% chosen before consent, no reason asked", state.json.extraTimePct);
  const thirty = await call("POST /hiring/extra-time", token, { pct: 30 });
  check(thirty.status === 400 && thirty.json.error === "EXTRA_TIME_INVALID", "30% is refused (400 EXTRA_TIME_INVALID)", thirty.json);
  const consentCopy = await call("GET /consent", token);
  // `accepted` is in INTERNAL_FIELDS, so candidateJson strips it from this body (the exam's too).
  check(consentCopy.status === 200 && consentCopy.json.version === consentText?.version && consentCopy.json.body === (consentText?.body as Record<string, string>).tr, "the consent copy shown is the invitation's frozen text", consentCopy.json.version);
  state = await call("POST /consent", token, { accepted: true });
  check(state.json.step === "CHECK" && state.json.path === "/check", "consent leads to the device check (name and e-mail came with the invitation)", state.json);
  const [consent] = await db.select().from(s.consents).where(eq(s.consents.assessmentId, invite.assessmentId));
  check(consent?.consentTextId === terms.consentTextId, "the consent recorded is the invitation's frozen text");
  const early = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  check(early.status === 409 && early.json.error === "STEPS_MISSING", "a stage cannot start before the device check", early.json);
  state = await call("POST /device-check", token);
  check(state.json.step === "STAGE" && state.json.path === "/stage/1", "then stage 1", state.json.path);

  console.log("\nStage 1: the clock is the server's");
  state = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  const current = state.json.current as { startedAt: string; deadlineAt: string; stage: { activities: Array<{ id: string; type: string }> } };
  const span = Date.parse(current.deadlineAt) - Date.parse(current.startedAt);
  check(span === 750_000, "the deadline is 600 s + 25% = 750 s after the start", span);
  const again = await call("POST /hiring/stage/start", token, { stagePosition: 1 });
  check((again.json.current as { deadlineAt: string }).deadlineAt === current.deadlineAt, "a second start moves nothing");
  const reread = await call("GET /state", token);
  check((reread.json.current as { deadlineAt: string }).deadlineAt === current.deadlineAt, "a reload reads the same deadline");
  const beat = await call("POST /heartbeat", token);
  check(beat.json.deadlineAt === current.deadlineAt, "the heartbeat reports that deadline");
  check((await call("POST /hiring/extra-time", token, { pct: 50 })).json.error === "EXTRA_TIME_LOCKED", "extra time is locked while the stage runs");
  const [video, single, long] = current.stage.activities;
  const outOfOrder = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: single.id, answer: { choiceIds: ["a"] } });
  check(outOfOrder.status === 409 && outOfOrder.json.error === "ACTIVITY_ORDER", "the second question cannot be answered while the first is open", outOfOrder.json);

  console.log("\nA video answer with two takes, uploaded in parts");
  /** The stage the uploads below belong to; moves to 2 with the second stage. */
  let position = 1;
  async function record(activityId: string, kind: "recording" | "file", mime: string, bytes: Uint8Array, name?: string) {
    const opened = await call("POST /hiring/media/init", token, { stagePosition: position, activityId, kind, mime, name, bytes: bytes.byteLength });
    if (opened.status !== 200) return { opened, done: null };
    const ref = opened.json.uploadRef as string;
    await call("PUT /media/part", token, undefined, `?ref=${ref}&part=1`, bytes);
    const done = await call("POST /media/complete", token, { uploadRef: ref, durationMs: kind === "recording" ? 4000 : undefined });
    return { opened, done, ref };
  }
  const take1 = await record(video.id, "recording", "video/webm", new Uint8Array(2048).fill(7));
  const take2 = await record(video.id, "recording", "video/webm", new Uint8Array(4096).fill(9));
  check(take1.done?.json.status === "READY" && take2.done?.json.status === "READY", "both takes complete");
  const third = await call("POST /hiring/media/init", token, { stagePosition: 1, activityId: video.id, kind: "recording", mime: "video/webm" });
  check(third.status === 409 && third.json.error === "TAKES_EXHAUSTED", "a third take is refused by the server's count", third.json);
  const [videoResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, video.id));
  check(videoResponse.mediaAssetId === take2.ref && videoResponse.takeAssetIds.length === 2, "the newest take is the answer", videoResponse);
  const play = await call("GET /hiring/media/play", token, undefined, `?ref=${take2.ref}`);
  check(typeof play.json.src === "string" && (play.json.src as string).length > 0, "the candidate can play their own take back");
  check((await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: video.id })).status === 200, "the video question closes");
  const reopen = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: video.id, answer: { usedTextAlternative: true, text: "Sonradan yazdım." } });
  check(reopen.status === 409 && reopen.json.error === "ACTIVITY_CLOSED", "a closed question in a stage without going back takes no more writes (409 ACTIVITY_CLOSED)", reopen.json);

  console.log("\nChoice and long text");
  const singleCommit = await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: single.id, answer: { choiceIds: ["a"] } });
  check(singleCommit.status === 200 && singleCommit.json.step === "STAGE", "the single choice closes (200)", singleCommit.status);
  const [singleResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, single.id));
  check(singleResponse.autoScore === 1, "the right choice scores 1 on the server", singleResponse.autoScore);
  const tooShort = await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: long.id, answer: { text: "kısa" } });
  check(tooShort.status === 422 && tooShort.json.error === "REQUIRED_MISSING", "a required text under its minimum cannot close", tooShort.json);
  const saved = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: long.id, answer: { text: "Önce kullanıcılarla konuştum, sonra iki seçeneği denedim." } });
  check(saved.json.saved === true, "autosave keeps the draft");
  const closedLong = await call("POST /hiring/response/commit", token, { stagePosition: 1, activityId: long.id });
  check(closedLong.status === 200, "the saved draft closes the question");
  state = await call("POST /hiring/stage/submit", token, { stagePosition: 1 });
  check(state.json.step === "STAGE" && state.json.position === 2, "stage 1 is submitted, stage 2 is next", state.json);
  check((state.json.current as { previous: { closedByClock: boolean } }).previous.closedByClock === false, "and stage 2 says stage 1 ended normally");
  const backToOne = await call("PUT /hiring/response", token, { stagePosition: 1, activityId: long.id, answer: { text: "Birinci aşamaya geri dönüp değiştirmek istiyorum." } });
  check(backToOne.status === 409 && backToOne.json.error === "STAGE_MISMATCH", "a write to stage 1 after its submit is refused (409 STAGE_MISMATCH)", backToOne.json);

  console.log("\nStage 2: a file, a sound answer, an optional question skipped, then the clock ends it");
  position = 2;
  state = await call("POST /hiring/stage/start", token, { stagePosition: 2 });
  const [file, audio, optional, multi] = (state.json.current as { stage: { activities: Array<{ id: string; type: string }> } }).stage.activities;
  check([file, audio, optional, multi].map((a) => a?.type).join() === "FILE_UPLOAD,AUDIO,SHORT_TEXT,MULTI_CHOICE", "stage 2 holds the file, audio, optional text and multiple choice questions", [file, audio, optional, multi].map((a) => a?.type));
  const wrong = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: file.id, kind: "file", mime: "image/png", name: "plan.png", bytes: 100 });
  check(wrong.status === 400 && wrong.json.error === "FILE_TYPE_REJECTED", "a PNG is refused where a PDF is asked", wrong.json);
  const big = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: file.id, kind: "file", mime: "application/pdf", name: "plan.pdf", bytes: 2 * 1024 * 1024 });
  check(big.status === 400 && big.json.error === "FILE_TOO_LARGE", "a file over 1 MB is refused before upload", big.json);
  const pdf = await record(file.id, "file", "application/pdf", new TextEncoder().encode("%PDF-1.4 plan"), "C:\\Belgeler\\Plan Taslağı.pdf");
  check(pdf.done?.json.status === "READY", "the PDF uploads");
  const [fileResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, file.id));
  check(fileResponse.payload.file?.name === "Plan Taslağı.pdf" && fileResponse.fileAssetIds[0] === pdf.ref, "and is attached under its own name, without the path", fileResponse.payload);
  const fileCommit = await call("POST /hiring/response/commit", token, { stagePosition: 2, activityId: file.id });
  check(fileCommit.status === 200, "the file question closes (200)", fileCommit.json);
  const videoOnAudio = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: audio.id, kind: "recording", mime: "video/webm", bytes: 2048 });
  check(videoOnAudio.status === 400 && videoOnAudio.json.error === "RECORDING_TYPE_REJECTED", "a video take is refused on a sound question (400 RECORDING_TYPE_REJECTED)", videoOnAudio.json);
  const sound = await record(audio.id, "recording", "audio/webm", new Uint8Array(1024).fill(3));
  check(sound.done?.json.status === "READY", "the one sound take uploads", sound.done?.json);
  const secondSound = await call("POST /hiring/media/init", token, { stagePosition: 2, activityId: audio.id, kind: "recording", mime: "audio/webm" });
  check(secondSound.status === 409 && secondSound.json.error === "TAKES_EXHAUSTED", "a second take is refused where one is allowed (409 TAKES_EXHAUSTED)", secondSound.json);
  const [audioResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, audio.id));
  const [audioAsset] = await db.select().from(s.mediaAssets).where(eq(s.mediaAssets.id, sound.ref ?? "00000000-0000-0000-0000-000000000000"));
  check(audioResponse.mediaAssetId === sound.ref && audioResponse.takesUsed === 1 && !!audioAsset?.mime.startsWith("audio/"), "the sound take is the answer, stored as audio", { media: audioResponse.mediaAssetId, takes: audioResponse.takesUsed, mime: audioAsset?.mime });
  const audioCommit = await call("POST /hiring/response/commit", token, { stagePosition: 2, activityId: audio.id });
  check(audioCommit.status === 200, "the sound question closes (200)", audioCommit.json);
  const skipped = await call("POST /hiring/response/commit", token, { stagePosition: 2, activityId: optional.id });
  check(skipped.status === 200, "the optional text is skipped: it closes without an answer (200)", skipped.json);
  const [optionalResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, optional.id));
  check(!!optionalResponse.answeredAt && !optionalResponse.payload.text, "and is stored closed with no text", optionalResponse.payload);
  await db.execute(sql`update hiring_stage_runs set deadline_at = now() - interval '10 seconds' where attempt_id = (select id from attempts where assessment_id = ${invite.assessmentId}) and order_index = 1`);
  const late = await call("PUT /hiring/response", token, { stagePosition: 2, activityId: multi.id, answer: { choiceIds: ["a", "b"] } });
  check(late.status === 409 && late.json.error === "STAGE_EXPIRED", "a write after the deadline is refused", late.json);
  const after = await call("GET /state", token);
  check(after.status === 200 && after.json.step === "DONE" && after.json.path === "/done", "the next read closes the stage and the attempt: DONE", after.json);
  const closedLink = await call("GET /state", token);
  check(closedLink.status === 409 && closedLink.json.error === "COMPLETED", "and the link is COMPLETED from then on", closedLink.json);
  const [attempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, invite.assessmentId));
  const runs = await db.select().from(s.hiringStageRuns).where(eq(s.hiringStageRuns.attemptId, attempt.id));
  const first = runs.find((r) => r.orderIndex === 0)!;
  const second = runs.find((r) => r.orderIndex === 1)!;
  check(!!attempt.completedAt && second.wasLate && second.completion === "PARTIAL", "stage 2 closed late and PARTIAL (file and sound answered, the required multiple choice not), the attempt is complete", { completion: second.completion, wasLate: second.wasLate });
  check(first.closedBy === "CANDIDATE" && !first.wasLate, "stage 1, submitted by hand in time, records closed_by CANDIDATE", { closedBy: first.closedBy, wasLate: first.wasLate });
  check(second.closedBy === "CLOCK", "stage 2, closed by the clock on the next read, records closed_by CLOCK", second.closedBy);
  check(!!attempt.completedAt && !!second.submittedAt && attempt.completedAt.getTime() >= second.submittedAt.getTime(), "the attempt's completedAt is written when its last stage closes", { completedAt: attempt.completedAt, closedAt: second.submittedAt });
  const [multiRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, multi.id));
  check(multiRow?.autoScore === 0, "the unanswered multiple choice scored 0 when the stage closed", multiRow?.autoScore);

  console.log("\nThe survey, once");
  check((await call("POST /hiring/survey", token, { rating: 5, comment: "Akıcıydı." })).json.received === true, "a finished candidate can leave the survey");
  check((await call("POST /hiring/survey", token, { rating: 4 })).json.error === "ALREADY_ANSWERED", "but only once");

  console.log("\nRequests the team will see");
  const second2 = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Can Demir", email: `can-${Date.now()}@example.com`, locale: "en", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!second2.ok) throw new Error(second2.code);
  const token2 = second2.url.split("/a/")[1];
  check((await call("POST /rights", token2, { kind: "ACCOMMODATION", message: "Altyazı" })).status === 200, "an accommodation request is accepted");
  const problem = await call("POST /problem", token2, { area: "LINK", message: "Yeni link" });
  check(problem.status === 200, "a new-link request is accepted (200)", problem.json);
  const listed = await listOpeningCandidates(team.orgId, fixture.openingId, { runs: true, blindMode: false });
  const can = listed.find((r) => r.assessmentId === second2.assessmentId);
  check(can?.requests.map((r) => r.kind).sort().join() === "ACCOMMODATION,NEW_LINK", "both requests are on the candidate's row", can?.requests);
  const elif = listed.find((r) => r.assessmentId === invite.assessmentId);
  check(elif?.progress === "COMPLETED" && elif.adapted && elif.stagesDone === 2, "the finished candidate shows complete, adapted, 2/2", elif);
  const masked = await listOpeningCandidates(team.orgId, fixture.openingId, { runs: false, blindMode: true });
  check(masked.every((r) => r.name === null && r.email === null && !r.adapted), "a reviewer under blind mode sees no identity and no adaptation");
  const other = await freshOrganisation();
  check((await listOpeningCandidates(other.orgId, fixture.openingId, { runs: true, blindMode: false })).length === 0, "another organisation sees none of them");

  console.log("\nThe cron closes an abandoned stage");
  const cronSteps = [await call("POST /consent", token2, { accepted: true }), await call("POST /device-check", token2), await call("POST /hiring/stage/start", token2, { stagePosition: 1 })];
  check(cronSteps.every((r) => r.status === 200), "the second candidate consents, checks devices and starts stage 1 (200 each)", cronSteps.map((r) => r.status));
  await db.execute(sql`update hiring_stage_runs set deadline_at = now() - interval '1 minute' where attempt_id = (select id from attempts where assessment_id = ${second2.assessmentId})`);
  const swept = await hiringModule.attempts.closeExpired!(new Date(), 50);
  check(swept.closed >= 1, "closeExpired closed the run", swept);
  const [abandoned] = await db
    .select({ completion: s.hiringStageRuns.completion, wasLate: s.hiringStageRuns.wasLate, closedBy: s.hiringStageRuns.closedBy })
    .from(s.hiringStageRuns)
    .innerJoin(s.attempts, eq(s.attempts.id, s.hiringStageRuns.attemptId))
    .where(eq(s.attempts.assessmentId, second2.assessmentId));
  check(abandoned.completion === "EXPIRED" && abandoned.wasLate, "as EXPIRED and late (nothing was written)", abandoned);
  check(abandoned.closedBy === "CLOCK", "and records closed_by CLOCK", abandoned.closedBy);

  console.log("\nRetention: deleting the person removes every hiring row");
  const [person] = await db.select({ id: s.assessments.candidateId }).from(s.assessments).where(eq(s.assessments.id, second2.assessmentId));
  await db.delete(s.candidates).where(eq(s.candidates.id, person.id));
  const leftovers = await db.execute<{ n: number }>(sql`
    select (select count(*) from hiring_assessments where assessment_id = ${second2.assessmentId})
         + (select count(*) from hiring_assignments where assessment_id = ${second2.assessmentId})
         + (select count(*) from attempts where assessment_id = ${second2.assessmentId})
         + (select count(*) from hiring_stage_runs r join attempts a on a.id = r.attempt_id where a.assessment_id = ${second2.assessmentId}) as n`);
  check(Number(leftovers[0]?.n ?? -1) === 0, "no invitation, assignment, attempt or run is left", leftovers[0]);

  console.log("\nA hand submit of the last stage finishes the attempt");
  const textOpening = await buildPublishedOpening({ orgId: team.orgId, ownerId: team.ownerId, memberIds: [team.ownerId], sentinels: true, kind: "text" });
  const handInvite = await createHiringInvitation(owner, { openingId: textOpening.openingId, fullName: "Ece Arslan", email: `ece-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!handInvite.ok) throw new Error(handInvite.code);
  const token3 = handInvite.url.split("/a/")[1];
  state = await call("POST /consent", token3, { accepted: true });
  check(state.json.step === "STAGE" && state.json.path === "/stage/1", "a text-only opening asks for no device check: consent leads to stage 1", state.json);
  state = await call("POST /hiring/stage/start", token3, { stagePosition: 1 });
  const [only] = (state.json.current as { stage: { activities: Array<{ id: string }> } }).stage.activities;
  check((await call("POST /hiring/response/commit", token3, { stagePosition: 1, activityId: only.id, answer: { text: "Sorunu önce küçük parçalara böldüm, sonra test ettim." } })).status === 200, "the only question closes");
  const [openAttempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, handInvite.assessmentId));
  check(openAttempt.completedAt === null, "before the last submit the attempt has no completedAt", openAttempt.completedAt);
  state = await call("POST /hiring/stage/submit", token3, { stagePosition: 1 });
  check(state.status === 200 && state.json.step === "DONE" && state.json.path === "/done", "submitting the last stage by hand: DONE", state.json);
  const [doneAttempt] = await db.select().from(s.attempts).where(eq(s.attempts.assessmentId, handInvite.assessmentId));
  const [handRun] = await db.select().from(s.hiringStageRuns).where(eq(s.hiringStageRuns.attemptId, doneAttempt.id));
  check(!!doneAttempt.completedAt && handRun.closedBy === "CANDIDATE" && !handRun.wasLate && handRun.completion === "COMPLETE", "the attempt gets completedAt on the last submit, the run records closed_by CANDIDATE", { completedAt: doneAttempt.completedAt, closedBy: handRun.closedBy, wasLate: handRun.wasLate, completion: handRun.completion });
  check(!!handRun.submittedAt && doneAttempt.completedAt!.getTime() >= handRun.submittedAt.getTime(), "completedAt is not before the submit", { completedAt: doneAttempt.completedAt, submittedAt: handRun.submittedAt });
  const doneLink = await call("GET /state", token3);
  check(doneLink.status === 409 && doneLink.json.error === "COMPLETED", "and the link is COMPLETED", doneLink.json);

  console.log("\nThe video question's written alternative");
  const altInvite = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Deniz Aksoy", email: `deniz-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!altInvite.ok) throw new Error(altInvite.code);
  const token4 = altInvite.url.split("/a/")[1];
  const altSteps = [await call("POST /consent", token4, { accepted: true }), await call("POST /device-check", token4)];
  state = await call("POST /hiring/stage/start", token4, { stagePosition: 1 });
  check([...altSteps, state].every((r) => r.status === 200), "a fourth candidate reaches stage 1 (200 each)", [...altSteps, state].map((r) => r.status));
  const [altVideo] = (state.json.current as { stage: { activities: Array<{ id: string; type: string }> } }).stage.activities;
  const written = await call("POST /hiring/response/commit", token4, { stagePosition: 1, activityId: altVideo.id, answer: { usedTextAlternative: true, text: "Kamera kullanamıyorum; kendimi yazıyla tanıtıyorum." } });
  check(written.status === 200, "the video question closes with the written alternative and no take (200)", written.json);
  const [altResponse] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, altVideo.id)).innerJoin(s.hiringStageRuns, eq(s.hiringStageRuns.id, s.hiringResponses.stageRunId)).innerJoin(s.attempts, and(eq(s.attempts.id, s.hiringStageRuns.attemptId), eq(s.attempts.assessmentId, altInvite.assessmentId)));
  const alt = altResponse?.hiring_responses;
  check(!!alt && alt.usedTextAlternative && alt.payload.usedTextAlternative === true && typeof alt.payload.text === "string" && alt.takeAssetIds.length === 0 && !!alt.answeredAt, "stored as the written alternative, answered, no take", alt && { used: alt.usedTextAlternative, payload: alt.payload, takes: alt.takeAssetIds.length });

  console.log("\nA stage with a way back (written opening)");
  const writtenOpening = await buildPublishedOpening({ orgId: team.orgId, ownerId: team.ownerId, memberIds: [team.ownerId], sentinels: true, kind: "written" });
  const writtenInvite = await createHiringInvitation(owner, { openingId: writtenOpening.openingId, fullName: "Selin Öz", email: `selin-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!writtenInvite.ok) throw new Error(writtenInvite.code);
  const token5 = writtenInvite.url.split("/a/")[1];
  const writtenFrom = sent.length;
  state = await call("POST /consent", token5, { accepted: true });
  check(state.json.step === "STAGE" && state.json.path === "/stage/1", "no recorded question, so no device check: consent leads to stage 1", state.json);
  state = await call("POST /hiring/stage/start", token5, { stagePosition: 1 });
  const [wLong, wSingle, wOptional] = (state.json.current as { stage: { activities: Array<{ id: string; type: string }> } }).stage.activities;
  check([wLong, wSingle, wOptional].map((a) => a?.type).join() === "LONG_TEXT,SINGLE_CHOICE,SHORT_TEXT", "stage 1 holds long text, single choice, optional short text", [wLong, wSingle, wOptional].map((a) => a?.type));
  const wSteps = [
    await call("POST /hiring/response/commit", token5, { stagePosition: 1, activityId: wLong.id, answer: { text: "Önce sorunu tanımladım, sonra ekiple çözdük." } }),
    await call("POST /hiring/response/commit", token5, { stagePosition: 1, activityId: wSingle.id, answer: { choiceIds: ["b"] } }),
  ];
  check(wSteps.every((r) => r.status === 200), "the two required questions close (200 each)", wSteps.map((r) => r.status));
  const [wrongSingle] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wSingle.id));
  check(wrongSingle.autoScore === 0, "a wrong single choice scores 0", wrongSingle.autoScore);
  state = await call("POST /hiring/stage/submit", token5, { stagePosition: 1 });
  check(state.status === 200 && state.json.step === "STAGE" && state.json.position === 2, "the stage submits with the optional question never touched (skipped)", state.json);
  const [wOptionalRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wOptional.id));
  check(!wOptionalRow?.payload.text, "and the optional question holds no answer", wOptionalRow?.payload);
  state = await call("POST /hiring/stage/start", token5, { stagePosition: 2 });
  const [wCase, wMulti] = (state.json.current as { stage: { activities: Array<{ id: string; type: string }> } }).stage.activities;
  check(state.status === 200 && wCase?.type === "LONG_TEXT" && wMulti?.type === "MULTI_CHOICE", "stage 2 (going back allowed) starts: long text, multiple choice", state.json.error ?? [wCase?.type, wMulti?.type]);
  const caseCommit = await call("POST /hiring/response/commit", token5, { stagePosition: 2, activityId: wCase.id, answer: { text: "Açık konuşur, nedenini ve sonraki adımı anlatırdım." } });
  check(caseCommit.status === 200, "the long text closes (200)", caseCommit.json);
  const partial = await call("POST /hiring/response/commit", token5, { stagePosition: 2, activityId: wMulti.id, answer: { choiceIds: ["a"] } });
  const [partialRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wMulti.id));
  check(partial.status === 200 && partialRow.autoScore === 0, "a partial set (a) of the right set (a, b) scores 0", { status: partial.status, autoScore: partialRow.autoScore });
  const reedit = await call("PUT /hiring/response", token5, { stagePosition: 2, activityId: wCase.id, answer: { text: "Geri dönüp düzelttim: önce dinler, sonra açık konuşurdum." } });
  const [caseRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wCase.id));
  check(reedit.status === 200 && reedit.json.saved === true && caseRow.payload.text === "Geri dönüp düzelttim: önce dinler, sonra açık konuşurdum.", "going back, a closed question takes a re-edit", { status: reedit.status, text: caseRow.payload.text });
  const exact = await call("POST /hiring/response/commit", token5, { stagePosition: 2, activityId: wMulti.id, answer: { choiceIds: ["b", "a"] } });
  const [exactRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wMulti.id));
  check(exact.status === 200 && exactRow.autoScore === 1, "the exact set (a, b), in any order, scores 1", { status: exact.status, autoScore: exactRow.autoScore });
  const over = await call("POST /hiring/response/commit", token5, { stagePosition: 2, activityId: wMulti.id, answer: { choiceIds: ["a", "b", "c"] } });
  const [overRow] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wMulti.id));
  check(over.status === 200 && overRow.autoScore === 0, "a superset (a, b, c) scores 0", { status: over.status, autoScore: overRow.autoScore });
  await call("POST /hiring/response/commit", token5, { stagePosition: 2, activityId: wMulti.id, answer: { choiceIds: ["a", "b"] } });
  state = await call("POST /hiring/stage/submit", token5, { stagePosition: 2 });
  check(state.status === 200 && state.json.step === "DONE", "the last stage submits: DONE", state.json);
  const [finalMulti] = await db.select().from(s.hiringResponses).where(eq(s.hiringResponses.activityId, wMulti.id));
  check(finalMulti.autoScore === 1, "the score the stage closed with is the last answer's (1)", finalMulti.autoScore);
  const writtenBodies = sent.slice(writtenFrom).join("\n");
  check(writtenBodies.includes("LEAKVISIBLE_PROMPT") && writtenBodies.includes("LEAKVISIBLE_CHOICE") && writtenBodies.includes("LEAKVISIBLE_STAGE"), "positive control: the written opening's sentinels reached this candidate", ["PROMPT", "CHOICE", "STAGE"].filter((x) => !writtenBodies.includes(`LEAKVISIBLE_${x}`)));

  console.log("\nWhat a page can reach in process");
  // Every candidate page asks solutionPage first; the module's title is the page header's.
  // Hiring renders the landing and the details form (Task 11), the device check (Task 12), the
  // stage runner (Task 13), the warm-up (Task 14) and the finish (Task 16): no slot of a served
  // link answers with the invalid-link placeholder any more. Every node rendered here joins the
  // leak scan; the browser check scans the real document and RSC payload (C10).
  const pageRead = (node: unknown) => JSON.stringify(node ?? null, (_key, value) => (typeof value === "function" || typeof value === "symbol" ? undefined : value));
  /** A rendered page, or the address Next's redirect() sends it to (its digest is "NEXT_REDIRECT;type;url;status;"). */
  async function page(raw: string, slot: "landing" | "info" | "check" | "practice" | "stage" | "done", params: Record<string, string> = {}, query: Record<string, string> = {}): Promise<{ node?: string; to?: string }> {
    try {
      const node = await solutionPage(raw, slot, Promise.resolve(query), params);
      const read = node === undefined ? undefined : pageRead(node);
      if (read !== undefined) sent.push(read);
      return { node: read };
    } catch (error) {
      const digest = (error as { digest?: unknown }).digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) return { to: digest.split(";").slice(2, -2).join(";") };
      throw error;
    }
  }
  const invalidCard = (r: { node?: string }) => !!r.node && r.node.includes('"problem":"INVALID"');
  check(typeof hiringModule.candidate.renderPage === "function", "hiring renders its own candidate pages (module.renderPage)");
  for (const [label, raw, slot, params] of [
    ["finished, landing", token, "landing", {}],
    ["finished, stage 2", token, "stage", { n: "2" }],
  ] as const) {
    const r = await page(raw, slot, { ...params });
    check(r.to === `/a/${token}/done`, `${label}: sent to its finish page`, r);
  }
  const handDone = await page(token3, "done");
  const [handOpening] = await db.select({ feedbackDays: s.hiringOpenings.feedbackDays, survey: s.hiringOpenings.finishSurveyEnabled }).from(s.hiringOpenings).where(eq(s.hiringOpenings.id, textOpening.openingId));
  // Task 16 fix round 1 (I2): the promise is frozen on the invitation in the finish's transaction.
  const [handRow] = await db.select({ feedbackBy: s.hiringAssessments.feedbackBy }).from(s.hiringAssessments).where(eq(s.hiringAssessments.assessmentId, handInvite.assessmentId));
  const promisedDay = feedbackDay(doneAttempt.completedAt!, handOpening.feedbackDays, ORG_TIMEZONE);
  check(handRow.feedbackBy === promisedDay, `the finish froze the reply promise on the invitation: ${promisedDay} (the org day of completion + ${handOpening.feedbackDays} days)`, handRow.feedbackBy);
  const promised = formatInviteDay(promisedDay, "tr");
  check(
    !!handDone.node && !invalidCard(handDone) && handDone.node.includes(`"feedbackBy":"${promised}"`) && handDone.node.includes('"stagesDone":'),
    `finished by hand, done: the finish page (Task 16) with the reply promise ${promised} in the organisation's zone`,
    handDone.to ?? handDone.node?.match(/"feedbackBy":"[^"]*"/)?.[0] ?? handDone.node?.slice(0, 160),
  );
  check(
    !!handDone.node && handDone.node.includes(`"survey":{"enabled":${handOpening.survey},"answered":false}`),
    "and its survey is not answered yet",
    handDone.node?.match(/"survey":\{[^}]*\}/)?.[0],
  );
  // The team edits the opening's feedback days after the candidate finished: the promise shown stays.
  await db.update(s.hiringOpenings).set({ feedbackDays: handOpening.feedbackDays + 20 }).where(eq(s.hiringOpenings.id, textOpening.openingId));
  const editedDone = await page(token3, "done");
  check(
    !!editedDone.node && editedDone.node.includes(`"feedbackBy":"${promised}"`),
    `a later edit of the opening's feedback days (${handOpening.feedbackDays} -> ${handOpening.feedbackDays + 20}) does not move the promise shown (${promised})`,
    editedDone.node?.match(/"feedbackBy":"[^"]*"/)?.[0],
  );
  await db.update(s.hiringOpenings).set({ feedbackDays: handOpening.feedbackDays }).where(eq(s.hiringOpenings.id, textOpening.openingId));
  const surveyedDone = await page(token, "done");
  check(
    !!surveyedDone.node && !invalidCard(surveyedDone) && /"survey":\{"enabled":true,"answered":true\}/.test(surveyedDone.node),
    "the candidate who sent the survey gets the finish with it answered (a reload shows the thanks)",
    surveyedDone.to ?? surveyedDone.node?.match(/"survey":\{[^}]*\}/)?.[0],
  );
  for (const [label, r] of [["finished by hand", handDone], ["surveyed", surveyedDone]] as const) {
    check(
      !!r.node && r.node.includes('"orgName":"Örnek A.Ş."') && !r.node.includes("TEAMSECRET") && !/"correct"|autoScore|"score"/.test(r.node),
      `${label}, done: the frame's organisation (positive control), no TEAMSECRET text and no score`,
      r.node?.match(/TEAMSECRET_[A-Z_]+|"correct"|autoScore|"score"/g),
    );
  }

  const fresh = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Leyla Şahin", email: `leyla-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!fresh.ok) throw new Error(fresh.code);
  const token6 = fresh.url.split("/a/")[1];
  const toInfo = await page(token6, "info");
  check(toInfo.to === `/a/${token6}`, "a new candidate asking for /info is sent to the landing", toInfo);
  const switched = await page(token6, "landing", {}, { lang: "en" });
  const [inEnglish] = await db.select({ locale: s.assessments.locale }).from(s.assessments).where(eq(s.assessments.id, fresh.assessmentId));
  check(switched.to === `/a/${token6}` && inEnglish.locale === "en", "?lang=en is written to the invitation and dropped from the address", { to: switched.to, locale: inEnglish.locale });
  const landing = await page(token6, "landing");
  check(!!landing.node && landing.node.includes('"consentBody"') && landing.node.includes(JSON.stringify(consentText.body.en)), "the landing renders, with the invitation's frozen hiring consent text in English", landing.to ?? landing.node?.slice(0, 120));
  check(!!landing.node && landing.node.includes('"orgName":"Örnek A.Ş."') && (landing.node.match(/LEAKVISIBLE_[A-Z]+/g) ?? []).length >= 1, "positive control: the landing's props carry the organisation and a LEAKVISIBLE text", landing.node?.match(/LEAKVISIBLE_[A-Z]+/g));
  check(!!landing.node && !landing.node.includes("TEAMSECRET"), "and no TEAMSECRET text", landing.node?.match(/TEAMSECRET_[A-Z_]+/g));
  check(!!landing.node && /"deadline":"\d{1,2} [A-Z][a-z]{2}, 23:59 \(/.test(landing.node), "the deadline reads like the invitation e-mail (end of the day, zone named)", landing.node?.match(/"deadline":"[^"]*"/)?.[0]);
  check(!!landing.node && landing.node.includes('"reviewers":2'), "the landing promises the opening's minimum of 2 reviewers (panel of 2)", landing.node?.match(/"reviewers":\d+/)?.[0]);
  check((await call("POST /consent", token6, { accepted: true })).json.step === "CHECK", "the landing's consent leads to the device check");
  const [leyla] = await db.select({ id: s.assessments.candidateId }).from(s.assessments).where(eq(s.assessments.id, fresh.assessmentId));
  await db.update(s.candidates).set({ email: null }).where(eq(s.candidates.id, leyla.id));
  const info = await page(token6, "info");
  check(!!info.node && info.node.includes('"initial"') && info.node.includes("Leyla Şahin"), "without an e-mail address the details form renders, filled from the invitation", info.to ?? info.node?.slice(0, 120));
  await db.update(s.candidates).set({ email: `leyla-${Date.now()}@example.com` }).where(eq(s.candidates.id, leyla.id));
  const checkPage = await page(token6, "check");
  check(!!checkPage.node && !invalidCard(checkPage) && /"camera":(true|false),"practice":(true|false),"locale":"(tr|en)"/.test(checkPage.node), "the device check renders (Task 12) with the camera and warm-up flags and the language", checkPage.to ?? checkPage.node?.slice(0, 160));
  check(!!checkPage.node && checkPage.node.includes('"orgName":"Örnek A.Ş."') && !/LEAKVISIBLE_|TEAMSECRET/.test(checkPage.node), "the device check carries the frame's organisation (positive control) and no question, stage or team text", checkPage.node?.match(/(LEAKVISIBLE|TEAMSECRET)_[A-Z_]+/g));
  const toCheck = await page(token6, "info");
  check(toCheck.to === `/a/${token6}/check`, "with the details given, /info sends on to /check", toCheck);
  state = await call("POST /device-check", token6);
  check(state.status === 200 && state.json.step === "STAGE", "the device check leads to stage 1", state.json.step);
  const stagePage = await page(token6, "stage", { n: "1" });
  check(
    !!stagePage.node && !invalidCard(stagePage) && stagePage.node.includes('"current":{"position":1') && stagePage.node.includes('"startedAt":null'),
    "the stage slot renders the stage runner (Task 13) on stage 1's intro",
    stagePage.to ?? stagePage.node?.slice(0, 160),
  );
  check(
    !!stagePage.node && (stagePage.node.match(/LEAKVISIBLE_[A-Z]+/g) ?? []).length >= 1 && !stagePage.node.includes("TEAMSECRET") && !stagePage.node.includes('"correct"'),
    "the runner's props carry a LEAKVISIBLE text (positive control) and no TEAMSECRET text or right answer",
    stagePage.node?.match(/(LEAKVISIBLE|TEAMSECRET)_[A-Z_]+|"correct"/g),
  );
  const practicePage = await page(token6, "practice");
  if (state.json.practice) {
    check(
      !!practicePage.node && !invalidCard(practicePage) && /"camera":(true|false),"locale":"(tr|en)"/.test(practicePage.node),
      "the warm-up slot renders the warm-up (Task 14) with the camera flag and the language",
      practicePage.to ?? practicePage.node?.slice(0, 160),
    );
    check(
      !!practicePage.node && practicePage.node.includes('"orgName":"Örnek A.Ş."') && !/LEAKVISIBLE_|TEAMSECRET/.test(practicePage.node),
      "the warm-up carries the frame's organisation (positive control) and no question, stage or team text",
      practicePage.node?.match(/(LEAKVISIBLE|TEAMSECRET)_[A-Z_]+/g),
    );
  } else {
    check(practicePage.to === `/a/${token6}/stage/1`, "the warm-up slot: no warm-up in this version, sent to stage 1", practicePage);
  }

  const served = { handDone, surveyedDone, landing, info, checkPage, stagePage, practicePage };
  const placeholders = Object.entries(served).filter(([, r]) => invalidCard(r)).map(([name]) => name);
  check(placeholders.length === 0, `no slot of a served link renders the invalid-link placeholder (${Object.keys(served).length} pages read)`, placeholders);

  const expiring = await createHiringInvitation(owner, { openingId: fixture.openingId, fullName: "Mert Aydın", email: `mert-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
  if (!expiring.ok) throw new Error(expiring.code);
  const token7 = expiring.url.split("/a/")[1];
  await db.update(s.assessmentLinks).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(s.assessmentLinks.assessmentId, expiring.assessmentId));
  const expired = await page(token7, "landing");
  check(!!expired.node && expired.node.includes('"problem":"EXPIRED"') && expired.node.includes('"orgName":"Örnek A.Ş."'), "an expired link shows the expired-link card inside the hiring frame", expired.to ?? expired.node?.slice(0, 120));
  await db.update(s.assessmentLinks).set({ expiresAt: new Date(Date.now() + 86_400_000) }).where(eq(s.assessmentLinks.assessmentId, expiring.assessmentId));
  // Ruling C5: Today's "48 saat içinde dolacak linkler" is the exam's list. Both links lapse within a day here.
  const soon = (await expiringLinks(team.orgId)).map((r) => r.assessmentId);
  check(soon.includes(examAssessment.id), "Today's expiring links list an exam invitation that lapses within 48 hours (positive control)", soon);
  check(!soon.includes(expiring.assessmentId), "Today's expiring links leave out a hiring invitation that lapses within 48 hours", soon);
  await db.update(s.hiringOpenings).set({ status: "CLOSED" }).where(eq(s.hiringOpenings.id, fixture.openingId));
  const closed = await page(token7, "landing");
  check(!!closed.node && closed.node.includes('"contactEmail":"deniz@ornek.test"') && !closed.node.includes('"consentBody"'), "a closed opening shows a not-started candidate the closed card, not the landing", closed.to ?? closed.node?.slice(0, 120));
  const notStarted = await page(token6, "stage", { n: "1" });
  check(notStarted.to === `/a/${token6}`, "a candidate who has not started a stage is stopped by the closed opening too", notStarted);
  const stillIn = await page(token4, "stage", { n: "1" });
  check(
    !!stillIn.node && !invalidCard(stillIn) && stillIn.node.includes('"current":{"position":1') && /"startedAt":"\d{4}-/.test(stillIn.node),
    "a candidate already inside a stage of the closed opening still reaches their running stage",
    stillIn.to ?? stillIn.node?.slice(0, 160),
  );

  for (const raw of [token, token3]) {
    const resolved = await resolveToken(raw);
    check(!!resolved.ctx, "the finished token still resolves for the page header");
    if (resolved.ctx) sent.push(JSON.stringify(await hiringModule.candidate.title(resolved.ctx)));
  }

  // The invitation e-mails reach the candidate too.
  const mails = await db.select({ kind: s.messageOutbox.kind, subject: s.messageOutbox.subject, body: s.messageOutbox.body }).from(s.messageOutbox).where(eq(s.messageOutbox.orgId, team.orgId));
  const invites = mails.filter((m) => m.kind === "INVITE");
  check(invites.length === 7 && invites.every((m) => m.body.includes("https://kademe.test/a/")), `the seven invitation e-mails (with their links) join the scan, with every other outbox mail (${mails.length} in all)`, mails.map((m) => m.kind));
  for (const m of mails) sent.push(`${m.subject}\n${m.body}`);

  console.log("\nLeak scan over every body the candidate received");
  const all = sent.join("\n");
  const count = (pattern: RegExp) => (all.match(pattern) ?? []).length;
  for (const visible of ["LEAKVISIBLE_PROMPT", "LEAKVISIBLE_STAGE", "LEAKVISIBLE_CHOICE"]) {
    const n = count(new RegExp(visible, "g"));
    check(n >= 1, `positive control: ${visible} reached the candidate (${n} times)`);
  }
  check(!all.includes("TEAMSECRET"), "no team-only text reached the candidate (0 TEAMSECRET_*)", all.match(/TEAMSECRET_[A-Z_]+/g));
  for (const id of [...new Set([...fixture.competencies, ...textOpening.competencies, ...writtenOpening.competencies])]) check(!all.includes(id), `competency ${id.slice(0, 8)} never reached the candidate`);
  check(!/"correct"|internalQuestion|internalPurpose|expectedBehaviours|redFlags|managerNotes|answerExamples|autoScore|auto_score|scorecard/.test(all), "no team-only field name either", all.match(/"correct"|internalQuestion|internalPurpose|expectedBehaviours|redFlags|managerNotes|answerExamples|autoScore|auto_score|scorecard/g));
  check(sent.length > 40, `the scan covered the whole walk (${sent.length} bodies)`, sent.length);

  console.log("\nThe overview's survey, released in batches of five (Task 19 fix round 1)");
  // Its own organisation, so the mail count above stays as it is. The real statement on Postgres:
  // the oldest whole batches only, ordered by created_at then assessment_id, trimmed comments.
  // Answers count only once they are a day old (fix round 2), so these are dated in January.
  const quiet = await freshOrganisation();
  const quietOwner = { id: quiet.ownerId, orgId: quiet.orgId };
  const surveyOpening = await buildPublishedOpening({ orgId: quiet.orgId, ownerId: quiet.ownerId, memberIds: [quiet.ownerId], kind: "text" });
  const surveyed: string[] = [];
  for (let i = 0; i < 15; i++) {
    const r = await createHiringInvitation(quietOwner, { openingId: surveyOpening.openingId, fullName: `Anket Aday ${i}`, email: `anket${i}-${Date.now()}@example.com`, locale: "tr", deadline: null }, { baseUrl: "https://kademe.test" });
    if (!r.ok) throw new Error(`survey invite: ${r.code}`);
    surveyed.push(r.assessmentId);
  }
  const surveyBase = Date.parse("2026-01-01T09:00:00Z");
  const answerAt = async (i: number, rating: number, comment: string | null, minute = i) =>
    db.insert(s.hiringSurveyResponses).values({ assessmentId: surveyed[i], rating, comment, createdAt: new Date(surveyBase + minute * 60_000) });
  const surveyNow = async () => (await openingFunnel(quiet.orgId, surveyOpening.openingId)).survey;
  const firstFive: Array<[number, string | null]> = [[5, "  Bir  "], [4, null], [3, " "], [4, "Dört"], [5, "Beş\n"]];
  for (let i = 0; i < 4; i++) await answerAt(i, firstFive[i][0], firstFive[i][1]);
  const four = await surveyNow();
  check(four.count === 0 && four.average === null && four.comments.length === 0, "four answers: nothing is shown, not even a count", four);
  await answerAt(4, firstFive[4][0], firstFive[4][1]);
  const five = await surveyNow();
  check(five.count === 5 && five.average === 4.2 && [...five.comments].sort().join("|") === ["Beş", "Bir", "Dört"].sort().join("|"), "five answers: count 5, average 4.2, the three non-empty comments trimmed", five);
  check(JSON.stringify(await surveyNow()) === JSON.stringify(five), "a reload shows the same trio in the same order", five.comments);
  for (let i = 5; i < 9; i++) await answerAt(i, 1, `Geç ${i}`);
  const nine = await surveyNow();
  check(JSON.stringify(nine) === JSON.stringify(five), "answers six to nine change nothing (count, average, trio)", nine);
  await answerAt(9, 1, "Onuncu");
  const ten = await surveyNow();
  check(ten.count === 10 && ten.average === 2.6 && ten.comments.length === 3 && JSON.stringify(ten) !== JSON.stringify(five), "the tenth answer releases the next batch: count 10, average 2.6", ten);
  await answerAt(10, 5, "On birinci");
  const eleven = await surveyNow();
  check(JSON.stringify(eleven) === JSON.stringify(ten) && !eleven.comments.includes("On birinci"), "an eleventh answer changes nothing", eleven);
  // Two answers in the same instant are ordered by invitation id, so every read releases the same ones.
  await db.update(s.hiringSurveyResponses).set({ createdAt: new Date(surveyBase + 9 * 60_000) }).where(eq(s.hiringSurveyResponses.assessmentId, surveyed[10]));
  const tied = JSON.stringify(await surveyNow());
  check(tied === JSON.stringify(await surveyNow()) && JSON.parse(tied).count === 10, "a tie at the edge of a batch is released the same way on every read", tied);
  // Fix round 2: three more old answers make 14; a fifteenth written just now does not count yet.
  for (let i = 11; i < 14; i++) await answerAt(i, 3, `Eski ${i}`);
  await db.insert(s.hiringSurveyResponses).values({ assessmentId: surveyed[14], rating: 5, comment: "Az önce" });
  const young = await surveyNow();
  check(young.count === 10 && !young.comments.includes("Az önce"), "an answer younger than a day does not count toward the next batch", young);
  await db.update(s.hiringSurveyResponses).set({ createdAt: new Date(surveyBase + 14 * 60_000) }).where(eq(s.hiringSurveyResponses.assessmentId, surveyed[14]));
  const aged = await surveyNow();
  check(aged.count === 15 && aged.comments.length === 3, "once it is a day old, the fifteenth releases the third batch", aged);

  console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
