import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The grading job for a course test: opening the gradings of a closed section,
 * the model's proposal as `course_proposal` (AI_PROPOSED, no level), a rule for an
 * empty answer, and AI_FAILED, never a zero, when the model cannot be used. The
 * database and the model are mocked; the prompt and the checks are tested in
 * exam/course/rubric-grading.test.ts.
 */

const h = vi.hoisted(() => ({
  results: [] as unknown[][],
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  enqueued: [] as string[],
  callJson: vi.fn(),
}));

vi.mock("@/db", () => {
  const statement = () => {
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "onConflictDoNothing", "onConflictDoUpdate", "returning", "orderBy"]) chain[name] = () => chain;
    chain.values = (values: Record<string, unknown>) => {
      h.inserts.push(values);
      return chain;
    };
    chain.set = (values: Record<string, unknown>) => {
      h.updates.push(values);
      return chain;
    };
    chain.then = (resolve: (rows: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(h.results.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { db: { select: statement, insert: statement, update: statement } };
});
vi.mock("@/lib/ai-runs", () => ({ callJson: h.callJson }));
vi.mock("@/lib/queue", () => ({
  enqueueGrading: async (id: string) => {
    h.enqueued.push(id);
  },
}));

import { openGradings, reopenGradingForMedia, runGrading } from "./exam-results";

const base = { id: "i", level: "B1", difficulty: 0, type: "WRITING_PROMPT", skillTag: "writing.formal", stimulusId: null, orderInStimulus: 0, key: { kind: "NONE" }, points: 1, stimulus: null };
const LEITPUNKTE = ["Interesse nennen UND begründen", "Zeit pro Woche nennen", "Nach der Bewerbung fragen UND der Schulung"];
const writingSnap = {
  ...base,
  section: "WRITING",
  prompt: "Schreiben Sie eine E-Mail an Frau Neumann.",
  content: { kind: "WRITING", minWords: 60, maxWords: 80 },
  rubric: { contentPoints: LEITPUNKTE, register: "formell (Sie)" },
};
const speakingSnap = {
  ...base,
  section: "SPEAKING",
  type: "SPEAKING_PROMPT",
  prompt: "Stellen Sie sich vor.",
  content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 },
  rubric: { contentPoints: ["Name", "Wohnort"] },
};

const TEXT =
  "Sehr geehrte Frau Neumann, gestern war ich bei Ihrem Infoabend und möchte mich gern ehrenamtlich engagieren, weil ich anderen Menschen helfen möchte. " +
  "Ich habe zwei Jahre als Betreuer in einem Ferienlager gearbeitet und kann gut mit Kindern umgehen. Pro Woche habe ich etwa vier Stunden Zeit. " +
  "Wie läuft die Bewerbung ab, und gibt es vorher eine Schulung? Mit freundlichen Grüßen, Marek Nowak";

const writingAnswer = JSON.stringify({
  leitpunkte: LEITPUNKTE.map((point) => ({ point, done: "YES", evidence: "ehrenamtlich engagieren" })),
  criteria: [
    { id: "INHALT", points: 3, rationale: "Alles bearbeitet." },
    { id: "WORTSCHATZ", points: 2, rationale: "Passend." },
    { id: "GRAMMATIK", points: 2, rationale: "Wenige Fehler." },
  ],
  errors: [],
  commonErrors: [],
  advice: "Nebensätze mit ob üben.",
});
const speakingAnswer = JSON.stringify({
  criteria: ["KOMMUNIKATION", "WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "KOHAERENZ"].map((id) => ({ id, points: 3, assessable: id !== "AUSSPRACHE", rationale: `Begründung ${id}.` })),
  advice: "Perfekt üben.",
});

const modelReply = (text: string) => ({ response: { text, model: "gemini-test" }, runId: "run-1" });

/** The row `runGrading` reads: a PENDING grading of a course test attempt. */
function gradingRow(snapshot: unknown, answer: unknown, over: { mode?: string; course?: unknown } = {}) {
  return {
    grading: { id: "grading-1", status: "PENDING", taskLevel: "B1" },
    response: { id: "resp-1", sectionRunId: "run-1", itemSnapshot: snapshot, answer },
    run: { id: "run-1" },
    attempt: { id: "attempt-1" },
    assessment: { locale: "tr" },
    exam: { mode: over.mode ?? "COURSE_TEST", blueprintSnapshot: { course: "course" in over ? over.course : { key: "B1", form: "A", rules: {} } } },
    org: { id: "org-1" },
  };
}

beforeEach(() => {
  h.results = [];
  h.inserts = [];
  h.updates = [];
  h.enqueued = [];
  h.callJson.mockReset();
});

describe("openGradings for a course test", () => {
  const response = (id: string, snapshot: unknown, answer: unknown, examMode = "COURSE_TEST") => ({ id, sectionRunId: "run-1", itemSnapshot: snapshot, answer, examMode });

  it("proposes 0 in every criterion by rule for a task nobody answered, as AI_PROPOSED without a level", async () => {
    h.results = [[response("resp-w", writingSnap, null)]];
    await openGradings("run-1");
    expect(h.inserts).toHaveLength(1);
    const row = h.inserts[0] as { status: string; courseProposal: { byRule: string; criteria: Array<{ points: number }>; leitpunkte: Array<{ done: string }> } } & Record<string, unknown>;
    expect(row).toMatchObject({ itemResponseId: "resp-w", taskLevel: "B1", status: "AI_PROPOSED", aiModel: "rule" });
    expect(row.courseProposal.byRule).toBe("EMPTY");
    expect(row.courseProposal.criteria.map((c) => c.points)).toEqual([0, 0, 0]);
    expect(row.courseProposal.leitpunkte.map((r) => r.done)).toEqual(["NO", "NO", "NO"]);
    expect(row).not.toHaveProperty("aiLevel");
    expect(row).not.toHaveProperty("aiProposal");
    expect(h.enqueued).toEqual([]);
  });

  it("queues an answered writing task for the model, and a recording once it has a transcript", async () => {
    h.results = [
      [response("resp-w", writingSnap, { text: TEXT }), response("resp-s", speakingSnap, { mediaAssetId: "m1" })],
      // the writing task: its PENDING insert, then the input check (writing is ready at once)
      [{ id: "grading-w" }],
      [{ id: "resp-w", itemSnapshot: writingSnap, answer: { text: TEXT } }],
      // the speaking task: its insert, then the input check (the response, its transcript)
      [{ id: "grading-s" }],
      [{ id: "resp-s", itemSnapshot: speakingSnap, answer: { mediaAssetId: "m1" } }],
      [{ id: "t1" }],
    ];
    await openGradings("run-1");
    expect(h.inserts.map((i) => i.status)).toEqual(["PENDING", "PENDING"]);
    expect(h.enqueued).toEqual(["grading-w", "grading-s"]);
  });

  it("leaves the A0 rule for the other exams as it was", async () => {
    h.results = [[response("resp-w", writingSnap, null, "PLACEMENT")]];
    await openGradings("run-1");
    expect(h.inserts[0]).toMatchObject({ status: "AI_PROPOSED", aiLevel: "A0", aiModel: "rule" });
    expect(h.inserts[0]).not.toHaveProperty("courseProposal");
  });
});

describe("runGrading for a course test", () => {
  it("stores the model's rubric points as the proposal, awaiting the teacher, with no level", async () => {
    h.results = [[gradingRow(writingSnap, { text: TEXT })]];
    h.callJson.mockResolvedValue(modelReply(writingAnswer));
    const outcome = await runGrading("grading-1");
    expect(outcome).toEqual({ status: "PROPOSED", level: null });

    const [name, schema, messages, meta, options] = h.callJson.mock.calls[0];
    expect(name).toBe("course_rubric");
    expect(JSON.stringify(schema)).toContain("INHALT");
    expect((messages as Array<{ content: string }>)[0].content).toContain("Prüfer für Deutsch als Fremdsprache");
    expect((messages as Array<{ content: string }>)[1].content).toContain(TEXT);
    expect(meta).toEqual({ orgId: "org-1", purpose: "COURSE_RUBRIC", inputRef: "item_response:resp-1" });
    expect(options).toMatchObject({ maxTokens: expect.any(Number) });

    const proposed = h.updates.find((u) => u.status === "AI_PROPOSED") as Record<string, unknown>;
    expect(proposed).toMatchObject({ status: "AI_PROPOSED", aiRunId: "run-1", aiModel: "gemini-test", aiError: null });
    expect(proposed).not.toHaveProperty("aiLevel");
    expect(proposed).not.toHaveProperty("aiProposal");
    expect(proposed).not.toHaveProperty("finalLevel");
    const proposal = proposed.courseProposal as { section: string; criteria: Array<{ id: string; points: number | null }>; wordCount: number };
    expect(proposal.section).toBe("WRITING");
    expect(proposal.criteria.map((c) => [c.id, c.points])).toEqual([["INHALT", 3], ["WORTSCHATZ", 2], ["GRAMMATIK", 2]]);
    expect(proposal.wordCount).toBeGreaterThan(40);
  });

  it("proposes a speaking task from its transcript, with pronunciation left to the teacher", async () => {
    h.results = [[gradingRow(speakingSnap, { mediaAssetId: "m1" })], [{ text: "Ich heiße Ali und wohne in Köln.", words: [{ text: "Ich", startMs: 0, endMs: 300 }], durationMs: 8000 }]];
    h.callJson.mockResolvedValue(modelReply(speakingAnswer));
    expect(await runGrading("grading-1")).toEqual({ status: "PROPOSED", level: null });
    const proposal = (h.updates.find((u) => u.status === "AI_PROPOSED") as { courseProposal: { criteria: Array<{ id: string; points: number | null }> } }).courseProposal;
    expect(proposal.criteria.map((c) => [c.id, c.points])).toEqual([["KOMMUNIKATION", 3], ["WORTSCHATZ", 3], ["GRAMMATIK", 3], ["AUSSPRACHE", null], ["KOHAERENZ", 3]]);
    const messages = h.callJson.mock.calls[0][2] as Array<{ content: string }>;
    expect(messages[1].content).toContain("Ich heiße Ali und wohne in Köln.");
  });

  it("waits for a recording whose transcript is not there yet", async () => {
    h.results = [[gradingRow(speakingSnap, { mediaAssetId: "m1" })], []];
    expect(await runGrading("grading-1")).toEqual({ status: "SKIPPED", reason: "transcript not ready" });
    expect(h.callJson).not.toHaveBeenCalled();
    expect(h.updates).toEqual([]);
  });

  it("proposes 0 by rule for a recording with no speech in it, without a model call", async () => {
    h.results = [[gradingRow(speakingSnap, { mediaAssetId: "m1" })], [{ text: "", words: [], durationMs: null }]];
    expect(await runGrading("grading-1")).toEqual({ status: "PROPOSED", level: null });
    expect(h.callJson).not.toHaveBeenCalled();
    const proposed = h.updates.find((u) => u.status === "AI_PROPOSED") as { aiModel: string; aiRunId: unknown; courseProposal: { byRule: string; criteria: Array<{ points: number }> } };
    expect(proposed).toMatchObject({ aiModel: "rule", aiRunId: null });
    expect(proposed.courseProposal.byRule).toBe("EMPTY");
    expect(proposed.courseProposal.criteria.map((c) => c.points)).toEqual([0, 0, 0, 0, 0]);
  });

  it("closes the grading as AI_FAILED, not as a zero, when the model's answers cannot be used", async () => {
    h.results = [[gradingRow(writingSnap, { text: TEXT })]];
    h.callJson.mockResolvedValue(modelReply("kein JSON"));
    const outcome = await runGrading("grading-1");
    expect(outcome.status).toBe("FAILED");
    expect(h.callJson).toHaveBeenCalledTimes(2);
    const closing = h.updates.find((u) => u.status === "AI_FAILED") as Record<string, unknown>;
    expect(closing).toMatchObject({ status: "AI_FAILED", aiRunId: "run-1", aiModel: "gemini-test" });
    expect(String(closing.aiError)).toContain("unparseable");
    expect(closing).not.toHaveProperty("courseProposal");
    expect(closing).not.toHaveProperty("finalLevel");
    expect(h.updates.some((u) => u.status === "AI_PROPOSED")).toBe(false);
  });

  it("lets a provider failure through, so the queue retries and the grading stays pending", async () => {
    h.results = [[gradingRow(writingSnap, { text: TEXT })]];
    h.callJson.mockRejectedValue(new Error("AI_UNAVAILABLE"));
    await expect(runGrading("grading-1")).rejects.toThrow("AI_UNAVAILABLE");
    expect(h.updates).toEqual([]);
  });

  it("hands a course test with no course configuration to the teacher", async () => {
    h.results = [[gradingRow(writingSnap, { text: TEXT }, { course: undefined })]];
    const outcome = await runGrading("grading-1");
    expect(outcome.status).toBe("FAILED");
    expect(h.callJson).not.toHaveBeenCalled();
    expect(h.updates[0]).toMatchObject({ status: "AI_FAILED" });
  });

  it("does not touch a grading that is no longer pending", async () => {
    const row = gradingRow(writingSnap, { text: TEXT });
    row.grading.status = "CONFIRMED";
    h.results = [[row]];
    expect(await runGrading("grading-1")).toEqual({ status: "SKIPPED", reason: "status is CONFIRMED" });
    expect(h.callJson).not.toHaveBeenCalled();
  });
});

describe("reopenGradingForMedia", () => {
  it("clears a course proposal too, so a late recording is graded afresh", async () => {
    await reopenGradingForMedia("resp-1");
    expect(h.updates).toHaveLength(2);
    for (const u of h.updates) expect(u).toMatchObject({ status: "PENDING", aiProposal: null, courseProposal: null, aiLevel: null, aiModel: null });
  });
});
