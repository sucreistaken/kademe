import { describe, expect, it } from "vitest";
import screensTr from "@/i18n/messages/screens.tr.json";
import screensEn from "@/i18n/messages/screens.en.json";
import { ROW_PROBLEM_CODES } from "./bank-sheet";
import { ITEM_PROBLEM_CODES, itemProblems, validateItem, type ValidatableItem } from "./validate";

const matching = (over: Partial<{ left: Array<{ id: string; text: string }>; right: Array<{ id: string; text: string }>; pairs: Record<string, string> }> = {}): ValidatableItem => ({
  type: "MATCHING",
  prompt: "Ordnen Sie zu.",
  content: {
    kind: "MATCHING",
    left: over.left ?? [{ id: "l1", text: "Hund" }, { id: "l2", text: "Katze" }],
    right: over.right ?? [{ id: "r1", text: "bellt" }, { id: "r2", text: "miaut" }, { id: "r3", text: "muht" }],
  },
  key: { kind: "MATCHING", pairs: over.pairs ?? { l1: "r1", l2: "r2" } },
});

const gap = (answers: Record<string, string[]>, gaps: Array<{ id: string; choices?: string[] }> = [{ id: "g1" }]): ValidatableItem => ({
  type: "GAP_FILL",
  prompt: "Ich warte {{g1}} dich.",
  content: { kind: "GAP", gaps },
  key: { kind: "GAP", answers },
});

const codes = (item: ValidatableItem) => itemProblems(item).map((p) => p.code);

describe("validateItem: matching", () => {
  it("passes a sound item", () => {
    expect(validateItem(matching())).toEqual([]);
  });

  it("refuses empty or repeated target texts", () => {
    expect(codes(matching({ right: [{ id: "r1", text: "bellt" }, { id: "r2", text: " " }] }))).toContain("MATCH_TARGET_EMPTY");
    expect(codes(matching({ right: [{ id: "r1", text: "bellt" }, { id: "r2", text: "Bellt " }] }))).toEqual(["MATCH_TARGET_TEXT_REPEAT"]);
  });

  it("refuses empty or repeated row texts", () => {
    expect(codes(matching({ left: [{ id: "l1", text: "" }, { id: "l2", text: "Katze" }] }))).toEqual(["MATCH_ROW_EMPTY"]);
    expect(codes(matching({ left: [{ id: "l1", text: "Katze" }, { id: "l2", text: "katze" }] }))).toEqual(["MATCH_ROW_TEXT_REPEAT"]);
  });

  it("refuses pairs keyed by an id that is not a row, and a row without a pair", () => {
    const p = itemProblems(matching({ pairs: { l1: "r1", l2: "r2", l9: "r3" } }));
    expect(p).toEqual([{ code: "MATCH_KEY_UNKNOWN_ROW", ids: ["l9"] }]);
    expect(validateItem(matching({ pairs: { l1: "r1", l2: "r2", l9: "r3" } }))).toEqual(["key pairs unknown rows l9"]);
    expect(itemProblems(matching({ pairs: { l1: "r1" } }))).toEqual([{ code: "MATCH_ROW_NO_TARGET", n: 2, ids: ["l2"] }]);
    expect(codes(matching({ pairs: { l1: "r1", l2: "r9" } }))).toEqual(["MATCH_ROW_NO_TARGET"]);
  });
});

describe("validateItem: gap fill", () => {
  it("refuses answers for gaps the item does not have", () => {
    expect(itemProblems(gap({ g1: ["auf"], g7: ["an"] }))).toEqual([{ code: "GAP_KEY_UNKNOWN", ids: ["g7"] }]);
  });

  it("refuses an empty drop-down choice", () => {
    expect(codes(gap({ g1: ["auf"] }, [{ id: "g1", choices: ["auf", "", "an"] }]))).toEqual(["GAP_CHOICE_EMPTY"]);
  });

  it("keeps the English sentences the engine and the AI repair prompt read", () => {
    expect(validateItem(gap({}))).toEqual(["gap g1 has no accepted answer"]);
    expect(validateItem({ ...gap({ g1: ["x"] }), prompt: "Ohne Marker." })).toEqual(["gaps without a marker: g1"]);
  });
});

describe("validateItem: the other new checks", () => {
  it("true/false: an empty statement and answers for unknown statements", () => {
    const item: ValidatableItem = {
      type: "TRUE_FALSE_NG",
      prompt: "Richtig oder falsch?",
      content: { kind: "TFNG", statements: [{ id: "s1", text: "Eins." }, { id: "s2", text: "" }] },
      key: { kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } },
    };
    expect(codes(item)).toEqual(["TFNG_EMPTY", "TFNG_KEY_UNKNOWN"]);
  });

  it("short text: a sensible length", () => {
    const item: ValidatableItem = { type: "SHORT_TEXT", prompt: "Gegenteil von teuer?", content: { kind: "SHORT_TEXT", maxChars: 0 }, key: { kind: "SHORT_TEXT", accepted: ["billig"] } };
    expect(codes(item)).toEqual(["SHORT_LENGTH"]);
  });

  it("an unknown type answers alone", () => {
    expect(validateItem({ ...gap({ g1: ["x"] }), type: "ESSAY" as never })).toEqual(["unknown item type ESSAY"]);
  });
});

