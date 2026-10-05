import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf, type Op } from "./test-fake-db";

const io = vi.hoisted(() => ({
  enqueueTranscription: vi.fn<(id: string) => Promise<boolean>>(async () => true),
  salvage: vi.fn<(key: string, uploadId: string) => Promise<{ bytes: number; parts: Array<{ partNumber: number; etag: string; bytes: number }> }>>(),
  initUpload: vi.fn<(key: string, mime: string) => Promise<{ uploadId: string }>>(async () => ({ uploadId: "up-1" })),
}));

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));
vi.mock("@/lib/queue", () => ({ enqueueTranscription: io.enqueueTranscription }));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    minPartBytes: 0,
    initUpload: io.initUpload,
    signPartUrls: async (_key: string, _id: string, numbers: number[]) => numbers.map((n) => ({ partNumber: n, url: `/p/${n}`, proxy: true })),
    getSignedUrl: async (key: string, seconds: number) => `/signed/${key}?s=${seconds}`,
    salvage: io.salvage,
  }),
  mediaKey: (i: { orgId: string; assessmentId: string; stageRunId: string; mediaId: string }) => `media/${i.orgId}/${i.assessmentId}/${i.stageRunId}/${i.mediaId}.webm`,
}));

import type { CandidateContext } from "@/lib/candidate-context";
import {
  attachMedia,
  closeExpiredStageRuns,
  commitResponse,
  hiringServes,
  loadHiringContext,
  loadHiringState,
  openUpload,
  playbackUrl,
  runningSegment,
  salvageHiringUploads,
  saveResponse,
  saveSurvey,
  setExtraTime,
  stageHeartbeat,
  startStage,
  submitStage,
  type HiringContext,
} from "./candidate";

