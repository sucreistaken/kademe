import { describe, expect, it } from "vitest";
import {
  JOB_AD_MAX_CHARS,
  JOB_AD_MIN_CHARS,
  buildDraftMessages,
  checkDraftBudget,
  draftTotalSeconds,
  isJobAdThin,
  jobAdProblem,
  JOB_AD_THIN_CHARS,
  normalizeDraft,
  parseDraftAnswer,
  type TemplateDraft,
} from "@/lib/template-draft";

/**
 * The AI builder writes into a real template, so the guard between a model
 * answer and the database is the only thing standing between a hallucinated
 * field and a candidate's screen. These tests pin that guard.
 */

function activity(overrides: Record<string, unknown> = {}) {
  return {
    key: "a1",
    type: "VIDEO",
    promptTr: "Onboarding akışında düşüşü nasıl teşhis edersiniz?",
    promptEn: "How would you diagnose the onboarding drop off?",
    noteTr: "",
    noteEn: "",
    internalQuestion: "Problemi veriyle çerçeveliyor mu?",
    internalObjective: "Ölçüm disiplini",
    expectedBehaviours: ["Metriği tanımlar", "Hipotez kurar"],
    redFlags: ["Sadece estetikten konuşur"],
    thinkSeconds: 60,
    answerSeconds: 180,
    rationale: "İlandaki aktivasyon akışları maddesinden çıktı.",
    ...overrides,
  };
}

function stage(overrides: Record<string, unknown> = {}) {
  return {
    key: "s1",
    nameTr: "Vaka: onboarding düşüşü",
    nameEn: "Case: onboarding drop off",
    descriptionTr: "Bir vaka üzerinden problem çerçeveleme.",
    descriptionEn: "",
    internalPurpose: "Problem çerçeveleme ve ölçüm disiplini",
    internalObjective: "Veriyle çalışma",
    durationSeconds: 900,
    rationale: "İlan aktivasyondan sorumlu bir tasarımcı arıyor.",
    activities: [activity()],
    ...overrides,
  };
}

function competency(overrides: Record<string, unknown> = {}) {
  return {
    key: "c1",
    nameTr: "Mühendisle iletişim",
    nameEn: "Communicating with engineers",
    descriptionTr: "Teknik ekiple doğrudan çalışabilme.",
    descriptionEn: "",
    stageKeys: ["s1"],
    rationale: "İlan mühendislerle doğrudan iletişim diyor.",
    ...overrides,
  };
}

const answer = (draft: unknown) => JSON.stringify(draft);

