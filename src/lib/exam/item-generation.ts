import { z } from "zod";
import type { AiMessage } from "@/lib/ai";
import { parseModelJson, zodProblem } from "./grading";
import { validateItem } from "./validate";
import {
  CEFR_LEVELS,
  ITEM_TYPES,
  SECTIONS,
  type Cefr,
  type ItemContent,
  type ItemKey,
  type ItemRubric,
  type ItemType,
  type Section,
} from "./types";

/**
 * AI item generation for the question bank: spec, prompt, wire schema and the
 * conversion into the bank's own shapes. Pure.
 *
 * A generated item is a draft for a teacher to approve, never a live item.
 * The model answers in a flat wire shape because a provider schema cannot
 * express the `ItemContent` union; the conversion and `validateItem` decide
 * what survives, so a model that fills the wrong fields loses that item only.
 */

export const ALLOWED_TYPES: Record<Section, readonly ItemType[]> = {
  GRAMMAR: ["SINGLE_CHOICE", "GAP_FILL"],
  READING: ["SINGLE_CHOICE", "TRUE_FALSE_NG", "MATCHING"],
  LISTENING: ["SINGLE_CHOICE", "TRUE_FALSE_NG"],
  WRITING: ["WRITING_PROMPT"],
  SPEAKING: ["SPEAKING_PROMPT"],
};

/** Sections whose items hang off a shared text or recording. */
export const STIMULUS_SECTIONS: readonly Section[] = ["READING", "LISTENING"];

/** Word ranges for a reading passage or a listening script, per level. */
export const TEXT_LENGTH: Record<"READING" | "LISTENING", Record<Cefr, [number, number]>> = {
  READING: {
    A1: [40, 80],
    A2: [80, 130],
    B1: [150, 220],
    B2: [220, 320],
    C1: [300, 400],
    C2: [350, 450],
  },
  LISTENING: {
    A1: [30, 60],
    A2: [60, 100],
    B1: [100, 160],
    B2: [150, 230],
    C1: [200, 290],
    C2: [250, 340],
  },
};

/** Suggested answer length for a writing task, per level. */
export const WRITING_WORDS: Record<Cefr, [number, number]> = {
  A1: [30, 50],
  A2: [50, 80],
  B1: [80, 120],
  B2: [150, 200],
  C1: [200, 250],
  C2: [250, 300],
};

/** Suggested think and answer time for a speaking task, per level, in seconds. */
export const SPEAKING_SECONDS: Record<Cefr, { think: number; answer: number }> = {
  A1: { think: 30, answer: 45 },
  A2: { think: 30, answer: 60 },
  B1: { think: 45, answer: 90 },
  B2: { think: 60, answer: 120 },
  C1: { think: 60, answer: 150 },
  C2: { think: 60, answer: 180 },
};

/** Takes a generated speaking task allows. The teacher can change it. */
export const DEFAULT_MAX_TAKES = 2;

export const MAX_FEW_SHOT = 5;

export const generationSpecSchema = z
  .object({
    section: z.enum(SECTIONS),
    level: z.enum(CEFR_LEVELS),
    itemType: z.enum(ITEM_TYPES),
    count: z.number().int().min(1).max(10),
    topic: z.string().trim().max(200).optional(),
    withStimulus: z.boolean(),
  })
  .superRefine((spec, ctx) => {
    if (!ALLOWED_TYPES[spec.section].includes(spec.itemType)) {
      ctx.addIssue({
        code: "custom",
        path: ["itemType"],
        message: `${spec.itemType} is not generated for ${spec.section}`,
      });
    }
    const needs = STIMULUS_SECTIONS.includes(spec.section);
    if (spec.withStimulus !== needs) {
      ctx.addIssue({
        code: "custom",
        path: ["withStimulus"],
        message: needs
          ? `${spec.section} items need a stimulus`
          : `${spec.section} items have no stimulus`,
      });
    }
  });

export type GenerationSpec = z.infer<typeof generationSpecSchema>;

// ---------------------------------------------------------------------------
// Wire shape
// ---------------------------------------------------------------------------

const idText = z.object({ id: z.string().trim().min(1).max(20), text: z.string().max(2000) });
const optList = <T extends z.ZodType>(item: T) => z.array(item).max(40).nullish();

