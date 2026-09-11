import { describe, it, expect } from "vitest";
import {
  SALVAGE_MIN_AGE_MS,
  SALVAGE_QUIET_MS,
  decideClose,
  decideSalvage,
  hasAnswer,
  isDueForClose,
} from "./stage-timeout";

const base = {
  behaviour: "AUTO_SUBMIT" as const,
  requiredCount: 2,
  answeredRequired: 2,
  answeredAny: 2,
};

describe("what happens when a stage runs out of time", () => {
  it("submits a fully answered stage as complete", () => {
    expect(decideClose(base)).toEqual({
      action: "CLOSE",
      completion: "COMPLETE",
      late: true,
    });
  });

  it("keeps a half finished stage as PARTIAL rather than throwing it away", () => {
    // The candidate typed something. Discarding it would lose real work.
    expect(
      decideClose({ ...base, answeredRequired: 1, answeredAny: 1 }),
    ).toMatchObject({ completion: "PARTIAL" });
  });

  it("marks an untouched stage EXPIRED", () => {
    expect(
      decideClose({ ...base, answeredRequired: 0, answeredAny: 0 }),
    ).toMatchObject({ completion: "EXPIRED" });
  });

  it("counts optional answers, so an all-optional stage is not discarded", () => {
    expect(
      decideClose({
        behaviour: "AUTO_SUBMIT",
        requiredCount: 0,
        answeredRequired: 0,
        answeredAny: 3,
      }),
    ).toMatchObject({ completion: "PARTIAL" });
  });

  it("hard stops under AUTO_CLOSE even with answers present", () => {
    expect(decideClose({ ...base, behaviour: "AUTO_CLOSE" })).toMatchObject({
      completion: "EXPIRED",
    });
  });

  it("leaves ALLOW_LATE stages open, because the candidate may still be working", () => {
    expect(decideClose({ ...base, behaviour: "ALLOW_LATE" })).toEqual({
      action: "LEAVE_OPEN",
      reason: "stage allows late submission",
    });
  });

  it("treats ALLOW_GRACE like AUTO_SUBMIT, since grace is already in the deadline", () => {
    expect(decideClose({ ...base, behaviour: "ALLOW_GRACE" })).toEqual(
      decideClose({ ...base, behaviour: "AUTO_SUBMIT" }),
    );
  });

  it("always flags a closed run as late", () => {
    for (const behaviour of ["AUTO_SUBMIT", "AUTO_CLOSE", "ALLOW_GRACE"] as const) {
      const d = decideClose({ ...base, behaviour });
      expect(d.action === "CLOSE" && d.late).toBe(true);
    }
  });
});

describe("what counts as an answer", () => {
  it("accepts text, choices, media and files", () => {
    expect(hasAnswer({ text: "merhaba" })).toBe(true);
    expect(hasAnswer({ choiceIds: ["a"] })).toBe(true);
    expect(hasAnswer({ mediaAssetId: "m1" })).toBe(true);
    expect(hasAnswer({ fileAssetIds: ["f1"] })).toBe(true);
  });

  it("rejects empty, whitespace and missing payloads", () => {
    expect(hasAnswer(null)).toBe(false);
    expect(hasAnswer({})).toBe(false);
    expect(hasAnswer({ text: "" })).toBe(false);
    expect(hasAnswer({ text: "   " })).toBe(false);
    expect(hasAnswer({ choiceIds: [] })).toBe(false);
  });
});

import { carryDecision } from "./stage-timeout";

describe("what a stage looks like in a retake attempt", () => {
  it("gives a fresh run for every stage the manager asked to redo", () => {
    expect(
      carryDecision({ inRetakeScope: true, priorCompletion: "COMPLETE" }),
    ).toBe("FRESH");
  });

  it("carries a settled stage instead of copying it", () => {
    for (const prior of ["COMPLETE", "PARTIAL", "EXPIRED", "SKIPPED"] as const) {
      expect(carryDecision({ inRetakeScope: false, priorCompletion: prior })).toBe(
        "CARRY",
      );
    }
  });

  it("leaves a stage the candidate never reached outstanding, not skipped", () => {
    // The bug this guards: a candidate who ran out of time in stage 2 had never
    // opened stage 3. Carrying it forward closed a stage they never got to do.
    expect(carryDecision({ inRetakeScope: false, priorCompletion: null })).toBe(
      "FRESH",
    );
    expect(
      carryDecision({ inRetakeScope: false, priorCompletion: "PENDING" }),
    ).toBe("FRESH");
  });
});

