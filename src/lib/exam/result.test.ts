import { describe, expect, it } from "vitest";
import { BAND_CENTER } from "./cefr";
import { autoFinalizes, computeResult, isUncertainResult, poolPosteriors, studentWaitingFor, type SectionEvidence } from "./result";

const rules = { overallAtLeastClaimed: true, minSkillOffset: -1, requiredSkills: [], minHoldProbability: 0.5 };
const obj = (section: "GRAMMAR" | "READING" | "LISTENING", mean: number, sd = 0.4): SectionEvidence => ({
  section,
  kind: "OBJECTIVE",
  posterior: { mean, sd },
  answered: 12,
  insufficient: false,
});
const prod = (section: "WRITING" | "SPEAKING", level: "B1" | "B2" | "A2" | null, decider: "AI" | "TEACHER" | null = "AI"): SectionEvidence => ({
  section,
  kind: "PRODUCTIVE",
  level,
  decider: level ? decider : null,
});

describe("pooling", () => {
  it("weights by precision", () => {
    const p = poolPosteriors([{ mean: 0, sd: 0.5 }, { mean: 1, sd: 0.5 }])!;
    expect(p.mean).toBeCloseTo(0.5, 6);
    expect(p.sd).toBeCloseTo(Math.sqrt(0.125), 6);
  });
});

describe("placement", () => {
  it("takes the lower median of the skills", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.B2), obj("READING", BAND_CENTER.B1), prod("WRITING", "B1", "TEACHER"), prod("SPEAKING", "B2", "TEACHER")],
    });
    expect(r.overall).toBe("B1");
    expect(r.status).toBe("READY");
    expect(r.verification).toBe(null);
  });

  it("waits for grading before giving an overall level", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", 0), prod("WRITING", null)] });
    expect(r.overall).toBe(null);
    expect(r.status).toBe("AWAITING_GRADING");
  });

  it("asks for a teacher while a level is only an AI proposal", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", 0), prod("WRITING", "B1")] });
    expect(r.status).toBe("AWAITING_REVIEW");
  });

  it("applies teacher overrides", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.A2), prod("WRITING", "B1")],
      overrides: { skills: { WRITING: "A2" }, overall: "B1" },
    });
    expect(r.skills.WRITING).toMatchObject({ level: "A2", decider: "TEACHER" });
    expect(r.overall).toBe("B1");
    expect(r.status).toBe("READY");
  });
});

describe("verification", () => {
  it("passes a student who holds the claim", () => {
    const r = computeResult({
      mode: "LEVEL_VERIFICATION",
      claimed: "B1",
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.B1 + 0.3), obj("READING", BAND_CENTER.B2), prod("WRITING", "B1", "TEACHER")],
    });
    expect(r.verification!.outcome).toBe("PASS");
    expect(r.verification!.holdProbability!).toBeGreaterThan(0.5);
  });

  it("fails with named reasons", () => {
    const r = computeResult({
      mode: "LEVEL_VERIFICATION",
      claimed: "B2",
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.A2), obj("READING", BAND_CENTER.B1), prod("WRITING", "A2", "TEACHER")],
    });
    expect(r.verification!.outcome).toBe("FAIL");
    expect(r.verification!.reasons).toContain("OVERALL_BELOW_CLAIMED");
    expect(r.verification!.reasons).toContain("SKILL_BELOW:GRAMMAR");
    expect(r.verification!.reasons).toContain("HOLD_PROBABILITY_LOW");
  });

  it("is inconclusive while grading is pending or evidence is thin", () => {
    const pending = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "B1", rules, sections: [obj("GRAMMAR", -3), prod("WRITING", null)] });
    expect(pending.verification!.outcome).toBe("INCONCLUSIVE");
    const thin = computeResult({
      mode: "LEVEL_VERIFICATION",
      claimed: "B1",
      rules,
      sections: [{ ...(obj("GRAMMAR", 1) as Extract<SectionEvidence, { kind: "OBJECTIVE" }>), insufficient: true }],
    });
    expect(thin.verification!.reasons).toEqual(["INSUFFICIENT_EVIDENCE"]);
  });
});