export const wireItemSchema = z.object({
  prompt: z.string().max(6000),
  skillTag: z.string().max(80).default(""),
  explanation: z.string().max(2000).default(""),
  within: z.enum(["EASY", "MID", "HARD"]).default("MID"),
  options: optList(idText),
  correctOptionIds: optList(z.string().max(20)),
  statements: optList(idText.extend({ answer: z.enum(["R", "F", "NG"]) })),
  gaps: optList(
    z.object({
      id: z.string().trim().min(1).max(20),
      choices: z.array(z.string().max(200)).max(10).nullish(),
      accepted: z.array(z.string().max(200)).max(10),
    }),
  ),
  left: optList(idText),
  right: optList(idText),
  pairs: optList(z.object({ left: z.string().max(20), right: z.string().max(20) })),
  minWords: z.number().nullish(),
  maxWords: z.number().nullish(),
  thinkSeconds: z.number().nullish(),
  answerSeconds: z.number().nullish(),
  contentPoints: optList(z.string().max(500)),
  register: z.string().max(200).nullish(),
});

export type WireItem = z.infer<typeof wireItemSchema>;

const stimulusWireSchema = z.object({
  title: z.string().max(200).default(""),
  body: z.string().max(12_000).default(""),
  topic: z.string().max(200).default(""),
  speakers: z
    .array(z.object({ label: z.string().max(40), voice: z.enum(["A", "B"]) }))
    .max(4)
    .nullish(),
});

const wireBatchSchema = z.object({
  stimulus: stimulusWireSchema.nullish(),
  items: z.array(z.unknown()).min(1).max(20),
});

const idTextJson = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text"],
  properties: { id: { type: "string" }, text: { type: "string" } },
};

/**
 * The provider schema. Every field is required so OpenAI strict mode accepts
 * it, and there is no union so Gemini does: a field that does not apply to the
 * item type is sent as an empty array, 0 or an empty string.
 */
