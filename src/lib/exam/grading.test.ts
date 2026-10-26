import { describe, expect, it } from "vitest";
import { toGeminiSchema } from "@/lib/ai";
import {
  DEFAULT_RATIONALE_LOCALE,
  GRADING_JSON_SCHEMA,
  PRONUNCIATION_NOT_ASSESSABLE,
  buildGradingRepairMessages,
  buildSpeakingGradingMessages,
  buildWritingGradingMessages,
  capByTaskLevel,
  countWords,
  guardPreA1,
  hasGermanSentence,
  parseGradingAnswer,
  skillLevelFromCriteria,
  speakingMetrics,
  verifyEvidence,
  type GradingProposal,
} from "./grading";
import {
  CRITERIA_BY_SECTION,
  DESCRIPTORS,
  CRITERIA,
  SPEAKING_ANCHORS,
  SPEAKING_ANCHOR_TASK,
  WRITING_ANCHORS,
  WRITING_ANCHOR_TASK,
} from "./cefr-descriptors";
import { CALIBRATION_FIXTURES } from "./grading-calibration/fixtures";
import { CALIBRATION_TASKS, resolveTask } from "./grading-calibration/tasks";
import { CEFR_LEVELS, type ResultLevel } from "./types";

const EM_DASH = "\u2014";

