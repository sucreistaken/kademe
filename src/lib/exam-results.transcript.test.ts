import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A recorded speaking answer with no speech in it. Its transcript is stored with
 * empty text (transcribe-job), and from there the chain is: the grading is ready,
 * a rule proposes A0 without a model call, the teacher confirms. And the other
 * side: a recording that never gets a transcript is closed for a teacher, never
 * given a level.
 */

const h = vi.hoisted(() => ({
  /** Rows each awaited statement answers, in order. */
  results: [] as unknown[][],
  /** What each update set, in order. */
  updates: [] as Array<Record<string, unknown>>,
  enqueued: [] as string[],
  callJson: vi.fn(),
}));

vi.mock("@/db", () => {
  const statement = () => {
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "leftJoin", "innerJoin", "where", "limit", "values", "onConflictDoNothing", "onConflictDoUpdate", "returning", "orderBy"]) {
      chain[name] = () => chain;
    }
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

import { NO_TRANSCRIPT_ERROR, failGradingsWithoutTranscript, gradeAfterTranscript, openGradings, runGrading } from "./exam-results";

const snapshot = {
  type: "SPEAKING_PROMPT",
  section: "SPEAKING",
  level: "A1",
  prompt: "Stellen Sie sich bitte vor. Sprechen Sie über Name und Wohnort.",
  content: { kind: "SPEAKING" },
  rubric: { contentPoints: ["Name", "Wohnort"] },
};
const recorded = { id: "resp-1", sectionRunId: "run-1", itemSnapshot: snapshot, answer: { mediaAssetId: "m1" } };

beforeEach(() => {
  h.results = [];
  h.updates = [];
  h.enqueued = [];
  h.callJson.mockReset();
});

describe("a transcript with empty text is a transcript", () => {
  it("makes the grading ready: a recorded answer whose transcript row exists is queued for grading", async () => {
    // responses of the run; the insert of the PENDING grading; its input check (response, transcript).
    h.results = [[recorded], [{ id: "grading-1" }], [recorded], [{ id: "transcript-1" }]];
    await openGradings("run-1");
    expect(h.enqueued).toEqual(["grading-1"]);
  });

  it("does not queue a recorded answer that has no transcript row yet", async () => {
    h.results = [[recorded], [{ id: "grading-1" }], [recorded], []];
    await openGradings("run-1");
    expect(h.enqueued).toEqual([]);
  });

  it("ends AI_PROPOSED A0 by rule, with the EMPTY flag and no model call", async () => {
    h.results = [
      [
        {
          grading: { id: "grading-1", status: "PENDING", taskLevel: "A1" },
          response: recorded,
          run: { id: "run-1" },
          attempt: { id: "attempt-1" },
          assessment: { locale: "tr" },
          org: { id: "org-1" },
        },
      ],
      // the transcript as the job stores it for a recording with no speech
      [{ text: "", words: [], durationMs: null }],
    ];

    const outcome = await runGrading("grading-1");

    expect(outcome).toEqual({ status: "PROPOSED", level: "A0" });
    expect(h.callJson).not.toHaveBeenCalled();
    const proposed = h.updates.find((u) => u.status === "AI_PROPOSED");
    expect(proposed).toMatchObject({ status: "AI_PROPOSED", aiLevel: "A0", aiModel: "rule", aiRunId: null, aiError: null });
    expect((proposed?.aiProposal as { flags: string[] }).flags).toEqual(["EMPTY"]);
    // A teacher still decides: nothing here writes a final level.
    expect(proposed).not.toHaveProperty("finalLevel");
  });
});

describe("a transcript that arrives after its grading was closed for want of one", () => {
  it("reopens that grading, and queues the one that is pending", async () => {
    // the asset; the reopened grading is then found PENDING
    h.results = [[{ id: "m1", itemResponseId: "resp-1" }], [], [{ id: "grading-1", status: "PENDING" }]];
    await gradeAfterTranscript("m1");
    expect(h.updates[0]).toMatchObject({ status: "PENDING", aiError: null });
    expect(h.enqueued).toEqual(["grading-1"]);
  });
});

describe("failGradingsWithoutTranscript: no transcript is a job for the teacher, not a level", () => {
  const cutoff = new Date("2026-10-26T00:00:00Z");

  it("closes each stuck grading as AI_FAILED with the no-transcript error, never with a level", async () => {
    // two stuck gradings; both updates take; then recomputeResult finds no result row for either attempt.
    h.results = [[{ id: "g1", attemptId: "a1" }, { id: "g2", attemptId: "a1" }], [{ id: "g1" }], [{ id: "g2" }]];

    expect(await failGradingsWithoutTranscript(cutoff)).toBe(2);

    const closing = h.updates.filter((u) => u.status === "AI_FAILED");
    expect(closing).toHaveLength(2);
    for (const u of closing) {
      expect(u.aiError).toBe(NO_TRANSCRIPT_ERROR);
      expect(u).not.toHaveProperty("aiLevel");
      expect(u).not.toHaveProperty("finalLevel");
    }
  });

  it("does not count a grading that changed state in between", async () => {
    // the update finds the row no longer PENDING (a teacher or a late proposal got there first)
    h.results = [[{ id: "g1", attemptId: "a1" }], []];
    expect(await failGradingsWithoutTranscript(cutoff)).toBe(0);
  });

  it("does nothing when no recording is stuck", async () => {
    h.results = [[]];
    expect(await failGradingsWithoutTranscript(cutoff)).toBe(0);
    expect(h.updates).toEqual([]);
  });
});
