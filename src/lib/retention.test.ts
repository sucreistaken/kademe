import { describe, it, expect, vi } from "vitest";

// The module under test also holds the queries, so importing it would pull in
// @/db and fail on a missing DATABASE_URL. Nothing below touches the database,
// so the connection is stubbed away rather than stood up. Hoisted by vitest, so
// src/db/index.ts is never evaluated at all.
vi.mock("@/db", () => ({ db: {}, schema: {} }));

import {
  DEFAULT_BATCH,
  MAX_BATCH,
  SOFT_DELETE_GRACE_DAYS,
  batchWindow,
  clampBatch,
  daysAfter,
  daysBefore,
  hardDeleteDueAt,
  isExpired,
  isPurgeDue,
  isTerminalDecision,
  mediaAnchorFrom,
  retentionCutoff,
  settingsProblem,
  TERMINAL_DECISION_STATUSES,
} from "./retention";

// No database here on purpose. Everything below is the arithmetic that decides
// whether a candidate's video is deleted, so it has to be checkable without a
// running Postgres and without touching a single real row.

const NOW = new Date("2026-09-09T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("retention date arithmetic", () => {
  it("counts a day as 24 hours in both directions", () => {
    expect(daysBefore(NOW, 1).toISOString()).toBe("2026-09-08T12:00:00.000Z");
    expect(daysAfter(NOW, 1).toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("does not mutate the date it was handed", () => {
    const before = NOW.getTime();
    daysBefore(NOW, 400);
    daysAfter(NOW, 400);
    expect(NOW.getTime()).toBe(before);
  });

  it("puts the media cutoff 180 days back by default policy", () => {
    const cutoff = retentionCutoff(NOW, 180);
    expect(NOW.getTime() - cutoff.getTime()).toBe(180 * DAY_MS);
  });

  it("keeps the two clocks separate, 180 for media and 730 for candidates", () => {
    const media = retentionCutoff(NOW, 180);
    const candidate = retentionCutoff(NOW, 730);
    expect(candidate.getTime()).toBeLessThan(media.getTime());
    expect(media.getTime() - candidate.getTime()).toBe(550 * DAY_MS);
  });

  it("refuses a zero or negative retention, which would mean delete everything", () => {
    expect(() => retentionCutoff(NOW, 0)).toThrow(/positive/);
    expect(() => retentionCutoff(NOW, -5)).toThrow(/positive/);
    expect(() => retentionCutoff(NOW, Number.NaN)).toThrow(/positive/);
  });

  it("ignores a fractional setting downward rather than rounding up", () => {
    // 180.9 days must not become 181, which would keep data a day too long.
    expect(retentionCutoff(NOW, 180.9).getTime()).toBe(
      retentionCutoff(NOW, 180).getTime(),
    );
  });
});

describe("who is out of retention", () => {
  it("expires an anchor one millisecond past the window", () => {
    const anchor = new Date(retentionCutoff(NOW, 180).getTime() - 1);
    expect(isExpired(anchor, NOW, 180)).toBe(true);
  });

  it("keeps an anchor sitting exactly on the boundary", () => {
    // Exclusive boundary. A row that turns 180 days old at this instant gets
    // picked up by the next run, not this one.
    const anchor = retentionCutoff(NOW, 180);
    expect(isExpired(anchor, NOW, 180)).toBe(false);
  });

  it("keeps an anchor one millisecond inside the window", () => {
    const anchor = new Date(retentionCutoff(NOW, 180).getTime() + 1);
    expect(isExpired(anchor, NOW, 180)).toBe(false);
  });

  it("holds a 200 day old recording that is still inside a 730 day candidate window", () => {
    const anchor = daysBefore(NOW, 200);
    expect(isExpired(anchor, NOW, 180)).toBe(true);
    expect(isExpired(anchor, NOW, 730)).toBe(false);
  });
});

describe("the seven day grace between marking and deleting", () => {
  it("puts the purge date a week after the mark", () => {
    const due = hardDeleteDueAt(NOW);
    expect(due.getTime() - NOW.getTime()).toBe(SOFT_DELETE_GRACE_DAYS * DAY_MS);
    expect(due.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });

  it("is not due six days and 23 hours later", () => {
    const marked = daysBefore(NOW, 7);
    const due = hardDeleteDueAt(marked);
    const almost = new Date(due.getTime() - 60 * 60 * 1000);
    expect(isPurgeDue(due, almost)).toBe(false);
  });

  it("is due at the exact instant the week runs out, and after", () => {
    const marked = daysBefore(NOW, 7);
    const due = hardDeleteDueAt(marked);
    expect(isPurgeDue(due, due)).toBe(true);
    expect(isPurgeDue(due, new Date(due.getTime() + 1))).toBe(true);
  });

  it("honours a shorter grace when one is passed explicitly", () => {
    expect(hardDeleteDueAt(NOW, 1).toISOString()).toBe(
      "2026-09-10T12:00:00.000Z",
    );
  });

  it("never lets a row marked today be deleted today", () => {
    expect(isPurgeDue(hardDeleteDueAt(NOW), NOW)).toBe(false);
  });
});

describe("guarding against a retention setting that would wipe everything", () => {
  const good = { mediaRetentionDays: 180, candidateRetentionDays: 730 };

  it("accepts the defaults", () => {
    expect(settingsProblem(good)).toBeNull();
  });

  it("rejects a zero on either clock, independently", () => {
    expect(settingsProblem({ ...good, mediaRetentionDays: 0 })).toMatch(
      /mediaRetentionDays is 0/,
    );
    expect(settingsProblem({ ...good, candidateRetentionDays: 0 })).toMatch(
      /candidateRetentionDays is 0/,
    );
  });

  it("rejects a negative and a non finite setting", () => {
    expect(settingsProblem({ ...good, mediaRetentionDays: -1 })).not.toBeNull();
    expect(
      settingsProblem({ ...good, candidateRetentionDays: Number.NaN }),
    ).not.toBeNull();
  });

  it("accepts the shortest legal retention, one day", () => {
    expect(
      settingsProblem({ mediaRetentionDays: 1, candidateRetentionDays: 1 }),
    ).toBeNull();
  });
});

describe("batch size, so one call cannot run unbounded", () => {
  it("falls back to the default when nothing is asked for", () => {
    expect(clampBatch(undefined)).toBe(DEFAULT_BATCH);
    expect(clampBatch(null)).toBe(DEFAULT_BATCH);
    expect(clampBatch(Number.NaN)).toBe(DEFAULT_BATCH);
  });

  it("caps an enormous request", () => {
    expect(clampBatch(1_000_000)).toBe(MAX_BATCH);
  });

  it("floors a fractional request and never drops below one", () => {
    expect(clampBatch(10.9)).toBe(10);
    expect(clampBatch(0)).toBe(1);
    expect(clampBatch(-40)).toBe(1);
  });
});

describe("batch boundaries", () => {
  it("reports nothing to do on an empty backlog", () => {
    expect(batchWindow(0, 200)).toEqual({
      inBatch: 0,
      remaining: 0,
      complete: true,
    });
  });

  it("takes the whole backlog when it fits", () => {
    expect(batchWindow(199, 200)).toEqual({
      inBatch: 199,
      remaining: 0,
      complete: true,
    });
  });

  it("is complete at exactly the batch size, with nothing left over", () => {
    expect(batchWindow(200, 200)).toEqual({
      inBatch: 200,
      remaining: 0,
      complete: true,
    });
  });

  it("leaves the overflow for the next run rather than pretending it is done", () => {
    expect(batchWindow(201, 200)).toEqual({
      inBatch: 200,
      remaining: 1,
      complete: false,
    });
  });

  it("drains a 4501 row backlog in three capped runs and one short one", () => {
    let left = 4501;
    const taken: number[] = [];
    for (let pass = 0; pass < 4; pass += 1) {
      const window = batchWindow(left, MAX_BATCH);
      taken.push(window.inBatch);
      left = window.remaining;
    }
    expect(taken).toEqual([2000, 2000, 501, 0]);
    expect(left).toBe(0);
  });

  it("applies the same clamping to the batch it was given", () => {
    // A caller asking for a million rows still only gets MAX_BATCH of them.
    expect(batchWindow(10_000, 1_000_000).inBatch).toBe(MAX_BATCH);
    expect(batchWindow(10_000, -1).inBatch).toBe(1);
  });

  it("never returns a negative remainder from a nonsense total", () => {
    expect(batchWindow(-5, 200)).toEqual({
      inBatch: 0,
      remaining: 0,
      complete: true,
    });
  });
});

describe("what starts the media clock", () => {
  const d = (iso: string, status: string) => ({ status, at: new Date(iso) });

  it("treats only ACCEPTED and REJECTED as the end of a review", () => {
    expect([...TERMINAL_DECISION_STATUSES].sort()).toEqual(["ACCEPTED", "REJECTED"]);
    for (const s of ["NEW", "IN_REVIEW", "SHORTLISTED", "INTERVIEW", "RETAKE_REQUESTED", "ON_HOLD"]) {
      expect(isTerminalDecision(s)).toBe(false);
    }
  });

  it("has no anchor at all while nobody has decided", () => {
    // Null, not the invitation date and not the recording date: a candidate
    // under review keeps the video however long the review takes.
    expect(mediaAnchorFrom([])).toBeNull();
  });

  it("is not started by an intermediate decision", () => {
    // The bug this guards: any decisions row, even IN_REVIEW, used to start
    // the 180 day clock, which is the opposite of the documented intent.
    expect(
      mediaAnchorFrom([
        d("2026-01-01T00:00:00Z", "IN_REVIEW"),
        d("2026-02-01T00:00:00Z", "RETAKE_REQUESTED"),
        d("2026-03-01T00:00:00Z", "ON_HOLD"),
      ]),
    ).toBeNull();
  });

  it("starts at the terminal decision even when later notes follow it", () => {
    expect(
      mediaAnchorFrom([
        d("2026-01-01T00:00:00Z", "IN_REVIEW"),
        d("2026-02-01T00:00:00Z", "REJECTED"),
        d("2026-03-01T00:00:00Z", "ON_HOLD"),
      ])?.toISOString(),
    ).toBe("2026-02-01T00:00:00.000Z");
  });

  it("takes the latest terminal decision when the outcome was revised", () => {
    expect(
      mediaAnchorFrom([
        d("2026-02-01T00:00:00Z", "REJECTED"),
        d("2026-04-01T00:00:00Z", "ACCEPTED"),
        d("2026-01-01T00:00:00Z", "ACCEPTED"),
      ])?.toISOString(),
    ).toBe("2026-04-01T00:00:00.000Z");
  });
});