const ORG = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";
const RUN = "55555555-5555-4555-8555-555555555555";
const RUN2 = "66666666-6666-4666-8666-666666666666";
const TAKE = "77777777-7777-4777-8777-777777777777";
const NOW = new Date("2026-10-05T09:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

const ctx = (solution: "HIRING" | "LANGUAGE_EXAM" = "HIRING"): CandidateContext => ({
  link: { id: "link-1", status: "NOT_STARTED", expiresAt: new Date("2026-10-19T00:00:00Z"), notBefore: null, firstSeenIp: null },
  assessment: { id: ASSESSMENT, orgId: ORG, solution },
  candidate: { id: "c-1", fullName: "Elif Kaya", email: "elif@example.com", phone: null, location: null },
  orgName: "Örnek A.Ş.",
  locale: "tr",
  contactEmail: null,
  contactName: null,
  mediaRetentionDays: 180,
  evidenceRetentionDays: 90,
});
const h = (): HiringContext => ({ ...ctx(), hiring: { openingId: "op-1", versionId: VERSION, extraTimePct: 0, consentTextId: "ct-1" } });

type World = {
  stages: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  attempt: Record<string, unknown>;
  runs: Array<Record<string, unknown>>;
  responses: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  consented: boolean;
  pct: number;
};
let world: World;

const stageRow = (id: string, orderIndex: number, over: Record<string, unknown> = {}) => ({
  id, versionId: VERSION, orderIndex, name: { tr: `Aşama ${orderIndex + 1}`, en: "" }, description: { tr: "", en: "" }, internalPurpose: null,
  durationSeconds: 600, graceSeconds: 0, onTimeout: "AUTO_SUBMIT", backNavigation: false, ...over,
});
const activityRow = (id: string, stageId: string, orderIndex: number, over: Record<string, unknown> = {}) => ({
  id, stageId, orderIndex, type: "LONG_TEXT", required: true, prompt: { tr: "Anlat.", en: "" }, note: { tr: "", en: "" }, internalQuestion: null,
  expectedBehaviours: [], redFlags: [], managerNotes: null, answerExamples: {}, thinkSeconds: 0, flexibleThink: true, answerSeconds: null, maxTakes: 1, config: {}, ...over,
});
const runRow = (id: string, stageId: string, over: Record<string, unknown> = {}) => ({
  id, attemptId: ATTEMPT, stageId, startedAt: NOW, deadlineAt: later(600_000), submittedAt: null, closedBy: null, wasLate: false, completion: "PENDING", lastHeartbeatAt: null, ...over,
});
const responseRow = (id: string, stageRunId: string, activityId: string, over: Record<string, unknown> = {}) => ({
  id, stageRunId, activityId, payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null, ...over,
});
const openingRow = {
  status: "OPEN",
  name: "Ürün Tasarımcısı · Ekim",
  orgName: "Örnek A.Ş.",
  orgContact: "ik@example.com",
  mediaDays: 180,
  candidateDays: 365,
  openingStatus: "OPEN",
  openingContact: null,
  finishSurveyEnabled: true,
  feedbackDays: 7,
  positionName: "Ürün Tasarımcısı",
  introTitle: null,
  introBody: null,
  practiceEnabled: true,
};

function respond(op: Op): unknown[] {
  if (op.kind === "select") {
    switch (op.table) {
      case "hiring_assessments":
        // One row serves both reads: the context (openingId, versionId, extraTimePct, consentTextId) and the start's `pct`.
        return [{ assessmentId: ASSESSMENT, openingId: "op-1", versionId: VERSION, extraTimePct: world.pct, consentTextId: "ct-1", pct: world.pct }];
      case "hiring_versions":
        return [{ id: VERSION, versionNumber: 1, status: "PUBLISHED", defaultLocale: "tr", localeSet: ["tr"], weightsEnabled: false, draftWeights: null, previewedAt: null }];
      case "hiring_stages":
        return world.stages;
      case "hiring_activities":
        return world.activities;
      case "hiring_activity_competencies":
        return [];
      case "attempts":
        return [world.attempt];
      case "hiring_stage_runs":
        return world.runs;
      case "hiring_responses":
        return world.responses;
      case "media_assets":
        return world.media;
      case "consents":
        return world.consented ? [{ id: "consent-1" }] : [];
      case "hiring_openings":
        return [openingRow];
      case "hiring_assignments":
        return [{ n: 2 }];
    }
    return [];
  }
  if (op.kind === "insert" && op.table === "hiring_stage_runs") return [{ id: RUN }];
  if (op.kind === "insert" && op.table === "media_assets") return [{ id: "m-new", mime: "video/webm", attemptId: ATTEMPT }];
  if (op.kind === "update" && op.table === "hiring_stage_runs") {
    // The claim closes the open run in the world, so a reload sees it closed.
    const values = op.values as Record<string, unknown>;
    if (values.submittedAt) {
      const open = world.runs.find((r) => r.startedAt && !r.submittedAt);
      if (open) Object.assign(open, values);
    }
    return [{ id: RUN }];
  }
  if (op.kind === "update" && op.table === "attempts") {
    const values = op.values as Record<string, unknown>;
    if (values.completedAt) Object.assign(world.attempt, values);
  }
  return [];
}

beforeEach(() => {
  fake.ops = [];
  fake.respond = respond;
  io.enqueueTranscription.mockClear();
  io.salvage.mockReset();
  io.initUpload.mockClear();
  world = {
    stages: [stageRow("s1", 0), stageRow("s2", 1)],
    activities: [activityRow("a1", "s1", 0), activityRow("a2", "s1", 1, { required: false }), activityRow("b1", "s2", 0)],
    attempt: { id: ATTEMPT, assessmentId: ASSESSMENT, attemptNumber: 1, startedAt: null, completedAt: null, terminatedAt: null, deviceCheckedAt: null },
    runs: [],
    responses: [],
    media: [],
    consented: true,
    pct: 25,
  };
});

const claimsOf = (ops: Op[]) => writesOf(ops).filter((w) => w.table === "hiring_stage_runs" && w.kind === "update");

describe("loadHiringContext", () => {
  it("never reads anything for another solution's invitation", async () => {
    expect(await loadHiringContext(ctx("LANGUAGE_EXAM"))).toBeNull();
    expect(fake.ops).toEqual([]);
  });

  it("reads the invitation's own hiring terms by its id and organisation", async () => {
    const found = await loadHiringContext(ctx());
    expect(found?.hiring).toEqual({ openingId: "op-1", versionId: VERSION, extraTimePct: 25, consentTextId: "ct-1" });
    expect(fake.ops[0].where).toContain('"hiring_assessments"."org_id" = $');
    expect(fake.ops[0].params).toEqual(expect.arrayContaining([ASSESSMENT, ORG]));
  });

  it("answers null when the invitation has no hiring row", async () => {
    fake.respond = () => [];
    expect(await loadHiringContext(ctx())).toBeNull();
    expect(await hiringServes(ctx())).toBe(false);
  });
});

describe("startStage", () => {
  it("writes the deadline once, from now plus the chosen extra time, under the attempt's lock", async () => {
    const result = await startStage(h(), 1, NOW);
    expect(result).toEqual({ ok: true });
    // Read and locked on the transaction's own connection (fix round 1: NO KEY UPDATE).
    expect(fake.ops.find((o) => o.table === "attempts" && o.lock === "no key update")).toBeTruthy();
    const run = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "hiring_stage_runs")!;
    expect(run.values).toEqual({ attemptId: ATTEMPT, stageId: "s1", orderIndex: 0, startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 750_000) });
    const responses = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "hiring_responses")!;
    expect(responses.values).toEqual([
      { stageRunId: RUN, activityId: "a1" },
      { stageRunId: RUN, activityId: "a2" },
    ]);
    const link = writesOf(fake.ops).find((w) => w.table === "assessment_links")!;
    expect(link.values).toEqual({ status: "IN_PROGRESS" });
  });

  it("is idempotent: a started stage is left exactly as it is", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    expect(await startStage(h(), 1, new Date(NOW.getTime() + 60_000))).toEqual({ ok: true });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("refuses another stage's number and a candidate who skipped the steps before", async () => {
    expect(await startStage(h(), 2, NOW)).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    world.consented = false;
    expect(await startStage(h(), 1, NOW)).toEqual({ ok: false, code: "NOT_READY" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("stops a candidate who has not started once the opening is no longer open", async () => {
    fake.respond = (op) => (op.table === "hiring_openings" ? [{ status: "CLOSED" }] : respond(op));
    expect(await startStage(h(), 1, NOW)).toEqual({ ok: false, code: "OPENING_CLOSED" });
    fake.respond = (op) => (op.table === "hiring_openings" ? [{ status: "DRAFT" }] : respond(op));
    expect(await startStage(h(), 1, NOW)).toEqual({ ok: false, code: "OPENING_CLOSED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("saveResponse", () => {
  it("keeps what the server attached and writes only an open question when there is no way back", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
    const result = await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "Merhaba", choiceIds: ["x"] } }, NOW);
    expect(result).toEqual({ ok: true, at: NOW.toISOString() });
    const write = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(write.values).toMatchObject({ payload: { text: "Merhaba" }, usedTextAlternative: false });
    expect(write.where).toContain('"hiring_responses"."answered_at" is null');
  });

  it("refuses the second question while the first is open", async () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
    expect(await saveResponse(h(), { position: 1, activityId: "a2", answer: { text: "x" } }, NOW)).toEqual({ ok: false, code: "ACTIVITY_ORDER" });
  });
});

describe("writes reach only the running stage of the invitation's own version", () => {
  const running = () => {
    world.runs = [runRow(RUN, "s1")];
    world.responses = [responseRow("r1", RUN, "a1"), responseRow("r2", RUN, "a2")];
  };

  it("never writes into a submitted stage: its number is a stale tab, and after the last one there is no stage", async () => {
    world.runs = [runRow(RUN, "s1", { submittedAt: later(60_000), closedBy: "CANDIDATE" })];
    world.responses = [responseRow("r1", RUN, "a1"), responseRow("r2", RUN, "a2")];
    const answer = { text: "geç kalan kayıt" };
    expect(await saveResponse(h(), { position: 1, activityId: "a1", answer }, later(70_000))).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    expect(await commitResponse(h(), { position: 1, activityId: "a1", answer }, later(70_000))).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    expect(await openUpload(h(), { position: 1, activityId: "a1", kind: "recording", mime: "video/webm" }, later(70_000))).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    // Stage 2 has not started: a write naming it is refused too.
    expect(await saveResponse(h(), { position: 2, activityId: "b1", answer }, later(70_000))).toEqual({ ok: false, code: "STAGE_NOT_STARTED" });
    world.runs.push(runRow(RUN2, "s2", { submittedAt: later(80_000), closedBy: "CLOCK" }));
    expect(await saveResponse(h(), { position: 2, activityId: "b1", answer }, later(90_000))).toEqual({ ok: false, code: "NO_STAGE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("reads the runs only after it holds the attempt's lock, so a submit cannot close the stage under a write", async () => {
    running();
    await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "x" } }, NOW);
    const lock = fake.ops.findIndex((o) => o.table === "attempts" && o.lock === "no key update");
    const runs = fake.ops.findIndex((o) => o.table === "hiring_stage_runs" && o.kind === "select");
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(runs).toBeGreaterThan(lock);
  });

  it("accepts a write up to the deadline plus the slack and refuses it one millisecond later, like the sweep's overdue rule", async () => {
    running();
    const edge = later(600_000 + 5_000);
    expect(await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "son an" } }, edge)).toEqual({ ok: true, at: edge.toISOString() });
    fake.ops = [];
    expect(await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "geç" } }, later(605_001))).toEqual({ ok: false, code: "STAGE_EXPIRED" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("takes question ids only from the running stage of the frozen version, read inside the organisation", async () => {
    running();
    expect(await saveResponse(h(), { position: 1, activityId: "b1", answer: { text: "x" } }, NOW)).toEqual({ ok: false, code: "ACTIVITY_NOT_FOUND" });
    expect(await saveResponse(h(), { position: 1, activityId: "' or 1=1 --", answer: { text: "x" } }, NOW)).toEqual({ ok: false, code: "ACTIVITY_NOT_FOUND" });
    expect(await saveResponse(h(), { position: "1", activityId: "a1", answer: { text: "x" } }, NOW)).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    expect(writesOf(fake.ops)).toEqual([]);
    const version = fake.ops.find((o) => o.table === "hiring_versions")!;
    expect(version.where).toContain('"hiring_versions"."org_id" = $');
    expect(version.params).toEqual(expect.arrayContaining([VERSION, ORG]));
  });

  it("closes a question with its score on commit, and refuses a required one without an answer", async () => {
    running();
    expect(await commitResponse(h(), { position: 1, activityId: "a1" }, NOW)).toEqual({ ok: false, code: "REQUIRED_MISSING" });
    expect(await commitResponse(h(), { position: 1, activityId: "a1", answer: { text: "Bitti." } }, NOW)).toEqual({ ok: true });
    const write = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(write.values).toEqual({ payload: { text: "Bitti." }, answeredAt: NOW, autoScore: null, usedTextAlternative: false, updatedAt: NOW });
  });
});

