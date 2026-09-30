import { describe, expect, it } from "vitest";
import { toGeminiSchema } from "@/lib/ai";
import {
  ALLOWED_TYPES,
  DEFAULT_MAX_TAKES,
  ITEM_GENERATION_JSON_SCHEMA,
  TEXT_LENGTH,
  buildGenerationMessages,
  buildGenerationRepairMessages,
  generationSpecSchema,
  itemToWire,
  parseGeneratedBatch,
  wireItemSchema,
  wireToItem,
  type GenerationSpec,
} from "./item-generation";
import { validateItem } from "./validate";

const EM_DASH = "\u2014";

const wire = (fields: Record<string, unknown>) =>
  wireItemSchema.parse({
    prompt: "Frage",
    skillTag: "reading.detail",
    explanation: "Weil.",
    within: "MID",
    options: [],
    correctOptionIds: [],
    statements: [],
    gaps: [],
    left: [],
    right: [],
    pairs: [],
    minWords: 0,
    maxWords: 0,
    thinkSeconds: 0,
    answerSeconds: 0,
    contentPoints: [],
    register: "",
    ...fields,
  });

const choice = (correct = "b") => ({
  prompt: "Ich wohne ___ Berlin.",
  options: [
    { id: "a", text: "an" },
    { id: "b", text: "in" },
    { id: "c", text: "auf" },
  ],
  correctOptionIds: [correct],
});

describe("wireToItem", () => {
  it("SINGLE_CHOICE", () => {
    const r = wireToItem(wire(choice()), "SINGLE_CHOICE");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.content).toEqual({ kind: "CHOICE", options: choice().options });
    expect(r.item.key).toEqual({ kind: "CHOICE", correct: ["b"] });
    expect(r.item.rubric).toBeUndefined();
    expect(r.item.skillTag).toBe("reading.detail");
  });

  it("TRUE_FALSE_NG", () => {
    const r = wireToItem(
      wire({
        statements: [
          { id: "s1", text: "Anna wohnt in Köln.", answer: "R" },
          { id: "s2", text: "Anna hat einen Hund.", answer: "NG" },
        ],
      }),
      "TRUE_FALSE_NG",
    );
    expect(r.ok && r.item.content).toEqual({
      kind: "TFNG",
      statements: [
        { id: "s1", text: "Anna wohnt in Köln." },
        { id: "s2", text: "Anna hat einen Hund." },
      ],
    });
    expect(r.ok && r.item.key).toEqual({ kind: "TFNG", answers: { s1: "R", s2: "NG" } });
  });

  it("GAP_FILL with a drop-down gap and a typed gap", () => {
    const r = wireToItem(
      wire({
        prompt: "Ich gebe {{g1}} Mann das Buch und {{g2}} gehe.",
        gaps: [
          { id: "g1", choices: ["dem", "den", "der"], accepted: ["dem"] },
          { id: "g2", choices: [], accepted: ["ich", "Ich"] },
        ],
      }),
      "GAP_FILL",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.content).toEqual({
      kind: "GAP",
      gaps: [{ id: "g1", choices: ["dem", "den", "der"] }, { id: "g2" }],
    });
    expect(r.item.key).toEqual({ kind: "GAP", answers: { g1: ["dem"], g2: ["ich", "Ich"] } });
  });

  it("MATCHING", () => {
    const r = wireToItem(
      wire({
        left: [
          { id: "l1", text: "Wohnung" },
          { id: "l2", text: "Arbeit" },
        ],
        right: [
          { id: "r1", text: "Absatz 1" },
          { id: "r2", text: "Absatz 2" },
          { id: "r3", text: "Absatz 3" },
        ],
        pairs: [
          { left: "l1", right: "r2" },
          { left: "l2", right: "r1" },
        ],
      }),
      "MATCHING",
    );
    expect(r.ok && r.item.key).toEqual({ kind: "MATCHING", pairs: { l1: "r2", l2: "r1" } });
    expect(r.ok && r.item.content.kind).toBe("MATCHING");
  });

  it("WRITING_PROMPT with rubric", () => {
    const r = wireToItem(
      wire({
        minWords: 80,
        maxWords: 120,
        contentPoints: ["Dank", "Termin vorschlagen"],
        register: "formell (Sie)",
      }),
      "WRITING_PROMPT",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.content).toEqual({ kind: "WRITING", minWords: 80, maxWords: 120 });
    expect(r.item.key).toEqual({ kind: "NONE" });
    expect(r.item.rubric).toEqual({ contentPoints: ["Dank", "Termin vorschlagen"], register: "formell (Sie)" });
  });

  it("SPEAKING_PROMPT without register", () => {
    const r = wireToItem(
      wire({ thinkSeconds: 30, answerSeconds: 60, contentPoints: ["Name", "Hobby"] }),
      "SPEAKING_PROMPT",
    );
    expect(r.ok && r.item.content).toEqual({
      kind: "SPEAKING",
      thinkSeconds: 30,
      answerSeconds: 60,
      maxTakes: DEFAULT_MAX_TAKES,
    });
    expect(r.ok && r.item.rubric).toEqual({ contentPoints: ["Name", "Hobby"] });
  });

  it("reports missing fields", () => {
    const r = wireToItem(wire({}), "SINGLE_CHOICE");
    expect(r).toEqual({
      ok: false,
      errors: ["SINGLE_CHOICE needs options", "SINGLE_CHOICE needs correctOptionIds"],
    });
    const w = wireToItem(wire({ minWords: 80 }), "WRITING_PROMPT");
    expect(!w.ok && w.errors).toEqual(["WRITING_PROMPT needs maxWords", "WRITING_PROMPT needs contentPoints"]);
  });

  it("replaces an em dash with an en dash", () => {
    const r = wireToItem(wire({ ...choice(), prompt: `Ich wohne ${EM_DASH} ___ Berlin.` }), "SINGLE_CHOICE");
    expect(r.ok && r.item.prompt).toBe("Ich wohne – ___ Berlin.");
  });

  it("round-trips through itemToWire", () => {
    const r = wireToItem(wire(choice("c")), "SINGLE_CHOICE");
    if (!r.ok) throw new Error("conversion failed");
    const back = wireToItem(wireItemSchema.parse({ ...itemToWire(r.item) }), "SINGLE_CHOICE");
    expect(back.ok && back.item.key).toEqual(r.item.key);
    expect(validateItem({ type: "SINGLE_CHOICE", ...r.item })).toEqual([]);
  });
});

