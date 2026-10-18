import { describe, expect, it } from "vitest";
import { difficultyFor } from "@/lib/exam/difficulty";
import type { ItemContent, ItemKey } from "@/lib/exam/types";
import { itemProblems } from "@/lib/exam/validate";
import { draftFromItem, draftToItem, emptyDraft, insertGap, nextId, pickedKindOfDraft, saveInput, saveItemSchema, syncGaps, underscoresToMarkers, type EditableItem } from "./item-editor-model";

const item = (over: Partial<EditableItem> & { content: ItemContent; key: ItemKey }): EditableItem => ({
  type: "SINGLE_CHOICE",
  section: "GRAMMAR",
  level: "A2",
  difficulty: difficultyFor("A2", "HARD"),
  prompt: "Ich ___ müde.",
  rubric: null,
  explanation: null,
  ...over,
});

describe("draftFromItem / draftToItem round trip", () => {
  const cases: EditableItem[] = [
    item({ content: { kind: "CHOICE", options: [{ id: "a", text: "bin" }, { id: "b", text: "bist" }, { id: "c", text: "ist" }] }, key: { kind: "CHOICE", correct: ["a"] } }),
    item({ type: "MULTI_CHOICE", content: { kind: "CHOICE", options: [{ id: "a", text: "gehen" }, { id: "b", text: "Haus" }, { id: "c", text: "laufen" }] }, key: { kind: "CHOICE", correct: ["a", "c"] } }),
    item({ type: "TRUE_FALSE_NG", section: "READING", prompt: "Richtig?", content: { kind: "TFNG", statements: [{ id: "s1", text: "Eins." }, { id: "s2", text: "Zwei." }] }, key: { kind: "TFNG", answers: { s1: "R", s2: "NG" } } }),
    item({ type: "GAP_FILL", prompt: "Ich warte {{g1}} dich, {{g2}} du kommst.", content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2", choices: ["bis", "weil", "ob"] }] }, key: { kind: "GAP", answers: { g1: ["auf"], g2: ["bis"] } } }),
    item({ type: "MATCHING", section: "READING", prompt: "Ordnen Sie zu.", content: { kind: "MATCHING", left: [{ id: "l1", text: "Hund" }, { id: "l2", text: "Katze" }], right: [{ id: "r1", text: "bellt" }, { id: "r2", text: "miaut" }, { id: "r3", text: "muht" }] }, key: { kind: "MATCHING", pairs: { l1: "r1", l2: "r2" } } }),
    item({ type: "SHORT_TEXT", prompt: "Gegenteil von teuer?", content: { kind: "SHORT_TEXT", maxChars: 120 }, key: { kind: "SHORT_TEXT", accepted: ["billig", "günstig"] } }),
    item({ type: "WRITING_PROMPT", section: "WRITING", prompt: "Schreiben Sie eine E-Mail.", content: { kind: "WRITING", minWords: 80, maxWords: 120 }, key: { kind: "NONE" }, rubric: { contentPoints: ["Dank", "Frage"], register: "informell (du)" } }),
    item({ type: "SPEAKING_PROMPT", section: "SPEAKING", prompt: "Erzählen Sie.", content: { kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 90, maxTakes: 2 }, key: { kind: "NONE" }, rubric: { contentPoints: ["Ort", "Zeit"] } }),
    item({ type: "WRITING_PROMPT", section: "WRITING", prompt: "Schreiben Sie Jan.", content: { kind: "WRITING", minWords: 20, maxWords: 30 }, key: { kind: "NONE" }, rubric: { contentPoints: ["Dank: am Samstag"], studentPoints: ["sich bedanken", "einen Termin vorschlagen"] } }),
  ];
  it.each(cases.map((c) => [c.type, c] as const))("%s comes back unchanged", (_type, it) => {
    const d = draftFromItem(it);
    expect(d.within).toBe("HARD");
    const back = draftToItem(d);
    expect(back).toEqual({ type: it.type, prompt: it.prompt, content: it.content, key: it.key, rubric: it.rubric });
    expect(itemProblems(back)).toEqual([]);
  });
});

describe("student points in the editor", () => {
  const writing = item({ type: "WRITING_PROMPT", section: "WRITING", prompt: "Schreiben Sie Jan.", content: { kind: "WRITING", minWords: 20, maxWords: 30 }, key: { kind: "NONE" }, rubric: { contentPoints: ["Dank"] } });

  it("reads one point per line, drops blank lines and sends them in the save payload", () => {
    const d = { ...draftFromItem(writing), studentPoints: "  sich bedanken \n\n einen Termin vorschlagen" };
    expect(draftToItem(d).rubric).toEqual({ contentPoints: ["Dank"], studentPoints: ["sich bedanken", "einen Termin vorschlagen"] });
    expect(saveItemSchema.parse(saveInput(d, null)).rubric?.studentPoints).toEqual(["sich bedanken", "einen Termin vorschlagen"]);
  });

  it("leaves the field out when it is empty", () => {
    expect(draftToItem(draftFromItem(writing)).rubric).toEqual({ contentPoints: ["Dank"] });
  });

  it("names a seventh point and a point over 80 characters while editing", () => {
    const d = draftFromItem(writing);
    expect(itemProblems(draftToItem({ ...d, studentPoints: ["a", "b", "c", "d", "e", "f", "g"].join("\n") })).map((p) => p.code)).toEqual(["STUDENT_POINTS_COUNT"]);
    expect(itemProblems(draftToItem({ ...d, studentPoints: `kurz\n${"x".repeat(81)}` }))).toEqual([{ code: "STUDENT_POINT_TEXT", n: 2 }]);
  });
});

describe("MC cloze and word-bank items in the editor (spec 2026-10-18)", () => {
  const bank = item({
    type: "GAP_FILL",
    prompt: "Wir {{g1}} morgen {{g2}} Hamburg.",
    content: { kind: "GAP", gaps: [{ id: "g1" }, { id: "g2" }] },
    key: { kind: "GAP", answers: { g1: ["fahren"], g2: ["nach"] }, distractors: ["fährt", "zu", "bei"] },
    skillTag: "grammar.wordbank",
  });

  it("a word bank comes back with its distractors and passes the word-bank rules", () => {
    const d = draftFromItem(bank);
    expect(d.skillTag).toBe("grammar.wordbank");
    const back = draftToItem(d);
    expect(back).toEqual({ type: bank.type, prompt: bank.prompt, content: bank.content, key: bank.key, rubric: null, skillTag: "grammar.wordbank" });
    expect(itemProblems(back)).toEqual([]);
    // The payload keeps the pool, so saving does not empty it.
    expect(saveItemSchema.parse(saveInput(d, null)).key).toEqual(bank.key);
  });

  it("the word-bank and cloze rules show while editing", () => {
    const d = draftFromItem(bank);
    expect(itemProblems(draftToItem({ ...d, distractors: "fährt" })).map((p) => p.code)).toEqual(["WORDBANK_FEW_DISTRACTORS"]);
    const cloze = draftFromItem(
      item({
        type: "GAP_FILL",
        prompt: "Wir {{g1}} morgen.",
        content: { kind: "GAP", gaps: [{ id: "g1", choices: ["fahren", "fährt", "fuhr"] }] },
        key: { kind: "GAP", answers: { g1: ["fahren"] } },
        skillTag: "grammar.cloze",
      }),
    );
    expect(itemProblems(draftToItem(cloze)).map((p) => p.code)).toEqual(["CLOZE_CHOICE_COUNT"]);
  });

  it("names the picked kind of a stored item and nothing else", () => {
    expect(pickedKindOfDraft(draftFromItem(bank))).toBe("WORDBANK");
    expect(pickedKindOfDraft({ type: "GAP_FILL", skillTag: "grammar.cloze" })).toBe("CLOZE");
    expect(pickedKindOfDraft({ type: "GAP_FILL", skillTag: "grammar.ctest" })).toBeNull();
    expect(pickedKindOfDraft({ type: "GAP_FILL", skillTag: null })).toBeNull();
    expect(pickedKindOfDraft({ type: "SINGLE_CHOICE", skillTag: "grammar.cloze" })).toBeNull();
  });

  it("editing a cloze gap's choices and a word bank's distractors is checked with the same rules", () => {
    const cloze = draftFromItem(
      item({
        type: "GAP_FILL",
        prompt: "Wir {{g1}} morgen.",
        content: { kind: "GAP", gaps: [{ id: "g1", choices: ["fahren", "fährt", "fuhr", "fahrt"] }] },
        key: { kind: "GAP", answers: { g1: ["fahren"] } },
        skillTag: "grammar.cloze",
      }),
    );
    expect(itemProblems(draftToItem(cloze))).toEqual([]);
    const edited = { ...cloze, gaps: cloze.gaps.map((g) => ({ ...g, choices: "fahren | fährt | fuhr | fahren" })) };
    expect(itemProblems(draftToItem(edited)).map((p) => p.code)).toEqual(["GAP_CHOICE_REPEAT"]);
    const wb = draftFromItem(bank);
    expect(itemProblems(draftToItem({ ...wb, distractors: "fährt | zu | nach" })).map((p) => p.code)).toEqual(["WORDBANK_DISTRACTOR_IS_ANSWER"]);
    expect(itemProblems(draftToItem({ ...wb, distractors: "fährt | zu | bei | im Haus" })).map((p) => p.code)).toEqual(["WORDBANK_DISTRACTOR_NOT_WORD"]);
  });

  it("an item without a skill tag or distractors converts exactly as before", () => {
    const d = emptyDraft("GAP_FILL", "GRAMMAR", "B1");
    expect(d.skillTag).toBeNull();
    expect(d.distractors).toBe("");
    expect(draftToItem({ ...d, prompt: "Ich warte {{g1}} dich." })).not.toHaveProperty("skillTag");
  });
});

describe("an empty draft", () => {
  it("does not pass until the teacher marks the answer", () => {
    const d = emptyDraft("SINGLE_CHOICE", "GRAMMAR", "B1");
    const codes = itemProblems(draftToItem(d)).map((p) => p.code);
    expect(codes).toContain("PROMPT_EMPTY");
    const filled = { ...d, prompt: "Ich ___ müde.", options: d.options.map((o, i) => ({ ...o, text: ["bin", "bist", "ist", "sind"][i] })) };
    expect(itemProblems(draftToItem(filled)).map((p) => p.code)).toEqual(["SINGLE_KEY_COUNT"]);
    filled.options[0].correct = true;
    expect(itemProblems(draftToItem(filled))).toEqual([]);
  });

  it("matching needs every row paired", () => {
    const d = { ...emptyDraft("MATCHING", "READING", "A2"), prompt: "Ordnen Sie zu." };
    d.rows = d.rows.map((r, i) => ({ ...r, text: `Zeile ${i}` }));
    d.targets = d.targets.map((r, i) => ({ ...r, text: `Ziel ${i}` }));
    expect(itemProblems(draftToItem(d)).map((p) => p.code)).toEqual(["MATCH_ROW_NO_TARGET", "MATCH_ROW_NO_TARGET", "MATCH_ROW_NO_TARGET"]);
    d.rows = d.rows.map((r, i) => ({ ...r, target: d.targets[i].id }));
    expect(itemProblems(draftToItem(d))).toEqual([]);
  });
});

describe("gaps", () => {
  it("turns ___ into the next free markers and keeps typed answers by id", () => {
    expect(underscoresToMarkers("A ___ b {{g1}} c ____")).toBe("A {{g2}} b {{g1}} c {{g3}}");
    const gaps = syncGaps("x {{g2}} y {{g1}}", [{ id: "g1", mode: "choice", accepted: "a", choices: "a | b | c" }]);
    expect(gaps).toEqual([
      { id: "g2", mode: "typed", accepted: "", choices: "" },
      { id: "g1", mode: "choice", accepted: "a", choices: "a | b | c" },
    ]);
    expect(insertGap("Ich warte  dich.", 10)).toEqual({ prompt: "Ich warte {{g1}} dich.", id: "g1", caret: 16 });
  });

  it("nextId skips taken ids, letters for options", () => {
    expect(nextId(["a", "b", "d"], "")).toBe("c");
    expect(nextId(["s1", "s2"], "s")).toBe("s3");
  });
});

describe("saveInput", () => {
  it("passes the server's schema and carries a new question's own text only for reading or listening", () => {
    const d = { ...emptyDraft("SHORT_TEXT", "READING", "B1"), prompt: "Wie heißt das?", accepted: "Haus | das Haus", textTitle: "Titel", textBody: "Ein Text." };
    const input = saveInput(d, null);
    expect(saveItemSchema.safeParse(input).success).toBe(true);
    expect(input.text).toEqual({ title: "Titel", body: "Ein Text." });
    expect(input.key).toEqual({ kind: "SHORT_TEXT", accepted: ["Haus", "das Haus"] });
    expect(saveInput({ ...d, section: "GRAMMAR" }, null).text).toBeNull();
    expect(saveInput(d, "6f1d3b8e-8f43-4a8c-9f0e-0a9a7c1e2b3d").text).toBeNull();
  });

  it("swaps an em dash for an en dash", () => {
    const d = { ...emptyDraft("SHORT_TEXT", "GRAMMAR", "B1"), prompt: "Ein Satz \u2014 mit Strich", accepted: "ja" };
    expect(saveInput(d, null).prompt).toBe("Ein Satz – mit Strich");
  });
});