export const ITEM_GENERATION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["stimulus", "items"],
  properties: {
    stimulus: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "topic", "speakers"],
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Empty string when the section has no stimulus" },
        topic: { type: "string" },
        speakers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "voice"],
            properties: {
              label: { type: "string" },
              voice: { type: "string", enum: ["A", "B"] },
            },
          },
        },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "prompt",
          "skillTag",
          "explanation",
          "within",
          "options",
          "correctOptionIds",
          "statements",
          "gaps",
          "left",
          "right",
          "pairs",
          "minWords",
          "maxWords",
          "thinkSeconds",
          "answerSeconds",
          "contentPoints",
          "register",
        ],
        properties: {
          prompt: { type: "string" },
          skillTag: { type: "string" },
          explanation: { type: "string" },
          within: { type: "string", enum: ["EASY", "MID", "HARD"] },
          options: { type: "array", items: idTextJson },
          correctOptionIds: { type: "array", items: { type: "string" } },
          statements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text", "answer"],
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                answer: { type: "string", enum: ["R", "F", "NG"] },
              },
            },
          },
          gaps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "choices", "accepted"],
              properties: {
                id: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                accepted: { type: "array", items: { type: "string" } },
              },
            },
          },
          left: { type: "array", items: idTextJson },
          right: { type: "array", items: idTextJson },
          pairs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["left", "right"],
              properties: { left: { type: "string" }, right: { type: "string" } },
            },
          },
          minWords: { type: "integer" },
          maxWords: { type: "integer" },
          thinkSeconds: { type: "integer" },
          answerSeconds: { type: "integer" },
          contentPoints: { type: "array", items: { type: "string" } },
          register: { type: "string" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export type GeneratedItem = {
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric?: ItemRubric;
  skillTag: string;
  explanation: string;
  within: "EASY" | "MID" | "HARD";
};

export type GeneratedStimulus = {
  title: string;
  body: string;
  topic: string;
  speakers?: Array<{ label: string; voice: "A" | "B" }>;
};

export type GeneratedBatch = {
  stimulus: GeneratedStimulus | null;
  items: GeneratedItem[];
};

const EM_DASH = /\u2014/g;

/** Trims and swaps the em dash for the German Gedankenstrich (en dash). */
export const cleanText = (s: string): string => s.replace(EM_DASH, "\u2013").trim();

const cleanIdText = (list: Array<{ id: string; text: string }>) =>
  list.map((x) => ({ id: x.id.trim(), text: cleanText(x.text) }));

const nonEmpty = <T>(list: T[] | null | undefined): list is T[] => Array.isArray(list) && list.length > 0;

export type WireResult = { ok: true; item: GeneratedItem } | { ok: false; errors: string[] };

/**
 * Turns a flat wire item into the bank's content, key and rubric for the item
 * type. Reports what is missing; structural soundness is `validateItem`'s job.
 */
export function wireToItem(wire: WireItem, itemType: ItemType): WireResult {
  const errors: string[] = [];
  const need = (ok: boolean, field: string) => {
    if (!ok) errors.push(`${itemType} needs ${field}`);
  };
  const base = {
    prompt: cleanText(wire.prompt),
    skillTag: (wire.skillTag ?? "").trim(),
    explanation: cleanText(wire.explanation ?? ""),
    within: wire.within ?? "MID",
  };
  const rubric = (): ItemRubric => {
    const register = wire.register?.trim();
    return {
      contentPoints: (wire.contentPoints ?? []).map(cleanText).filter(Boolean),
      ...(register ? { register } : {}),
    };
  };

  let content: ItemContent | null = null;
  let key: ItemKey | null = null;
  let withRubric: ItemRubric | undefined;

  switch (itemType) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE": {
      need(nonEmpty(wire.options), "options");
      need(nonEmpty(wire.correctOptionIds), "correctOptionIds");
      if (nonEmpty(wire.options) && nonEmpty(wire.correctOptionIds)) {
        content = { kind: "CHOICE", options: cleanIdText(wire.options) };
        key = { kind: "CHOICE", correct: wire.correctOptionIds.map((id) => id.trim()) };
      }
      break;
    }
    case "TRUE_FALSE_NG": {
      need(nonEmpty(wire.statements), "statements");
      if (nonEmpty(wire.statements)) {
        content = {
          kind: "TFNG",
          statements: cleanIdText(wire.statements),
        };
        key = {
          kind: "TFNG",
          answers: Object.fromEntries(wire.statements.map((s) => [s.id.trim(), s.answer])),
        };
      }
      break;
    }
    case "GAP_FILL": {
      need(nonEmpty(wire.gaps), "gaps");
      if (nonEmpty(wire.gaps)) {
        content = {
          kind: "GAP",
          gaps: wire.gaps.map((g) => {
            const choices = (g.choices ?? []).map(cleanText).filter(Boolean);
            return choices.length ? { id: g.id.trim(), choices } : { id: g.id.trim() };
          }),
        };
        key = {
          kind: "GAP",
          answers: Object.fromEntries(
            wire.gaps.map((g) => [g.id.trim(), g.accepted.map(cleanText).filter(Boolean)]),
          ),
        };
      }
      break;
    }
    case "MATCHING": {
      need(nonEmpty(wire.left), "left");
      need(nonEmpty(wire.right), "right");
      need(nonEmpty(wire.pairs), "pairs");
      if (nonEmpty(wire.left) && nonEmpty(wire.right) && nonEmpty(wire.pairs)) {
        const lefts = wire.pairs.map((p) => p.left.trim());
        if (new Set(lefts).size !== lefts.length) errors.push("a row is paired more than once");
        content = { kind: "MATCHING", left: cleanIdText(wire.left), right: cleanIdText(wire.right) };
        key = {
          kind: "MATCHING",
          pairs: Object.fromEntries(wire.pairs.map((p) => [p.left.trim(), p.right.trim()])),
        };
      }
      break;
    }
    case "WRITING_PROMPT": {
      need(!!wire.minWords && wire.minWords > 0, "minWords");
      need(!!wire.maxWords && wire.maxWords > 0, "maxWords");
      need(nonEmpty(wire.contentPoints), "contentPoints");
      if (errors.length === 0) {
        content = {
          kind: "WRITING",
          minWords: Math.round(wire.minWords!),
          maxWords: Math.round(wire.maxWords!),
        };
        key = { kind: "NONE" };
        withRubric = rubric();
      }
      break;
    }
    case "SPEAKING_PROMPT": {
      need(!!wire.answerSeconds && wire.answerSeconds > 0, "answerSeconds");
      need(typeof wire.thinkSeconds === "number" && wire.thinkSeconds >= 0, "thinkSeconds");
      need(nonEmpty(wire.contentPoints), "contentPoints");
      if (errors.length === 0) {
        content = {
          kind: "SPEAKING",
          thinkSeconds: Math.round(wire.thinkSeconds!),
          answerSeconds: Math.round(wire.answerSeconds!),
          maxTakes: DEFAULT_MAX_TAKES,
        };
        key = { kind: "NONE" };
        withRubric = rubric();
      }
      break;
    }
    case "SHORT_TEXT":
      errors.push("SHORT_TEXT items are not generated");
      break;
  }

  if (errors.length || !content || !key) return { ok: false, errors };
  return {
    ok: true,
    item: { ...base, content, key, ...(withRubric ? { rubric: withRubric } : {}) },
  };
}