describe("validateItem: points shown to the student", () => {
  const speaking = (studentPoints?: string[]): ValidatableItem => ({
    type: "SPEAKING_PROMPT",
    prompt: "Bitten Sie Herrn Braun um den Kuli.",
    content: { kind: "SPEAKING", thinkSeconds: 20, answerSeconds: 30, maxTakes: 2 },
    key: { kind: "NONE" },
    rubric: { contentPoints: ["höfliche Bitte"], ...(studentPoints ? { studentPoints } : {}) },
  });

  it("are optional, and up to six short ones pass", () => {
    expect(codes(speaking())).toEqual([]);
    expect(codes(speaking(["höflich um den Kuli bitten", "sich bedanken"]))).toEqual([]);
    expect(codes(speaking(["a", "b", "c", "d", "e", "x".repeat(80)]))).toEqual([]);
  });

  it("allow at most six, each 1 to 80 characters", () => {
    expect(codes(speaking(["a", "b", "c", "d", "e", "f", "g"]))).toEqual(["STUDENT_POINTS_COUNT"]);
    expect(itemProblems(speaking(["gut", "  ", "x".repeat(81)]))).toEqual([
      { code: "STUDENT_POINT_TEXT", n: 2 },
      { code: "STUDENT_POINT_TEXT", n: 3 },
    ]);
    expect(validateItem(speaking(["x".repeat(81)]))).toEqual(["point 1 for the student must be 1 to 80 characters"]);
  });
});

describe("every problem has its sentence in both languages", () => {
  const tr = screensTr.bankTools as Record<string, string>;
  const en = screensEn.bankTools as Record<string, string>;
  it.each([...ITEM_PROBLEM_CODES.map((c) => `p_${c}`), ...ROW_PROBLEM_CODES.map((c) => `r_${c}`)])("%s", (key) => {
    expect(tr[key], key).toBeTruthy();
    expect(en[key], key).toBeTruthy();
  });
});

