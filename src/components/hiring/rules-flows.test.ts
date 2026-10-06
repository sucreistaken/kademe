import { describe, expect, it } from "vitest";
import type { OpeningRulesInput, RulesProblem } from "@/solutions/hiring/rules/opening-rules";
import { flowHashFix, flowStepOf } from "@/components/manager/flow-model";
import { FLOW_FIELDS, REVIEW_STEP, RULES_ENTRY, RULES_FLOWS, firstInvalidStep, flowOfStep, otherFlowProblem, rulesNavMode, rulesPath, rulesRoute, rulesStepOf, saveInput, stepWait, teamLine } from "./rules-flows";

const users = [
  { id: "owner", role: "OWNER" as const, disabled: false },
  { id: "rev", role: "REVIEWER" as const, disabled: false },
  { id: "gone", role: "MANAGER" as const, disabled: true },
];
const saved: OpeningRulesInput = {
  name: "Tasarımcı · Ekim",
  memberIds: ["rev"],
  decisionMakerId: "owner",
  backupDecisionMakerId: null,
  minEvaluations: 1,
  blindMode: false,
  deadline: "2026-10-31",
  feedbackDays: 7,
  candidateContactEmail: "",
  finishSurveyEnabled: true,
};
const check = { users, today: "2026-10-06", savedDeadline: saved.deadline };