describe("submitStage", () => {
  const running = () => {
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [
      { id: "r1", stageRunId: RUN, activityId: "a1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
      { id: "r2", stageRunId: RUN, activityId: "a2", payload: { text: "isteğe bağlı" }, takeAssetIds: [], fileAssetIds: [], answeredAt: null },
    ];
  };

  it("refuses while a required answer is missing and time is left, naming it", async () => {
    running();
    expect(await submitStage(h(), 1, new Date(NOW.getTime() + 60_000))).toEqual({ ok: false, code: "REQUIRED_MISSING", missing: ["a1"] });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("closes the stage once its time is over, keeping what was written", async () => {
    running();
    expect(await submitStage(h(), 1, new Date(NOW.getTime() + 601_000))).toEqual({ ok: true });
    const closes = writesOf(fake.ops).filter((w) => w.table === "hiring_stage_runs");
    // Task 5 carry: the claim also records that the clock ended it ("Süre doldu" on the next stage).
    expect(closes[0].values).toEqual({ submittedAt: new Date(NOW.getTime() + 601_000), closedBy: "CLOCK" });
    expect(closes[1].values).toEqual({ completion: "PARTIAL", wasLate: true });
  });

  it("records a submit in time as the candidate's, never closing a run twice", async () => {
    running();
    world.responses[0].payload = { text: "Cevabım" };
    expect(await submitStage(h(), 1, later(60_000))).toEqual({ ok: true });
    const closes = claimsOf(fake.ops);
    expect(closes[0].values).toEqual({ submittedAt: later(60_000), closedBy: "CANDIDATE" });
    expect(closes[0].where).toContain('"hiring_stage_runs"."submitted_at" is null');
    expect(closes[1].values).toEqual({ completion: "COMPLETE", wasLate: false });
    // Not the last stage: the invitation is not finished.
    expect(writesOf(fake.ops).find((w) => w.table === "attempts")).toBeUndefined();
  });

  it("writes the invitation's completion when the last stage is submitted (the DONE fallback is never used)", async () => {
    world.runs = [runRow(RUN, "s1", { submittedAt: later(60_000), closedBy: "CANDIDATE" }), runRow(RUN2, "s2", { startedAt: later(70_000), deadlineAt: later(670_000) })];
    world.responses = [responseRow("r3", RUN2, "b1", { payload: { text: "Son cevap" } })];
    const at = later(120_000);
    expect(await submitStage(h(), 2, at)).toEqual({ ok: true });
    const writes = writesOf(fake.ops);
    expect(writes.find((w) => w.table === "attempts")?.values).toEqual({ completedAt: at });
    expect(writes.find((w) => w.table === "assessment_links")?.values).toEqual({ status: "COMPLETED" });
    expect(writes.find((w) => w.table === "candidates")?.values).toEqual({ lastContactAt: at });
  });

  it("refuses a stage that has not started and a stale number", async () => {
    expect(await submitStage(h(), 1, NOW)).toEqual({ ok: false, code: "STAGE_NOT_STARTED" });
    running();
    expect(await submitStage(h(), 2, NOW)).toEqual({ ok: false, code: "STAGE_MISMATCH" });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("loadHiringState", () => {
  it("closes a run the clock ended as the clock's, and the next stage says so", async () => {
    world.runs = [runRow(RUN, "s1")];
    world.responses = [];
    const now = later(700_000);
    const state = await loadHiringState(h(), now);
    expect(claimsOf(fake.ops)[0].values).toEqual({ submittedAt: now, closedBy: "CLOCK" });
    expect(state.step).toBe("STAGE");
    expect(state.current?.position).toBe(2);
    expect(state.current?.previous).toEqual({ position: 1, closedByClock: true });
  });

  it("never says \"Süre doldu\" for a stage the candidate submitted, even late", async () => {
    world.stages = [stageRow("s1", 0, { onTimeout: "ALLOW_LATE" }), stageRow("s2", 1)];
    world.runs = [runRow(RUN, "s1", { submittedAt: later(900_000), closedBy: "CANDIDATE", wasLate: true })];
    const state = await loadHiringState(h(), later(950_000));
    expect(claimsOf(fake.ops)).toEqual([]);
    expect(state.current?.previous).toEqual({ position: 1, closedByClock: false });
  });

  it("finishes an attempt whose every stage is closed, so DONE carries the real completion", async () => {
    world.runs = [runRow(RUN, "s1", { submittedAt: later(60_000), closedBy: "CANDIDATE" }), runRow(RUN2, "s2", { submittedAt: later(90_000), closedBy: "CANDIDATE" })];
    const now = later(100_000);
    const state = await loadHiringState(h(), now);
    expect(writesOf(fake.ops).find((w) => w.table === "attempts")?.values).toEqual({ completedAt: now });
    expect(state.step).toBe("DONE");
    expect(state.finished?.completedAt).toBe(now.toISOString());
  });

  it("builds the state only from the candidate view: no team-only text reaches the candidate", async () => {
    world.activities = [
      activityRow("a1", "s1", 0, {
        internalQuestion: "TEAMSECRET_QUESTION",
        expectedBehaviours: [{ tr: "TEAMSECRET_BEHAVIOUR", en: "" }],
        redFlags: [{ tr: "TEAMSECRET_FLAG", en: "" }],
        managerNotes: "TEAMSECRET_NOTES",
        answerExamples: { strong: { tr: "TEAMSECRET_EXAMPLE", en: "" } },
      }),
      activityRow("c1", "s1", 1, { type: "SINGLE_CHOICE", required: false, config: { choices: [{ id: "x", label: { tr: "Evet", en: "" }, correct: true }, { id: "y", label: { tr: "Hayır", en: "" } }] } }),
      activityRow("b1", "s2", 0),
    ];
    world.stages = [stageRow("s1", 0, { internalPurpose: "TEAMSECRET_PURPOSE" }), stageRow("s2", 1)];
    world.runs = [runRow(RUN, "s1")];
    world.responses = [responseRow("r1", RUN, "a1", { payload: { text: "Benim cevabım" } }), responseRow("r2", RUN, "c1", { payload: { choiceIds: ["x"] }, autoScore: 1 })];
    const json = JSON.stringify(await loadHiringState(h(), later(60_000)));
    expect(json).toContain("Benim cevabım");
    expect(json).not.toContain("TEAMSECRET");
    expect(json).not.toMatch(/"correct"|autoScore|competenc/i);
  });
});

describe("setExtraTime", () => {
  it("refuses a value outside 0, 25 and 50 and a change while a stage runs", async () => {
    expect(await setExtraTime(h(), 30, NOW)).toEqual({ ok: false, code: "EXTRA_TIME_INVALID" });
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: NOW, submittedAt: null }];
    expect(await setExtraTime(h(), 50, NOW)).toEqual({ ok: false, code: "EXTRA_TIME_LOCKED" });
  });

  it("stores the choice for the stages that start afterwards", async () => {
    const hh = h();
    expect(await setExtraTime(hh, 50, NOW)).toEqual({ ok: true });
    expect(writesOf(fake.ops).find((w) => w.table === "hiring_assessments")?.values).toEqual({ extraTimePct: 50, extraTimeChosenAt: NOW });
    expect(hh.hiring.extraTimePct).toBe(50);
  });
});

describe("openUpload", () => {
  const recorded = () => {
    world.activities = [activityRow("v1", "s1", 0, { type: "VIDEO", maxTakes: 2 })];
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
  };

  it("counts takes on the server and gives a failed one back", async () => {
    recorded();
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "v1", payload: {}, takeAssetIds: ["m1", "m2"], fileAssetIds: [], answeredAt: null }];
    world.media = [{ id: "m1", status: "READY", durationMs: 1 }, { id: "m2", status: "FAILED", durationMs: null }];
    const opened = await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW);
    expect(opened.ok).toBe(true);
    const take = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(take.values).toMatchObject({ takeAssetIds: ["m1", "m2", "m-new"], takesUsed: 2 });
    if (opened.ok) expect(opened.upload).toMatchObject({ uploadRef: "m-new", minPartBytes: 0, proxy: true });
  });

  it("refuses a take beyond the question's limit", async () => {
    recorded();
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "v1", payload: {}, takeAssetIds: ["m1", "m2"], fileAssetIds: [], answeredAt: null }];
    world.media = [{ id: "m1", status: "READY", durationMs: 1 }, { id: "m2", status: "UPLOADING", durationMs: null }];
    expect(await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW)).toEqual({ ok: false, code: "TAKES_EXHAUSTED" });
  });

  it("refuses a file type the question does not take and a file over its size", async () => {
    world.activities = [activityRow("f1", "s1", 0, { type: "FILE_UPLOAD", config: { acceptedMimeTypes: ["application/pdf"], maxFileBytes: 1000 } })];
    world.runs = [{ id: RUN, attemptId: ATTEMPT, stageId: "s1", startedAt: NOW, deadlineAt: new Date(NOW.getTime() + 600_000), submittedAt: null }];
    world.responses = [{ id: "r1", stageRunId: RUN, activityId: "f1", payload: {}, takeAssetIds: [], fileAssetIds: [], answeredAt: null }];
    expect(await openUpload(h(), { position: 1, activityId: "f1", kind: "file", mime: "image/png", name: "a.png", bytes: 10 }, NOW)).toEqual({ ok: false, code: "FILE_TYPE_REJECTED" });
    expect(await openUpload(h(), { position: 1, activityId: "f1", kind: "file", mime: "application/pdf", name: "a.pdf", bytes: 1001 }, NOW)).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("opens the asset in the invitation's organisation and attempt, never a client-chosen one, under the response's lock", async () => {
    recorded();
    world.responses = [responseRow("r1", RUN, "v1")];
    await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW);
    expect(fake.ops.find((o) => o.table === "hiring_responses" && o.lock === "update")).toBeTruthy();
    const asset = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "media_assets")!;
    expect(asset.values).toEqual({ orgId: ORG, attemptId: ATTEMPT, storageKey: "pending", mime: "video/webm", status: "UPLOADING", parts: [] });
    const key = writesOf(fake.ops).find((w) => w.kind === "update" && w.table === "media_assets")!;
    expect(key.values).toEqual({ storageKey: `media/${ORG}/${ASSESSMENT}/${RUN}/m-new.webm`, uploadId: "up-1" });
  });
});