function proposal(levels: Partial<Record<string, ResultLevel>>, overall: ResultLevel = "B1"): GradingProposal {
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

describe("countWords", () => {
  it("counts tokens with a letter or a digit, not punctuation", () => {
    expect(countWords("   \n ")).toBe(0);
    expect(countWords("... !!")).toBe(0);
    expect(countWords("Hallo, wie geht's? - gut")).toBe(4);
    expect(countWords("28195 Bremen")).toBe(2);
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

  it("asks for German rationales and summary by default, in the other two languages when told to", () => {
    expect(DEFAULT_RATIONALE_LOCALE).toBe("de");
    const system = (rationaleLocale: "tr" | "en" | "de") =>
      buildWritingGradingMessages({ task: "t", contentPoints: [], taskLevel: "B1", minWords: 80, maxWords: 120, text, rationaleLocale })[0].content;
    const de = system(DEFAULT_RATIONALE_LOCALE);
    expect(de).toContain("Write every rationale and the summary in German");
    expect(de).toContain("Evidence quotes stay in the original German, copied exactly.");
    expect(de).not.toContain("in Turkish");
    expect(de).not.toContain("in English");
    expect(de).not.toContain(EM_DASH);
    expect(system("tr")).toContain("in Turkish");
    expect(system("en")).toContain("in English");
    // The spoken task carries the same line.
    const metrics = speakingMetrics([{ text: "ich", startMs: 0, endMs: 400 }], 30_000);
    const speaking = buildSpeakingGradingMessages({ task: "t", contentPoints: [], taskLevel: "A1", transcript: "ich heiße Anna", metrics, rationaleLocale: "de" });
    expect(speaking[0].content).toContain("Write every rationale and the summary in German");
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

  it("passes each task picture's alt text as a Bild line, in both prompts, and nothing when there is none", () => {
    const images = [{ alt: "Eine Familie isst am Tisch." }, { alt: "  " }, { alt: "Ein Hund läuft im Park." }];
    const metrics = speakingMetrics([{ text: "ich", startMs: 0, endMs: 400 }], 30_000);
    const writing = buildWritingGradingMessages({ task: "Beschreiben Sie.", contentPoints: ["Ort"], taskLevel: "A2", images, minWords: 30, maxWords: 50, text, rationaleLocale: "en" });
    const speaking = buildSpeakingGradingMessages({ task: "Beschreiben Sie.", contentPoints: ["Ort"], taskLevel: "A2", images, transcript: "ich sehe einen Hund", metrics, rationaleLocale: "en" });
    for (const msgs of [writing, speaking]) {
      expect(msgs[1].content).toContain("Bild: Eine Familie isst am Tisch.\nBild: Ein Hund läuft im Park.");
      expect(msgs[1].content.match(/Bild:/g)).toHaveLength(2);
      expect(msgs.map((m) => m.content).join("\n")).not.toContain(EM_DASH);
    }
    const plain = buildWritingGradingMessages({ task: "t", contentPoints: [], taskLevel: "B1", minWords: 80, maxWords: 120, text, rationaleLocale: "en" });
    expect(plain[1].content).not.toContain("Bild:");
    expect(plain[1].content).not.toContain("Pictures shown");
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

describe("A0 (Pre-A1) in AI grading", () => {
  const a0 = (flags: GradingProposal["flags"]): GradingProposal => ({ ...proposal({ RANGE: "A0", ACCURACY: "A1" }, "A0"), flags });

  it("accepts A0 from the model, for a criterion and overall", () => {
    const json = JSON.parse(answerJson([...CRITERIA_BY_SECTION.WRITING]));
    json.overallLevel = "A0";
    json.criteria[0].level = "A0";
    json.flags = ["NOT_GERMAN"];
    const res = parseGradingAnswer(JSON.stringify(json), "WRITING");
    expect(res.ok).toBe(true);
    if (res.ok) expect([res.proposal.overallLevel, res.proposal.criteria[0].level]).toEqual(["A0", "A0"]);
  });

  it("keeps A0 when the model says the answer is empty or not German and it holds no German sentence", () => {
    for (const [flag, source] of [["EMPTY", ""], ["NOT_GERMAN", "My name is Ali and I live in Izmir."], ["NOT_GERMAN", "Benim adım Ali. Hallo."]] as const) {
      const out = guardPreA1(a0([flag]), source);
      expect(out.overallLevel, source).toBe("A0");
      expect(out.criteria[0].level).toBe("A0");
      expect(out.flags).toEqual([flag]);
    }
  });

  it("raises an A0 with no such flag to A1 and marks it", () => {
    const out = guardPreA1(a0(["OFF_TOPIC"]), "");
    expect(out.overallLevel).toBe("A1");
    expect(out.criteria.map((c) => c.level)).toEqual(["A1", "A1"]);
    expect(out.flags).toEqual(["OFF_TOPIC", "A0_RAISED"]);
    expect(guardPreA1(proposal({ RANGE: "B1" }), "").flags).toEqual([]);
  });

  it("raises a NOT_GERMAN A0 to A1 when the answer still holds a German sentence", () => {
    const out = guardPreA1(a0(["NOT_GERMAN"]), "I don't know much German. Ich heiße Ali und wohne in Izmir.");
    expect(out.overallLevel).toBe("A1");
    expect(out.flags).toEqual(["NOT_GERMAN", "A0_RAISED"]);
  });

  it("hasGermanSentence: three or more words, two German markers", () => {
    expect(hasGermanSentence("Ich heiße Ali.")).toBe(true);
    expect(hasGermanSentence("Hallo, ich bin Ayşe und ich komme aus der Türkei")).toBe(true);
    expect(hasGermanSentence("I was in the house. Die!")).toBe(false);
    expect(hasGermanSentence("Benim adım Ayşe, Türkiye'den geliyorum.")).toBe(false);
    expect(hasGermanSentence("Hallo danke")).toBe(false);
    expect(hasGermanSentence("")).toBe(false);
  });

  it("the model cannot claim a flag the code owns (A0_RAISED, TOO_SHORT, COPIED_TASK)", () => {
    const json = JSON.parse(answerJson([...CRITERIA_BY_SECTION.WRITING]));
    json.flags = ["A0_RAISED", "TOO_SHORT", "COPIED_TASK", "OFF_TOPIC"];
    const res = parseGradingAnswer(JSON.stringify(json), "WRITING");
    expect(res.ok && res.proposal.flags).toEqual(["OFF_TOPIC"]);
    expect(JSON.stringify(GRADING_JSON_SCHEMA)).not.toContain("TOO_SHORT");
  });

  it("A0 is under every task ceiling and counts in the criteria median", () => {
    const capped = capByTaskLevel(guardPreA1(a0(["NOT_GERMAN"]), "Merhaba"), "A1");
    expect(capped.overallLevel).toBe("A0");
    expect(capped.flags).toEqual(["NOT_GERMAN"]);
    expect(skillLevelFromCriteria(proposal({ TASK_ACHIEVEMENT: "A0", COHERENCE: "A0", RANGE: "A1", ACCURACY: "A1" }))).toBe("A0");
  });

  it("tells the model when A0 is allowed", () => {
    const [system] = buildWritingGradingMessages({
      task: "Schreiben Sie.",
      contentPoints: [],
      taskLevel: "A1",
      minWords: 30,
      maxWords: 60,
      text: "Hallo",
      rationaleLocale: "en",
    });
    expect(system.content).toContain("level is one of A0, A1, A2, B1, B2, C1, C2");
    expect(system.content).toContain("A0 (Pre-A1) means the answer has no German that can be scored");
    expect(system.content).toContain("add the flag EMPTY or NOT_GERMAN");
    expect(system.content).toContain("it contains no German sentence at all");
    expect(system.content).toContain("If the answer contains at least one German sentence of the candidate's own");
    expect(system.content).not.toContain(EM_DASH);
  });

  it("offers A0 in the provider schema", () => {
    const text = JSON.stringify(GRADING_JSON_SCHEMA);
    expect(text).toContain('"enum":["A0","A1","A2","B1","B2","C1","C2"]');
    expect(text).not.toContain("A0_RAISED");
  });
});

describe("GRADING_JSON_SCHEMA", () => {
  it("survives the Gemini conversion with no unsupported keywords", () => {
    const text = JSON.stringify(toGeminiSchema(GRADING_JSON_SCHEMA));
    expect(text).not.toMatch(/oneOf|anyOf|additionalProperties/);
    expect(text).toContain("PRONUNCIATION");
  });
});

describe("the standards in the prompt", () => {
  const writing = buildWritingGradingMessages({
    task: "Schreiben Sie Anna eine Antwort.",
    contentPoints: ["zusagen"],
    taskLevel: "B1",
    minWords: 70,
    maxWords: 110,
    text: "Liebe Anna, ich komme gern zu deiner Party am Samstag.",
    rationaleLocale: "en",
  });
  const speaking = buildSpeakingGradingMessages({
    task: "Stellen Sie sich vor.",
    contentPoints: ["Name"],
    taskLevel: "A1",
    transcript: "ich heiße Anna",
    metrics: speakingMetrics([{ text: "ich", startMs: 0, endMs: 400 }], 30_000),
    rationaleLocale: "en",
  });

  it("states the rules the calibration found missing", () => {
    const system = writing[0].content;
    expect(system).toContain("Levels are absolute CEFR levels of the language shown");
    expect(system).toContain("A flawless answer that only uses A1 structures is A1");
    expect(system).toContain("If you hesitate between two neighbouring levels, give the lower one");
    expect(system).toContain("ACCURACY is never more than one level above RANGE");
    expect(system).toContain("Length is not level");
    expect(system).toContain("learnt by heart");
    expect(system).toContain("Do not add TOO_SHORT");
    expect(system).toContain("give TASK_ACHIEVEMENT at most A1");
    expect(system).toContain("lower median of your criterion levels");
    expect(system).not.toContain(EM_DASH);
  });

  it("shows the scale with one anchor per level, written for the section", () => {
    for (const a of WRITING_ANCHORS) {
      expect(writing[0].content).toContain(a.text);
      expect(speaking[0].content).not.toContain(a.text);
    }
    for (const a of SPEAKING_ANCHORS) {
      expect(speaking[0].content).toContain(a.text);
      expect(writing[0].content).not.toContain(a.text);
    }
    expect(WRITING_ANCHORS.map((a) => a.level)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    expect(SPEAKING_ANCHORS.map((a) => a.level)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
    expect(writing[0].content).toContain("They are NOT the answer to grade");
    expect(JSON.stringify([WRITING_ANCHORS, SPEAKING_ANCHORS])).not.toContain(EM_DASH);
  });

  it("gives the length of the answer as a share of the minimum", () => {
    expect(writing[1].content).toContain("(14% of the minimum)");
  });

  it("keeps the anchors out of the calibration set, so the calibration measures the prompt", () => {
    const anchors = [...WRITING_ANCHORS, ...SPEAKING_ANCHORS].map((a) => a.text);
    for (const f of CALIBRATION_FIXTURES) expect(anchors, f.id).not.toContain(f.text);
    for (const t of CALIBRATION_TASKS) {
      const prompt = resolveTask(t.id).prompt;
      expect(prompt).not.toContain(WRITING_ANCHOR_TASK);
      expect(prompt).not.toContain(SPEAKING_ANCHOR_TASK);
    }
  });
});

describe("criteria that cannot be assessed", () => {
  const withPronunciation = (level: ResultLevel): GradingProposal => ({
    criteria: [
      { criterion: "RANGE", level: "A1", score: 2, assessable: true, rationale: "r", evidence: [] },
      { criterion: "PRONUNCIATION", level, score: 0, assessable: false, rationale: PRONUNCIATION_NOT_ASSESSABLE, evidence: [] },
    ],
    overallLevel: "A1",
    summary: "s",
    flags: [],
  });

  it("are not raised from A0 and do not mark the proposal A0_RAISED", () => {
    const out = guardPreA1(withPronunciation("A0"), "Ich heiße Ali und wohne in Berlin.");
    expect(out.flags).toEqual([]);
    expect(out.criteria[1].level).toBe("A0");
  });

  it("are not counted as capped", () => {
    const out = capByTaskLevel(withPronunciation("C2"), "A1");
    expect(out.flags).toEqual([]);
  });
});