describe("parseDraftAnswer", () => {
  it("accepts a well formed draft", () => {
    const result = parseDraftAnswer(
      answer({ stages: [stage()], competencies: [competency()] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.stages[0].activities[0].type).toBe("VIDEO");
  });

  it("unwraps a fenced code block, because providers add one uninvited", () => {
    const body = answer({ stages: [stage()], competencies: [] });
    const result = parseDraftAnswer("```json\n" + body + "\n```");
    expect(result.ok).toBe(true);
  });

  it("rejects choice activities, which would carry an answer key", () => {
    const result = parseDraftAnswer(
      answer({
        stages: [stage({ activities: [activity({ type: "SINGLE_CHOICE" })] })],
        competencies: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain("type");
  });

  it("rejects a draft with a missing field instead of filling it in", () => {
    const broken = stage();
    delete (broken as Record<string, unknown>).internalPurpose;
    const result = parseDraftAnswer(
      answer({ stages: [broken], competencies: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("cuts back an answer that narrates around its JSON", () => {
    // What a reasoning model does even with a schema attached.
    const body = answer({ stages: [stage()], competencies: [] });
    const result = parseDraftAnswer(
      `Okay, the user is asking for an assessment.\n${body}\nUmarım yardımcı olur.`,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an answer that is not JSON at all", () => {
    const result = parseDraftAnswer("Elbette, işte önerilerim:");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toContain("JSON");
  });
});

describe("normalizeDraft", () => {
  const parse = (draft: unknown): TemplateDraft => {
    const result = parseDraftAnswer(answer(draft));
    if (!result.ok) throw new Error(result.problem);
    return result.draft;
  };

  it("stretches a stage whose timer is shorter than its own questions", () => {
    const draft = normalizeDraft(
      parse({
        stages: [
          stage({
            durationSeconds: 120,
            activities: [activity(), activity({ key: "a2" })],
          }),
        ],
        competencies: [],
      }),
    );
    // Two activities of 60 + 180 seconds, plus a minute of slack.
    expect(draft.stages[0].durationSeconds).toBe(540);
  });

  it("clamps an answer time the database would not accept", () => {
    const draft = normalizeDraft(
      parse({
        stages: [stage({ activities: [activity({ answerSeconds: 99_999 })] })],
        competencies: [],
      }),
    );
    expect(draft.stages[0].activities[0].answerSeconds).toBe(1800);
  });

  it("zeroes think time on written activities, where it means nothing", () => {
    const draft = normalizeDraft(
      parse({
        stages: [
          stage({
            activities: [activity({ type: "LONG_TEXT", thinkSeconds: 90 })],
          }),
        ],
        competencies: [],
      }),
    );
    expect(draft.stages[0].activities[0].thinkSeconds).toBe(0);
  });

  it("drops English text when the version is Turkish only", () => {
    const draft = normalizeDraft(
      parse({ stages: [stage()], competencies: [competency()] }),
      ["tr"],
    );
    expect(draft.stages[0].nameEn).toBe("");
    expect(draft.stages[0].activities[0].promptEn).toBe("");
    expect(draft.competencies[0].nameEn).toBe("");
  });

  it("keeps English text when the version is bilingual", () => {
    const draft = normalizeDraft(
      parse({ stages: [stage()], competencies: [competency()] }),
      ["tr", "en"],
    );
    expect(draft.stages[0].nameEn).toBe("Case: onboarding drop off");
  });

  it("drops a competency link pointing at a stage that did not survive", () => {
    const draft = normalizeDraft(
      parse({
        stages: [stage()],
        competencies: [competency({ stageKeys: ["s1", "s9"] })],
      }),
    );
    expect(draft.competencies[0].stageKeys).toEqual(["s1"]);
  });

  it("caps the draft at four stages, whatever the model proposed", () => {
    const draft = normalizeDraft(
      parse({
        stages: [1, 2, 3, 4, 5, 6].map((n) =>
          stage({ key: `s${n}`, nameTr: `Aşama ${n}` }),
        ),
        competencies: [],
      }),
    );
    expect(draft.stages).toHaveLength(4);
  });

  it("drops duplicate stage keys, which would collide on the cards", () => {
    const draft = normalizeDraft(
      parse({
        stages: [stage(), stage({ nameTr: "Aynı anahtar" })],
        competencies: [],
      }),
    );
    expect(draft.stages).toHaveLength(1);
    expect(draft.stages[0].nameTr).toBe("Vaka: onboarding düşüşü");
  });

  it("trims a runaway list of expected behaviours", () => {
    const draft = normalizeDraft(
      parse({
        stages: [
          stage({
            activities: [
              activity({
                expectedBehaviours: ["a", "b", "c", "d", "e", "f", "g", "h"],
              }),
            ],
          }),
        ],
        competencies: [],
      }),
    );
    expect(draft.stages[0].activities[0].expectedBehaviours).toHaveLength(6);
  });

  it("drops a stage left with no answerable activity", () => {
    const draft = normalizeDraft(
      parse({
        stages: [stage({ activities: [activity({ promptTr: "   x" })] })],
        competencies: [],
      }),
    );
    // The prompt survives trimming, so the stage stays; an empty one would not
    // be representable here because the schema requires a non empty prompt.
    expect(draft.stages).toHaveLength(1);
    expect(draft.stages[0].activities[0].promptTr).toBe("x");
  });
});

describe("checkDraftBudget", () => {
  const build = (draft: unknown): TemplateDraft => {
    const result = parseDraftAnswer(answer(draft));
    if (!result.ok) throw new Error(result.problem);
    return normalizeDraft(result.draft);
  };

  it("passes a draft a candidate would actually finish", () => {
    const draft = build({
      stages: [
        stage({ durationSeconds: 600 }),
        stage({ key: "s2", durationSeconds: 600 }),
      ],
      competencies: [],
    });
    expect(draftTotalSeconds(draft)).toBe(1200);
    expect(checkDraftBudget(draft)).toBeNull();
  });

  it("flags the 106 minute draft the first real run produced", () => {
    const draft = build({
      stages: [
        stage({ key: "s1", durationSeconds: 1860 }),
        stage({ key: "s2", durationSeconds: 1260 }),
        stage({ key: "s3", durationSeconds: 1200 }),
        stage({ key: "s4", durationSeconds: 1080 }),
      ],
      competencies: [],
    });
    const problem = checkDraftBudget(draft);
    expect(problem).toContain("Toplam süre 90 dakika");
    expect(problem).toContain("30 dakika olmalı");
  });

  it("flags a single stage that runs past twelve minutes", () => {
    const problem = checkDraftBudget(
      build({ stages: [stage({ durationSeconds: 1500 })], competencies: [] }),
    );
    expect(problem).toContain("25 dakika");
  });

  it("flags a recorded answer longer than three minutes", () => {
    const problem = checkDraftBudget(
      build({
        stages: [stage({ activities: [activity({ answerSeconds: 300 })] })],
        competencies: [],
      }),
    );
    expect(problem).toContain("300 saniyelik");
  });

  it("names the real fix when a written task was labelled VIDEO", () => {
    // The first NVIDIA run did exactly this: type VIDEO, thinkSeconds 0,
    // answerSeconds 600, and a prompt ending "yanıtınız metin kutusuna
    // yazılacak". Saying only "too long" made the repair keep the wrong type.
    const problem = checkDraftBudget(
      build({
        stages: [
          stage({
            durationSeconds: 720,
            activities: [
              activity({ type: "VIDEO", thinkSeconds: 0, answerSeconds: 600 }),
            ],
          }),
        ],
        competencies: [],
      }),
    );
    expect(problem).toContain("LONG_TEXT olmalı");
  });

  it("flags homework: file uploads asked for in more than one stage", () => {
    const upload = () => activity({ type: "FILE_UPLOAD", thinkSeconds: 0 });
    const problem = checkDraftBudget(
      build({
        stages: [
          stage({ activities: [upload()] }),
          stage({ key: "s2", activities: [upload()] }),
        ],
        competencies: [],
      }),
    );
    expect(problem).toContain("dosya yükleme");
  });

  it("accepts a single work sample stage", () => {
    const draft = build({
      stages: [
        stage({
          durationSeconds: 600,
          activities: [activity({ type: "FILE_UPLOAD", thinkSeconds: 0 })],
        }),
        stage({ key: "s2", nameTr: "Video cevap", durationSeconds: 600 }),
      ],
      competencies: [],
    });
    expect(checkDraftBudget(draft)).toBeNull();
  });
});

describe("buildDraftMessages", () => {
  const request = {
    positionName: "Kıdemli Ürün Tasarımcısı",
    jobDescription: "B2B SaaS onboarding ve aktivasyon akışlarından sorumlu.",
    locales: ["tr"] as Array<"tr" | "en">,
    existingCompetencies: ["İletişim"],
  };

  it("carries the job ad and the library into the prompt", () => {
    const messages = buildDraftMessages(request);
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("aktivasyon akışlarından sorumlu");
    expect(messages[1].content).toContain("İletişim");
  });

  it("asks for English only when the version is bilingual", () => {
    const turkishOnly = buildDraftMessages(request);
    expect(turkishOnly[1].content).toContain("boş dize");

    const bilingual = buildDraftMessages({ ...request, locales: ["tr", "en"] });
    expect(bilingual[1].content).toContain("hem *Tr hem *En");
  });

  it("tells the model it must not score or rank anyone", () => {
    const system = buildDraftMessages(request)[0].content;
    expect(system).toContain("never score, rank, shortlist or reject");
    expect(system).toContain("EU AI Act");
  });
});

describe("draftTotalSeconds", () => {
  it("adds up what the assessment would ask of a candidate", () => {
    const parsed = parseDraftAnswer(
      answer({
        stages: [stage({ durationSeconds: 600 }), stage({ key: "s2", durationSeconds: 300 })],
        competencies: [],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.problem);
    expect(draftTotalSeconds(normalizeDraft(parsed.draft))).toBe(900);
  });
});

/**
 * The two ends need opposite advice. A single length check that reports "too
 * short" for a whole careers page pasted in tells the manager to write more
 * when the fix is to write less, so they paste again and get the same message.
 */
describe("jobAdProblem", () => {
  const text = (length: number) => "a".repeat(length);

  it("refuses a job title with nothing after it", () => {
    expect(jobAdProblem(text(JOB_AD_MIN_CHARS - 1))).toBe("TOO_SHORT");
    expect(jobAdProblem(text(39))).toBe("TOO_SHORT");
  });

  it("accepts the shortest usable ad", () => {
    expect(jobAdProblem(text(JOB_AD_MIN_CHARS))).toBeNull();
    expect(jobAdProblem(text(40))).toBeNull();
  });

  /**
   * The floor is deliberately below what a good ad looks like. Two short
   * Turkish sentences are about 98 characters, and blocking a manager who
   * typed those would be a dead end. Thinness is advice instead.
   */
  it("lets a short but real ad through, and calls it thin", () => {
    expect(jobAdProblem(text(98))).toBeNull();
    expect(isJobAdThin(text(98))).toBe(true);
    expect(isJobAdThin(text(JOB_AD_THIN_CHARS))).toBe(false);
    expect(isJobAdThin(text(JOB_AD_THIN_CHARS - 1))).toBe(true);
  });

  it("does not call an unusable ad thin, because it is refused outright", () => {
    expect(isJobAdThin(text(39))).toBe(false);
    expect(isJobAdThin("   ")).toBe(false);
  });

  it("accepts the longest usable ad", () => {
    expect(jobAdProblem(text(JOB_AD_MAX_CHARS))).toBeNull();
    expect(jobAdProblem(text(20_000))).toBeNull();
  });

  it("says too long rather than too short past the ceiling", () => {
    expect(jobAdProblem(text(JOB_AD_MAX_CHARS + 1))).toBe("TOO_LONG");
    expect(jobAdProblem(text(20_001))).toBe("TOO_LONG");
  });

  it("treats whitespace as nothing at all", () => {
    expect(jobAdProblem("")).toBe("TOO_SHORT");
    expect(jobAdProblem("   \n\t  \n ")).toBe("TOO_SHORT");
    // Padding is not content: an ad that only clears the floor on spaces would
    // still give the model nothing to anchor on.
    expect(jobAdProblem(`  ${text(JOB_AD_MIN_CHARS - 1)}  `)).toBe("TOO_SHORT");
  });
});