describe("validateItem: MC cloze and word bank (spec 2026-10-18)", () => {
  const prompt = "Ich {{g1}} gestern {{g2}} Berlin gefahren.";
  const cloze = (gaps: Array<{ id: string; choices?: string[] }>, answers: Record<string, string[]>): ValidatableItem => ({
    type: "GAP_FILL",
    prompt,
    content: { kind: "GAP", gaps },
    key: { kind: "GAP", answers },
    skillTag: "grammar.cloze",
  });
  const four = (first: string) => [first, "habe", "war", "wurde"];
  const okCloze = () => cloze([{ id: "g1", choices: four("bin") }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] });
  const bank = (distractors: string[] | undefined, answers: Record<string, string[]> = { g1: ["bin"], g2: ["nach"] }, gaps: Array<{ id: string; choices?: string[] }> = [{ id: "g1" }, { id: "g2" }]): ValidatableItem => ({
    type: "GAP_FILL",
    prompt,
    content: { kind: "GAP", gaps },
    key: { kind: "GAP", answers, ...(distractors ? { distractors } : {}) },
    skillTag: "grammar.wordbank",
  });

  it("passes a sound cloze and a sound word bank", () => {
    expect(itemProblems(okCloze())).toEqual([]);
    expect(itemProblems(bank(["habe", "in", "zu"]))).toEqual([]);
  });

  it("cloze: every gap has exactly four choices", () => {
    expect(itemProblems(cloze([{ id: "g1", choices: ["bin", "habe", "war"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] }))).toEqual([
      { code: "CLOZE_CHOICE_COUNT", n: 1, ids: ["g1"] },
    ]);
    expect(codes(cloze([{ id: "g1", choices: [...four("bin"), "ist"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] }))).toEqual(["CLOZE_CHOICE_COUNT"]);
    expect(codes(cloze([{ id: "g1" }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] }))).toEqual(["CLOZE_CHOICE_COUNT"]);
  });

  it("cloze: the choices differ as the scorer reads them, the answer is one of them, one answer per gap", () => {
    // "dass" and "daß" are one answer for the scorer.
    expect(codes(cloze([{ id: "g1", choices: ["dass", "daß", "ob", "wenn"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["dass"], g2: ["nach"] }))).toEqual(["GAP_CHOICE_REPEAT"]);
    expect(codes(cloze([{ id: "g1", choices: ["Bin", "bin", "war", "habe"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] }))).toEqual(["GAP_CHOICE_REPEAT"]);
    expect(codes(cloze([{ id: "g1", choices: four("bin") }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["ist"], g2: ["nach"] }))).toEqual(["GAP_ANSWER_NOT_CHOICE"]);
    expect(codes(cloze([{ id: "g1", choices: four("bin") }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin", "war"], g2: ["nach"] }))).toEqual(["GAP_ONE_ANSWER"]);
  });

  it("word bank: no choices, one whole word per gap", () => {
    expect(codes(bank(["habe", "in", "zu"], undefined, [{ id: "g1", choices: four("bin") }, { id: "g2" }]))).toEqual(["WORDBANK_CHOICES"]);
    expect(codes(bank(["habe", "in", "zu"], { g1: ["bin", "war"], g2: ["nach"] }))).toEqual(["GAP_ONE_ANSWER"]);
    expect(itemProblems(bank(["habe", "in", "zu"], { g1: ["bin"], g2: ["nach dem"] }))).toEqual([{ code: "WORDBANK_ANSWER_NOT_WORD", n: 2, ids: ["g2"] }]);
  });

  it("word bank: at least three whole-word distractors, none an answer, none twice", () => {
    expect(codes(bank(undefined))).toEqual(["WORDBANK_FEW_DISTRACTORS"]);
    expect(codes(bank(["habe", "in", " "]))).toEqual(["WORDBANK_FEW_DISTRACTORS"]);
    expect(itemProblems(bank(["habe", "in", "zu dem"]))).toEqual([{ code: "WORDBANK_DISTRACTOR_NOT_WORD", ids: ["zu dem"] }]);
    // Read as the scorer reads them: case, ß and a trailing full stop do not make a new word.
    expect(itemProblems(bank(["habe", "in", "Nach."]))).toEqual([{ code: "WORDBANK_DISTRACTOR_IS_ANSWER", ids: ["Nach."] }]);
    expect(codes(bank(["Strasse", "in", "zu"], { g1: ["bin"], g2: ["Straße"] }))).toEqual(["WORDBANK_DISTRACTOR_IS_ANSWER"]);
    expect(codes(bank(["habe", "in", "zu", "Zu"]))).toEqual(["WORDBANK_DISTRACTOR_REPEAT"]);
  });

  it("word bank: two gaps may share an answer spelled exactly alike (the pool then holds it twice)", () => {
    expect(itemProblems(bank(["habe", "in", "zu"], { g1: ["nach"], g2: ["nach"] }))).toEqual([]);
  });

  it("word bank: no pool word may appear in two forms, which would give the answers away", () => {
    // Answers equal for the scorer but spelled differently: "Der" and "der" side by side mark both as answers.
    expect(itemProblems(bank(["habe", "in", "zu"], { g1: ["Der"], g2: ["der"] }))).toEqual([{ code: "WORDBANK_ANSWER_VARIANT", ids: ["g1", "g2"] }]);
    expect(codes(bank(["habe", "in", "zu"], { g1: ["Straße"], g2: ["Strasse"] }))).toEqual(["WORDBANK_ANSWER_VARIANT"]);
    // A distractor in another case than an answer, or two distractors in two cases.
    expect(codes(bank(["habe", "in", "NACH"]))).toEqual(["WORDBANK_DISTRACTOR_IS_ANSWER"]);
    expect(codes(bank(["habe", "In", "in"]))).toEqual(["WORDBANK_DISTRACTOR_REPEAT"]);
    expect(validateItem(bank(["habe", "in", "zu"], { g1: ["Der"], g2: ["der"] }))).toEqual(["word bank answers differ only in spelling or case: g1,g2"]);
  });

  it("without the skill tag the same items keep the plain gap rules (C-tests and old items are unchanged)", () => {
    const plainCloze = { ...cloze([{ id: "g1", choices: ["bin", "habe", "war"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin", "war"], g2: ["nach"] }), skillTag: undefined };
    expect(itemProblems(plainCloze)).toEqual([]);
    const plainBank = { ...bank(undefined, { g1: ["bin"], g2: ["nach dem"] }), skillTag: null };
    expect(itemProblems(plainBank)).toEqual([]);
    expect(itemProblems({ ...plainBank, skillTag: "grammar.ctest" })).toEqual([]);
  });

  it("says each new problem in English for the engine", () => {
    expect(validateItem(bank(["habe"]))).toEqual(["a word bank needs at least 3 distractors"]);
    expect(validateItem(cloze([{ id: "g1" }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }], { g1: ["bin"], g2: ["nach"] }))).toEqual(["cloze gap g1 needs exactly four choices"]);
  });
});
