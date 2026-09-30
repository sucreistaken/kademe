import { describe, expect, it } from "vitest";
import { toGeminiSchema } from "@/lib/ai";
import {
  GRADING_JSON_SCHEMA,
  PRONUNCIATION_NOT_ASSESSABLE,
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  countWords,
  emptyAnswerReason,
  parseGradingAnswer,
  skillLevelFromCriteria,
  speakingMetrics,
  verifyEvidence,
  type GradingProposal,
} from "./grading";
import { CRITERIA_BY_SECTION, DESCRIPTORS, CRITERIA } from "./cefr-descriptors";
import { CEFR_LEVELS, type Cefr } from "./types";

const EM_DASH = "\u2014";

function proposal(levels: Partial<Record<string, Cefr>>, overall: Cefr = "B1"): GradingProposal {
  return {
    criteria: Object.entries(levels).map(([criterion, level]) => ({
      criterion: criterion as GradingProposal["criteria"][number]["criterion"],
      level: level!,
      score: 3,
      assessable: true,
      rationale: "ok",
      evidence: [],
    })),
    overallLevel: overall,
    summary: "s",
    flags: [],
  };
}

function answerJson(criteria: string[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    criteria: criteria.map((criterion) => ({
      criterion,
      level: "B1",
      score: 3,
      assessable: true,
      rationale: "  fine  ",
      evidence: ["a", "b", "c", "d", "e", "f"],
    })),
    overallLevel: "B1",
    summary: " sum ",
    flags: ["OFF_TOPIC", "LEVEL_CAPPED", "OFF_TOPIC"],
    ...extra,
  });
}

describe("descriptors", () => {
  it("has one line for every criterion and level, without em dash", () => {
    for (const c of CRITERIA)
      for (const l of CEFR_LEVELS) {
        expect(DESCRIPTORS[c][l].length).toBeGreaterThan(10);
        expect(DESCRIPTORS[c][l]).not.toContain("\n");
        expect(DESCRIPTORS[c][l]).not.toContain(EM_DASH);
      }
  });
});

describe("verifyEvidence", () => {
  const source = "Liebe Anna, ich komme am Samstag gern zu deiner Party! Leider habe ich kein Auto.";

  it("keeps real quotes despite case and punctuation and drops invented ones", () => {
    const p = proposal({ ACCURACY: "B1" });
    p.criteria[0].evidence = [
      "„Ich komme am Samstag gern zu deiner Party“",
      "leider habe ich   kein Auto",
      "Ich habe keinen Führerschein",
    ];
    const out = verifyEvidence(p, source);
    expect(out.criteria[0].evidence).toEqual([
      "„Ich komme am Samstag gern zu deiner Party“",
      "leider habe ich   kein Auto",
    ]);
    expect(out.flags).toContain("EVIDENCE_UNVERIFIED");
    expect(p.criteria[0].evidence).toHaveLength(3); // pure
  });

  it("adds no flag when every quote is real", () => {
    const p = proposal({ ACCURACY: "B1" });
    p.criteria[0].evidence = ["Liebe Anna,"];
    expect(verifyEvidence(p, source).flags).toEqual([]);
  });

  it("matches across NFC and NFD forms", () => {
    const p = proposal({ RANGE: "B1" });
    p.criteria[0].evidence = ["schöne Grüße"];
    expect(verifyEvidence(p, "Viele scho\u0308ne Gru\u0308ße").criteria[0].evidence).toHaveLength(1);
  });
});

describe("capByTaskLevel", () => {
  it("caps criteria and overall to one above the task level", () => {
    const out = capByTaskLevel(proposal({ RANGE: "C1", ACCURACY: "B1" }, "C2"), "A2");
    expect(out.criteria.map((c) => c.level)).toEqual(["B1", "B1"]);
    expect(out.overallLevel).toBe("B1");
    expect(out.flags).toEqual(["LEVEL_CAPPED"]);
  });

  it("leaves a proposal within the ceiling alone", () => {
    const out = capByTaskLevel(proposal({ RANGE: "B2" }, "B2"), "B1");
    expect(out.flags).toEqual([]);
    expect(out.overallLevel).toBe("B2");
  });

  it("cannot go above C2", () => {
    expect(capByTaskLevel(proposal({ RANGE: "C2" }, "C2"), "C2").flags).toEqual([]);
  });
});

