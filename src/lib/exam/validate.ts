import { typedMatches } from "./item-scoring";
import { textGapKindOf, type ItemContent, type ItemKey, type ItemRubric, type ItemType } from "./types";

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
  /** Turns on the MC cloze and word-bank rules (`grammar.cloze`, `grammar.wordbank`). Missing: no text rules. */
  skillTag?: string | null;
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
  "TFNG_TWO_WAY_NG",
  "WORDING_KIND",
  "PICK_KIND",
  "PICK_RANGE",
  "PICK_KEY_COUNT",
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
  "GAP_ONE_ANSWER",
  "CLOZE_CHOICE_COUNT",
  "WORDBANK_CHOICES",
  "WORDBANK_ANSWER_NOT_WORD",
  "WORDBANK_DISTRACTOR_NOT_WORD",
  "WORDBANK_FEW_DISTRACTORS",
  "WORDBANK_DISTRACTOR_IS_ANSWER",
  "WORDBANK_DISTRACTOR_REPEAT",
  "WORDBANK_ANSWER_VARIANT",
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
  "STUDENT_POINTS_COUNT",
  "STUDENT_POINT_TEXT",
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

/** Fewest distractors a word bank needs, so the last gap is never a giveaway. */
export const WORD_BANK_MIN_DISTRACTORS = 3;

/** One whole word: no inner space. */
const isWholeWord = (w: string) => /^\S+$/u.test(w.trim());

/** At most this many "cover these points" lines are shown to the student. */
export const STUDENT_POINTS_MAX = 6;
/** Each of them stays one short line. */
export const STUDENT_POINT_MAX_CHARS = 80;

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

  // `wording` belongs to true/false items and `pick` to multi choice ones; elsewhere they would be silently ignored.
  const loose = content as { wording?: unknown; pick?: unknown };
  if (loose.wording !== undefined && !(content.kind === "TFNG" && loose.wording === "JA_NEIN")) add("WORDING_KIND");

  if (content.kind === "CHOICE" && key.kind === "CHOICE" && content.pick !== undefined) {
    if (item.type !== "MULTI_CHOICE") add("PICK_KIND");
    else {
      const max = content.options.length - 1;
      if (!Number.isInteger(content.pick) || content.pick < 2 || content.pick > max) add("PICK_RANGE", { detail: String(max) });
      else if (key.correct.length !== content.pick) add("PICK_KEY_COUNT", { detail: `${content.pick}/${key.correct.length}` });
    }
  } else if (loose.pick !== undefined) add("PICK_KIND");

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
    const ng = content.statements.filter((s) => key.answers[s.id] === "NG").map((s) => s.id);
    if (content.twoWay && ng.length) add("TFNG_TWO_WAY_NG", { ids: ng });
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
    textGapProblems(textGapKindOf({ skillTag: item.skillTag ?? "" }), content, key, add);
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

  // Optional, but when a writing or speaking task names points for the student they stay short.
  const studentPoints = content.kind === "WRITING" || content.kind === "SPEAKING" ? item.rubric?.studentPoints : undefined;
  if (studentPoints) {
    if (studentPoints.length > STUDENT_POINTS_MAX) add("STUDENT_POINTS_COUNT");
    studentPoints.forEach((p, i) => {
      if (!p.trim() || p.trim().length > STUDENT_POINT_MAX_CHARS) add("STUDENT_POINT_TEXT", { n: i + 1 });
    });
  }

  return out;
}

/**
 * MC cloze and word bank rules (spec 2026-10-18), on top of the gap rules.
 * Cloze: one answer per gap and exactly four choices that differ even when
 * read as the scorer reads them (`typedMatches`). Word bank: one whole-word
 * answer per gap, no choices, at least three whole-word distractors, none
 * equal to an answer or to another distractor (all read as the scorer reads
 * them, so case, spacing and ß do not make a new word: a pool word shown in
 * two spellings would mark itself as an answer). Two gaps may share an answer
 * only when it is spelled exactly alike: the pool then holds that word twice,
 * as two identical chips (see `wordBankWords`).
 */
