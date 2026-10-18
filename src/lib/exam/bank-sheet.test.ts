import { describe, expect, it } from "vitest";
import { difficultyFor, withinOf } from "./difficulty";
import { scoreItem } from "./item-scoring";
import { makePresentation, toCandidateItem, unalias } from "./safe";
import {
  choiceAnswer,
  gapPrompt,
  headerColumn,
  issueMessage,
  planImport,
  readSheet,
  rowToItem,
  scriptSpeakers,
  templateCsv,
  type ImportSettings,
  type SheetRow,
} from "./bank-sheet";
import type { ItemAnswer, ItemSnapshot } from "./types";
import { validateItem } from "./validate";

const defaults: ImportSettings = { section: "GRAMMAR", level: "B1", within: "MID" };
const row = (cells: SheetRow["cells"], line = 2): SheetRow => ({ line, cells });
const codes = (r: { issues: Array<{ kind: string; code?: string; problem?: { code: string } }> }) =>
  r.issues.map((i) => (i.kind === "row" ? i.code : i.problem?.code));

describe("readSheet", () => {
  it("maps Turkish and English headers in any order and ignores unknown columns", () => {
    const sheet = readSheet("Soru;Tip;Seviye;Notlar;A;B;C;Cevap\nIch ___ müde.;tek seçimli;a2;x;bin;bist;ist;a\n");
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    expect(sheet.ignoredColumns).toEqual(["Notlar"]);
    expect(sheet.rows[0]).toEqual({ line: 2, cells: { question: "Ich ___ müde.", type: "tek seçimli", level: "a2", a: "bin", b: "bist", c: "ist", answer: "a" } });
  });

  it("says why a file cannot be read", () => {
    expect(readSheet("  ")).toEqual({ ok: false, code: "EMPTY" });
    expect(readSheet("foo,bar\n1,2")).toEqual({ ok: false, code: "NO_HEADER" });
    expect(readSheet("question,answer\nx,y")).toEqual({ ok: false, code: "NO_TYPE_COLUMN" });
    expect(readSheet("type,answer\nx,y")).toEqual({ ok: false, code: "NO_QUESTION_COLUMN" });
    expect(readSheet('type,question\nGAP_FILL,"open')).toEqual({ ok: false, code: "UNTERMINATED" });
    const many = ["type,question", ...Array.from({ length: 501 }, () => "SHORT_TEXT,x")].join("\n");
    expect(readSheet(many)).toEqual({ ok: false, code: "TOO_MANY_ROWS" });
  });
});