describe("A0 (Pre-A1)", () => {
  const productive = (section: "WRITING" | "SPEAKING", level: "A0" | "A1" | "A2" | "B1"): SectionEvidence => ({ section, kind: "PRODUCTIVE", level, decider: "TEACHER" });

  it("gives A0 to an objective section below the A1 band", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", -3.4, 0.4)] });
    expect(r.skills.GRAMMAR?.level).toBe("A0");
    expect(r.overall).toBe("A0");
    // The A1 band itself stays A1.
    expect(computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", -2.9, 0.4)] }).overall).toBe("A1");
  });

  it("keeps the A1 floor when the section stopped short of its minimum (thin evidence)", () => {
    const thin = { ...(obj("GRAMMAR", -3.8) as Extract<SectionEvidence, { kind: "OBJECTIVE" }>), insufficient: true };
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [thin] });
    expect(r.skills.GRAMMAR?.level).toBe("A1");
    expect(r.skills.GRAMMAR?.insufficient).toBe(true);
    expect(r.placement?.sublevel).toBe("A1.1");
  });

  it("takes A0 into the lower median of the skills like any level", () => {
    const sections = [obj("GRAMMAR", -3.4), obj("READING", -2.9), obj("LISTENING", -2.9), productive("WRITING", "A0"), productive("SPEAKING", "A0")];
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections });
    expect(Object.values(r.skills).map((s) => s!.level)).toEqual(["A0", "A1", "A1", "A0", "A0"]);
    expect(r.overall).toBe("A0");
    const one = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", BAND_CENTER.A2), obj("READING", BAND_CENTER.A2), productive("WRITING", "A0")] });
    expect(one.overall).toBe("A2");
  });

  it("lets a teacher set A0 on a skill or the overall level", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.A1), productive("WRITING", "A1")],
      overrides: { skills: { WRITING: "A0" }, overall: "A0" },
    });
    expect(r.skills.WRITING).toMatchObject({ level: "A0", decider: "TEACHER" });
    expect(r.overall).toBe("A0");
  });

  it("is below any claimed level: a verification fails as for any level below the claim", () => {
    const r = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "A1", rules, sections: [obj("GRAMMAR", -3.6, 0.3), productive("WRITING", "A0")] });
    expect(r.overall).toBe("A0");
    expect(r.verification!.outcome).toBe("FAIL");
    expect(r.verification!.reasons).toContain("OVERALL_BELOW_CLAIMED");
    // The skill floor for an A1 claim with offset -1 is A1 (no CEFR level below it): A0 is under it.
    expect(r.verification!.reasons).toContain("SKILL_BELOW:GRAMMAR");
    expect(r.verification!.reasons).toContain("SKILL_BELOW:WRITING");
    expect(r.verification!.reasons).toContain("HOLD_PROBABILITY_LOW");
  });

  it("puts a placement just below the A1 band near the A0/A1 cut, so a teacher decides", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", -3.1, 0.3), obj("READING", -3.1, 0.3)] });
    expect(r.overall).toBe("A0");
    expect(r.placement).toMatchObject({ sublevel: "A1.1", borderline: true, reasons: ["NEAR_CUT"], recommended: "A0" });
    expect(isUncertainResult(r)).toBe(true);
    // Far enough below the cut and precise: a clear A0 that may finalize by itself.
    const clear = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [obj("GRAMMAR", -3.6, 0.3), obj("READING", -3.6, 0.3)] });
    expect(clear.overall).toBe("A0");
    expect(clear.placement?.borderline).toBe(false);
    expect(isUncertainResult(clear)).toBe(false);
  });
});

describe("placement sublevel and borderline", () => {
  it("adds the sublevel from the pooled posterior", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", -0.65, 0.4), obj("READING", -0.55, 0.4), prod("WRITING", "B1", "TEACHER")],
    });
    expect(r.placement).toEqual({ sublevel: "B1.1", borderline: false, reasons: [], recommended: null });
  });

  it("flags a productive skill a band away, using the teacher's level", () => {
    const r = computeResult({
      mode: "PLACEMENT",
      claimed: null,
      rules,
      sections: [obj("GRAMMAR", BAND_CENTER.B2), prod("SPEAKING", "B2", "AI")],
      overrides: { skills: { SPEAKING: "A2" } },
    });
    expect(r.placement!.borderline).toBe(true);
    expect(r.placement!.reasons).toEqual(["PRODUCTIVE_GAP:SPEAKING"]);
    expect(r.placement!.recommended).toBe("A2");
  });

  it("is null without objective evidence", () => {
    const r = computeResult({ mode: "PLACEMENT", claimed: null, rules, sections: [prod("WRITING", "B1", "TEACHER")] });
    expect(r.placement).toBe(null);
  });

  it("leaves a verification untouched", () => {
    const r = computeResult({
      mode: "LEVEL_VERIFICATION",
      claimed: "B1",
      rules,
      sections: [obj("GRAMMAR", 0.05), prod("WRITING", "A2", "TEACHER")],
    });
    expect(r.placement).toBe(null);
    expect(r.verification!.outcome).toBe("FAIL");
  });
});

