import { describe, expect, it } from "vitest";
import { BAND_CENTER } from "./cefr";
import { computeResult, poolPosteriors, type SectionEvidence } from "./result";

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