describe("rowToItem, per type", () => {
  it("single choice: letter, number or the option's text", () => {
    const base = { type: "SINGLE_CHOICE", question: "Ich ___ müde.", a: "bin", b: "bist", c: "ist" };
    for (const answer of ["a", "A", "1", "bin", " Bin "]) {
      const r = rowToItem(row({ ...base, answer }));
      expect(r.issues).toEqual([]);
      expect(r.item).toMatchObject({ type: "SINGLE_CHOICE", content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] }, key: { kind: "CHOICE", correct: ["a"] } });
    }
    expect(codes(rowToItem(row({ ...base, answer: "d" })))).toEqual(["ANSWER_UNKNOWN_OPTION"]);
    expect(codes(rowToItem(row({ ...base, answer: "a, b" })))).toEqual(["SINGLE_KEY_COUNT"]);
    expect(codes(rowToItem(row({ ...base, answer: "" })))).toEqual(["ANSWER_MISSING"]);
  });

  it("multi choice: several letters or texts", () => {
    const base = { type: "Çok seçimli", question: "Welche sind Verben?", a: "gehen", b: "Haus", c: "laufen", d: "grün" };
    expect(rowToItem(row({ ...base, answer: "a, c" })).item?.key).toEqual({ kind: "CHOICE", correct: ["a", "c"] });
    expect(rowToItem(row({ ...base, answer: "a c" })).item?.key).toEqual({ kind: "CHOICE", correct: ["a", "c"] });
    expect(rowToItem(row({ ...base, answer: "gehen; laufen" })).item?.key).toEqual({ kind: "CHOICE", correct: ["a", "c"] });
    expect(codes(rowToItem(row({ ...base, answer: "a, b, c, d" })))).toEqual(["MULTI_KEY_COUNT"]);
  });

  it("true / false / not given: one answer per statement, in several spellings", () => {
    const base = { type: "TRUE_FALSE_NG", question: "Richtig oder falsch?", a: "Satz eins.", b: "Satz zwei.", c: "Satz drei." };
    const r = rowToItem(row({ ...base, answer: "R, F, NG" }));
    expect(r.item?.content).toEqual({ kind: "TFNG", statements: [{ id: "s1", text: "Satz eins." }, { id: "s2", text: "Satz zwei." }, { id: "s3", text: "Satz drei." }] });
    expect(r.item?.key).toEqual({ kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } });
    expect(rowToItem(row({ ...base, answer: "doğru; yanlış; metinde yok" })).item?.key).toEqual({ kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } });
    expect(rowToItem(row({ ...base, answer: "richtig falsch ng" })).item?.key).toEqual({ kind: "TFNG", answers: { s1: "R", s2: "F", s3: "NG" } });
    const short = rowToItem(row({ ...base, answer: "R, F" }));
    expect(short.issues).toEqual([{ kind: "row", code: "TFNG_ANSWER_COUNT", expected: 3, got: 2 }]);
    expect(codes(rowToItem(row({ ...base, answer: "R, vielleicht, F" })))).toEqual(["TFNG_ANSWER_UNKNOWN"]);
  });

  it("gap fill typed: ___ becomes {{gN}}, answers split by ; and spellings by |", () => {
    const r = rowToItem(row({ type: "GAP_FILL", question: "Ich warte ___ dich und denke ___ dich.", answer: "auf | auf; an" }));
    expect(r.issues).toEqual([]);
    expect(r.item?.prompt).toBe("Ich warte {{g1}} dich und denke {{g2}} dich.");
    expect(r.item?.content).toEqual({ kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] });
    expect(r.item?.key).toEqual({ kind: "GAP", answers: { g1: ["auf", "auf"], g2: ["an"] } });
    expect(rowToItem(row({ type: "GAP_FILL", question: "Ich warte ___ dich.", answer: "auf; an" })).issues).toEqual([{ kind: "row", code: "GAP_ANSWER_COUNT", expected: 1, got: 2 }]);
    expect(codes(rowToItem(row({ type: "GAP_FILL", question: "Keine Lücke hier.", answer: "x" })))).toEqual(["GAP_NONE"]);
    expect(gapPrompt("Schon {{x}} markiert ___")).toBe("Schon {{x}} markiert ___");
  });

  it("gap fill drop-down: the gap's column holds its choices", () => {
    const r = rowToItem(row({ type: "boşluk doldurma", question: "Kannst du mir ___ Buch geben?", a: "das | den | dem", answer: "das" }));
    expect(r.item?.content).toEqual({ kind: "GAP", gaps: [{ id: "g1", choices: ["das", "den", "dem"] }] });
    expect(codes(rowToItem(row({ type: "GAP_FILL", question: "Kannst du mir ___ Buch geben?", a: "das / den / dem", answer: "die" })))).toEqual(["GAP_ANSWER_NOT_CHOICE"]);
  });

  it("MC cloze (skill grammar.cloze): four choices per gap column, the cloze rules apply", () => {
    const cells = { type: "GAP_FILL", skill: "grammar.cloze", question: "Wir ___ morgen ___ Hamburg.", a: "fahren | fährt | fuhr | gefahren", b: "nach | in | zu | bei", answer: "fahren; nach" };
    const r = rowToItem(row(cells));
    expect(r.issues).toEqual([]);
    expect(r.item?.skillTag).toBe("grammar.cloze");
    expect(r.item?.content).toEqual({ kind: "GAP", gaps: [{ id: "g1", choices: ["fahren", "fährt", "fuhr", "gefahren"] }, { id: "g2", choices: ["nach", "in", "zu", "bei"] }] });
    expect(codes(rowToItem(row({ ...cells, b: "nach | in | zu" })))).toEqual(["CLOZE_CHOICE_COUNT"]);
  });

  it("word bank (skill grammar.wordbank): the distractors column fills the key's pool, the word-bank rules apply", () => {
    expect(headerColumn("Çeldiriciler")).toBe("distractors");
    expect(headerColumn("distractors")).toBe("distractors");
    const cells = { type: "GAP_FILL", skill: "grammar.wordbank", question: "Wir ___ morgen ___ Hamburg.", answer: "fahren; nach", distractors: "fährt | zu | bei" };
    const r = rowToItem(row(cells));
    expect(r.issues).toEqual([]);
    expect(r.item?.key).toEqual({ kind: "GAP", answers: { g1: ["fahren"], g2: ["nach"] }, distractors: ["fährt", "zu", "bei"] });
    expect(codes(rowToItem(row({ ...cells, distractors: "fährt | zu" })))).toEqual(["WORDBANK_FEW_DISTRACTORS"]);
    expect(codes(rowToItem(row({ ...cells, distractors: "" })))).toEqual(["WORDBANK_FEW_DISTRACTORS"]);
    // An ordinary gap row keeps its key as before.
    expect(rowToItem(row({ type: "GAP_FILL", question: "Ich warte ___ dich.", answer: "auf" })).item?.key).toEqual({ kind: "GAP", answers: { g1: ["auf"] } });
  });

  it("matching: row = target per cell, = target for an extra target, shared targets kept once", () => {
    const r = rowToItem(row({ type: "MATCHING", question: "Ordnen Sie zu.", a: "Hund = bellt", b: "Katze -> miaut", c: "Kuh => muht", d: "= singt" }));
    expect(r.issues).toEqual([]);
    expect(r.item?.content).toEqual({
      kind: "MATCHING",
      left: [{ id: "l1", text: "Hund" }, { id: "l2", text: "Katze" }, { id: "l3", text: "Kuh" }],
      right: [{ id: "r1", text: "bellt" }, { id: "r2", text: "miaut" }, { id: "r3", text: "muht" }, { id: "r4", text: "singt" }],
    });
    expect(r.item?.key).toEqual({ kind: "MATCHING", pairs: { l1: "r1", l2: "r2", l3: "r3" } });
    expect(rowToItem(row({ type: "MATCHING", question: "Ordnen Sie zu.", a: "Hund bellt", b: "x = y" })).issues).toEqual([{ kind: "row", code: "MATCH_CELL_FORMAT", value: "a" }]);
    expect(codes(rowToItem(row({ type: "MATCHING", question: "Ordnen Sie zu.", a: "Hund = bellt" })))).toEqual(["MATCH_FEW_ROWS"]);
  });

  it("short text: accepted answers split by |", () => {
    const r = rowToItem(row({ type: "kısa cevap", question: "Gegenteil von teuer?", answer: "billig | günstig" }));
    expect(r.item).toMatchObject({ type: "SHORT_TEXT", content: { kind: "SHORT_TEXT", maxChars: 200 }, key: { kind: "SHORT_TEXT", accepted: ["billig", "günstig"] } });
  });

  it("names a missing or unknown type and a missing question", () => {
    expect(codes(rowToItem(row({ question: "x?" })))).toEqual(["TYPE_MISSING"]);
    expect(codes(rowToItem(row({ type: "ESSAY", question: "x?" })))).toEqual(["TYPE_UNKNOWN"]);
    expect(codes(rowToItem(row({ type: "SHORT_TEXT", answer: "x" })))).toEqual(["QUESTION_MISSING"]);
  });

  it("swaps an em dash for an en dash, as generated items do", () => {
    const r = rowToItem(row({ type: "SHORT_TEXT", question: "Ein Satz \u2014 mit Strich?", answer: "ja" }));
    expect(r.item?.prompt).toBe("Ein Satz – mit Strich?");
  });

  it("choiceAnswer prefers the whole option text over letters", () => {
    expect(choiceAnswer("3", [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }])).toEqual({ ids: ["b"], unknown: [] });
  });
});