describe("generationSpecSchema", () => {
  const base = { level: "B1", count: 3 } as const;

  it("accepts the allowed combinations", () => {
    for (const [section, types] of Object.entries(ALLOWED_TYPES))
      for (const itemType of types)
        expect(
          generationSpecSchema.safeParse({
            ...base,
            section,
            itemType,
            withStimulus: section === "READING" || section === "LISTENING",
          }).success,
        ).toBe(true);
  });

  it("rejects GRAMMAR with a stimulus and LISTENING without one", () => {
    expect(
      generationSpecSchema.safeParse({ ...base, section: "GRAMMAR", itemType: "GAP_FILL", withStimulus: true })
        .success,
    ).toBe(false);
    expect(
      generationSpecSchema.safeParse({
        ...base,
        section: "LISTENING",
        itemType: "SINGLE_CHOICE",
        withStimulus: false,
      }).success,
    ).toBe(false);
  });

  it("rejects a type the section does not generate and a count out of range", () => {
    expect(
      generationSpecSchema.safeParse({ ...base, section: "LISTENING", itemType: "MATCHING", withStimulus: true })
        .success,
    ).toBe(false);
    expect(
      generationSpecSchema.safeParse({
        ...base,
        count: 11,
        section: "GRAMMAR",
        itemType: "GAP_FILL",
        withStimulus: false,
      }).success,
    ).toBe(false);
  });
});

