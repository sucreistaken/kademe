import type { ItemContent, ItemKey, ItemRubric, ItemType } from "./types";

/**
 * Structural checks every item passes before it may enter the bank, whether a
 * person wrote it, the seed ships it or a model generated it.
 *
 * The checks are about the item being answerable and scoreable, not about it
 * being good German. That part is the teacher's approval.
 *
 * `itemProblems` answers with codes, so the panel can say each problem in the
 * teacher's language (the `bankTools.p_*` messages). `validateItem` keeps the
 * English sentences the engine, the AI repair prompt and the seed tests read.
 */

export type ValidatableItem = {
  type: ItemType;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  rubric?: ItemRubric | null;
};

export const ITEM_PROBLEM_CODES = [
  "TYPE_UNKNOWN",
  "PROMPT_EMPTY",
  "CONTENT_KIND",
  "KEY_KIND",
  "CHOICE_TOO_FEW",
  "CHOICE_ID_REPEAT",
  "CHOICE_TEXT_REPEAT",
  "CHOICE_EMPTY",
  "CHOICE_KEY_UNKNOWN",
  "SINGLE_KEY_COUNT",
  "MULTI_KEY_COUNT",
  "TFNG_NONE",
  "TFNG_NO_ANSWER",
  "TFNG_ID_REPEAT",
  "TFNG_EMPTY",
  "TFNG_KEY_UNKNOWN",
  "GAP_NONE",
  "GAP_MARKER_REPEAT",
  "GAP_NO_MARKER",
  "GAP_STRAY_MARKER",
  "GAP_NO_ANSWER",
  "GAP_FEW_CHOICES",
  "GAP_CHOICE_REPEAT",
  "GAP_CHOICE_EMPTY",
  "GAP_ANSWER_NOT_CHOICE",
  "GAP_KEY_UNKNOWN",
  "MATCH_FEW_ROWS",
  "MATCH_FEW_TARGETS",
  "MATCH_ROW_NO_TARGET",
  "MATCH_ID_REPEAT",
  "MATCH_ROW_EMPTY",
  "MATCH_TARGET_EMPTY",
  "MATCH_ROW_TEXT_REPEAT",
  "MATCH_TARGET_TEXT_REPEAT",
  "MATCH_KEY_UNKNOWN_ROW",
  "SHORT_NO_ANSWER",
  "SHORT_LENGTH",
  "WRITING_RANGE",
  "WRITING_POINTS",
  "SPEAKING_ANSWER_TIME",
  "SPEAKING_THINK_TIME",
  "SPEAKING_TAKES",
  "SPEAKING_POINTS",
] as const;
export type ItemProblemCode = (typeof ITEM_PROBLEM_CODES)[number];

/**
 * One structural problem. `n` is the 1-based position of the option,
 * statement, gap, row or target it is about, for a sentence a teacher can
 * follow ("2. boşluk"); `ids` names the bank ids for the English sentence.
 */
export type ItemProblem = { code: ItemProblemCode; n?: number; ids?: string[]; detail?: string };

const EXPECTED: Record<ItemType, { content: ItemContent["kind"]; key: ItemKey["kind"] }> = {
  SINGLE_CHOICE: { content: "CHOICE", key: "CHOICE" },
  MULTI_CHOICE: { content: "CHOICE", key: "CHOICE" },
  TRUE_FALSE_NG: { content: "TFNG", key: "TFNG" },
  GAP_FILL: { content: "GAP", key: "GAP" },
  MATCHING: { content: "MATCHING", key: "MATCHING" },
  SHORT_TEXT: { content: "SHORT_TEXT", key: "SHORT_TEXT" },
  WRITING_PROMPT: { content: "WRITING", key: "NONE" },
  SPEAKING_PROMPT: { content: "SPEAKING", key: "NONE" },
};

const GAP_MARKER = /\{\{([A-Za-z0-9_-]+)\}\}/g;

export function gapMarkers(prompt: string): string[] {
  return [...prompt.matchAll(GAP_MARKER)].map((m) => m[1]);
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (seen.has(k)) dup.add(v);
    seen.add(k);
  }
  return [...dup];
}

const filled = (texts: string[]) => texts.filter((t) => t.trim());

/** The longest typed answer a short text item may allow. */
export const SHORT_TEXT_MAX_CHARS = 2000;