type WireBody = Omit<WireItem, "skillTag" | "explanation" | "within">;

/** The reverse of `wireToItem`, for showing approved items as examples. */
export function itemToWire(item: {
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric?: ItemRubric | null;
}): WireBody {
  const out: WireBody = {
    prompt: item.prompt,
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
    contentPoints: item.rubric?.contentPoints ?? [],
    register: item.rubric?.register ?? "",
  };
  const { content, key } = item;
  if (content.kind === "CHOICE") {
    out.options = content.options;
    out.correctOptionIds = key.kind === "CHOICE" ? key.correct : [];
  } else if (content.kind === "TFNG") {
    const answers = key.kind === "TFNG" ? key.answers : {};
    out.statements = content.statements.map((s) => ({ ...s, answer: answers[s.id] ?? "NG" }));
  } else if (content.kind === "GAP") {
    const answers = key.kind === "GAP" ? key.answers : {};
    out.gaps = content.gaps.map((g) => ({
      id: g.id,
      choices: g.choices ?? [],
      accepted: answers[g.id] ?? [],
    }));
  } else if (content.kind === "MATCHING") {
    out.left = content.left;
    out.right = content.right;
    out.pairs =
      key.kind === "MATCHING"
        ? Object.entries(key.pairs).map(([left, right]) => ({ left, right }))
        : [];
  } else if (content.kind === "WRITING") {
    out.minWords = content.minWords;
    out.maxWords = content.maxWords;
  } else if (content.kind === "SPEAKING") {
    out.thinkSeconds = content.thinkSeconds;
    out.answerSeconds = content.answerSeconds;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const rangeLine = (section: "READING" | "LISTENING") =>
  CEFR_LEVELS.map((l) => `${l} ${TEXT_LENGTH[section][l][0]}-${TEXT_LENGTH[section][l][1]}`).join(", ");

const SYSTEM_PROMPT = [
  "You are an expert author of German as a foreign language exams, writing items for a CEFR placement and level verification test. A teacher reviews every item before it is used.",
  "",
  "Rules:",
  "- Write original items. Never reproduce or adapt content from published exams (Goethe, telc, TestDaF, ÖSD) or from textbooks, and never use copyrighted texts.",
  "- Everything the candidate sees is in German. Address the candidate with Sie.",
  "- Topics are neutral and everyday: work, study, housing, travel, shopping, health services, leisure, environment, technology, media. Avoid politics, religion, war, crime, disasters, health conditions of individuals and anything that could upset or disadvantage a group.",
  "- Language, vocabulary and sentence structure fit the target level. An item tests the level it is written for, not general knowledge.",
  `- Reading passages have these lengths in words: ${rangeLine("READING")}.`,
  `- Listening scripts have these lengths in words: ${rangeLine("LISTENING")}.`,
  '- A listening script has one turn per line in the form "Label: text", with at most two speakers. Each speaker is listed in stimulus.speakers with its label and a voice, A or B, one voice per speaker. A monologue has one speaker. No stage directions, no sound effects.',
  "- Single choice items have 3 or 4 options with ids a, b, c, d and exactly one correct option. Distractors are plausible for a learner at the level, similar in length and form to the key, and clearly wrong for someone who understood. Vary the position of the correct option across items.",
  "- Items on a text are answerable only from the text, in text order, and do not give each other away.",
  "- Gap fill items mark each gap in the prompt as {{g1}}, {{g2}} and so on, with one entry per gap in gaps. accepted lists every correct spelling. choices, when given, has 3 or 4 entries including the correct one; an empty choices list means the gap is typed.",
  "- True or false items use statements with answer R (richtig), F (falsch) or NG (nicht im Text). Use NG only for reading.",
  "- Matching items have rows in left (ids l1, l2, ...), targets in right (ids r1, r2, ...) with at least as many targets as rows, preferably one extra, and pairs mapping each row id to one target id.",
  "- Writing and speaking tasks describe a realistic situation, name 3 or 4 content points in the prompt, and list the same points in contentPoints. register names the expected register, for example informell (du) or formell (Sie).",
  "- Fields that do not apply to the item type are sent as an empty array, 0 or an empty string.",
  "- skillTag is a short lowercase tag such as grammar.dative-prepositions, reading.detail, reading.gist, listening.detail, writing.email-informal.",
  "- explanation says in one or two German sentences why the key is correct, for the reviewing teacher.",
  "- within places the item inside its level: EASY, MID or HARD.",
  "- Never use the em dash character anywhere. Use commas, colons or the short dash instead.",
  "- Answer with a single JSON object that matches the schema. No code fence, no commentary.",
].join("\n");

const TYPE_GUIDE: Record<ItemType, string> = {
  SINGLE_CHOICE:
    "Fill prompt, options and correctOptionIds (exactly one id). For grammar the prompt is one German sentence with ___ where the answer goes.",
  MULTI_CHOICE: "Fill prompt, options and correctOptionIds.",
  TRUE_FALSE_NG:
    "Fill prompt (a short instruction) and statements, 3 to 5 per item, with a mix of answers.",
  GAP_FILL:
    "Fill prompt (sentence or short text with {{g1}} markers) and gaps. Test one grammar point per gap.",
  MATCHING:
    "Fill prompt (a short instruction), left, right and pairs. For reading, rows can be short statements or headings and targets the paragraphs or persons of the text.",
  SHORT_TEXT: "Not used.",
  WRITING_PROMPT: "Fill prompt, minWords, maxWords, contentPoints and register.",
  SPEAKING_PROMPT: "Fill prompt, thinkSeconds, answerSeconds, contentPoints and register.",
};

export type FewShotItem = { prompt: string; content: ItemContent; key: ItemKey; rubric?: ItemRubric | null };

export function buildGenerationMessages(
  spec: GenerationSpec,
  fewShot: FewShotItem[],
  avoidTopics: string[],
): AiMessage[] {
  const lines: string[] = [
    `Section: ${spec.section}`,
    `Target level: ${spec.level}`,
    `Item type: ${spec.itemType}`,
    `Number of items: ${spec.count}`,
    spec.topic ? `Topic: ${spec.topic}` : "Topic: choose a suitable neutral topic yourself.",
    "",
  ];

  if (spec.section === "READING" || spec.section === "LISTENING") {
    const [min, max] = TEXT_LENGTH[spec.section][spec.level];
    lines.push(
      spec.section === "READING"
        ? `Write one reading passage of ${min} to ${max} words in stimulus.body, with a title and a topic. All ${spec.count} items are about this passage. speakers stays empty.`
        : `Write one listening script of ${min} to ${max} words in stimulus.body, one "Label: text" turn per line, at most two speakers listed in stimulus.speakers. All ${spec.count} items are about this script and must be answerable by listening.`,
    );
  } else {
    lines.push("This section has no stimulus: send stimulus with empty title, body and topic and no speakers.");
  }
  if (spec.itemType === "WRITING_PROMPT") {
    const [min, max] = WRITING_WORDS[spec.level];
    lines.push(`Answer length for ${spec.level}: about ${min} to ${max} words (minWords, maxWords).`);
  }
  if (spec.itemType === "SPEAKING_PROMPT") {
    const t = SPEAKING_SECONDS[spec.level];
    lines.push(`Timing for ${spec.level}: about ${t.think} seconds to think and ${t.answer} seconds to answer.`);
  }
  lines.push(TYPE_GUIDE[spec.itemType]);

  if (avoidTopics.length) {
    lines.push("", "The bank already covers these topics, choose a different one:");
    for (const t of avoidTopics.slice(0, 40)) lines.push(`- ${t.trim()}`);
  }

  const examples = fewShot.slice(0, MAX_FEW_SHOT);
  if (examples.length) {
    lines.push(
      "",
      "Approved items of this type from the bank, to match in style and difficulty. Do not copy them; write new ones. They show the item fields only:",
    );
    for (const ex of examples) lines.push(JSON.stringify(itemToWire(ex)));
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

export function buildGenerationRepairMessages(
  previous: AiMessage[],
  badAnswer: string,
  error: string,
): AiMessage[] {
  return [
    ...previous,
    { role: "assistant", content: badAnswer.slice(0, 30_000) },
    {
      role: "user",
      content: [
        "That answer could not be used:",
        error.slice(0, 2000),
        "",
        "Send the whole batch again as one JSON object that matches the schema exactly, fixing these problems.",
        "Only JSON, no explanation, no code fence.",
      ].join("\n"),
    },
  ];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export type ItemError = { index: number; errors: string[] };

export type GenerationParseResult =
  | { ok: true; batch: GeneratedBatch; itemErrors: ItemError[]; warnings: string[] }
  | { ok: false; error: string; itemErrors: ItemError[] };

const LINE_TURN = /^([^:\n]{1,40}):\s*\S/;

/** Problems that would stop a listening script from being voiced. */
export function listeningScriptErrors(stimulus: GeneratedStimulus): string[] {
  const errors: string[] = [];
  const speakers = stimulus.speakers ?? [];
  if (speakers.length < 1 || speakers.length > 2) errors.push("a listening script needs one or two speakers");
  const labels = speakers.map((s) => s.label.trim());
  if (labels.some((l) => !l)) errors.push("a speaker has no label");
  if (new Set(labels).size !== labels.length) errors.push("speaker labels repeat");
  if (new Set(speakers.map((s) => s.voice)).size !== speakers.length) errors.push("two speakers share a voice");
  const lines = stimulus.body.split("\n").map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const m = LINE_TURN.exec(line);
    if (!m) errors.push(`line ${i + 1} is not in the form "Label: text"`);
    else if (!labels.includes(m[1].trim())) errors.push(`line ${i + 1} names an unknown speaker ${m[1].trim()}`);
  });
  return errors.slice(0, 10);
}

const countWords = (s: string) => s.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

export function parseGeneratedBatch(text: string, spec: GenerationSpec): GenerationParseResult {
  const json = parseModelJson(text);
  if (!json.ok) return { ok: false, error: json.error, itemErrors: [] };
  const parsed = wireBatchSchema.safeParse(json.json);
  if (!parsed.success) return { ok: false, error: zodProblem(parsed.error), itemErrors: [] };

  let stimulus: GeneratedStimulus | null = null;
  const warnings: string[] = [];
  if (spec.withStimulus) {
    const s = parsed.data.stimulus;
    const body = s ? cleanText(s.body) : "";
    if (!s || !body) return { ok: false, error: "the stimulus body is missing", itemErrors: [] };
    stimulus = {
      title: cleanText(s.title),
      body,
      topic: cleanText(s.topic),
      ...(spec.section === "LISTENING"
        ? { speakers: (s.speakers ?? []).map((sp) => ({ label: sp.label.trim(), voice: sp.voice })) }
        : {}),
    };
    if (spec.section === "LISTENING") {
      const scriptErrors = listeningScriptErrors(stimulus);
      if (scriptErrors.length)
        return { ok: false, error: `listening script: ${scriptErrors.join("; ")}`, itemErrors: [] };
    }
    if (spec.section === "READING" || spec.section === "LISTENING") {
      const [min, max] = TEXT_LENGTH[spec.section][spec.level];
      const words = countWords(stimulus.body);
      if (words < min * 0.8 || words > max * 1.2)
        warnings.push(`the ${spec.section.toLowerCase()} text has ${words} words, expected ${min} to ${max}`);
    }
  }

  const items: GeneratedItem[] = [];
  const itemErrors: ItemError[] = [];
  parsed.data.items.forEach((raw, index) => {
    const wire = wireItemSchema.safeParse(raw);
    if (!wire.success) {
      itemErrors.push({ index, errors: [zodProblem(wire.error)] });
      return;
    }
    const converted = wireToItem(wire.data, spec.itemType);
    if (!converted.ok) {
      itemErrors.push({ index, errors: converted.errors });
      return;
    }
    const errors = validateItem({ type: spec.itemType, ...converted.item });
    if (errors.length) itemErrors.push({ index, errors });
    else items.push(converted.item);
  });

  if (items.length === 0) {
    return { ok: false, error: "no usable item in the answer", itemErrors };
  }

  if (spec.itemType === "SINGLE_CHOICE" && items.length >= 3) {
    const positions = items.map(({ content, key }) =>
      content.kind === "CHOICE" && key.kind === "CHOICE"
        ? content.options.findIndex((o) => o.id === key.correct[0])
        : -1,
    );
    if (new Set(positions).size === 1) warnings.push("the correct option is in the same position in every item");
  }

  return { ok: true, batch: { stimulus, items }, itemErrors, warnings };
}
