import { describe, expect, it, vi } from "vitest";
import { CRITERIA_BY_SECTION } from "./cefr-descriptors";
import { RULE_MODEL, finishProposal, gradeAnswer, type GradingJob, type ModelCall } from "./grade-answer";
import { mergeProposals, speakingMetrics, type GradingProposal } from "./grading";
import type { ResultLevel } from "./types";

const TASK = "Ihr Freund Tim hat Ihnen eine Nachricht geschickt: „Hast du am Samstag Zeit? Wann kannst du kommen?“ Schreiben Sie Tim eine Antwort.";

const writing = (text: string, over: Partial<Extract<GradingJob, { section: "WRITING" }>> = {}): GradingJob => ({
  section: "WRITING",
  task: TASK,
  contentPoints: ["Zeit", "Uhrzeit"],
  register: "informell (du)",
  taskLevel: "A1",
  minWords: 20,
  maxWords: 40,
  text,
  rationaleLocale: "en",
  ...over,
});

const speaking = (transcript: string): GradingJob => ({
  section: "SPEAKING",
  task: "Stellen Sie sich bitte vor. Sprechen Sie über Name und Wohnort.",
  contentPoints: ["Name", "Wohnort"],
  taskLevel: "A1",
  transcript,
  metrics: speakingMetrics([{ text: "ich", startMs: 0, endMs: 400 }], 30_000),
  rationaleLocale: "en",
});

/** A model answer in the schema: every criterion at `level`, with the given overall level and flags. */
function modelJson(section: "WRITING" | "SPEAKING", level: ResultLevel, extra: { overall?: ResultLevel; flags?: string[]; evidence?: string[]; pronunciationLevel?: ResultLevel } = {}) {
  return JSON.stringify({
    criteria: CRITERIA_BY_SECTION[section].map((criterion) => ({
      criterion,
      level: criterion === "PRONUNCIATION" ? (extra.pronunciationLevel ?? level) : level,
      score: 3,
      assessable: criterion !== "PRONUNCIATION",
      rationale: "ok",
      evidence: criterion === "PRONUNCIATION" ? [] : (extra.evidence ?? []),
    })),
    overallLevel: extra.overall ?? level,
    summary: "s",
    flags: extra.flags ?? [],
  });
}

const reply = (text: string): ModelCall => vi.fn(async () => ({ text, model: "m", runId: "run-1" }));
const GOOD = "Hallo Tim, ich habe am Samstag Zeit. Ich komme um vier Uhr und bringe einen Salat mit. Bis dann! Viele Grüße, Elif";

describe("gradeAnswer: rules decide without a model", () => {
  it("proposes A0 for an empty answer and never calls the model", async () => {
    const call = reply("unused");
    const result = await gradeAnswer(writing(""), call);
    expect(call).not.toHaveBeenCalled();
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") return;
    expect(result.source).toBe("RULE");
    expect(result.rule).toBe("EMPTY");
    expect(result.level).toBe("A0");
    expect(result.model).toBe(RULE_MODEL);
    expect(result.runId).toBeNull();
    expect(result.calls).toBe(0);
    expect(result.proposal.flags).toEqual(["EMPTY"]);
  });

  it("proposes A0 for the task text handed back, for another language and for a few words", async () => {
    const call = reply("unused");
    const copied = await gradeAnswer(writing("Hast du am Samstag Zeit? Wann kannst du kommen? Schreiben Sie Tim eine Antwort."), call);
    const turkish = await gradeAnswer(writing("Merhaba Tim, davetin için çok teşekkür ederim. Cumartesi günü müsaitim ve geliyorum."), call);
    const few = await gradeAnswer(speaking("Ähm. Äh."), call);
    expect(call).not.toHaveBeenCalled();
    expect([copied, turkish, few].map((r) => r.status === "PROPOSED" && r.rule)).toEqual(["COPIED_TASK", "NOT_GERMAN", "FEW_WORDS"]);
    if (copied.status === "PROPOSED") expect(copied.proposal.flags).toEqual(["COPIED_TASK"]);
    if (few.status === "PROPOSED") expect(few.proposal.criteria.find((c) => c.criterion === "PRONUNCIATION")?.assessable).toBe(false);
  });

  it("writes the reason in the language of the job", async () => {
    const result = await gradeAnswer({ ...writing(""), rationaleLocale: "tr" }, reply("unused"));
    expect(result.status === "PROPOSED" && result.proposal.summary).toContain("Hiçbir metin");
  });
});