function textGapProblems(
  kind: ReturnType<typeof textGapKindOf>,
  content: Extract<ItemContent, { kind: "GAP" }>,
  key: Extract<ItemKey, { kind: "GAP" }>,
  add: (code: ItemProblemCode, extra?: Omit<ItemProblem, "code">) => void,
) {
  if (kind !== "CLOZE" && kind !== "WORDBANK") return;
  content.gaps.forEach((g, i) => {
    const at = { n: i + 1, ids: [g.id] };
    const accepted = key.answers[g.id] ?? [];
    if (accepted.length > 1) add("GAP_ONE_ANSWER", at);
    if (kind === "CLOZE") {
      const choices = g.choices ?? [];
      if (choices.length !== 4) add("CLOZE_CHOICE_COUNT", at);
      // The plain repeat check already reports texts equal up to case and spaces.
      else if (!duplicates(filled(choices)).length && choices.some((c, j) => choices.some((d, k) => k > j && typedMatches(c, [d]))))
        add("GAP_CHOICE_REPEAT", at);
    } else {
      if (g.choices) add("WORDBANK_CHOICES", at);
      if (accepted.some((a) => a.trim() && !isWholeWord(a))) add("WORDBANK_ANSWER_NOT_WORD", at);
    }
  });
  if (kind !== "WORDBANK") return;
  const distractors = (key.distractors ?? []).filter((d) => d.trim());
  if (distractors.length < WORD_BANK_MIN_DISTRACTORS) add("WORDBANK_FEW_DISTRACTORS", { detail: String(distractors.length) });
  const notWords = distractors.filter((d) => !isWholeWord(d));
  if (notWords.length) add("WORDBANK_DISTRACTOR_NOT_WORD", { ids: notWords });
  const answers = content.gaps.flatMap((g) => key.answers[g.id] ?? []);
  const taken = distractors.filter((d) => typedMatches(d, answers));
  if (taken.length) add("WORDBANK_DISTRACTOR_IS_ANSWER", { ids: taken });
  if (distractors.some((d, j) => distractors.some((e, k) => k > j && typedMatches(d, [e])))) add("WORDBANK_DISTRACTOR_REPEAT");
  // The pool words of the answers (first accepted per gap): equal for the scorer but spelled differently is refused.
  const poolAnswers = content.gaps.map((g) => ({ id: g.id, word: (key.answers[g.id]?.[0] ?? "").trim() })).filter((a) => a.word);
  const variants = poolAnswers.filter((a, j) => poolAnswers.some((b, k) => k !== j && b.word !== a.word && typedMatches(a.word, [b.word])));
  if (variants.length) add("WORDBANK_ANSWER_VARIANT", { ids: variants.map((a) => a.id) });
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
    case "TFNG_TWO_WAY_NG":
      return `a Richtig/Falsch item keys "nicht im Text" for ${list(p)}`;
    case "WORDING_KIND":
      return "wording is only for true/false items and only JA_NEIN";
    case "PICK_KIND":
      return "pick is only for multi choice items";
    case "PICK_RANGE":
      return `pick must be a whole number from 2 to ${p.detail ?? "the number of options minus one"}`;
    case "PICK_KEY_COUNT":
      return `pick and the number of correct options differ (${p.detail ?? ""})`;
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
    case "GAP_ONE_ANSWER":
      return `gap ${one(p)} needs exactly one answer`;
    case "CLOZE_CHOICE_COUNT":
      return `cloze gap ${one(p)} needs exactly four choices`;
    case "WORDBANK_CHOICES":
      return `word bank gap ${one(p)} has choices`;
    case "WORDBANK_ANSWER_NOT_WORD":
      return `word bank gap ${one(p)} answer is not one whole word`;
    case "WORDBANK_DISTRACTOR_NOT_WORD":
      return `word bank distractors are not whole words: ${list(p)}`;
    case "WORDBANK_FEW_DISTRACTORS":
      return `a word bank needs at least ${WORD_BANK_MIN_DISTRACTORS} distractors`;
    case "WORDBANK_DISTRACTOR_IS_ANSWER":
      return `word bank distractors equal an answer: ${list(p)}`;
    case "WORDBANK_DISTRACTOR_REPEAT":
      return "word bank distractors repeat";
    case "WORDBANK_ANSWER_VARIANT":
      return `word bank answers differ only in spelling or case: ${list(p)}`;
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
    case "STUDENT_POINTS_COUNT":
      return `at most ${STUDENT_POINTS_MAX} points for the student`;
    case "STUDENT_POINT_TEXT":
      return `point ${p.n ?? 0} for the student must be 1 to ${STUDENT_POINT_MAX_CHARS} characters`;
  }
}

export function validateItem(item: ValidatableItem): string[] {
  return itemProblems(item).map(problemText);
}
