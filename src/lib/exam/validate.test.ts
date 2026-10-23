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

  it("richtig/falsch only: \"nicht im Text\" cannot be a key", () => {
    const item: ValidatableItem = {
      type: "TRUE_FALSE_NG",
      prompt: "Richtig oder falsch?",
      content: { kind: "TFNG", twoWay: true, statements: [{ id: "s1", text: "Eins." }, { id: "s2", text: "Zwei." }] },
      key: { kind: "TFNG", answers: { s1: "R", s2: "NG" } },
    };
    expect(codes(item)).toEqual(["TFNG_TWO_WAY_NG"]);
    expect(codes({ ...item, key: { kind: "TFNG", answers: { s1: "R", s2: "F" } } })).toEqual([]);
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

  it("open gaps: no choices, every accepted answer one whole word, several spellings allowed", () => {
    const open = (gaps: Array<{ id: string; choices?: string[] }>, answers: Record<string, string[]>): ValidatableItem => ({
      type: "GAP_FILL",
      prompt,
      content: { kind: "GAP", gaps },
      key: { kind: "GAP", answers },
      skillTag: "grammar.open",
    });
    expect(itemProblems(open([{ id: "g1" }, { id: "g2" }], { g1: ["bin"], g2: ["nach", "in"] }))).toEqual([]);
    expect(codes(open([{ id: "g1", choices: four("bin") }, { id: "g2" }], { g1: ["bin"], g2: ["nach"] }))).toEqual(["OPEN_CHOICES"]);
    expect(itemProblems(open([{ id: "g1" }, { id: "g2" }], { g1: ["bin"], g2: ["nach", "in dem"] }))).toEqual([{ code: "OPEN_ANSWER_NOT_WORD", n: 2, ids: ["g2"] }]);
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

describe("validateItem: Ja/Nein wording", () => {
  const tf = (content: Record<string, unknown>, type: ValidatableItem["type"] = "TRUE_FALSE_NG"): ValidatableItem =>
    ({ type, prompt: "Ja oder nein?", content, key: { kind: "TFNG", answers: { s1: "R" } } }) as unknown as ValidatableItem;
  const statements = [{ id: "s1", text: "Er kommt." }];
  it("accepts JA_NEIN on a true/false item", () => {
    expect(itemProblems(tf({ kind: "TFNG", statements, wording: "JA_NEIN" }))).toEqual([]);
  });
  it("refuses any other wording value and wording on other content", () => {
    expect(itemProblems(tf({ kind: "TFNG", statements, wording: "YES_NO" })).map((p) => p.code)).toEqual(["WORDING_KIND"]);
    const choice = {
      type: "SINGLE_CHOICE",
      prompt: "Was?",
      content: { kind: "CHOICE", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }, { id: "c", text: "z" }], wording: "JA_NEIN" },
      key: { kind: "CHOICE", correct: ["a"] },
    } as unknown as ValidatableItem;
    expect(itemProblems(choice).map((p) => p.code)).toEqual(["WORDING_KIND"]);
  });
});

describe("validateItem: tick n (pick)", () => {
  const options = ["a", "b", "c", "d", "e"].map((id) => ({ id, text: `Option ${id}` }));
  const multi = (pick: unknown, correct: string[], type: ValidatableItem["type"] = "MULTI_CHOICE"): ValidatableItem =>
    ({ type, prompt: "Kreuzen Sie an.", content: { kind: "CHOICE", options, pick }, key: { kind: "CHOICE", correct } }) as unknown as ValidatableItem;
  const codes = (i: ValidatableItem) => itemProblems(i).map((p) => p.code);
  it("accepts a pick that matches the key", () => {
    expect(codes(multi(3, ["a", "b", "c"]))).toEqual([]);
    expect(codes(multi(4, ["a", "b", "c", "d"]))).toEqual([]);
  });
  it("refuses pick below 2, above options - 1 or not whole", () => {
    expect(codes(multi(1, ["a"]))).toEqual(["PICK_RANGE"]);
    expect(codes(multi(5, ["a", "b", "c", "d"]))).toEqual(["PICK_RANGE"]);
    expect(codes(multi(2.5, ["a", "b"]))).toEqual(["PICK_RANGE"]);
  });
  it("refuses a key whose length differs from pick", () => {
    expect(codes(multi(3, ["a", "b"]))).toEqual(["PICK_KEY_COUNT"]);
  });
  it("refuses pick on a single choice item", () => {
    expect(codes(multi(2, ["a"], "SINGLE_CHOICE"))).toEqual(["PICK_KIND"]);
  });
  it("refuses pick on other content", () => {
    const gapPick = { type: "TRUE_FALSE_NG", prompt: "Ja?", content: { kind: "TFNG", statements: [{ id: "s1", text: "x" }], pick: 2 }, key: { kind: "TFNG", answers: { s1: "R" } } } as unknown as ValidatableItem;
    expect(codes(gapPick)).toEqual(["PICK_KIND"]);
  });
});

describe("validateItem: pictures", () => {
  const pic = (alt = "Eine Katze sitzt auf dem Sofa.", key = "bank/images/0123456789abcdef.webp") => ({ storageKey: key, w: 960, h: 640, alt });
  const choice = (options: Array<{ id: string; text: string; image?: ReturnType<typeof pic> }>): ValidatableItem => ({
    type: "SINGLE_CHOICE",
    prompt: "Welches Bild passt?",
    content: { kind: "CHOICE", options },
    key: { kind: "CHOICE", correct: ["a"] },
  });
  const speaking = (images: ReturnType<typeof pic>[] | undefined): ValidatableItem => ({
    type: "SPEAKING_PROMPT",
    prompt: "Beschreiben Sie das Bild.",
    content: { kind: "SPEAKING", thinkSeconds: 20, answerSeconds: 30, maxTakes: 2, ...(images ? { images } : {}) },
    key: { kind: "NONE" },
    rubric: { contentPoints: ["Ort"] },
  });

  it("lets a picture option have no text when it has alt text", () => {
    expect(codes(choice([{ id: "a", text: "", image: pic() }, { id: "b", text: "", image: pic("Ein Hund.") }, { id: "c", text: "", image: pic("Ein Baum.") }]))).toEqual([]);
  });

  it("still refuses an empty option without a picture", () => {
    expect(itemProblems(choice([{ id: "a", text: "x", image: pic() }, { id: "b", text: "" }, { id: "c", text: "z" }]))).toEqual([{ code: "CHOICE_EMPTY", n: 2 }]);
  });

  it("refuses a picture without alt text, empty text or not", () => {
    expect(itemProblems(choice([{ id: "a", text: "", image: pic("  ") }, { id: "b", text: "Hund", image: pic("") }, { id: "c", text: "Baum" }]))).toEqual([
      { code: "IMAGE_ALT_EMPTY", n: 1 },
      { code: "IMAGE_ALT_EMPTY", n: 2 },
    ]);
  });

  it("refuses a storage key that is not a bank picture", () => {
    expect(codes(choice([{ id: "a", text: "", image: pic("Ein Hund.", "../../etc/passwd") }, { id: "b", text: "Hund" }, { id: "c", text: "Baum" }]))).toEqual(["IMAGE_KEY"]);
  });

  it("matching picture targets must carry a letter", () => {
    const m = (texts: string[]): ValidatableItem =>
      matching({
        right: texts.map((text, i) => ({ id: `r${i + 1}`, text, image: pic(`Bild ${i}`) })),
      });
    expect(codes(m(["Bild A", "Bild B", "Bild C"]))).toEqual([]);
    expect(codes(m(["Bild A", "", "Bild C"]))).toEqual(["MATCH_IMAGE_NOT_LETTERED"]);
    expect(codes(m(["Katze", "Hund", "Pferd"]))).toEqual(["MATCH_IMAGE_NOT_LETTERED", "MATCH_IMAGE_NOT_LETTERED", "MATCH_IMAGE_NOT_LETTERED"]);
  });

  it("task images: one or two pass, three fail, and only writing or speaking may have them", () => {
    expect(codes(speaking(undefined))).toEqual([]);
    expect(codes(speaking([pic()]))).toEqual([]);
    expect(codes(speaking([pic(), pic("Ein Hund.")]))).toEqual([]);
    expect(codes(speaking([pic(), pic("a"), pic("b")]))).toEqual(["IMAGES_COUNT"]);
    const onChoice = choice([{ id: "a", text: "x" }, { id: "b", text: "y" }, { id: "c", text: "z" }]);
    (onChoice.content as unknown as { images: unknown[] }).images = [pic()];
    expect(codes(onChoice)).toEqual(["IMAGES_KIND"]);
    const w = { type: "WRITING_PROMPT", prompt: "Schreiben Sie.", content: { kind: "WRITING", minWords: 20, maxWords: 40, images: [pic("")] }, key: { kind: "NONE" }, rubric: { contentPoints: ["x"] } } as ValidatableItem;
    expect(codes(w)).toEqual(["IMAGE_ALT_EMPTY"]);
  });
});
