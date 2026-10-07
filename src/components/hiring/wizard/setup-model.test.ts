import { describe, expect, it } from "vitest";
import { activity, content, stage } from "@/solutions/hiring/rules/test-fixtures";
import { aiCodeKey, candidatePreview, membersOf, publishRules, rulesChanged, scorecardLine, setupHref, teamChoiceOf, wizardNext } from "./setup-model";

const ME = "me";
const saved = {
  name: "Sürüş eğitmeni · Ekim",
  memberIds: [ME],
  decisionMakerId: ME,
  backupDecisionMakerId: null,
  blindMode: false,
  deadline: null,
  feedbackDays: 7,
  candidateContactEmail: "",
  finishSurveyEnabled: false,
};

describe("the wizard's way in from the overview and the openings list (HIRING-UX 5.20)", () => {
  it("opens the questions while the assessment, its anchors or its weights are open, the publish step otherwise", () => {
    expect(setupHref("o1")).toBe("/hiring/openings/o1/setup#questions");
    expect(wizardNext("o1", [{ key: "assessment", state: "missing" }, { key: "team", state: "advisory" }])).toBe("/hiring/openings/o1/setup#questions");
    expect(wizardNext("o1", [{ key: "assessment", state: "done" }, { key: "anchors", state: "missing" }])).toBe("/hiring/openings/o1/setup#questions");
    expect(wizardNext("o1", [{ key: "assessment", state: "done" }, { key: "weights", state: "missing" }])).toBe("/hiring/openings/o1/setup#questions");
    expect(wizardNext("o1", [{ key: "assessment", state: "done" }, { key: "anchors", state: "done" }, { key: "team", state: "advisory" }, { key: "preview", state: "advisory" }])).toBe(
      "/hiring/openings/o1/setup#publish",
    );
  });
});

describe("step 2's scorecard line", () => {
  it("says the measured count and 'equal' unless weighting is on with different weights", () => {
    expect(scorecardLine({ measured: 5, weightsEnabled: false, weights: { a: 50, b: 50 } })).toEqual({ count: 5, weights: "equal" });
    expect(scorecardLine({ measured: 2, weightsEnabled: true, weights: { a: 50, b: 50 } })).toEqual({ count: 2, weights: "equal" });
    expect(scorecardLine({ measured: 2, weightsEnabled: true, weights: { a: 70, b: 30 } })).toEqual({ count: 2, weights: "custom" });
    expect(scorecardLine({ measured: 0, weightsEnabled: true, weights: null })).toEqual({ count: 0, weights: "equal" });
  });
});

describe("step 3's short candidate preview", () => {
  it("names each stage in order with its minutes and question count, and the totals", () => {
    const c = content([
      stage("s2", [activity("a3")], { orderIndex: 1, name: { tr: "Vaka", en: "Case" }, durationSeconds: 600 }),
      stage("s1", [activity("a1"), activity("a2", { orderIndex: 1 })], { orderIndex: 0, name: { tr: "Tanışma", en: "Intro" }, durationSeconds: 300 }),
    ]);
    expect(candidatePreview(c, "tr")).toEqual({
      stages: [
        { id: "s1", name: "Tanışma", minutes: 5, questions: 2 },
        { id: "s2", name: "Vaka", minutes: 10, questions: 1 },
      ],
      minutes: 15,
      questions: 3,
    });
  });
});

describe("step 3's team and rules", () => {
  it("'Sadece sen' is the manager alone; 'Kişi ekle' keeps the manager and adds the others", () => {
    expect(teamChoiceOf([ME], ME)).toEqual({ solo: true, others: [] });
    expect(teamChoiceOf([], ME)).toEqual({ solo: true, others: [] });
    expect(teamChoiceOf([ME, "x"], ME)).toEqual({ solo: false, others: ["x"] });
    expect(membersOf({ solo: true, others: ["x"] }, ME)).toEqual([ME]);
    expect(membersOf({ solo: false, others: ["x", ME] }, ME)).toEqual([ME, "x"]);
  });

  it("saves only what changed: the defaults publish without a save", () => {
    const same = publishRules(saved, { team: { solo: true, others: [] }, me: ME, deadline: "", blindMode: false, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false });
    expect(rulesChanged(saved, same)).toBe(false);
    const withDeadline = publishRules(saved, { team: { solo: true, others: [] }, me: ME, deadline: "2026-11-01", blindMode: false, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false });
    expect(withDeadline.deadline).toBe("2026-11-01");
    expect(rulesChanged(saved, withDeadline)).toBe(true);
    const withPeople = publishRules(saved, { team: { solo: false, others: ["x"] }, me: ME, deadline: "", blindMode: false, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false });
    expect(withPeople.memberIds).toEqual([ME, "x"]);
    expect(rulesChanged(saved, withPeople)).toBe(true);
  });

  it("keeps the saved decider, and makes the manager the decider when none is set", () => {
    expect(publishRules({ ...saved, decisionMakerId: "boss" }, { team: { solo: true, others: [] }, me: ME, deadline: "", blindMode: false, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false }).decisionMakerId).toBe("boss");
    expect(publishRules({ ...saved, decisionMakerId: null }, { team: { solo: true, others: [] }, me: ME, deadline: "", blindMode: false, feedbackDays: 7, candidateContactEmail: "", finishSurveyEnabled: false }).decisionMakerId).toBe(ME);
  });
});

describe("the AI refusals' sentences", () => {
  it("names the unconnected AI and the limit plainly, everything else as a failure to retry", () => {
    expect(aiCodeKey("UNCONFIGURED")).toBe("aiUnconfigured");
    expect(aiCodeKey("RATE_LIMITED")).toBe("aiRateLimited");
    expect(aiCodeKey("FORBIDDEN")).toBe("aiForbidden");
    expect(aiCodeKey("CLOSED")).toBe("aiClosed");
    expect(aiCodeKey("JOB_AD_TOO_SHORT")).toBe("aiNoAd");
    expect(aiCodeKey("SCHEMA_FAILED")).toBe("aiFailed");
    expect(aiCodeKey("PROVIDER_FAILED")).toBe("aiFailed");
    expect(aiCodeKey("JOB_AD_TOO_LONG")).toBe("aiAdTooLong");
    expect(aiCodeKey("CHOICE_QUESTION")).toBe("aiChoice");
    expect(aiCodeKey("UNDO_EXPIRED")).toBe("undoFailed");
    expect(aiCodeKey("NO_DRAFT")).toBe("aiNoDraft");
  });
});