describe("skillLevelFromCriteria", () => {
  it("takes the lower median of assessable criteria", () => {
    const p = proposal({ TASK_ACHIEVEMENT: "B2", COHERENCE: "B1", RANGE: "C1", ACCURACY: "A2" });
    expect(skillLevelFromCriteria(p)).toBe("B1");
  });

  it("ignores criteria that are not assessable, null when none are", () => {
    const p = proposal({ FLUENCY: "B2", PRONUNCIATION: "A1" });
    p.criteria[1].assessable = false;
    expect(skillLevelFromCriteria(p)).toBe("B2");
    p.criteria[0].assessable = false;
    expect(skillLevelFromCriteria(p)).toBeNull();
  });
});

describe("parseGradingAnswer", () => {
  it("accepts a fenced writing answer, clamps evidence, trims and strips code flags", () => {
    const res = parseGradingAnswer("```json\n" + answerJson([...CRITERIA_BY_SECTION.WRITING]) + "\n```", "WRITING");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.proposal.criteria).toHaveLength(4);
    expect(res.proposal.criteria[0].evidence).toHaveLength(4);
    expect(res.proposal.criteria[0].rationale).toBe("fine");
    expect(res.proposal.summary).toBe("sum");
    expect(res.proposal.flags).toEqual(["OFF_TOPIC"]);
  });

  it("rejects an answer missing a criterion", () => {
    const res = parseGradingAnswer(answerJson(["TASK_ACHIEVEMENT", "COHERENCE", "RANGE"]), "WRITING");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("ACCURACY");
  });

  it("rejects a criterion given twice", () => {
    const res = parseGradingAnswer(
      answerJson([...CRITERIA_BY_SECTION.WRITING, "RANGE"]),
      "WRITING",
    );
    expect(res.ok).toBe(false);
  });

  it("drops criteria that do not belong to the section", () => {
    const res = parseGradingAnswer(answerJson([...CRITERIA_BY_SECTION.WRITING, "FLUENCY"]), "WRITING");
    expect(res.ok && res.proposal.criteria.map((c) => c.criterion)).toEqual([
      ...CRITERIA_BY_SECTION.WRITING,
    ]);
  });

  it("forces PRONUNCIATION to not assessable for speaking", () => {
    const res = parseGradingAnswer(answerJson([...CRITERIA_BY_SECTION.SPEAKING]), "SPEAKING");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const pron = res.proposal.criteria.find((c) => c.criterion === "PRONUNCIATION")!;
    expect(pron.assessable).toBe(false);
    expect(pron.rationale).toBe(PRONUNCIATION_NOT_ASSESSABLE);
    expect(pron.evidence).toEqual([]);
  });

  it("rejects a level outside A1..C2 and broken JSON", () => {
    const bad = JSON.parse(answerJson([...CRITERIA_BY_SECTION.WRITING]));
    bad.overallLevel = "B3";
    expect(parseGradingAnswer(JSON.stringify(bad), "WRITING").ok).toBe(false);
    expect(parseGradingAnswer("not json", "WRITING").ok).toBe(false);
  });
});

describe("speakingMetrics", () => {
  it("computes counts, rate, pauses and ratio", () => {
    // 60 s recording, 4 words of 500 ms; gaps 500, 2500, 1000 ms.
    const words = [
      { text: "ich", startMs: 1000, endMs: 1500 },
      { text: "wohne", startMs: 2000, endMs: 2500 },
      { text: "in", startMs: 5000, endMs: 5500 },
      { text: "Köln", startMs: 6500, endMs: 7000 },
    ];
    const m = speakingMetrics([...words].reverse(), 60_000);
    expect(m.wordCount).toBe(4);
    expect(m.wordsPerMinute).toBe(4);
    expect(m.longPauses).toBe(1);
    expect(m.meanPauseMs).toBe(1333);
    expect(m.speakingRatio).toBeCloseTo(2000 / 60_000, 3);
  });

  it("is safe on an empty list and zero duration", () => {
    expect(speakingMetrics([], 0)).toEqual({
      wordCount: 0,
      wordsPerMinute: 0,
      longPauses: 0,
      meanPauseMs: 0,
      speakingRatio: 0,
    });
  });
});