describe("attachMedia", () => {
  const asset = (id: string, over: Record<string, unknown> = {}) => ({ id, attemptId: ATTEMPT, status: "READY", mime: "video/webm", bytes: 100, ...over }) as never;

  it("makes the newest take the answer, superseding a written alternative", async () => {
    fake.respond = (op) =>
      op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m1", "m2"], payload: { usedTextAlternative: true, text: "yazdım" } }, activity: { type: "VIDEO", config: {} } }] : [];
    await attachMedia(asset("m2"));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ mediaAssetId: "m2", usedTextAlternative: false, payload: { text: "yazdım" } });
  });

  it("ignores an older take that finishes late", async () => {
    fake.respond = (op) => (op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m1", "m2"], payload: {} }, activity: { type: "VIDEO", config: {} } }] : []);
    await attachMedia(asset("m1"));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("attaches a finished file under the name the candidate gave it, and refuses one bigger than allowed", async () => {
    const row = (max: number) => [{ response: { id: "r1", takeAssetIds: [], payload: { pendingFile: { assetId: "f1", name: "Özgeçmiş.pdf", bytes: 100, mime: "application/pdf" } } }, activity: { type: "FILE_UPLOAD", config: { maxFileBytes: max } } }];
    fake.respond = (op) => (op.kind === "select" ? row(1000) : []);
    await attachMedia(asset("f1", { mime: "application/pdf" }));
    expect(writesOf(fake.ops)[0].values).toEqual({ fileAssetIds: ["f1"], payload: { file: { name: "Özgeçmiş.pdf", bytes: 100, mime: "application/pdf" } }, updatedAt: expect.any(Date) });
    fake.ops = [];
    fake.respond = (op) => (op.kind === "select" ? row(50) : []);
    await attachMedia(asset("f1", { mime: "application/pdf" }));
    expect(writesOf(fake.ops)[0].values).toEqual({ payload: {}, updatedAt: expect.any(Date) });
  });

  it("decides on the response row it holds locked (C14), found through the asset's own attempt", async () => {
    fake.respond = (op) => (op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m2"], payload: {} }, activity: { type: "VIDEO", config: {} } }] : []);
    await attachMedia(asset("m2"));
    const read = fake.ops[0];
    expect(read.table).toBe("hiring_responses");
    expect(read.lock).toBe("update");
    expect(read.where).toContain('"hiring_stage_runs"."attempt_id" = $');
    expect(read.params).toContain(ATTEMPT);
  });

  it("makes a slow older take the answer when every newer take failed, so a recording is never lost", async () => {
    fake.respond = (op) => {
      if (op.table === "hiring_responses") return [{ response: { id: "r1", takeAssetIds: ["m1", "m2"], payload: {} }, activity: { type: "VIDEO", config: {} } }];
      if (op.table === "media_assets") return [{ id: "m2", status: "FAILED" }];
      return [];
    };
    await attachMedia(asset("m1", { status: "INCOMPLETE" }));
    expect(writesOf(fake.ops)[0].values).toMatchObject({ mediaAssetId: "m1" });
  });

  it("still answers the finished upload when attaching fails: the hiring hook logs and never throws (moved from the route test)", async () => {
    fake.respond = () => {
      throw new Error("db down");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(attachMedia(asset("m1"))).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toContain("m1");
    log.mockRestore();
  });

  it("never attaches a take that did not finish", async () => {
    fake.respond = (op) => (op.kind === "select" ? [{ response: { id: "r1", takeAssetIds: ["m1"], payload: {} }, activity: { type: "VIDEO", config: {} } }] : []);
    await attachMedia(asset("m1", { status: "FAILED" }));
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("playbackUrl", () => {
  const own = (status: string) => {
    world.media = [{ asset: { id: TAKE, attemptId: ATTEMPT, status, storageKey: `media/${ORG}/${ASSESSMENT}/${RUN}/${TAKE}.webm` } }];
    world.responses = [responseRow("r1", RUN, "v1", { takeAssetIds: [TAKE] })];
  };

  it("hands a short-lived URL for the candidate's own finished take", async () => {
    own("READY");
    expect(await playbackUrl(h(), TAKE)).toEqual({ ok: true, url: `/signed/media/${ORG}/${ASSESSMENT}/${RUN}/${TAKE}.webm?s=600` });
    own("INCOMPLETE");
    expect((await playbackUrl(h(), TAKE)).ok).toBe(true);
    const read = fake.ops.find((o) => o.table === "media_assets")!;
    expect(read.params).toEqual(expect.arrayContaining([TAKE, ASSESSMENT]));
  });

  it("answers a take still uploading with a typed not-ready, never a URL or an error", async () => {
    own("UPLOADING");
    expect(await playbackUrl(h(), TAKE)).toEqual({ ok: false, code: "MEDIA_NOT_READY" });
    own("FAILED");
    expect(await playbackUrl(h(), TAKE)).toEqual({ ok: false, code: "MEDIA_NOT_READY" });
  });

  it("finds nothing for a malformed ref, someone else's asset or an asset that is not one of the invitation's takes", async () => {
    expect(await playbackUrl(h(), "../../etc/passwd")).toEqual({ ok: false, code: "UPLOAD_NOT_FOUND" });
    expect(await playbackUrl(h(), 42)).toEqual({ ok: false, code: "UPLOAD_NOT_FOUND" });
    expect(fake.ops).toEqual([]);
    world.media = [];
    expect(await playbackUrl(h(), TAKE)).toEqual({ ok: false, code: "UPLOAD_NOT_FOUND" });
    own("READY");
    world.responses = [];
    expect(await playbackUrl(h(), TAKE)).toEqual({ ok: false, code: "UPLOAD_NOT_FOUND" });
  });
});

describe("closeExpiredStageRuns", () => {
  it("looks only at runs past their deadline plus the slack, never ALLOW_LATE", async () => {
    fake.respond = () => [];
    await closeExpiredStageRuns(NOW, 10);
    const query = fake.ops[0];
    expect(query.table).toBe("hiring_stage_runs");
    expect(query.where).toContain('"hiring_stage_runs"."submitted_at" is null');
    expect(query.where).toContain('"hiring_stages"."on_timeout" <> $');
    expect(query.params).toContain("ALLOW_LATE");
    // Drizzle sends timestamps as ISO strings.
    expect(query.params).toContain(new Date(NOW.getTime() - 5_000).toISOString());
  });

  const due = (run: Record<string, unknown>) => (op: Op) =>
    op.table === "hiring_stage_runs" && op.kind === "select" && op.fields?.includes("run")
      ? [{ run, versionId: VERSION, orgId: ORG, assessmentId: ASSESSMENT, candidateId: "c-1" }]
      : respond(op);

  it("closes a run whose clock ran out as the clock's, and finishes the invitation when it was the last stage", async () => {
    world.runs = [runRow(RUN, "s1", { submittedAt: later(60_000), closedBy: "CANDIDATE" }), runRow(RUN2, "s2", { startedAt: later(70_000), deadlineAt: later(670_000) })];
    fake.respond = due(world.runs[1]);
    const now = later(700_000);
    expect(await closeExpiredStageRuns(now, 50)).toEqual({ scanned: 1, closed: 1 });
    expect(fake.ops.find((o) => o.table === "attempts" && o.lock === "no key update")).toBeTruthy();
    expect(claimsOf(fake.ops)[0].values).toEqual({ submittedAt: now, closedBy: "CLOCK" });
    expect(claimsOf(fake.ops)[1].values).toEqual({ completion: "EXPIRED", wasLate: true });
    expect(writesOf(fake.ops).find((w) => w.table === "attempts")?.values).toEqual({ completedAt: now });
    // The invitation's own version, read inside its organisation.
    expect(fake.ops.find((o) => o.table === "hiring_versions")?.params).toEqual(expect.arrayContaining([VERSION, ORG]));
  });

  it("leaves a run the write path still accepts (the one overdue rule), and a run outside the invitation's version", async () => {
    const run = runRow(RUN, "s1");
    world.runs = [run];
    fake.respond = due(run);
    expect(await closeExpiredStageRuns(later(605_000), 50)).toEqual({ scanned: 1, closed: 0 });
    fake.respond = due(runRow(RUN, "not-in-this-version"));
    expect(await closeExpiredStageRuns(later(900_000), 50)).toEqual({ scanned: 1, closed: 0 });
    expect(writesOf(fake.ops)).toEqual([]);
  });
});

describe("salvageHiringUploads", () => {
  const old = new Date(NOW.getTime() - 60 * 60 * 1000);
  const upload = (over: Record<string, unknown>) => ({ id: TAKE, attemptId: ATTEMPT, createdAt: old, storageKey: `media/${ORG}/${ASSESSMENT}/${RUN}/${TAKE}.webm`, uploadId: "u1", mime: "video/webm", status: "UPLOADING", ...over });

  const scripted = (asset: Record<string, unknown>, type: string) => (op: Op) => {
    // The expiry of never-opened uploads finds nothing here.
    if (op.table === "media_assets" && op.kind === "update" && (op.values as { status?: string }).status === "FAILED" && op.where.includes("upload_id")) return [];
    if (op.table === "media_assets" && op.kind === "select") return [{ asset }];
    if (op.table === "media_assets" && op.kind === "update") return [{ ...asset, status: "INCOMPLETE", bytes: 300 }];
    if (op.table === "hiring_responses" && op.fields?.includes("completion")) return [{ completion: "EXPIRED", deadlineAt: old, lastHeartbeatAt: null }];
    if (op.table === "hiring_responses")
      return [{ response: { id: "r1", takeAssetIds: [asset.id], payload: type === "FILE_UPLOAD" ? { pendingFile: { assetId: asset.id, name: "cv.pdf", bytes: 300, mime: asset.mime } } : {} }, activity: { type, config: {} } }];
    return [];
  };

  it("takes only hiring uploads, never an exam section's", async () => {
    fake.respond = () => [];
    await salvageHiringUploads(NOW, 20);
    const query = fake.ops.find((o) => o.kind === "select" && o.table === "media_assets")!;
    expect(query.where).toContain('"attempts"."solution" = $');
    expect(query.params).toContain("HIRING");
    expect(query.where).toContain('"media_assets"."section_run_id" is null');
  });

  it("finishes an abandoned take as INCOMPLETE, attaches it and sends it to transcription with no language forced", async () => {
    io.salvage.mockResolvedValueOnce({ bytes: 300, parts: [{ partNumber: 1, etag: "e", bytes: 300 }] });
    fake.respond = scripted(upload({}), "VIDEO");
    expect(await salvageHiringUploads(NOW, 20)).toEqual({ scanned: 1, salvaged: 1, failed: 0, skipped: 0 });
    expect(writesOf(fake.ops).find((w) => w.table === "hiring_responses")?.values).toMatchObject({ mediaAssetId: TAKE });
    // The queue carries only the id; transcribe-job reads the hint (null for hiring) from the manifest.
    expect(io.enqueueTranscription.mock.calls).toEqual([[TAKE]]);
  });

  it("never sends a file to transcription", async () => {
    io.salvage.mockResolvedValueOnce({ bytes: 300, parts: [{ partNumber: 1, etag: "e", bytes: 300 }] });
    fake.respond = scripted(upload({ mime: "application/pdf" }), "FILE_UPLOAD");
    await salvageHiringUploads(NOW, 20);
    expect(io.enqueueTranscription).not.toHaveBeenCalled();
  });

  it("waits while the candidate's tab is alive", async () => {
    fake.respond = (op) =>
      op.table === "hiring_responses" && op.fields?.includes("completion")
        ? [{ completion: "PENDING", deadlineAt: later(600_000), lastHeartbeatAt: later(-60_000) }]
        : scripted(upload({}), "VIDEO")(op);
    expect(await salvageHiringUploads(NOW, 20)).toEqual({ scanned: 1, salvaged: 0, failed: 0, skipped: 1 });
    expect(io.salvage).not.toHaveBeenCalled();
  });
});

describe("heartbeat, segment, survey", () => {
  it("keeps the running stage of this invitation's current attempt alive and returns its deadline", async () => {
    fake.respond = (op) => (op.table === "attempts" ? [world.attempt] : op.kind === "select" ? [{ id: RUN, deadlineAt: later(600_000) }] : []);
    expect(await stageHeartbeat(h(), NOW)).toEqual({ deadlineAt: later(600_000) });
    expect(fake.ops[0].params).toContain(ASSESSMENT);
    const runs = fake.ops.find((o) => o.table === "hiring_stage_runs")!;
    expect(runs.where).toContain('"hiring_stage_runs"."attempt_id" = $');
    expect(runs.params).toContain(ATTEMPT);
    expect(writesOf(fake.ops)[0].values).toEqual({ lastHeartbeatAt: NOW });
    fake.respond = () => [];
    expect(await runningSegment(ATTEMPT)).toBeNull();
  });

  it("takes one survey answer after the finish, when the opening asks for it", async () => {
    expect(await saveSurvey(h(), { rating: 6, comment: "" })).toEqual({ ok: false, code: "SURVEY_INVALID" });
    fake.respond = (op) => (op.table === "attempts" ? [{ completedAt: null, enabled: true }] : []);
    expect(await saveSurvey(h(), { rating: 5, comment: "" })).toEqual({ ok: false, code: "NOT_FINISHED" });
    fake.respond = (op) => (op.table === "attempts" ? [{ completedAt: NOW, enabled: false }] : []);
    expect(await saveSurvey(h(), { rating: 5, comment: "" })).toEqual({ ok: false, code: "SURVEY_OFF" });
    fake.respond = (op) => (op.table === "attempts" ? [{ completedAt: NOW, enabled: true }] : op.kind === "insert" ? [{ id: ASSESSMENT }] : []);
    expect(await saveSurvey(h(), { rating: 4, comment: "  İyiydi  " })).toEqual({ ok: true });
    expect(writesOf(fake.ops).find((w) => w.table === "hiring_survey_responses")?.values).toEqual({ assessmentId: ASSESSMENT, rating: 4, comment: "İyiydi" });
  });
});

describe("fix round 1 (Task 8 review)", () => {
  const running = () => {
    world.runs = [runRow(RUN, "s1")];
    world.responses = [responseRow("r1", RUN, "a1"), responseRow("r2", RUN, "a2")];
  };

  it("reads the attempt inside a write on the transaction itself, newest first and locked, after attempt 1 exists", async () => {
    running();
    await saveResponse(h(), { position: 1, activityId: "a1", answer: { text: "x" } }, NOW);
    const reads = fake.ops.filter((o) => o.table === "attempts");
    // First the core's currentAttempt (before the transaction, may create attempt 1), then the locked read.
    expect(reads[0].lock).toBeUndefined();
    expect(reads[1].lock).toBe("no key update");
    expect(reads[1].where).toContain('"attempts"."assessment_id" = $');
    expect(reads[1].params).toContain(ASSESSMENT);
  });

  it("records a hand submit after the deadline under ALLOW_LATE as the candidate's, even with a required answer missing", async () => {
    world.stages = [stageRow("s1", 0, { onTimeout: "ALLOW_LATE" }), stageRow("s2", 1)];
    running();
    const at = later(900_000);
    expect(await submitStage(h(), 1, at)).toEqual({ ok: true });
    expect(claimsOf(fake.ops)[0].values).toEqual({ submittedAt: at, closedBy: "CANDIDATE" });
  });

  it("keeps the answer sent with a refused commit as a draft (the question stays open)", async () => {
    running();
    expect(await commitResponse(h(), { position: 1, activityId: "a1", answer: { text: "   " } }, NOW)).toEqual({ ok: false, code: "REQUIRED_MISSING" });
    const write = writesOf(fake.ops).find((w) => w.table === "hiring_responses")!;
    expect(write.values).toEqual({ payload: { text: "   " }, usedTextAlternative: false, updatedAt: NOW });
    expect(write.where).toContain('"hiring_responses"."answered_at" is null');
  });

  it("closes a run holding its responses FOR UPDATE, and counts a file still uploading as an answer", async () => {
    world.activities = [activityRow("f1", "s1", 0, { type: "FILE_UPLOAD" }), activityRow("b1", "s2", 0)];
    world.runs = [runRow(RUN, "s1")];
    world.responses = [responseRow("r1", RUN, "f1", { payload: { pendingFile: { assetId: "pf", name: "cv.pdf", bytes: 10, mime: "application/pdf" } } })];
    const now = later(700_000);
    fake.respond = (op) =>
      op.table === "hiring_stage_runs" && op.kind === "select" && op.fields?.includes("run")
        ? [{ run: world.runs[0], versionId: VERSION, orgId: ORG, assessmentId: ASSESSMENT, candidateId: "c-1" }]
        : respond(op);
    expect(await closeExpiredStageRuns(now, 50)).toEqual({ scanned: 1, closed: 1 });
    expect(fake.ops.find((o) => o.table === "hiring_responses" && o.kind === "select")?.lock).toBe("update");
    expect(claimsOf(fake.ops)[1].values).toEqual({ completion: "COMPLETE", wasLate: true });
    expect(writesOf(fake.ops).find((w) => w.table === "hiring_responses")?.values).toMatchObject({ answeredAt: now });
  });

  describe("a failed take gives its place back to the newest finished one", () => {
    const owner = (takes: string[], mediaAssetId: string | null = null) => ({ response: { id: "r1", takeAssetIds: takes, payload: {}, mediaAssetId }, activity: { type: "VIDEO", config: {} } });

    it("attaches the older READY take when the newer take fails", async () => {
      fake.respond = (op) => {
        if (op.table === "hiring_responses") return [owner(["m1", "m2"])];
        if (op.table === "media_assets") return [{ id: "m1", status: "READY" }];
        return [];
      };
      await attachMedia({ id: "m2", attemptId: ATTEMPT, status: "FAILED", mime: "video/webm", bytes: 0 } as never);
      expect(writesOf(fake.ops)[0].values).toMatchObject({ mediaAssetId: "m1", usedTextAlternative: false });
    });

    it("writes nothing when the decided answer is already the answer, or every take failed", async () => {
      fake.respond = (op) => (op.table === "hiring_responses" ? [owner(["m1", "m2"], "m1")] : op.table === "media_assets" ? [{ id: "m1", status: "READY" }] : []);
      await attachMedia({ id: "m2", attemptId: ATTEMPT, status: "FAILED" } as never);
      fake.respond = (op) => (op.table === "hiring_responses" ? [owner(["m1", "m2"])] : op.table === "media_assets" ? [{ id: "m1", status: "FAILED" }] : []);
      await attachMedia({ id: "m2", attemptId: ATTEMPT, status: "FAILED" } as never);
      expect(writesOf(fake.ops)).toEqual([]);
    });

    it("when the storage upload cannot open: the take is FAILED and the question decided again", async () => {
      world.activities = [activityRow("v1", "s1", 0, { type: "VIDEO", maxTakes: 3 })];
      world.runs = [runRow(RUN, "s1")];
      world.responses = [responseRow("r1", RUN, "v1", { takeAssetIds: ["m1"] })];
      world.media = [{ id: "m1", status: "READY", durationMs: 1 }];
      io.initUpload.mockRejectedValueOnce(new Error("storage down"));
      const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
      fake.respond = (op) =>
        op.table === "hiring_responses" && op.fields?.includes("response") ? [owner(["m1", "m-new"])] : op.table === "media_assets" && op.kind === "select" ? [{ id: "m1", status: "READY" }] : respond(op);
      await expect(openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW)).rejects.toThrow(/storage down/);
      quiet.mockRestore();
      const writes = writesOf(fake.ops);
      expect(writes.find((w) => w.table === "media_assets" && w.kind === "update")?.values).toEqual({ status: "FAILED" });
      expect(writes.filter((w) => w.table === "hiring_responses").at(-1)?.values).toMatchObject({ mediaAssetId: "m1" });
    });

    it("when the salvage finds no bytes, and when an upload never opened its storage side", async () => {
      const old = new Date(NOW.getTime() - 60 * 60 * 1000);
      const take = { id: "m2", attemptId: ATTEMPT, createdAt: old, storageKey: `media/${ORG}/${ASSESSMENT}/${RUN}/m2.webm`, uploadId: "u2", mime: "video/webm", status: "UPLOADING" };
      io.salvage.mockResolvedValueOnce({ bytes: 0, parts: [] });
      fake.respond = (op) => {
        if (op.table === "media_assets" && op.kind === "update" && op.where.includes("upload_id")) return [];
        if (op.table === "media_assets" && op.kind === "update") return [{ ...take, status: "FAILED" }];
        if (op.table === "media_assets" && op.kind === "select" && op.fields?.includes("asset")) return [{ asset: take }];
        if (op.table === "media_assets") return [{ id: "m1", status: "READY" }];
        if (op.table === "hiring_responses" && op.fields?.includes("completion")) return [{ completion: "EXPIRED", deadlineAt: old, lastHeartbeatAt: null }];
        if (op.table === "hiring_responses") return [owner(["m1", "m2"])];
        return [];
      };
      expect(await salvageHiringUploads(NOW, 20)).toEqual({ scanned: 1, salvaged: 0, failed: 1, skipped: 0 });
      expect(writesOf(fake.ops).find((w) => w.table === "hiring_responses")?.values).toMatchObject({ mediaAssetId: "m1" });

      fake.ops = [];
      const pending = { ...take, id: "m3", storageKey: "pending", uploadId: null };
      fake.respond = (op) => {
        if (op.table === "media_assets" && op.kind === "update") return [{ ...pending, status: "FAILED" }];
        if (op.table === "media_assets" && op.kind === "select" && op.fields?.includes("asset")) return [];
        if (op.table === "media_assets") return [{ id: "m1", status: "READY" }];
        if (op.table === "hiring_responses") return [owner(["m1", "m3"])];
        return [];
      };
      expect(await salvageHiringUploads(NOW, 20)).toEqual({ scanned: 0, salvaged: 0, failed: 1, skipped: 0 });
      const expiry = writesOf(fake.ops)[0];
      expect(expiry.values).toEqual({ status: "FAILED" });
      expect(expiry.where).toContain('"media_assets"."upload_id" is null');
      expect(expiry.where).toContain('"media_assets"."storage_key" = $');
      expect(expiry.params).toContain(new Date(NOW.getTime() - 30 * 60 * 1000).toISOString());
      expect(writesOf(fake.ops).find((w) => w.table === "hiring_responses")?.values).toMatchObject({ mediaAssetId: "m1" });
    });
  });

  describe("recordings are opened for their own kind and within their caps", () => {
    const question = (type: string, over: Record<string, unknown> = {}) => {
      world.activities = [activityRow("v1", "s1", 0, { type, maxTakes: 2, ...over })];
      world.runs = [runRow(RUN, "s1")];
      world.responses = [responseRow("r1", RUN, "v1")];
    };

    it("refuses a video for an audio question and sound only for a video question", async () => {
      question("AUDIO");
      expect(await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "video/webm" }, NOW)).toEqual({ ok: false, code: "RECORDING_TYPE_REJECTED" });
      question("VIDEO");
      expect(await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "audio/webm;codecs=opus" }, NOW)).toEqual({ ok: false, code: "RECORDING_TYPE_REJECTED" });
      expect(writesOf(fake.ops)).toEqual([]);
    });

    it("refuses a declared size above the cap and hands the recorder its caps", async () => {
      question("AUDIO", { answerSeconds: 60 });
      expect(await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "audio/webm", bytes: 2 * 1024 * 1024 * 1024 }, NOW)).toEqual({ ok: false, code: "RECORDING_TOO_LARGE" });
      const opened = await openUpload(h(), { position: 1, activityId: "v1", kind: "recording", mime: "audio/webm" }, NOW);
      expect(opened.ok && opened.upload.limits).toEqual({ maxBytes: 1024 * 1024 * 1024, maxDurationMs: 66_000 });
      const asset = writesOf(fake.ops).find((w) => w.kind === "insert" && w.table === "media_assets")!;
      expect((asset.values as { mime: string }).mime).toBe("audio/webm");
    });
  });
});
