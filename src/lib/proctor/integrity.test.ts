import { describe, it, expect } from "vitest";
import {
  computeIntegrity,
  type AiVerdict,
  type CoverageInput,
  type IntegrityEvent,
} from "./integrity";
import { PROCTOR_EVENT_TYPES, TAXONOMY, type Severity } from "./taxonomy";

const FULL: CoverageInput = {
  modelUnavailable: false,
  shareUnverified: false,
  secondScreenUnverifiable: false,
  cameraCoverage: 1,
};

let seq = 0;
function ev(partial: Partial<IntegrityEvent> & Pick<IntegrityEvent, "type">): IntegrityEvent {
  const t = partial.startedAt ?? 1_000_000 + seq * 1000;
  return {
    id: partial.id ?? `e${seq++}`,
    severity: partial.severity ?? TAXONOMY[partial.type].severity,
    startedAt: t,
    endedAt: partial.endedAt ?? (TAXONOMY[partial.type].interval ? t + 2000 : null),
    teacherStatus: partial.teacherStatus ?? "OPEN",
    ...partial,
  };
}

const run = (
  events: IntegrityEvent[],
  reviews: Record<string, AiVerdict> = {},
  coverage: CoverageInput = FULL,
) => computeIntegrity({ events, reviews, coverage });

describe("basic levels", () => {
  it("no events is CLEAR with score 0", () => {
    expect(run([])).toEqual({
      level: "CLEAR",
      score: 0,
      reasons: [],
      openHigh: 0,
      coverageGaps: [],
    });
  });

  it("one phone is REVIEW, three phones is ATTENTION", () => {
    expect(run([ev({ type: "PHONE_DETECTED" })]).level).toBe("REVIEW");
    const three = [1, 2, 3].map(() => ev({ type: "PHONE_DETECTED" }));
    // 8 + 8/sqrt2 + 8/sqrt3 = 18.28
    const r = run(three);
    expect(r.score).toBeCloseTo(18.28, 2);
    expect(r.level).toBe("ATTENTION");
    expect(r.openHigh).toBe(3);
  });

  it("a couple of LOW events stay CLEAR", () => {
    const r = run([ev({ type: "COPY_ATTEMPT" }), ev({ type: "CONTEXT_MENU" })]);
    expect(r.score).toBe(2);
    expect(r.level).toBe("CLEAR");
  });
});

describe("diminishing returns", () => {
  const harmonicSqrt = (n: number) =>
    Array.from({ length: n }, (_, i) => 1 / Math.sqrt(i + 1)).reduce((a, b) => a + b, 0);

  it("40 focus losses are sublinear and follow sum 1/sqrt(k)", () => {
    const events = Array.from({ length: 40 }, () => ev({ type: "FOCUS_LOST" }));
    const r = run(events);
    expect(r.score).toBeLessThan(40);
    expect(r.score).toBeCloseTo(harmonicSqrt(40), 1);
  });

  it("per-type contribution grows like sqrt(n)", () => {
    const score = (n: number) =>
      run(Array.from({ length: n }, () => ev({ type: "COPY_ATTEMPT" }))).score;
    // sum_{k<=n} 1/sqrt(k) sits between 2sqrt(n+1)-2 and 2sqrt(n)-1.
    for (const n of [4, 16, 64]) {
      expect(score(n)).toBeGreaterThanOrEqual(2 * Math.sqrt(n + 1) - 2 - 0.01);
      expect(score(n)).toBeLessThanOrEqual(2 * Math.sqrt(n) - 1 + 0.01);
    }
    // Quadrupling the count roughly doubles the score.
    expect(score(64) / score(16)).toBeGreaterThan(1.8);
    expect(score(64) / score(16)).toBeLessThan(2.2);
  });

  it("different types do not share the curve", () => {
    const r = run([ev({ type: "COPY_ATTEMPT" }), ev({ type: "PASTE_ATTEMPT" })]);
    expect(r.score).toBe(2);
  });
});