describe("gradeAnswer: the model proposes and the code checks", () => {
  it("returns the checked proposal, the raw one and the skill level from the criteria", async () => {
    const result = await gradeAnswer(writing(GOOD, { taskLevel: "B1" }), reply(modelJson("WRITING", "B1", { overall: "B2" })));
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") return;
    expect(result.source).toBe("MODEL");
    expect(result.model).toBe("m");
    expect(result.runId).toBe("run-1");
    expect(result.calls).toBe(1);
    // The skill level is the median of the criteria, not the model's overall judgement.
    expect(result.level).toBe("B1");
    expect(result.proposal.overallLevel).toBe("B2");
    expect(result.raw.overallLevel).toBe("B2");
  });

  it("caps criteria and overall at one level above the task", async () => {
    const result = await gradeAnswer(writing(GOOD), reply(modelJson("WRITING", "B1", { overall: "C1" })));
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") return;
    // A1 task: nothing above A2, for criteria and overall; the raw proposal keeps what the model said.
    expect(result.proposal.criteria.every((c) => c.level === "A2")).toBe(true);
    expect(result.proposal.overallLevel).toBe("A2");
    expect(result.proposal.flags).toContain("LEVEL_CAPPED");
    expect(result.raw.overallLevel).toBe("C1");
    expect(result.level).toBe("A2");
  });

  it("repairs one unusable answer and gives up after the second", async () => {
    const calls: string[][] = [];
    const flaky: ModelCall = async (messages) => {
      calls.push(messages.map((m) => m.role));
      return { text: calls.length === 1 ? "{bad" : modelJson("WRITING", "A2"), model: "m", runId: null };
    };
    const repaired = await gradeAnswer(writing(GOOD), flaky);
    expect(repaired.status === "PROPOSED" && repaired.calls).toBe(2);
    expect(calls[1]).toEqual(["system", "user", "assistant", "user"]);

    const never = await gradeAnswer(writing(GOOD), reply("{bad"));
    expect(never.status).toBe("UNPARSEABLE");
    if (never.status === "UNPARSEABLE") {
      expect(never.calls).toBe(2);
      expect(never.error).toContain("JSON");
    }
  });

  it("keeps A0 from the model only with the flag and no German sentence, otherwise raises it", async () => {
    const english = "I would like to come to your party on Saturday but I have no time at all because I must work.";
    // A model A0 for an English text is not reached through the model any more (the rule decides first)...
    const viaRule = await gradeAnswer(writing(english), reply("unused"));
    expect(viaRule.status === "PROPOSED" && viaRule.source).toBe("RULE");
    // ... and an A0 the model gives to a German answer without a flag is raised and marked.
    const raised = await gradeAnswer(writing(GOOD), reply(modelJson("WRITING", "A0")));
    expect(raised.status === "PROPOSED" && raised.proposal.overallLevel).toBe("A1");
    expect(raised.status === "PROPOSED" && raised.proposal.flags).toContain("A0_RAISED");
  });

  it("does not mark a non-assessable pronunciation as raised or capped", async () => {
    const result = await gradeAnswer(
      speaking("Ich heiße Ali und wohne in Berlin. Ich bin Student."),
      reply(modelJson("SPEAKING", "A1", { pronunciationLevel: "A0" })),
    );
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") return;
    expect(result.proposal.flags).not.toContain("A0_RAISED");
    expect(result.proposal.flags).not.toContain("LEVEL_CAPPED");
    expect(result.level).toBe("A1");
    expect(result.proposal.criteria.find((c) => c.criterion === "PRONUNCIATION")?.assessable).toBe(false);
  });

  it("sets TOO_SHORT itself, from the word count, and drops the model's", async () => {
    // 8 words against a minimum of 20: below half.
    const short = "Hallo Tim, ich habe Zeit. Ich komme gern.";
    const flagged = await gradeAnswer(writing(short), reply(modelJson("WRITING", "A1")));
    expect(flagged.status === "PROPOSED" && flagged.proposal.flags).toContain("TOO_SHORT");
    // 22 words: not too short, whatever the model says.
    const dropped = await gradeAnswer(writing(GOOD), reply(modelJson("WRITING", "A1", { flags: ["TOO_SHORT"] })));
    expect(dropped.status === "PROPOSED" && dropped.proposal.flags).not.toContain("TOO_SHORT");
    // A spoken answer has no minimum length: the flag is never kept from the model.
    const spoken = await gradeAnswer(speaking("Ich heiße Ali und wohne in Berlin. Ich bin Student."), reply(modelJson("SPEAKING", "A1", { flags: ["TOO_SHORT"] })));
    expect(spoken.status === "PROPOSED" && spoken.proposal.flags).not.toContain("TOO_SHORT");
  });

  it("drops quotes that are not in the answer and says so", async () => {
    const result = await gradeAnswer(writing(GOOD), reply(modelJson("WRITING", "A1", { evidence: ["Ich habe am Samstag Zeit", "Ich bin müde"] })));
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") return;
    expect(result.proposal.criteria[0].evidence).toEqual(["Ich habe am Samstag Zeit"]);
    expect(result.proposal.flags).toContain("EVIDENCE_UNVERIFIED");
  });
});