export function itemProblems(item: ValidatableItem): ItemProblem[] {
  const out: ItemProblem[] = [];
  const add = (code: ItemProblemCode, extra: Omit<ItemProblem, "code"> = {}) => {
    out.push({ code, ...extra });
  };
  const expected = EXPECTED[item.type];
  if (!expected) return [{ code: "TYPE_UNKNOWN", detail: String(item.type) }];
  if (!item.prompt || item.prompt.trim().length < 3) add("PROMPT_EMPTY");
  if (item.content.kind !== expected.content) add("CONTENT_KIND", { detail: `${item.content.kind} does not fit ${item.type}` });
  if (item.key.kind !== expected.key) add("KEY_KIND", { detail: `${item.key.kind} does not fit ${item.type}` });
  if (out.length > 0) return out;

  const content = item.content;
  const key = item.key;

  if (content.kind === "CHOICE" && key.kind === "CHOICE") {
    const ids = content.options.map((o) => o.id);
    if (content.options.length < 3) add("CHOICE_TOO_FEW");
    if (duplicates(ids).length) add("CHOICE_ID_REPEAT");
    if (duplicates(filled(content.options.map((o) => o.text))).length) add("CHOICE_TEXT_REPEAT");
    const empty = content.options.findIndex((o) => !o.text.trim());
    if (empty >= 0) add("CHOICE_EMPTY", { n: empty + 1 });
    const unknown = key.correct.filter((c) => !ids.includes(c));
    if (unknown.length) add("CHOICE_KEY_UNKNOWN", { ids: unknown });
    if (item.type === "SINGLE_CHOICE" && key.correct.length !== 1) add("SINGLE_KEY_COUNT");
    if (item.type === "MULTI_CHOICE" && (key.correct.length < 1 || key.correct.length >= ids.length)) add("MULTI_KEY_COUNT");
  }

  if (content.kind === "TFNG" && key.kind === "TFNG") {
    const ids = content.statements.map((s) => s.id);
    if (content.statements.length < 1) add("TFNG_NONE");
    content.statements.forEach((s, i) => {
      if (!s.text.trim()) add("TFNG_EMPTY", { n: i + 1 });
      const v = key.answers[s.id];
      if (v !== "R" && v !== "F" && v !== "NG") add("TFNG_NO_ANSWER", { n: i + 1, ids: [s.id] });
    });
    if (duplicates(ids).length) add("TFNG_ID_REPEAT");
    const unknown = Object.keys(key.answers).filter((id) => !ids.includes(id));
    if (unknown.length) add("TFNG_KEY_UNKNOWN", { ids: unknown });
  }

  if (content.kind === "GAP" && key.kind === "GAP") {
    const markers = gapMarkers(item.prompt);
    const ids = content.gaps.map((g) => g.id);
    if (ids.length === 0) add("GAP_NONE");
    if (duplicates(markers).length) add("GAP_MARKER_REPEAT");
    const missingMarker = ids.filter((id) => !markers.includes(id));
    const strayMarker = markers.filter((m) => !ids.includes(m));
    if (missingMarker.length) add("GAP_NO_MARKER", { ids: missingMarker });
    if (strayMarker.length) add("GAP_STRAY_MARKER", { ids: strayMarker });
    content.gaps.forEach((g, i) => {
      const at = { n: i + 1, ids: [g.id] };
      const accepted = key.answers[g.id];
      if (!accepted || accepted.length === 0 || accepted.some((a) => !a.trim())) add("GAP_NO_ANSWER", at);
      else if (g.choices) {
        if (g.choices.length < 3) add("GAP_FEW_CHOICES", at);
        if (g.choices.some((c) => !c.trim())) add("GAP_CHOICE_EMPTY", at);
        if (duplicates(filled(g.choices)).length) add("GAP_CHOICE_REPEAT", at);
        if (!accepted.some((a) => g.choices!.includes(a))) add("GAP_ANSWER_NOT_CHOICE", at);
      }
    });
    const unknown = Object.keys(key.answers).filter((id) => !ids.includes(id));
    if (unknown.length) add("GAP_KEY_UNKNOWN", { ids: unknown });
  }

  if (content.kind === "MATCHING" && key.kind === "MATCHING") {
    const left = content.left.map((l) => l.id);
    const right = content.right.map((r) => r.id);
    if (left.length < 2) add("MATCH_FEW_ROWS");
    if (right.length < left.length) add("MATCH_FEW_TARGETS");
    content.left.forEach((l, i) => {
      if (!l.text.trim()) add("MATCH_ROW_EMPTY", { n: i + 1 });
      const target = key.pairs[l.id];
      if (!target || !right.includes(target)) add("MATCH_ROW_NO_TARGET", { n: i + 1, ids: [l.id] });
    });
    const emptyTarget = content.right.findIndex((r) => !r.text.trim());
    if (emptyTarget >= 0) add("MATCH_TARGET_EMPTY", { n: emptyTarget + 1 });
    if (duplicates([...left, ...right]).length) add("MATCH_ID_REPEAT");
    if (duplicates(filled(content.left.map((l) => l.text))).length) add("MATCH_ROW_TEXT_REPEAT");
    if (duplicates(filled(content.right.map((r) => r.text))).length) add("MATCH_TARGET_TEXT_REPEAT");
    const unknown = Object.keys(key.pairs).filter((id) => !left.includes(id));
    if (unknown.length) add("MATCH_KEY_UNKNOWN_ROW", { ids: unknown });
  }

  if (content.kind === "SHORT_TEXT" && key.kind === "SHORT_TEXT") {
    if (key.accepted.length === 0 || key.accepted.some((a) => !a.trim())) add("SHORT_NO_ANSWER");
    if (!(content.maxChars >= 1 && content.maxChars <= SHORT_TEXT_MAX_CHARS)) add("SHORT_LENGTH");
  }

  if (content.kind === "WRITING") {
    if (content.minWords < 10 || content.maxWords <= content.minWords) add("WRITING_RANGE");
    if (!item.rubric || item.rubric.contentPoints.length === 0) add("WRITING_POINTS");
  }

  if (content.kind === "SPEAKING") {
    if (content.answerSeconds < 20 || content.answerSeconds > 600) add("SPEAKING_ANSWER_TIME");
    if (content.thinkSeconds < 0 || content.thinkSeconds > 300) add("SPEAKING_THINK_TIME");
    if (content.maxTakes < 1 || content.maxTakes > 3) add("SPEAKING_TAKES");
    if (!item.rubric || item.rubric.contentPoints.length === 0) add("SPEAKING_POINTS");
  }

  return out;
}