describe("durations", () => {
  it("adds nothing for the first minute", () => {
    const e = ev({ type: "FULLSCREEN_EXIT", startedAt: 0, endedAt: 60_000 });
    expect(run([e]).score).toBe(3);
  });

  it("adds weight per minute beyond the first, capped at three", () => {
    const twoMin = ev({ type: "FULLSCREEN_EXIT", startedAt: 0, endedAt: 120_000 });
    expect(run([twoMin]).score).toBe(6);
    const tenMin = ev({ type: "FULLSCREEN_EXIT", startedAt: 0, endedAt: 600_000 });
    expect(run([tenMin]).score).toBe(12);
  });

  it("ignores duration on non-interval types", () => {
    const e = ev({ type: "PHONE_DETECTED", startedAt: 0, endedAt: 600_000 });
    expect(run([e]).score).toBe(8);
  });

  it("measures open intervals to now only when now is given", () => {
    const e = ev({ type: "FULLSCREEN_EXIT", startedAt: 0, endedAt: null });
    e.endedAt = null;
    expect(computeIntegrity({ events: [e], reviews: {}, coverage: FULL }).score).toBe(3);
    expect(
      computeIntegrity({ events: [e], reviews: {}, coverage: FULL, now: 120_000 }).score,
    ).toBe(6);
  });
});

describe("reviews", () => {
  it("applies AI multipliers", () => {
    const e = ev({ type: "PHONE_DETECTED", id: "p" });
    expect(run([e], { p: "CONFIRMED" }).score).toBe(12);
    expect(run([e], { p: "NOT_CONFIRMED" }).score).toBe(2.4);
    expect(run([e], { p: "UNCLEAR" }).score).toBe(8);
  });

  it("accepts a Map of reviews too", () => {
    const e = ev({ type: "PHONE_DETECTED", id: "p" });
    const r = computeIntegrity({
      events: [e],
      reviews: new Map([["p", "CONFIRMED" as const]]),
      coverage: FULL,
    });
    expect(r.score).toBe(12);
  });

  it("a teacher dismissal weighs zero, whatever the AI said", () => {
    const e = ev({ type: "PHONE_DETECTED", id: "p", teacherStatus: "DISMISSED" });
    const r = run([e], { p: "CONFIRMED" });
    expect(r.score).toBe(0);
    expect(r.level).toBe("CLEAR");
    expect(r.reasons).toEqual([]);
    expect(r.openHigh).toBe(0);
  });

  it("a teacher confirmation weighs 1.5x and forces at least REVIEW", () => {
    const e = ev({ type: "COPY_ATTEMPT", id: "c", teacherStatus: "CONFIRMED" });
    const r = run([e], { c: "NOT_CONFIRMED" });
    expect(r.score).toBe(1.5);
    expect(r.level).toBe("REVIEW");
  });

  it("an open HIGH event the AI confirmed is at least REVIEW", () => {
    const e = ev({ type: "MULTIPLE_FACES", id: "x" });
    const r = run([e], { x: "CONFIRMED" });
    expect(r.score).toBe(12);
    expect(r.level).toBe("ATTENTION");
    expect(r.openHigh).toBe(1);
  });
});

describe("reasons", () => {
  it("lists the top three types by contribution with counts and durations", () => {
    const events = [
      ev({ type: "PHONE_DETECTED" }),
      ev({ type: "FOCUS_LOST", startedAt: 0, endedAt: 5_000 }),
      ev({ type: "FOCUS_LOST", startedAt: 10_000, endedAt: 13_000 }),
      ev({ type: "FULLSCREEN_EXIT" }),
      ev({ type: "COPY_ATTEMPT" }),
      ev({ type: "RESUMED" }),
    ];
    const r = run(events);
    expect(r.reasons.map((x) => x.type)).toEqual([
      "PHONE_DETECTED",
      "FULLSCREEN_EXIT",
      "FOCUS_LOST",
    ]);
    expect(r.reasons[2]).toEqual({ type: "FOCUS_LOST", count: 2, totalMs: 8_000 });
  });
});