describe("planImport", () => {
  const text = "Erster Absatz.\nZweiter Absatz.";
  const rows: SheetRow[] = [
    row({ type: "TRUE_FALSE_NG", section: "Okuma", text_title: "Wohnung", text, question: "Richtig?", a: "Eins.", b: "Zwei.", answer: "R, F" }, 2),
    row({ type: "SINGLE_CHOICE", text_title: "Wohnung", question: "Was stimmt?", a: "x", b: "y", c: "z", answer: "b", level: "A2", difficulty: "Zor" }, 3),
    row({ type: "SINGLE_CHOICE", question: "Ich ___ müde.", a: "bin", b: "bist", c: "ist", answer: "a" }, 4),
    row({ type: "SINGLE_CHOICE", question: "kaputt", answer: "a" }, 5),
  ];

  it("shares one text between rows of the same title and reports broken rows without dropping the rest", () => {
    const plan = planImport(rows, { ...defaults, section: "READING" });
    expect(plan.items.map((i) => i.line)).toEqual([2, 3, 4]);
    expect(plan.texts).toEqual([{ key: "t:wohnung", title: "Wohnung", body: text, section: "READING", level: "B1", speakers: null }]);
    expect(plan.items.map((i) => i.textKey)).toEqual(["t:wohnung", "t:wohnung", null]);
    expect(plan.rows.find((r) => r.line === 5)?.issues.length).toBeGreaterThan(0);
  });

  it("resolves settings: the wizard's row choice, else the cell, else the file's default", () => {
    const plan = planImport(rows, { section: "READING", level: "B2", within: "EASY" }, { 4: { level: "C1", within: "HARD" } });
    const s = (line: number) => plan.rows.find((r) => r.line === line)?.settings;
    expect(s(2)).toEqual({ section: "READING", level: "B2", within: "EASY" });
    expect(s(3)).toEqual({ section: "READING", level: "A2", within: "HARD" });
    expect(s(4)).toEqual({ section: "READING", level: "C1", within: "HARD" });
  });

  it("refuses a text in grammar, listening without a script, and a text named but never written", () => {
    const g = planImport([rows[1]], defaults);
    expect(codes(g.rows[0])).toEqual(["TEXT_WITHOUT_BODY"]);
    const grammar = planImport([rows[0]], defaults, { 2: { section: "GRAMMAR" } });
    expect(codes(grammar.rows[0])).toEqual(["TEXT_IN_GRAMMAR"]);
    const listening = planImport([rows[2]], { ...defaults, section: "LISTENING" });
    expect(codes(listening.rows[0])).toEqual(["LISTENING_WITHOUT_TEXT"]);
  });

  it("gives a listening script its speakers", () => {
    expect(scriptSpeakers("Anna: Hallo!\nBen: Hi.\nAnna: Wie geht's?")).toEqual({ speakers: [{ label: "Anna", voice: "A" }, { label: "Ben", voice: "B" }], tooMany: false });
    expect(scriptSpeakers("Nur ein Monolog ohne Namen.")).toEqual({ speakers: [], tooMany: false });
    expect(scriptSpeakers("A: x\nB: y\nC: z").tooMany).toBe(true);
  });

  it("drops a cell problem once the wizard overrides that value", () => {
    const bad = row({ type: "SHORT_TEXT", question: "Wie heißt das?", answer: "Haus", level: "Z9", difficulty: "sehr" }, 7);
    expect(codes(planImport([bad], defaults).rows[0])).toEqual(["LEVEL_UNKNOWN", "DIFFICULTY_UNKNOWN"]);
    expect(planImport([bad], defaults, { 7: { level: "A1", within: "EASY" } }).rows[0].issues).toEqual([]);
  });

  it("says each issue through an i18n key", () => {
    expect(issueMessage({ kind: "row", code: "GAP_ANSWER_COUNT", expected: 2, got: 1 })).toEqual({ key: "r_GAP_ANSWER_COUNT", values: { value: "", expected: 2, got: 1 } });
    expect(issueMessage({ kind: "item", problem: { code: "GAP_NO_ANSWER", n: 2, ids: ["g2"] } })).toEqual({ key: "p_GAP_NO_ANSWER", values: { n: 2, ids: "g2", detail: "" } });
  });
});