describe("which runs the close sweep should even look at", () => {
  const now = new Date("2026-09-11T10:00:00.000Z");
  const overdue = {
    behaviour: "AUTO_SUBMIT" as const,
    completion: "PENDING" as const,
    submittedAt: null,
    deadlineAt: new Date(now.getTime() - 60_000),
  };

  it("picks an open run whose deadline has passed", () => {
    expect(isDueForClose(overdue, now)).toBe(true);
  });

  it("never picks an ALLOW_LATE run, so fifty abandoned ones cannot fill the batch", () => {
    // The bug this guards: ALLOW_LATE runs were selected, left open, and
    // selected again every tick. With no ORDER BY, fifty of them starved every
    // other stage in the system.
    expect(isDueForClose({ ...overdue, behaviour: "ALLOW_LATE" }, now)).toBe(false);
  });

  it("ignores runs already settled, submitted, unstarted, or still in time", () => {
    expect(isDueForClose({ ...overdue, completion: "COMPLETE" }, now)).toBe(false);
    expect(isDueForClose({ ...overdue, submittedAt: now }, now)).toBe(false);
    expect(isDueForClose({ ...overdue, deadlineAt: null }, now)).toBe(false);
    expect(
      isDueForClose({ ...overdue, deadlineAt: new Date(now.getTime() + 1) }, now),
    ).toBe(false);
  });

  it("is exclusive at the deadline itself", () => {
    expect(isDueForClose({ ...overdue, deadlineAt: now }, now)).toBe(false);
  });
});

describe("when the server may finish an upload the browser abandoned", () => {
  const now = new Date("2026-09-11T10:00:00.000Z");
  const old = new Date(now.getTime() - SALVAGE_MIN_AGE_MS - 1);
  const closedRun = {
    completion: "EXPIRED" as const,
    deadlineAt: new Date(now.getTime() - 3_600_000),
    lastHeartbeatAt: new Date(now.getTime() - 3_600_000),
  };

  it("salvages an old upload on a run that is already closed", () => {
    expect(decideSalvage({ assetCreatedAt: old, run: closedRun }, now)).toEqual({
      action: "SALVAGE",
    });
  });

  it("salvages an old upload on a PENDING run whose deadline has passed", () => {
    expect(
      decideSalvage(
        { assetCreatedAt: old, run: { ...closedRun, completion: "PENDING" } },
        now,
      ),
    ).toEqual({ action: "SALVAGE" });
  });

  it("leaves a recording alone while it is younger than the threshold", () => {
    // Half an hour: a recording in progress is minutes old, and cutting it
    // short would turn a live answer into a truncated one.
    const fresh = new Date(now.getTime() - SALVAGE_MIN_AGE_MS + 1);
    expect(decideSalvage({ assetCreatedAt: fresh, run: closedRun }, now)).toMatchObject({
      action: "SKIP",
    });
  });

  it("leaves a run alone while its tab is still sending heartbeats", () => {
    const alive = {
      ...closedRun,
      completion: "PENDING" as const,
      lastHeartbeatAt: new Date(now.getTime() - SALVAGE_QUIET_MS + 1),
    };
    expect(decideSalvage({ assetCreatedAt: old, run: alive }, now)).toMatchObject({
      action: "SKIP",
      reason: expect.stringMatching(/alive/),
    });
  });

  it("leaves an open run that is still inside its deadline", () => {
    const open = {
      completion: "PENDING" as const,
      deadlineAt: new Date(now.getTime() + 60_000),
      lastHeartbeatAt: null,
    };
    expect(decideSalvage({ assetCreatedAt: old, run: open }, now)).toMatchObject({
      action: "SKIP",
    });
  });

  it("salvages an old upload that belongs to no run at all", () => {
    expect(decideSalvage({ assetCreatedAt: old, run: null }, now)).toEqual({
      action: "SALVAGE",
    });
  });
});
