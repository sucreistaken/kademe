import { z } from "zod";
import { WITHINS, withinOf, type Within } from "@/lib/exam/difficulty";
import { cleanText } from "@/lib/exam/item-generation";
import { CEFR_LEVELS, ITEM_TYPES, SECTIONS, textGapKindOf, type Cefr, type ItemContent, type ItemKey, type ItemRubric, type ItemType, type Section, type TfngValue } from "@/lib/exam/types";
import { gapMarkers, type ValidatableItem } from "@/lib/exam/validate";

/**
 * The bank's item editor as plain data: the form's state for every item type,
 * and the two conversions between it and the bank's content, key and rubric.
 * Pure, so each rule has a test and the server can trust nothing but
 * `saveItemSchema` and `itemProblems`.
 */

export type EditorDraft = {
  type: ItemType;
  section: Section;
  level: Cefr;
  within: Within;
  prompt: string;
  explanation: string;
  /** Choice: options with their correct mark. */
  options: Array<{ id: string; text: string; correct: boolean }>;
  /** True / false / not given. */
  statements: Array<{ id: string; text: string; answer: TfngValue | "" }>;
  /** Gap fill, in the order of the markers in the prompt. Spellings and choices are "|" separated. */
  gaps: Array<{ id: string; mode: "typed" | "choice"; accepted: string; choices: string }>;
  /**
   * Gap fill: the key's distractors ("|" separated), kept so saving a C-test
   * or word bank does not drop its pool. Not edited in the form yet.
   */
  distractors: string;
  /**
   * The stored item's skill tag, read only: it turns on the cloze and word-bank
   * rules in `itemProblems`. Null for a new item.
   */
  skillTag: string | null;
  /** Matching: rows with the id of their target, and the targets. */
  rows: Array<{ id: string; text: string; target: string }>;
  targets: Array<{ id: string; text: string }>;
  /** Short text: accepted answers, "|" separated. */
  accepted: string;
  maxChars: number;
  /** Writing and speaking. */
  minWords: number;
  maxWords: number;
  thinkSeconds: number;
  answerSeconds: number;
  maxTakes: number;
  contentPoints: string;
  register: string;
  /** Writing and speaking: the points shown to the student, one per line. */
  studentPoints: string;
  /** A new reading text or listening script, for a new question only. */
  textTitle: string;
  textBody: string;
};

/**
 * The text kind a stored item has when its gaps are picked words: CLOZE (four
 * choices per gap) or WORDBANK (a shared pool). Null for every other draft,
 * C-tests included, which keep the ordinary gap form.
 */
export function pickedKindOfDraft(d: Pick<EditorDraft, "type" | "skillTag">): "CLOZE" | "WORDBANK" | null {
  if (d.type !== "GAP_FILL" || !d.skillTag) return null;
  const kind = textGapKindOf({ skillTag: d.skillTag });
  return kind === "CLOZE" || kind === "WORDBANK" ? kind : null;
}