describe("finishProposal", () => {
  it("is the cap, the A0 guard, the evidence check and the length flag in one place", () => {
    const raw: GradingProposal = {
      criteria: CRITERIA_BY_SECTION.WRITING.map((criterion) => ({ criterion, level: "C1" as const, score: 4, assessable: true, rationale: "r", evidence: ["gibt es nicht"] })),
      overallLevel: "C1",
      summary: "s",
      flags: ["TOO_SHORT"],
    };
    const out = finishProposal(raw, writing(GOOD));
    expect(out.overallLevel).toBe("A2");
    expect(out.flags).toEqual(expect.arrayContaining(["EVIDENCE_UNVERIFIED", "LEVEL_CAPPED"]));
    expect(out.flags).not.toContain("TOO_SHORT");
    expect(raw.flags).toEqual(["TOO_SHORT"]); // pure
  });
});

describe("several answers of the model, merged by median", () => {
  const proposal = (level: ResultLevel, over: Partial<GradingProposal> = {}): GradingProposal => ({
    criteria: CRITERIA_BY_SECTION.WRITING.map((criterion) => ({ criterion, level, score: 3, assessable: true, rationale: `r ${level}`, evidence: [] })),
    overallLevel: level,
    summary: `s ${level}`,
    flags: [],
    ...over,
  });

  it("takes the lower median per criterion and overall, and the wording of an answer that gave it", () => {
    const merged = mergeProposals([proposal("B2"), proposal("B1"), proposal("B1")]);
    expect(merged.overallLevel).toBe("B1");
    expect(merged.criteria.every((c) => c.level === "B1" && c.rationale === "r B1")).toBe(true);
    expect(merged.summary).toBe("s B1");
    // Two answers: the lower middle, so a disagreement errs on the side of not over-placing.
    expect(mergeProposals([proposal("B2"), proposal("B1")]).overallLevel).toBe("B1");
  });

  it("keeps a flag only when most answers raised it, and a single answer unchanged", () => {
    const merged = mergeProposals([proposal("B1", { flags: ["OFF_TOPIC"] }), proposal("B1", { flags: ["OFF_TOPIC", "NOT_GERMAN"] }), proposal("B1")]);
    expect(merged.flags).toEqual(["OFF_TOPIC"]);
    const one = proposal("A2");
    expect(mergeProposals([one])).toBe(one);
    expect(() => mergeProposals([])).toThrow();
  });

  it("calls the model once per sample, at the same time, and returns the median level", async () => {
    const levels: ResultLevel[] = ["B2", "B1", "B1"];
    let started = 0;
    let concurrent = 0;
    let peak = 0;
    const call: ModelCall = async () => {
      const text = modelJson("WRITING", levels[started++ % 3]);
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return { text, model: "m", runId: "r" };
    };
    const result = await gradeAnswer(writing(GOOD, { taskLevel: "B2" }), call, { samples: 3 });
    expect(result.status === "PROPOSED" && result.level).toBe("B1");
    expect(result.status === "PROPOSED" && result.calls).toBe(3);
    expect(peak).toBe(3);
  });

  it("goes on with the answers that parse, and with the repair attempt when none does", async () => {
    let n = 0;
    const oneBad: ModelCall = async () => ({ text: n++ === 0 ? "{bad" : modelJson("WRITING", "B1"), model: "m", runId: null });
    const merged = await gradeAnswer(writing(GOOD, { taskLevel: "B1" }), oneBad, { samples: 3 });
    expect(merged.status === "PROPOSED" && merged.level).toBe("B1");

    let k = 0;
    const allBadThenGood: ModelCall = async () => ({ text: k++ < 3 ? "{bad" : modelJson("WRITING", "A2"), model: "m", runId: null });
    const repaired = await gradeAnswer(writing(GOOD), allBadThenGood, { samples: 3 });
    expect(repaired.status === "PROPOSED" && repaired.level).toBe("A2");
    expect(repaired.status === "PROPOSED" && repaired.calls).toBe(4);
  });

  it("survives one failed call and throws when every call fails", async () => {
    let n = 0;
    const flaky: ModelCall = async () => {
      if (n++ === 1) throw new Error("503");
      return { text: modelJson("WRITING", "A2"), model: "m", runId: null };
    };
    const ok = await gradeAnswer(writing(GOOD), flaky, { samples: 3 });
    expect(ok.status).toBe("PROPOSED");
    const down: ModelCall = async () => {
      throw new Error("provider down");
    };
    await expect(gradeAnswer(writing(GOOD), down, { samples: 3 })).rejects.toThrow("provider down");
  });
});