describe("the template file", () => {
  it.each(["tr", "en"] as const)("%s: reads back with one valid row per question type", (locale) => {
    const { text } = templateCsv(locale);
    const sheet = readSheet(text);
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    expect(sheet.ignoredColumns).toEqual([]);
    const plan = planImport(sheet.rows, defaults);
    expect(plan.rows.filter((r) => r.issues.length)).toEqual([]);
    expect(plan.items.map((i) => i.type)).toEqual(["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE_NG", "MATCHING", "GAP_FILL", "GAP_FILL", "SHORT_TEXT"]);
    expect(plan.items[4].content).toEqual({ kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] });
    expect(plan.items[5].content).toEqual({ kind: "GAP", gaps: [{ id: "g1", choices: ["das", "den", "dem"] }] });
    // The two reading questions share the one text.
    expect(plan.texts).toHaveLength(1);
    expect(plan.items[2].textKey).toBe(plan.items[3].textKey);
    expect(plan.items[2].within).toBe("EASY");
    for (const item of plan.items) expect(validateItem(item)).toEqual([]);
    expect(text).not.toContain("\u2014");
  });
});

describe("an imported matching question, all the way to a full score", () => {
  it("import -> approve check -> what the student sees -> the student's answer -> score 1", () => {
    const sheet = readSheet(templateCsv("tr").text);
    if (!sheet.ok) throw new Error("template");
    // The reading text spans two lines of the file, so the matching row starts on line 6.
    const plan = planImport(sheet.rows, defaults, { 6: { within: "HARD" } });
    const matching = plan.items.find((i) => i.type === "MATCHING")!;
    expect(matching.line).toBe(6);
    // What the import writes: the row's level and Zor as the numeric difficulty.
    const difficulty = difficultyFor(matching.level, matching.within);
    expect(withinOf(matching.level, difficulty)).toBe("HARD");
    // Approval runs the same structural check.
    expect(validateItem(matching)).toEqual([]);

    const text = plan.texts.find((t) => t.key === matching.textKey)!;
    const snapshot: ItemSnapshot = {
      id: "item-1",
      section: matching.section,
      level: matching.level,
      difficulty,
      type: matching.type,
      skillTag: matching.skillTag ?? "reading.imported",
      stimulusId: "stim-1",
      orderInStimulus: 2,
      prompt: matching.prompt,
      content: matching.content,
      key: matching.key,
      rubric: null,
      points: 1,
      stimulus: { id: "stim-1", section: "READING", level: text.level, title: text.title, body: text.body, audioKey: null, audioDurationMs: null },
    };
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const presentation = makePresentation(snapshot, rng);
    const seen = toCandidateItem(snapshot, presentation, null, 1, { maxPlays: 2 });
    expect(seen.content.kind).toBe("MATCHING");
    if (seen.content.kind !== "MATCHING") return;
    expect(JSON.stringify(seen)).not.toContain("pairs");
    expect(seen.stimulus).toEqual({ kind: "READING", title: "Neue Nachbarin", text: text.body });

    // The student matches by the texts on screen, answering with the aliased target ids.
    const want: Record<string, string> = { "Frau Keller": "arbeitet im Krankenhaus.", "Herr Keller": "kocht in einem Restaurant.", "Lena und Max": "gehen in die Grundschule." };
    const matches = Object.fromEntries(seen.content.left.map((l) => [l.id, seen.content.kind === "MATCHING" ? seen.content.right.find((r) => r.text === want[l.text])!.id : ""]));
    // The server turns the aliases back into bank ids before scoring (exam-flow).
    const answer: ItemAnswer = { matches: Object.fromEntries(Object.entries(matches).map(([k, v]) => [k, unalias(presentation, v)!])) };
    expect(scoreItem(snapshot.type, snapshot.content, snapshot.key, answer)).toEqual({ score: 1, correct: true });
    // And a wrong pairing is not a full score.
    const swapped: ItemAnswer = { matches: { ...answer.matches, l1: answer.matches!.l2, l2: answer.matches!.l1 } };
    expect(scoreItem(snapshot.type, snapshot.content, snapshot.key, swapped)?.correct).toBe(false);
  });
});