describe("team and rules as four short flows (4.10, D10)", () => {
  it("opens a flow's step from the hash; any other hash is the summary", () => {
    expect(rulesRoute("#team-decider")).toEqual({ flow: "team", step: "team-decider" });
    expect(rulesRoute("#contact-review")).toEqual({ flow: "contact", step: "contact-review" });
    expect(rulesRoute("#name")).toEqual({ flow: "name", step: "name" });
    expect(rulesRoute("")).toBeNull();
    expect(rulesRoute("#publish")).toBeNull();
    expect(flowOfStep("fair-survey")).toBe("fair");
  });

  it("every hash another page links to is a step of a flow, so the link lands on it (Task 19 carry)", () => {
    // The overview's rules and publish summary, the setup path and the control view link here.
    expect(rulesRoute("#team-members")).toEqual({ flow: "team", step: "team-members" });
    expect(rulesRoute("#team-decider")).toEqual({ flow: "team", step: "team-decider" });
    expect(rulesRoute("#contact-deadline")).toEqual({ flow: "contact", step: "contact-deadline" });
  });

  it("a flow's first step keeps its hash (no hash is the summary here), and a link past a waiting step is rewritten to it", () => {
    for (const hash of ["#team-members", "#contact-deadline", "#fair-blind", "#name"]) {
      const route = rulesRoute(hash)!;
      const path = rulesPath(route.flow);
      const shown = flowStepOf(hash, { steps: path, firstInvalid: null });
      expect(shown).toBe(route.step);
      expect(flowHashFix(hash, shown, path[0])).toBeNull();
    }
    expect(rulesPath("team")[0]).toBe(RULES_ENTRY);
    const stop = firstInvalidStep("team", { ...saved, decisionMakerId: null }, check);
    const shown = flowStepOf("#team-review", { steps: rulesPath("team"), firstInvalid: stop });
    expect(shown).toBe("team-decider");
    expect(flowHashFix("#team-review", shown, RULES_ENTRY)).toBe("#team-decider");
  });

  it("only an open flow owns the address: the summary keeps the flow's step in memory and never rewrites the hash", () => {
    expect(rulesNavMode(null)).toBe("memory");
    expect(rulesNavMode({ flow: "contact" })).toBe("hash");
  });

  it("puts every rules problem on the step that fixes it (W8)", () => {
    const all: RulesProblem[] = ["NAME_REQUIRED", "MEMBER_UNKNOWN", "DECISION_MAKER_REQUIRED", "DECISION_MAKER_ROLE", "BACKUP_SAME", "BACKUP_ROLE", "MIN_EVALUATIONS", "DEADLINE_INVALID", "DEADLINE_PAST", "FEEDBACK_DAYS", "EMAIL"];
    expect(Object.fromEntries(all.map((p) => [p, rulesStepOf(p)]))).toEqual({
      NAME_REQUIRED: "name",
      MEMBER_UNKNOWN: "team-members",
      DECISION_MAKER_REQUIRED: "team-decider",
      DECISION_MAKER_ROLE: "team-decider",
      BACKUP_SAME: "team-decider",
      BACKUP_ROLE: "team-decider",
      MIN_EVALUATIONS: "team-min",
      DEADLINE_INVALID: "contact-deadline",
      DEADLINE_PAST: "contact-deadline",
      FEEDBACK_DAYS: "contact-feedback",
      EMAIL: "contact-email",
    });
    // No field belongs to two flows; twelve steps in all (three summaries among them).
    expect(Object.values(FLOW_FIELDS).flat()).toHaveLength(new Set(Object.values(FLOW_FIELDS).flat()).size);
    expect(Object.values(RULES_FLOWS).flat()).toHaveLength(12);
    // Each flow ends on its own save step.
    for (const flow of Object.keys(RULES_FLOWS) as Array<keyof typeof RULES_FLOWS>) expect(RULES_FLOWS[flow].at(-1)).toBe(REVIEW_STEP[flow]);
  });

  it("lets a step's 'Devam et' wait only for its own fields' problems, in the existing rules' words", () => {
    const value = { ...saved, decisionMakerId: "gone", feedbackDays: 0 };
    expect(stepWait("team-decider", value, check)).toBe("DECISION_MAKER_ROLE");
    expect(stepWait("team-members", value, check)).toBeNull();
    expect(stepWait("contact-feedback", value, check)).toBe("FEEDBACK_DAYS");
    // A passed deadline left as it is stays valid; a changed one may not be in the past.
    expect(stepWait("contact-deadline", { ...saved, deadline: "2026-10-01" }, { ...check, savedDeadline: "2026-10-01" })).toBeNull();
    expect(stepWait("contact-deadline", { ...saved, deadline: "2026-10-01" }, check)).toBe("DEADLINE_PAST");
  });

  it("never lets a link skip a step that waits", () => {
    expect(firstInvalidStep("team", { ...saved, decisionMakerId: null }, check)).toBe("team-decider");
    expect(firstInvalidStep("team", saved, check)).toBeNull();
    expect(firstInvalidStep("contact", { ...saved, candidateContactEmail: "x@" }, check)).toBe("contact-email");
    // A member who left stops the team at its first step, before the decider.
    expect(firstInvalidStep("team", { ...saved, memberIds: ["rev", "gone"], decisionMakerId: null }, check)).toBe("team-members");
  });

  it("sends the flow's own fields as chosen and every other field as loaded (pass-through)", () => {
    const value = { ...saved, name: "Yeni ad", memberIds: ["rev", "owner"], feedbackDays: 14, blindMode: true };
    expect(saveInput(saved, value, "contact")).toEqual({ ...saved, feedbackDays: 14 });
    expect(saveInput(saved, value, "team")).toEqual({ ...saved, memberIds: ["rev", "owner"] });
    expect(saveInput(saved, value, "fair")).toEqual({ ...saved, blindMode: true });
    expect(saveInput(saved, value, "name")).toEqual({ ...saved, name: "Yeni ad" });
  });

  it("names a problem of another flow, which the save waits for and opens there (D10's cost)", () => {
    expect(otherFlowProblem(["DECISION_MAKER_ROLE"], "contact")).toBe("DECISION_MAKER_ROLE");
    expect(otherFlowProblem(["EMAIL", "DECISION_MAKER_ROLE"], "contact")).toBe("DECISION_MAKER_ROLE");
    expect(otherFlowProblem(["DECISION_MAKER_ROLE"], "team")).toBeNull();
    expect(otherFlowProblem([], "fair")).toBeNull();
  });

  it("the team line names a decider only while active and able to decide, and counts active members (Task 20 rule)", () => {
    const people = [
      { id: "owner", name: "Kadir Ay", role: "OWNER" as const, disabled: false },
      { id: "rev", name: "Ece Yıldız", role: "REVIEWER" as const, disabled: false },
      { id: "gone", name: "Mert Öz", role: "MANAGER" as const, disabled: true },
    ];
    expect(teamLine({ memberIds: ["rev", "gone"], decisionMakerId: "owner", backupDecisionMakerId: "gone" }, people)).toEqual({ count: 1, decider: "Kadir Ay", backup: null });
    expect(teamLine({ memberIds: ["rev"], decisionMakerId: "gone", backupDecisionMakerId: null }, people)).toEqual({ count: 1, decider: null, backup: null });
    // A reviewer can be on the team but never decides.
    expect(teamLine({ memberIds: [], decisionMakerId: "rev", backupDecisionMakerId: null }, people)).toEqual({ count: 0, decider: null, backup: null });
  });
});