describe("coverage", () => {
  it("lifts CLEAR to REVIEW for low camera coverage, missing model, unverified share", () => {
    expect(run([], {}, { ...FULL, cameraCoverage: 0.5 }).level).toBe("REVIEW");
    expect(run([], {}, { ...FULL, modelUnavailable: true }).level).toBe("REVIEW");
    expect(run([], {}, { ...FULL, shareUnverified: true }).level).toBe("REVIEW");
  });

  it("reports an unverifiable second screen without lifting the level", () => {
    const r = run([], {}, { ...FULL, secondScreenUnverifiable: true });
    expect(r.level).toBe("CLEAR");
    expect(r.coverageGaps).toEqual(["SECOND_SCREEN_UNVERIFIABLE"]);
  });

  it("never lifts to ATTENTION", () => {
    const worst: CoverageInput = {
      modelUnavailable: true,
      shareUnverified: true,
      secondScreenUnverifiable: true,
      cameraCoverage: 0,
    };
    const r = run([ev({ type: "PHONE_DETECTED" })], {}, worst);
    expect(r.level).toBe("REVIEW");
    expect(r.coverageGaps).toEqual([
      "MODEL_UNAVAILABLE",
      "SHARE_UNVERIFIED",
      "SECOND_SCREEN_UNVERIFIABLE",
      "LOW_CAMERA_COVERAGE",
    ]);
  });
});

describe("monotonicity", () => {
  // Small deterministic PRNG so failures reproduce.
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }
  const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const statuses = ["OPEN", "OPEN", "CONFIRMED", "DISMISSED"] as const;
  const verdicts = [undefined, "CONFIRMED", "NOT_CONFIRMED", "UNCLEAR"] as const;
  const severities: Severity[] = ["INFO", "LOW", "MEDIUM", "HIGH"];

  function randomEvent(r: () => number, i: number): [IntegrityEvent, AiVerdict | undefined] {
    const type = pick(r, ["FOCUS_LOST", "FOCUS_LOST", "NO_FACE", "PHONE_DETECTED", "COPY_ATTEMPT"] as const);
    const startedAt = Math.floor(r() * 3_600_000);
    const e: IntegrityEvent = {
      id: `r${i}`,
      type,
      severity: pick(r, severities),
      startedAt,
      endedAt: TAXONOMY[type].interval ? startedAt + Math.floor(r() * 400_000) : null,
      teacherStatus: pick(r, statuses),
    };
    return [e, pick(r, verdicts)];
  }

  it("adding an event never lowers the score or the level", () => {
    const rank = { CLEAR: 0, REVIEW: 1, ATTENTION: 2 };
    for (let trial = 0; trial < 300; trial++) {
      const r = rng(trial + 1);
      const n = 1 + Math.floor(r() * 12);
      const events: IntegrityEvent[] = [];
      const reviews: Record<string, AiVerdict> = {};
      for (let i = 0; i < n; i++) {
        const [e, v] = randomEvent(r, i);
        events.push(e);
        if (v) reviews[e.id] = v;
      }
      const before = run(events, reviews);
      const [extra, v] = randomEvent(r, 999);
      if (v) reviews[extra.id] = v;
      // Insert at a random position so order cannot matter either.
      const at = Math.floor(r() * (events.length + 1));
      const after = run([...events.slice(0, at), extra, ...events.slice(at)], reviews);
      expect(after.score).toBeGreaterThanOrEqual(before.score);
      expect(rank[after.level]).toBeGreaterThanOrEqual(rank[before.level]);
    }
  });

  it("covers every event type without throwing", () => {
    const events = PROCTOR_EVENT_TYPES.map((type) => ev({ type }));
    expect(() => run(events)).not.toThrow();
  });
});
