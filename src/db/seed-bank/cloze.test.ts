import { describe, expect, it } from "vitest";
import { scoreItem } from "@/lib/exam/item-scoring";
import { textGapKindOf } from "@/lib/exam/types";
import { validateItem } from "@/lib/exam/validate";
import { cloze } from "./cloze";
import { SEED_BANK } from "./index";
import { seedItemKey } from "./seed-key";

const spec = {
  title: "Im Café",
  first: "Lena geht ins Café.",
  body: "Sie [[trinkt|trinke|trinken|trinkst]] einen Tee und isst [[ein|eine|einen|einem]] Brot.",
  last: "Dann geht sie nach Hause.",
};

describe("cloze", () => {
  const item = cloze("A1", "EASY", spec);

  it("is a GAP_FILL cloze item that validates", () => {
    expect(item.type).toBe("GAP_FILL");
    expect(item.section).toBe("GRAMMAR");
    expect(textGapKindOf(item)).toBe("CLOZE");
    expect(validateItem(item)).toEqual([]);
  });

  it("writes instruction, title and text as paragraphs with numbered markers", () => {
    const [instruction, title, text] = item.prompt.split("\n\n");
    expect(instruction).toContain("Wählen Sie");
    expect(title).toBe("Im Café");
    expect(text).toBe("Lena geht ins Café. Sie {{g1}} einen Tee und isst {{g2}} Brot. Dann geht sie nach Hause.");
  });

  it("stores the answer and its three distractors as the choices, one answer per gap in the key", () => {
    if (item.content.kind !== "GAP" || item.key.kind !== "GAP") throw new Error("not a gap item");
    expect(item.content.gaps.map((g) => [...(g.choices ?? [])].sort())).toEqual([
      ["trinke", "trinken", "trinkst", "trinkt"],
      ["ein", "eine", "einem", "einen"],
    ]);
    expect(item.key.answers).toEqual({ g1: ["trinkt"], g2: ["ein"] });
  });

  it("builds the same item every time, so the seed key is stable", () => {
    expect(cloze("A1", "EASY", spec)).toEqual(item);
    expect(seedItemKey(cloze("A1", "EASY", spec))).toBe(seedItemKey(item));
  });

  it("scores each gap on its own", () => {
    const s = scoreItem(item.type, item.content, item.key, { gaps: { g1: "trinkt", g2: "einen" } });
    expect(s?.score).toBe(0.5);
  });

  it("puts the teacher note into the explanation", () => {
    expect(cloze("A1", "EASY", { ...spec, note: "Verbformen." }).explanation).toContain("Geprüft: Verbformen.");
  });

  it("rejects a gap without exactly three distractors", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|trinke|trinken]] Tee." })).toThrow(/exactly 3/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c|d]] Tee." })).toThrow(/exactly 3/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt]] Tee." })).toThrow(/exactly 3/);
  });

  it("rejects options that repeat, also by case, ß or umlaut spelling", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "[[Der|der|die|das]] Tee." })).toThrow(/equal/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Er [[heißt|heisst|heiße|heißen]] Tom." })).toThrow(/equal/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Ich [[möchte|moechte|mag|will]] Tee." })).toThrow(/equal/);
  });

  it("rejects an empty answer or distractor", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[ |a|b|c]] Tee." })).toThrow(/no answer/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a||c]] Tee." })).toThrow(/empty/);
  });

  it("rejects a body without gaps, stray brackets and gaps in the intact sentences", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie trinkt Tee." })).toThrow(/no gap/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c]] Tee ]]." })).toThrow(/stray/);
    expect(() => cloze("A1", "EASY", { ...spec, first: "Lena [[geht|a|b|c]]." })).toThrow(/outside the body/);
    expect(() => cloze("A1", "EASY", { ...spec, last: "Dann {{g9}}." })).toThrow(/outside the body/);
  });
});