describe("uncertain results go to a teacher", () => {
  const place = (sections: SectionEvidence[]) => computeResult({ mode: "PLACEMENT", claimed: null, rules, sections });
  const flow = { status: "AWAITING_REVIEW", hasProductive: false, anyUndecided: false, clean: true };
  // Tight posteriors in the middle of a band: clear.
  const clear = place([obj("GRAMMAR", BAND_CENTER.B1, 0.3), obj("READING", BAND_CENTER.B1, 0.3)]);
  // Right at the B1/B2 cut: borderline.
  const nearCut = place([obj("GRAMMAR", 0.05, 0.3), obj("READING", 0.05, 0.3)]);
  // Wide posteriors (few usable answers): HIGH_UNCERTAINTY.
  const imprecise = place([obj("GRAMMAR", BAND_CENTER.B2, 1.2), obj("READING", BAND_CENTER.B2, 1.2)]);

  it("treats a clear result as certain, and an objective-only exam finalizes by itself", () => {
    expect(clear.placement?.borderline).toBe(false);
    expect(isUncertainResult(clear)).toBe(false);
    expect(autoFinalizes({ ...flow, computed: clear })).toBe(true);
    expect(studentWaitingFor({ hasProductive: false, final: false, computed: clear })).toBe(null);
  });

  it("holds a borderline result for the teacher", () => {
    expect(nearCut.placement?.reasons).toContain("NEAR_CUT");
    expect(isUncertainResult(nearCut)).toBe(true);
    expect(autoFinalizes({ ...flow, computed: nearCut })).toBe(false);
  });

  it("holds an imprecise result (HIGH_UNCERTAINTY) for the teacher", () => {
    expect(imprecise.placement?.reasons).toContain("HIGH_UNCERTAINTY");
    expect(autoFinalizes({ ...flow, computed: imprecise })).toBe(false);
  });

  it("holds a result whose recommended level differs from the computed level", () => {
    const c = { overall: "B2" as const, placement: { sublevel: "B2.1", borderline: false, reasons: [], recommended: "B1" as const } };
    expect(isUncertainResult(c)).toBe(true);
    expect(autoFinalizes({ ...flow, computed: c })).toBe(false);
  });

  it("still needs every other condition to auto-finalize", () => {
    expect(autoFinalizes({ ...flow, hasProductive: true, computed: clear })).toBe(false);
    expect(autoFinalizes({ ...flow, anyUndecided: true, computed: clear })).toBe(false);
    expect(autoFinalizes({ ...flow, clean: false, computed: clear })).toBe(false);
    expect(autoFinalizes({ ...flow, status: "AWAITING_GRADING", computed: clear })).toBe(false);
  });

  it("level verification has no placement flag and is unchanged", () => {
    const v = computeResult({ mode: "LEVEL_VERIFICATION", claimed: "B1", rules, sections: [obj("GRAMMAR", 0.05, 1.2)] });
    expect(isUncertainResult(v)).toBe(false);
  });

  it("tells the student a teacher is reviewing, only while not final", () => {
    expect(studentWaitingFor({ hasProductive: false, final: false, computed: nearCut })).toBe("REVIEW");
    expect(studentWaitingFor({ hasProductive: false, final: true, computed: nearCut })).toBe(null);
    expect(studentWaitingFor({ hasProductive: true, final: false, computed: clear })).toBe("PRODUCTIVE");
    expect(studentWaitingFor({ hasProductive: true, final: true, computed: clear })).toBe(null);
  });
});
