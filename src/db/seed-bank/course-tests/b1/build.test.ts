import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { splitInstruction, splitTitle } from "@/lib/exam/prompt-instruction";
import { textGapKindOf } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { abcCloze, formalEmail, grammarChoice, listeningChoice, listeningClip, readingChoice, readingText, speakingTask } from "./build";

const spec = {
  instruction: "Lesen Sie den Text. Wählen Sie für jede Lücke die richtige Lösung.",
  title: "Im Café",
  text: "Hallo,\n\nSie [[trinke|*trinkt|trinken#praesens.regelmaessig]] einen Tee und isst [[ein|eine|*einen#akkusativ]] Kuchen.\n\nViele Grüße",
  note: "Verbformen.",
};

describe("abcCloze", () => {
  const item = abcCloze(spec);

  it("is a valid MC cloze item with three choices per gap, kept in the written order", () => {
    expect(validateItem(item)).toEqual([]);
    expect(textGapKindOf(item)).toBe("CLOZE");
    if (item.content.kind !== "GAP" || item.key.kind !== "GAP") throw new Error("not a gap item");
    expect(item.content.gaps.map((g) => g.choices)).toEqual([
      ["trinke", "trinkt", "trinken"],
      ["ein", "eine", "einen"],
    ]);
    expect(item.key.answers).toEqual({ g1: ["trinkt"], g2: ["einen"] });
    expect(item.key.topics).toEqual({ g1: "praesens.regelmaessig", g2: "akkusativ" });
  });

  it("keeps the paragraphs of the text and puts instruction and title in front, as the cloze screen splits them", () => {
    expect(item.prompt).toBe(
      "Lesen Sie den Text. Wählen Sie für jede Lücke die richtige Lösung.\n\nIm Café\n\nHallo,\n\nSie {{g1}} einen Tee und isst {{g2}} Kuchen.\n\nViele Grüße",
    );
    const { instruction, content } = splitInstruction(item.prompt, "stem");
    expect(instruction).toBe(spec.instruction);
    expect(splitTitle(content).title).toBe("Im Café");
  });

  it("scores each gap on its own", () => {
    expect(scoreItem(item.type, item.content, item.key, { gaps: { g1: "trinkt", g2: "ein" } })?.score).toBe(0.5);
    expect(scoreItem(item.type, item.content, item.key, { gaps: { g1: "trinkt", g2: "einen" } })?.score).toBe(1);
  });

  it("puts the note into the explanation", () => {
    expect(item.explanation).toContain("Geprüft: Verbformen.");
  });

  it("rejects a gap without exactly three choices, exactly one right one and a topic", () => {
    const body = (gap: string) => ({ ...spec, text: `Sie ${gap} Tee.` });
    expect(() => abcCloze(body("[[*trinkt|trinke#praesens]]"))).toThrow(/exactly 3/);
    expect(() => abcCloze(body("[[*trinkt|trinke|trinken|trinkst#praesens]]"))).toThrow(/exactly 3/);
    expect(() => abcCloze(body("[[trinkt|trinke|trinken#praesens]]"))).toThrow(/exactly one/);
    expect(() => abcCloze(body("[[*trinkt|*trinke|trinken#praesens]]"))).toThrow(/exactly one/);
    expect(() => abcCloze(body("[[*trinkt|trinke|trinken]]"))).toThrow(/no #topic/);
  });

  it("rejects equal choices, also by case or spelling, and a text without gaps", () => {
    expect(() => abcCloze({ ...spec, text: "Er [[*heißt|heisst|heiße#praesens]] Tom." })).toThrow(/equal/);
    expect(() => abcCloze({ ...spec, text: "Er heißt Tom." })).toThrow(/no gap/);
  });
});

describe("single choices", () => {
  const stim = readingText("k", "T", "Thema", "Text A - x\nBody");

  it("a reading choice names three options in the written order, the key points at the right one", () => {
    const item = readingChoice(stim, "detail", "Wer?", ["Text A", "Text C", "Text D"], 1, "Text C.");
    expect(validateItem(item)).toEqual([]);
    expect(item.content.kind === "CHOICE" && item.content.options.map((o) => o.text)).toEqual(["Text A", "Text C", "Text D"]);
    expect(item.key).toEqual({ kind: "CHOICE", correct: ["b"] });
    expect(item.stimulusKey).toBe("k");
  });

  it("a sentence has exactly four options", () => {
    expect(validateItem(grammarChoice("reflexiv", "Ich wasche ___ die Hände.", ["mich", "mir", "sich", "mein"], 1, "x"))).toEqual([]);
    expect(() => grammarChoice("reflexiv", "Ich wasche ___ die Hände.", ["mich", "mir", "sich"], 1, "x")).toThrow(/4 options/);
  });

  it("refuses an answer outside the options", () => {
    expect(() => readingChoice(stim, "detail", "Wer?", ["Text A", "Text C", "Text D"], 3, "x")).toThrow(/not an option/);
  });
});

describe("listeningClip", () => {
  it("accepts a two-speaker script with two voices and plays twice", () => {
    const clip = listeningClip("c", "T", "Thema", [{ label: "Anna", voice: "A" }, { label: "Ben", voice: "C" }], ["Anna: Hallo.", "Ben: Hallo, Anna."]);
    expect(clip.maxPlays).toBe(2);
    expect(clip.body).toBe("Anna: Hallo.\nBen: Hallo, Anna.");
    expect(validateItem(listeningChoice(clip, "detail", "Wer?", ["a", "b", "c"], 0, "x"))).toEqual([]);
  });

  it("refuses a line without a declared speaker and two speakers on one voice", () => {
    expect(() => listeningClip("c", "T", "Thema", [{ label: "Anna", voice: "A" }], ["Ben: Hallo."])).toThrow(/declared speaker/);
    expect(() => listeningClip("c", "T", "Thema", [{ label: "Anna", voice: "A" }, { label: "Ben", voice: "A" }], ["Anna: Hallo."])).toThrow(/share a voice/);
  });
});

describe("writing and speaking tasks", () => {
  const email = formalEmail({
    situation: "Sie schreiben an Frau Neumann.",
    points: ["Erstens.", "Zweitens.", "Drittens."],
    contentPoints: ["eins", "zwei", "drei"],
    studentPoints: ["a", "b", "c"],
    explanation: "x",
  });

  it("lays the email task out as situation, three bullet points and the reminder", () => {
    expect(validateItem(email)).toEqual([]);
    expect(email.prompt).toBe(
      "Sie schreiben an Frau Neumann.\n\nSchreiben Sie zu allen drei Punkten:\n- Erstens.\n- Zweitens.\n- Drittens.\n\nSchreiben Sie ca. 60-80 Wörter. Vergessen Sie die formelle Anrede und die Grußformel nicht.",
    );
    expect(email.content).toEqual({ kind: "WRITING", minWords: 60, maxWords: 80 });
    expect(email.rubric?.register).toBe("formell (Sie)");
  });

  it("gives each speaking task the spec's B1 timing and one take", () => {
    const task = (skill: "introduction" | "presentation" | "planning") => speakingTask(skill, "Sprechen Sie.\n\n- a\n- b", ["a", "b"], "x");
    expect(validateItem(task("introduction"))).toEqual([]);
    expect(task("introduction").content).toEqual({ kind: "SPEAKING", thinkSeconds: 30, answerSeconds: 60, maxTakes: 1 });
    expect(task("presentation").content).toEqual({ kind: "SPEAKING", thinkSeconds: 60, answerSeconds: 120, maxTakes: 1 });
    expect(task("planning").content).toEqual({ kind: "SPEAKING", thinkSeconds: 60, answerSeconds: 90, maxTakes: 1 });
  });
});