describe("cloze #topic", () => {
  const tagged = cloze("A1", "EASY", {
    ...spec,
    body: "Sie [[trinkt|trinke|trinken|trinkst#praesens]] einen Tee und isst [[ein|eine|einen|einem#akkusativ]] Brot.",
  });
  const plain = cloze("A1", "EASY", spec);

  it("strips the suffix and stores it in key.topics by gap id", () => {
    expect(tagged.key).toEqual({ kind: "GAP", answers: { g1: ["trinkt"], g2: ["ein"] }, topics: { g1: "praesens", g2: "akkusativ" } });
    expect(tagged.prompt).not.toContain("#");
    expect(JSON.stringify(tagged.content)).not.toContain("praesens");
    expect(validateItem(tagged)).toEqual([]);
  });

  it("leaves prompt, content and seed key unchanged, and key.topics off without a suffix", () => {
    expect(tagged.prompt).toBe(plain.prompt);
    expect(tagged.content).toEqual(plain.content);
    expect(plain.key).not.toHaveProperty("topics");
    const input = (i: typeof plain) => ({ section: i.section, level: i.level, type: i.type, prompt: i.prompt, content: i.content });
    expect(seedItemKey(input(tagged))).toBe(seedItemKey(input(plain)));
  });

  it("keeps the seed key of a shipped text when topics are added", () => {
    const real = SEED_BANK.items.find((i) => i.skillTag === "grammar.cloze" && i.level === "B1" && i.prompt.includes("Ein Praktikum im Hotel"));
    if (!real) throw new Error("shipped text not found");
    const rebuilt = cloze("B1", "EASY", {
      title: "Ein Praktikum im Hotel",
      first: "Im letzten Sommer hat Elif ein Praktikum in einem Hotel am Bodensee gemacht.",
      body:
        "Sie hatte sich schon im Winter [[um|über|an|zu#praeposition]] die Stelle beworben. " +
        "Das Hotel, in [[dem|das|den|der#relativsatz]] sie gearbeitet hat, liegt direkt am Wasser. " +
        "Jeden Morgen [[musste|müsste|musstest|muss]] sie schon um sechs Uhr aufstehen, [[weil|denn|deshalb|trotzdem#konnektor]] das Frühstück für die Gäste um sieben Uhr begann. " +
        "Am Anfang hat sie vor allem in der Küche [[geholfen|helfen|half|hilft]]. " +
        "Später durfte sie auch an der Rezeption arbeiten und [[die|den|dem|der]] Gäste begrüßen. " +
        "Viele Gäste kamen aus der Schweiz oder aus Österreich, und manche haben [[ihr|sie|ihre|ihn]] viel von ihrer Heimat erzählt. " +
        "Die Arbeit war anstrengend, aber Elif hat [[sich|ihr|ihm|ihnen]] nie gelangweilt. " +
        "Ihre Chefin war [[mit|von|bei|zu]] ihr sehr zufrieden. " +
        "Am letzten Tag hat sie Elif gefragt, [[ob|dass|wenn|als]] sie im nächsten Sommer wiederkommen möchte. " +
        "Elif [[würde|wurde|würden|geworden]] sehr gern zurückkommen, aber im nächsten Sommer muss sie ihre Abschlussprüfungen schreiben.",
      last: "Mit zwei Kolleginnen aus dem Hotel schreibt sie sich bis heute regelmäßig Nachrichten.",
    });
    const input = (i: typeof real) => ({ section: i.section, level: i.level, type: i.type, prompt: i.prompt, content: i.content, stimulusKey: null });
    expect(seedItemKey(input(rebuilt))).toBe(seedItemKey(input(real)));
    expect(rebuilt.key).toMatchObject({ topics: { g1: "praeposition", g2: "relativsatz", g4: "konnektor" } });
  });

  it("rejects an empty or doubled topic", () => {
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c#]] Tee." })).toThrow(/empty topic/);
    expect(() => cloze("A1", "EASY", { ...spec, body: "Sie [[trinkt|a|b|c#x#y]] Tee." })).toThrow(/more than one/);
  });
});