const list = (p: ItemProblem) => (p.ids ?? []).join(",");
const one = (p: ItemProblem) => p.ids?.[0] ?? String(p.n ?? "");

/** The English sentence of a problem, as the engine and its tests have always read it. */
export function problemText(p: ItemProblem): string {
  switch (p.code) {
    case "TYPE_UNKNOWN":
      return `unknown item type ${p.detail ?? ""}`;
    case "PROMPT_EMPTY":
      return "prompt is empty";
    case "CONTENT_KIND":
      return `content kind ${p.detail ?? ""}`;
    case "KEY_KIND":
      return `key kind ${p.detail ?? ""}`;
    case "CHOICE_TOO_FEW":
      return "a choice item needs at least three options";
    case "CHOICE_ID_REPEAT":
      return "option ids repeat";
    case "CHOICE_TEXT_REPEAT":
      return "option texts repeat";
    case "CHOICE_EMPTY":
      return "an option is empty";
    case "CHOICE_KEY_UNKNOWN":
      return `key names unknown options ${list(p)}`;
    case "SINGLE_KEY_COUNT":
      return "a single choice item has exactly one correct option";
    case "MULTI_KEY_COUNT":
      return "a multi choice item has at least one correct and one wrong option";
    case "TFNG_NONE":
      return "no statements";
    case "TFNG_NO_ANSWER":
      return `statement ${one(p)} has no answer`;
    case "TFNG_ID_REPEAT":
      return "statement ids repeat";
    case "TFNG_EMPTY":
      return "a statement is empty";
    case "TFNG_KEY_UNKNOWN":
      return `key names unknown statements ${list(p)}`;
    case "GAP_NONE":
      return "no gaps";
    case "GAP_MARKER_REPEAT":
      return "a gap marker repeats in the prompt";
    case "GAP_NO_MARKER":
      return `gaps without a marker: ${list(p)}`;
    case "GAP_STRAY_MARKER":
      return `markers without a gap: ${list(p)}`;
    case "GAP_NO_ANSWER":
      return `gap ${one(p)} has no accepted answer`;
    case "GAP_FEW_CHOICES":
      return `gap ${one(p)} needs at least three choices`;
    case "GAP_CHOICE_REPEAT":
      return `gap ${one(p)} choices repeat`;
    case "GAP_CHOICE_EMPTY":
      return `gap ${one(p)} has an empty choice`;
    case "GAP_ANSWER_NOT_CHOICE":
      return `gap ${one(p)} answer is not among its choices`;
    case "GAP_KEY_UNKNOWN":
      return `key names unknown gaps ${list(p)}`;
    case "MATCH_FEW_ROWS":
      return "matching needs at least two rows";
    case "MATCH_FEW_TARGETS":
      return "matching needs at least as many targets as rows";
    case "MATCH_ROW_NO_TARGET":
      return `row ${one(p)} has no valid target`;
    case "MATCH_ID_REPEAT":
      return "matching ids repeat";
    case "MATCH_ROW_EMPTY":
      return "a matching row is empty";
    case "MATCH_TARGET_EMPTY":
      return "a matching target is empty";
    case "MATCH_ROW_TEXT_REPEAT":
      return "matching row texts repeat";
    case "MATCH_TARGET_TEXT_REPEAT":
      return "matching target texts repeat";
    case "MATCH_KEY_UNKNOWN_ROW":
      return `key pairs unknown rows ${list(p)}`;
    case "SHORT_NO_ANSWER":
      return "short text needs accepted answers";
    case "SHORT_LENGTH":
      return `short text length must be 1 to ${SHORT_TEXT_MAX_CHARS} characters`;
    case "WRITING_RANGE":
      return "writing word range is not sensible";
    case "WRITING_POINTS":
      return "writing needs content points";
    case "SPEAKING_ANSWER_TIME":
      return "speaking answer time must be 20 to 600 seconds";
    case "SPEAKING_THINK_TIME":
      return "speaking think time must be 0 to 300 seconds";
    case "SPEAKING_TAKES":
      return "speaking takes must be 1 to 3";
    case "SPEAKING_POINTS":
      return "speaking needs content points";
  }
}

export function validateItem(item: ValidatableItem): string[] {
  return itemProblems(item).map(problemText);
}