/** The types a teacher writes here: every objective type. Writing and speaking tasks are edited, not created. */
export const CREATE_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE_NG", "GAP_FILL", "MATCHING", "SHORT_TEXT"] as const satisfies readonly ItemType[];
export const CREATE_SECTIONS = ["GRAMMAR", "READING", "LISTENING"] as const satisfies readonly Section[];

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** The first id of the form prefix+n (or a free letter for options) that is not taken. */
export function nextId(taken: string[], prefix: string): string {
  if (prefix === "") {
    for (const l of LETTERS) if (!taken.includes(l)) return l;
  }
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}${n}`)) return `${prefix}${n}`;
}

export const splitBar = (s: string): string[] => s.split("|").map((x) => cleanText(x)).filter(Boolean);
const joinBar = (xs: string[] | undefined): string => (xs ?? []).join(" | ");

export function emptyDraft(type: ItemType, section: Section, level: Cefr): EditorDraft {
  return {
    type,
    section,
    level,
    within: "MID",
    prompt: "",
    explanation: "",
    options: ["a", "b", "c", "d"].map((id) => ({ id, text: "", correct: false })),
    statements: ["s1", "s2", "s3"].map((id) => ({ id, text: "", answer: "" as const })),
    gaps: [],
    distractors: "",
    skillTag: null,
    rows: ["l1", "l2", "l3"].map((id) => ({ id, text: "", target: "" })),
    targets: ["r1", "r2", "r3", "r4"].map((id) => ({ id, text: "" })),
    accepted: "",
    maxChars: 200,
    minWords: 80,
    maxWords: 120,
    thinkSeconds: 45,
    answerSeconds: 90,
    maxTakes: 2,
    contentPoints: "",
    register: "",
    studentPoints: "",
    textTitle: "",
    textBody: "",
  };
}

export type EditableItem = {
  type: ItemType;
  section: Section;
  level: Cefr;
  difficulty: number;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric: ItemRubric | null;
  explanation: string | null;
  /** Optional so callers without it keep working; see EditorDraft.skillTag. */
  skillTag?: string | null;
};

export function draftFromItem(item: EditableItem): EditorDraft {
  const d = emptyDraft(item.type, item.section, item.level);
  d.within = withinOf(item.level, item.difficulty);
  d.prompt = item.prompt;
  d.explanation = item.explanation ?? "";
  d.skillTag = item.skillTag ?? null;
  const { content, key } = item;
  if (content.kind === "CHOICE") {
    const correct = key.kind === "CHOICE" ? key.correct : [];
    d.options = content.options.map((o) => ({ id: o.id, text: o.text, correct: correct.includes(o.id) }));
  }
  if (content.kind === "TFNG") {
    const answers = key.kind === "TFNG" ? key.answers : {};
    d.statements = content.statements.map((s) => ({ id: s.id, text: s.text, answer: answers[s.id] ?? "" }));
  }
  if (content.kind === "GAP") {
    const answers = key.kind === "GAP" ? key.answers : {};
    d.gaps = content.gaps.map((g) => ({ id: g.id, mode: g.choices ? "choice" : "typed", accepted: joinBar(answers[g.id]), choices: joinBar(g.choices) }));
    d.distractors = key.kind === "GAP" ? joinBar(key.distractors) : "";
  }
  if (content.kind === "MATCHING") {
    const pairs = key.kind === "MATCHING" ? key.pairs : {};
    d.rows = content.left.map((l) => ({ id: l.id, text: l.text, target: pairs[l.id] ?? "" }));
    d.targets = content.right.map((r) => ({ id: r.id, text: r.text }));
  }
  if (content.kind === "SHORT_TEXT") {
    d.maxChars = content.maxChars;
    d.accepted = key.kind === "SHORT_TEXT" ? joinBar(key.accepted) : "";
  }
  if (content.kind === "WRITING") {
    d.minWords = content.minWords;
    d.maxWords = content.maxWords;
  }
  if (content.kind === "SPEAKING") {
    d.thinkSeconds = content.thinkSeconds;
    d.answerSeconds = content.answerSeconds;
    d.maxTakes = content.maxTakes;
  }
  if (item.rubric) {
    d.contentPoints = item.rubric.contentPoints.join("\n");
    d.register = item.rubric.register ?? "";
    d.studentPoints = (item.rubric.studentPoints ?? []).join("\n");
  }
  return d;
}

/** The bank's shapes of a draft. Texts are trimmed and an em dash becomes the German en dash. */
export function draftToItem(d: EditorDraft): ValidatableItem & { rubric: ItemRubric | null } {
  const prompt = cleanText(d.prompt);
  const idText = (xs: Array<{ id: string; text: string }>) => xs.map((x) => ({ id: x.id, text: cleanText(x.text) }));
  const rubric = (): ItemRubric => {
    const register = cleanText(d.register);
    const studentPoints = d.studentPoints.split("\n").map((p) => cleanText(p)).filter(Boolean);
    return {
      contentPoints: d.contentPoints.split("\n").map((p) => cleanText(p)).filter(Boolean),
      ...(register ? { register } : {}),
      ...(studentPoints.length ? { studentPoints } : {}),
    };
  };
  switch (d.type) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return {
        type: d.type,
        prompt,
        content: { kind: "CHOICE", options: idText(d.options) },
        key: { kind: "CHOICE", correct: d.options.filter((o) => o.correct).map((o) => o.id) },
        rubric: null,
      };
    case "TRUE_FALSE_NG":
      return {
        type: d.type,
        prompt,
        content: { kind: "TFNG", statements: idText(d.statements) },
        key: { kind: "TFNG", answers: Object.fromEntries(d.statements.filter((s) => s.answer).map((s) => [s.id, s.answer as TfngValue])) },
        rubric: null,
      };
    case "GAP_FILL": {
      const gaps = syncGaps(prompt, d.gaps);
      const distractors = splitBar(d.distractors);
      return {
        type: d.type,
        prompt,
        content: { kind: "GAP", gaps: gaps.map((g) => (g.mode === "choice" ? { id: g.id, choices: splitBar(g.choices) } : { id: g.id })) },
        key: { kind: "GAP", answers: Object.fromEntries(gaps.map((g) => [g.id, splitBar(g.accepted)])), ...(distractors.length ? { distractors } : {}) },
        rubric: null,
        ...(d.skillTag ? { skillTag: d.skillTag } : {}),
      };
    }
    case "MATCHING":
      return {
        type: d.type,
        prompt,
        content: { kind: "MATCHING", left: idText(d.rows), right: idText(d.targets) },
        key: { kind: "MATCHING", pairs: Object.fromEntries(d.rows.filter((r) => r.target).map((r) => [r.id, r.target])) },
        rubric: null,
      };
    case "SHORT_TEXT":
      return { type: d.type, prompt, content: { kind: "SHORT_TEXT", maxChars: Math.round(d.maxChars) }, key: { kind: "SHORT_TEXT", accepted: splitBar(d.accepted) }, rubric: null };
    case "WRITING_PROMPT":
      return { type: d.type, prompt, content: { kind: "WRITING", minWords: Math.round(d.minWords), maxWords: Math.round(d.maxWords) }, key: { kind: "NONE" }, rubric: rubric() };
    case "SPEAKING_PROMPT":
      return {
        type: d.type,
        prompt,
        content: { kind: "SPEAKING", thinkSeconds: Math.round(d.thinkSeconds), answerSeconds: Math.round(d.answerSeconds), maxTakes: Math.round(d.maxTakes) },
        key: { kind: "NONE" },
        rubric: rubric(),
      };
  }
}

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

/** The gap list for a prompt: one entry per marker, in order, keeping what was typed for an id. */
export function syncGaps(prompt: string, gaps: EditorDraft["gaps"]): EditorDraft["gaps"] {
  const ids = [...new Set(gapMarkers(prompt))];
  return ids.map((id) => gaps.find((g) => g.id === id) ?? { id, mode: "typed", accepted: "", choices: "" });
}

/** Every run of three or more underscores becomes the next free {{gN}} marker. */
export function underscoresToMarkers(prompt: string): string {
  const taken = gapMarkers(prompt);
  return prompt.replace(/_{3,}/g, () => {
    const id = nextId(taken, "g");
    taken.push(id);
    return `{{${id}}}`;
  });
}

/** The prompt with a new gap marker at `at` (a caret position), and that marker's id. */
export function insertGap(prompt: string, at: number): { prompt: string; id: string; caret: number } {
  const id = nextId(gapMarkers(prompt), "g");
  const pos = Math.max(0, Math.min(prompt.length, at));
  const marker = `{{${id}}}`;
  return { prompt: prompt.slice(0, pos) + marker + prompt.slice(pos), id, caret: pos + marker.length };
}

// ---------------------------------------------------------------------------
// What the server accepts
// ---------------------------------------------------------------------------

const id = z.string().trim().min(1).max(20);
const idText = z.object({ id, text: z.string().max(2000) });
const int = z.number().int().min(-1).max(100_000);

export const contentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CHOICE"), options: z.array(idText).max(8) }),
  z.object({ kind: z.literal("TFNG"), statements: z.array(idText).max(12) }),
  z.object({ kind: z.literal("GAP"), gaps: z.array(z.object({ id, choices: z.array(z.string().max(200)).max(10).optional() })).max(30) }),
  z.object({ kind: z.literal("MATCHING"), left: z.array(idText).max(12), right: z.array(idText).max(14) }),
  z.object({ kind: z.literal("SHORT_TEXT"), maxChars: int }),
  z.object({ kind: z.literal("WRITING"), minWords: int, maxWords: int }),
  z.object({ kind: z.literal("SPEAKING"), thinkSeconds: int, answerSeconds: int, maxTakes: int }),
]);

export const keySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CHOICE"), correct: z.array(id).max(8) }),
  z.object({ kind: z.literal("TFNG"), answers: z.record(id, z.enum(["R", "F", "NG"])) }),
  z.object({
    kind: z.literal("GAP"),
    answers: z.record(id, z.array(z.string().max(200)).max(10)),
    distractors: z.array(z.string().max(50)).max(40).optional(),
  }),
  z.object({ kind: z.literal("MATCHING"), pairs: z.record(id, id) }),
  z.object({ kind: z.literal("SHORT_TEXT"), accepted: z.array(z.string().max(200)).max(20) }),
  z.object({ kind: z.literal("NONE") }),
]);

export const saveItemSchema = z.object({
  id: z.uuid().nullable(),
  type: z.enum(ITEM_TYPES),
  section: z.enum(SECTIONS),
  level: z.enum(CEFR_LEVELS),
  within: z.enum(WITHINS),
  prompt: z.string().max(6000),
  content: contentSchema,
  key: keySchema,
  // Loose bounds here; `itemProblems` holds the real limits for the student points and names them.
  rubric: z
    .object({
      contentPoints: z.array(z.string().max(500)).max(10),
      register: z.string().max(200).optional(),
      studentPoints: z.array(z.string().max(500)).max(20).optional(),
    })
    .nullable(),
  explanation: z.string().max(2000),
  /** A new question only: its own reading text or listening script. */
  text: z.object({ title: z.string().max(200), body: z.string().max(12_000) }).nullable(),
});
export type SaveItemInput = z.infer<typeof saveItemSchema>;

/** The payload the editor sends for a draft. */
export function saveInput(d: EditorDraft, itemId: string | null): SaveItemInput {
  const item = draftToItem(d);
  const body = cleanText(d.textBody);
  return {
    id: itemId,
    type: d.type,
    section: d.section,
    level: d.level,
    within: d.within,
    prompt: item.prompt,
    content: item.content,
    key: item.key,
    rubric: item.rubric,
    explanation: cleanText(d.explanation),
    text: itemId === null && body && d.section !== "GRAMMAR" ? { title: cleanText(d.textTitle), body } : null,
  };
}