describe("emptyAnswerReason", () => {
  it("classifies blank, too short and usable answers", () => {
    expect(emptyAnswerReason("   \n ", 80)).toBe("EMPTY");
    expect(emptyAnswerReason("... !!", 80)).toBe("EMPTY");
    expect(emptyAnswerReason("Hallo ich bin Anna", 80)).toBe("TOO_SHORT");
    expect(emptyAnswerReason(Array(24).fill("Wort").join(" "), 80)).toBeNull();
    expect(countWords("Hallo, wie geht's? - gut")).toBe(4);
  });
});

describe("prompts", () => {
  const text = "Liebe Anna, ich komme gern zu deiner Party am Samstag.";

  it("writing messages carry the answer, the word count, descriptors and the cap", () => {
    const msgs = buildWritingGradingMessages({
      task: "Schreiben Sie Anna eine Antwort.",
      contentPoints: ["zusagen", "Geschenk fragen"],
      register: "informell (du)",
      taskLevel: "A2",
      minWords: 30,
      maxWords: 50,
      text,
      rationaleLocale: "tr",
    });
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
    const all = msgs.map((m) => m.content).join("\n");
    expect(all).not.toContain(EM_DASH);
    expect(msgs[1].content).toContain(text);
    expect(msgs[1].content).toContain(`answer (counted by the system, trust this number): ${countWords(text)}`);
    expect(msgs[0].content).toContain("at most B1");
    expect(msgs[0].content).toContain("Turkish");
    expect(msgs[0].content).toContain("Do not infer personality, emotion, origin");
    expect(msgs[0].content).toContain(DESCRIPTORS.ACCURACY.C2);
    expect(msgs[0].content).not.toContain(DESCRIPTORS.FLUENCY.B1);
  });

  it("speaking messages carry the transcript, the metrics and the transcript caveats", () => {
    const metrics = speakingMetrics([{ text: "ich", startMs: 0, endMs: 400 }], 30_000);
    const msgs = buildSpeakingGradingMessages({
      task: "Stellen Sie sich vor.",
      contentPoints: ["Name", "Wohnort"],
      taskLevel: "A1",
      transcript: "ich heiße Anna und wohne in Köln",
      metrics,
      rationaleLocale: "en",
    });
    const all = msgs.map((m) => m.content).join("\n");
    expect(all).not.toContain(EM_DASH);
    expect(msgs[1].content).toContain("ich heiße Anna und wohne in Köln");
    expect(msgs[1].content).toContain("words per minute: 2");
    expect(msgs[1].content).toContain("counted by the system): 7");
    expect(msgs[0].content).toContain("Punctuation");
    expect(msgs[0].content).toContain("Filler words");
    expect(msgs[0].content).toContain(PRONUNCIATION_NOT_ASSESSABLE);
    expect(msgs[0].content).toContain(DESCRIPTORS.FLUENCY.B1);
  });

  it("repair messages append the bad answer and the error", () => {
    const base = buildWritingGradingMessages({
      task: "t",
      contentPoints: [],
      taskLevel: "B1",
      minWords: 80,
      maxWords: 120,
      text,
      rationaleLocale: "en",
    });
    const repair = buildGradingRepairMessages(base, "{bad", "missing criteria: RANGE");
    expect(repair).toHaveLength(4);
    expect(repair[2]).toEqual({ role: "assistant", content: "{bad" });
    expect(repair[3].content).toContain("missing criteria: RANGE");
    expect(repair[3].content).not.toContain(EM_DASH);
  });
});

describe("GRADING_JSON_SCHEMA", () => {
  it("survives the Gemini conversion with no unsupported keywords", () => {
    const text = JSON.stringify(toGeminiSchema(GRADING_JSON_SCHEMA));
    expect(text).not.toMatch(/oneOf|anyOf|additionalProperties/);
    expect(text).toContain("PRONUNCIATION");
  });
});