describe("parseGeneratedBatch", () => {
  const readingSpec: GenerationSpec = {
    section: "READING",
    level: "A2",
    itemType: "SINGLE_CHOICE",
    count: 3,
    withStimulus: true,
  };
  const passage = Array(90).fill("Wort").join(" ");

  it("keeps valid items and reports invalid ones", () => {
    const answer = JSON.stringify({
      stimulus: { title: "Umzug", body: passage, topic: "Wohnen", speakers: [] },
      items: [
        wire(choice("a")),
        wire({ ...choice("z") }), // unknown key id
        wire({}), // no options
        wire(choice("c")),
      ],
    });
    const r = parseGeneratedBatch("```json\n" + answer + "\n```", readingSpec);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.batch.items).toHaveLength(2);
    expect(r.batch.stimulus?.title).toBe("Umzug");
    expect(r.batch.stimulus?.speakers).toBeUndefined();
    expect(r.itemErrors.map((e) => e.index)).toEqual([1, 2]);
    expect(r.itemErrors[0].errors.join(" ")).toContain("unknown options");
    expect(r.warnings).toEqual([]);
  });

  it("fails without a stimulus body when one is required", () => {
    const answer = JSON.stringify({
      stimulus: { title: "x", body: "  ", topic: "", speakers: [] },
      items: [wire(choice())],
    });
    const r = parseGeneratedBatch(answer, readingSpec);
    expect(r.ok).toBe(false);
  });

  it("fails when no item survives", () => {
    const answer = JSON.stringify({
      stimulus: { title: "x", body: passage, topic: "", speakers: [] },
      items: [wire({})],
    });
    const r = parseGeneratedBatch(answer, readingSpec);
    expect(r.ok).toBe(false);
    expect(r.itemErrors).toHaveLength(1);
  });

  it("drops the stimulus for grammar and checks listening scripts", () => {
    const grammar = parseGeneratedBatch(
      JSON.stringify({ stimulus: { title: "", body: "", topic: "", speakers: [] }, items: [wire(choice())] }),
      { section: "GRAMMAR", level: "A1", itemType: "SINGLE_CHOICE", count: 1, withStimulus: false },
    );
    expect(grammar.ok && grammar.batch.stimulus).toBeNull();

    const listeningSpec: GenerationSpec = {
      section: "LISTENING",
      level: "A1",
      itemType: "SINGLE_CHOICE",
      count: 1,
      withStimulus: true,
    };
    const script = "Anna: Hallo Tom, wie geht es dir heute?\nTom: Gut, danke. Ich fahre morgen mit dem Zug nach Hamburg zu meiner Schwester.\nAnna: Schön, gute Reise!";
    const good = parseGeneratedBatch(
      JSON.stringify({
        stimulus: {
          title: "Reise",
          body: script,
          topic: "Reisen",
          speakers: [
            { label: "Anna", voice: "A" },
            { label: "Tom", voice: "B" },
          ],
        },
        items: [wire(choice())],
      }),
      listeningSpec,
    );
    expect(good.ok).toBe(true);
    expect(good.ok && good.batch.stimulus?.speakers).toHaveLength(2);

    const bad = parseGeneratedBatch(
      JSON.stringify({
        stimulus: { title: "Reise", body: script + "\nLea: Tschüss!", topic: "", speakers: [{ label: "Anna", voice: "A" }] },
        items: [wire(choice())],
      }),
      listeningSpec,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("unknown speaker");
  });

  it("warns when the key sits in the same position every time", () => {
    const answer = JSON.stringify({
      stimulus: { title: "t", body: passage, topic: "", speakers: [] },
      items: [wire(choice("b")), wire(choice("b")), wire(choice("b"))],
    });
    const r = parseGeneratedBatch(answer, readingSpec);
    expect(r.ok && r.warnings).toEqual(["the correct option is in the same position in every item"]);
  });
});

describe("buildGenerationMessages", () => {
  it("includes the level ranges, the spec and examples, with no em dash", () => {
    const spec: GenerationSpec = {
      section: "LISTENING",
      level: "B1",
      itemType: "TRUE_FALSE_NG",
      count: 4,
      topic: "Wohnungssuche",
      withStimulus: true,
    };
    const fewShot = [
      {
        prompt: "Richtig oder falsch?",
        content: { kind: "TFNG" as const, statements: [{ id: "s1", text: "Der Zug fährt um 8 Uhr." }] },
        key: { kind: "TFNG" as const, answers: { s1: "R" as const } },
      },
    ];
    const msgs = buildGenerationMessages(spec, fewShot, ["Einkaufen", "Arzttermin"]);
    const all = msgs.map((m) => m.content).join("\n");
    expect(all).not.toContain(EM_DASH);
    expect(msgs[0].content).toContain("A1 40-80");
    expect(msgs[0].content).toContain("C2 350-450");
    expect(msgs[0].content).toContain("A1 30-60");
    expect(msgs[0].content).toContain("C2 250-340");
    const [min, max] = TEXT_LENGTH.LISTENING.B1;
    expect(msgs[1].content).toContain(`${min} to ${max} words`);
    expect(msgs[1].content).toContain("Wohnungssuche");
    expect(msgs[1].content).toContain("Arzttermin");
    expect(msgs[1].content).toContain("Der Zug fährt um 8 Uhr.");
    expect(msgs[1].content).toContain('"answer":"R"');
    expect(msgs[1].content).not.toContain("skillTag");

    const repair = buildGenerationRepairMessages(msgs, "{}", "no usable item");
    expect(repair).toHaveLength(4);
    expect(repair[3].content).not.toContain(EM_DASH);
  });

  it("the schema survives the Gemini conversion", () => {
    const text = JSON.stringify(toGeminiSchema(ITEM_GENERATION_JSON_SCHEMA));
    expect(text).not.toMatch(/oneOf|anyOf|additionalProperties/);
    expect(text).toContain("correctOptionIds");
  });
});
