import { parseDelimited, toCsv, type Delimiter } from "./bank-csv";
import { isWithin, parseWithin, type Within } from "./difficulty";
import { cleanText } from "./item-generation";
import { CEFR_LEVELS, type Cefr, type ItemContent, type ItemKey, type TfngValue } from "./types";
import { gapMarkers, itemProblems, type ItemProblem } from "./validate";

/**
 * A school's own questions from a spreadsheet: one row per question, one
 * header row naming the columns. Pure, so the upload wizard checks a file in
 * the browser and the server checks the very same rows again before it
 * writes anything.
 *
 * Columns (the header may be in Turkish or English, in any order; only `type`
 * and `question` are required):
 *
 *   type        SINGLE_CHOICE, MULTI_CHOICE, TRUE_FALSE_NG, GAP_FILL, MATCHING,
 *               SHORT_TEXT, or their Turkish names
 *   section     Dilbilgisi / Okuma / Dinleme (else the file's default)
 *   level       A1-C2 (else the file's default)
 *   difficulty  Kolay / Orta / Zor (else the file's default)
 *   text_title, text
 *               an optional shared reading text or listening script. Rows with
 *               the same title share one text; the text itself is written once.
 *   question    the stem. Gap fill marks each gap with ___ (or {{g1}}).
 *   a .. h      choice: the options; true/false: the statements; gap fill:
 *               the drop-down choices of gap 1, 2, ... ("das | den | dem");
 *               matching: "row = target", or "= target" for an extra target.
 *   answer      choice: the letter(s) ("b", "a, c") or the option's text;
 *               true/false: R / F / NG per statement ("R, F, NG"); gap fill:
 *               the answer per gap, gaps split by ";", spellings by "|";
 *               short text: accepted answers split by "|".
 *   explanation, skill   optional.
 */

export const OPTION_COLUMNS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export type OptionColumn = (typeof OPTION_COLUMNS)[number];

export const SHEET_COLUMNS = [
  "type",
  "section",
  "level",
  "difficulty",
  "text_title",
  "text",
  "question",
  ...OPTION_COLUMNS,
  "answer",
  "explanation",
  "skill",
] as const;
export type SheetColumn = (typeof SHEET_COLUMNS)[number];

export const IMPORT_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE_NG", "GAP_FILL", "MATCHING", "SHORT_TEXT"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const IMPORT_SECTIONS = ["GRAMMAR", "READING", "LISTENING"] as const;
export type ImportSection = (typeof IMPORT_SECTIONS)[number];

/** Most rows one file may bring. A server action body is capped at 1 MB too. */
export const MAX_IMPORT_ROWS = 500;
/** Longest cell kept; a reading text is a few thousand characters. */
export const MAX_CELL = 12_000;
/** Answer length a short text item allows when it is imported. */
export const SHORT_TEXT_IMPORT_MAX_CHARS = 200;

export type SheetRow = { line: number; cells: Partial<Record<SheetColumn, string>> };

export type ImportSettings = { section: ImportSection; level: Cefr; within: Within };
export type RowOverride = Partial<ImportSettings>;

export const ROW_PROBLEM_CODES = [
  "TYPE_MISSING",
  "TYPE_UNKNOWN",
  "SECTION_UNKNOWN",
  "SECTION_NOT_OBJECTIVE",
  "LEVEL_UNKNOWN",
  "DIFFICULTY_UNKNOWN",
  "QUESTION_MISSING",
  "ANSWER_MISSING",
  "ANSWER_UNKNOWN_OPTION",
  "TFNG_ANSWER_COUNT",
  "TFNG_ANSWER_UNKNOWN",
  "GAP_NONE",
  "GAP_ANSWER_COUNT",
  "MATCH_CELL_FORMAT",
  "TEXT_WITHOUT_BODY",
  "TEXT_CONFLICT",
  "TEXT_IN_GRAMMAR",
  "TEXT_SECTION_MIXED",
  "LISTENING_WITHOUT_TEXT",
  "LISTENING_SPEAKERS",
] as const;
export type RowProblemCode = (typeof ROW_PROBLEM_CODES)[number];

/** A problem of one row: in the sheet itself, or in the question it makes (validateItem's codes). */
export type RowIssue =
  | { kind: "row"; code: RowProblemCode; value?: string; expected?: number; got?: number }
  | { kind: "item"; problem: ItemProblem };

export type SheetCode = "EMPTY" | "NO_HEADER" | "NO_TYPE_COLUMN" | "NO_QUESTION_COLUMN" | "UNTERMINATED" | "TOO_MANY_ROWS";

export type Sheet =
  | { ok: true; rows: SheetRow[]; ignoredColumns: string[]; delimiter: Delimiter }
  | { ok: false; code: SheetCode };

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** Lower case, Turkish and German letters folded to ASCII, anything else dropped. */
export function fold(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ä/g, "a")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<SheetColumn, string[]> = {
  type: ["type", "tip", "sorutipi", "tur", "typ", "itemtype"],
  section: ["section", "bolum", "beceri", "teil", "bereich"],
  level: ["level", "seviye", "cefr", "niveau", "kur"],
  difficulty: ["difficulty", "zorluk", "schwierigkeit", "within"],
  text_title: ["texttitle", "metinbasligi", "baslik", "title", "titel", "metinadi"],
  text: ["text", "metin", "passage", "okumametni", "dinlememetni", "stimulus", "readingtext", "transcript"],
  question: ["question", "soru", "prompt", "sorukoku", "stem", "frage", "aufgabe"],
  a: [],
  b: [],
  c: [],
  d: [],
  e: [],
  f: [],
  g: [],
  h: [],
  answer: ["answer", "cevap", "dogrucevap", "yanit", "key", "anahtar", "losung", "antwort"],
  explanation: ["explanation", "aciklama", "erklarung", "note", "not"],
  skill: ["skill", "skilltag", "beceri etiketi", "etiket", "tag"],
};

const HEADERS = new Map<string, SheetColumn>();
for (const column of SHEET_COLUMNS) {
  for (const alias of HEADER_ALIASES[column]) HEADERS.set(fold(alias), column);
  if ((OPTION_COLUMNS as readonly string[]).includes(column)) {
    for (const prefix of ["", "option", "secenek", "sik", "opt", "choice"]) HEADERS.set(`${prefix}${column}`, column);
    HEADERS.set(`${column}sikki`, column);
  }
}

export const headerColumn = (raw: string): SheetColumn | null => HEADERS.get(fold(raw)) ?? null;

const TYPE_WORDS: Record<string, ImportType> = {};
const typeWords: Record<ImportType, string[]> = {
  SINGLE_CHOICE: ["single_choice", "single choice", "single", "tek seçimli", "tek secimli", "çoktan seçmeli", "coktan secmeli", "test", "mc", "einfachauswahl"],
  MULTI_CHOICE: ["multi_choice", "multi choice", "multiple choice", "multi", "çok seçimli", "cok secimli", "birden fazla", "mehrfachauswahl"],
  TRUE_FALSE_NG: ["true_false_ng", "tfng", "true false", "doğru/yanlış", "dogru yanlis", "doğru/yanlış/metinde yok", "richtig/falsch", "richtig falsch"],
  GAP_FILL: ["gap_fill", "gap fill", "gap", "boşluk", "bosluk", "boşluk doldurma", "bosluk doldurma", "lückentext", "luckentext", "cloze"],
  MATCHING: ["matching", "match", "eşleştirme", "eslestirme", "zuordnung", "zuordnen"],
  SHORT_TEXT: ["short_text", "short text", "short", "kısa cevap", "kisa cevap", "kısa yanıt", "kurzantwort"],
};
for (const [type, words] of Object.entries(typeWords) as Array<[ImportType, string[]]>) {
  for (const w of words) TYPE_WORDS[fold(w)] = type;
}

const SECTION_WORDS: Record<string, ImportSection | "PRODUCTIVE"> = {};
for (const [section, words] of Object.entries({
  GRAMMAR: ["grammar", "dilbilgisi", "dil bilgisi", "gramer", "grammatik"],
  READING: ["reading", "okuma", "lesen", "leseverstehen"],
  LISTENING: ["listening", "dinleme", "hören", "horen", "hörverstehen"],
  PRODUCTIVE: ["writing", "yazma", "schreiben", "speaking", "konuşma", "konusma", "sprechen"],
}) as Array<[ImportSection | "PRODUCTIVE", string[]]>) {
  for (const w of words) SECTION_WORDS[fold(w)] = section;
}

const TFNG_WORDS: Record<string, TfngValue> = {};
for (const [value, words] of Object.entries({
  R: ["r", "richtig", "d", "doğru", "true", "t", "wahr", "w", "evet"],
  F: ["f", "falsch", "y", "yanlış", "false", "hayır"],
  NG: ["ng", "nicht im text", "nicht gegeben", "metinde yok", "yok", "my", "not given", "nt"],
}) as Array<[TfngValue, string[]]>) {
  for (const w of words) TFNG_WORDS[fold(w)] = value;
}

export const parseType = (raw: string): ImportType | null => TYPE_WORDS[fold(raw)] ?? null;
export const parseLevel = (raw: string): Cefr | null => {
  const v = raw.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(v) ? (v as Cefr) : null;
};

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

/** The question file as rows of named cells. The first non-empty row is the header. */
export function readSheet(text: string): Sheet {
  if (!text.trim()) return { ok: false, code: "EMPTY" };
  const table = parseDelimited(text);
  if (table.unterminated) return { ok: false, code: "UNTERMINATED" };
  const [head, ...body] = table.rows;
  if (!head) return { ok: false, code: "EMPTY" };
  const columns = head.cells.map((c) => headerColumn(c));
  if (!columns.some(Boolean)) return { ok: false, code: "NO_HEADER" };
  if (!columns.includes("type")) return { ok: false, code: "NO_TYPE_COLUMN" };
  if (!columns.includes("question")) return { ok: false, code: "NO_QUESTION_COLUMN" };
  if (body.length > MAX_IMPORT_ROWS) return { ok: false, code: "TOO_MANY_ROWS" };
  const ignoredColumns = head.cells.filter((c, i) => c.trim() && !columns[i]).map((c) => c.trim());
  const rows: SheetRow[] = body.map((r) => {
    const cells: SheetRow["cells"] = {};
    columns.forEach((column, i) => {
      const value = (r.cells[i] ?? "").slice(0, MAX_CELL);
      // A column named twice keeps its first non-empty cell.
      if (column && value.trim() && !cells[column]) cells[column] = value;
    });
    return { line: r.line, cells };
  });
  return { ok: true, rows, ignoredColumns, delimiter: table.delimiter };
}

// ---------------------------------------------------------------------------
// One row
// ---------------------------------------------------------------------------

const cell = (row: SheetRow, column: SheetColumn): string => (row.cells[column] ?? "").trim();
const rowIssue = (code: RowProblemCode, extra: Omit<Extract<RowIssue, { kind: "row" }>, "kind" | "code"> = {}): RowIssue => ({ kind: "row", code, ...extra });

/** What the row's own cells say about section, level and difficulty, and which cells could not be read. */
export function rowCellSettings(row: SheetRow): { values: RowOverride; issues: RowIssue[] } {
  const values: RowOverride = {};
  const issues: RowIssue[] = [];
  const section = cell(row, "section");
  if (section) {
    const s = SECTION_WORDS[fold(section)];
    if (!s) issues.push(rowIssue("SECTION_UNKNOWN", { value: section }));
    else if (s === "PRODUCTIVE") issues.push(rowIssue("SECTION_NOT_OBJECTIVE", { value: section }));
    else values.section = s;
  }
  const level = cell(row, "level");
  if (level) {
    const l = parseLevel(level);
    if (l) values.level = l;
    else issues.push(rowIssue("LEVEL_UNKNOWN", { value: level }));
  }
  const difficulty = cell(row, "difficulty");
  if (difficulty) {
    const w = parseWithin(difficulty);
    if (w) values.within = w;
    else issues.push(rowIssue("DIFFICULTY_UNKNOWN", { value: difficulty }));
  }
  return { values, issues };
}

/** The row's section, level and difficulty: the wizard's choice for the row, else its cell, else the file's default. */
export function resolveSettings(row: SheetRow, defaults: ImportSettings, override: RowOverride = {}): ImportSettings {
  const { values } = rowCellSettings(row);
  return {
    section: override.section ?? values.section ?? defaults.section,
    level: override.level ?? values.level ?? defaults.level,
    within: override.within && isWithin(override.within) ? override.within : (values.within ?? defaults.within),
  };
}

const LETTERS = /^[a-h1-8](?:[\s,;/|+]+[a-h1-8])*$/i;
const letterId = (token: string): string => {
  const t = token.toLowerCase();
  return /^[1-8]$/.test(t) ? OPTION_COLUMNS[Number(t) - 1] : t;
};

/** The option ids an answer cell names: by the whole option text, by letters, or by a list of texts. */
export function choiceAnswer(raw: string, options: Array<{ id: string; text: string }>): { ids: string[]; unknown: string[] } {
  const value = raw.trim();
  const byText = (t: string) => options.find((o) => fold(o.text) === fold(t) && fold(t) !== "")?.id;
  const whole = byText(value);
  if (whole) return { ids: [whole], unknown: [] };
  if (LETTERS.test(value)) {
    const ids = value.split(/[\s,;/|+]+/).filter(Boolean).map(letterId);
    return { ids: [...new Set(ids)], unknown: [] };
  }
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const token of value.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)) {
    const id = byText(token) ?? (/^[a-h1-8]$/i.test(token) ? letterId(token) : undefined);
    if (id) ids.push(id);
    else unknown.push(token);
  }
  return { ids: [...new Set(ids)], unknown };
}

function tfngAnswers(raw: string, count: number): { values: TfngValue[]; unknown: string[] } {
  let tokens = raw.split(/[,;|/\n]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 1 && count > 1) tokens = raw.split(/\s+/).filter(Boolean);
  const values: TfngValue[] = [];
  const unknown: string[] = [];
  for (const t of tokens) {
    const v = TFNG_WORDS[fold(t)];
    if (v) values.push(v);
    else unknown.push(t);
  }
  return { values, unknown };
}

const splitAlternatives = (raw: string) => raw.split("|").map((s) => cleanText(s)).filter(Boolean);
const splitChoices = (raw: string) => {
  const parts = /[|/]/.test(raw) ? raw.split(/[|/]/) : raw.split(",");
  return parts.map((s) => cleanText(s)).filter(Boolean);
};

/** Gap fill's stem with every ___ turned into a {{gN}} marker; a stem that already has markers keeps them. */
export function gapPrompt(question: string): string {
  if (gapMarkers(question).length > 0) return question;
  let n = 0;
  return question.replace(/_{3,}/g, () => `{{g${++n}}}`);
}

const MATCH_SPLIT = /\s*(?:=>|->|→|=)\s*/;

export type RowItem = {
  type: ImportType;
  prompt: string;
  content: ItemContent;
  key: ItemKey;
  explanation: string | null;
  skillTag: string | null;
};

/** The question a row describes, or what keeps it from being one. Section-independent. */
export function rowToItem(row: SheetRow): { item: RowItem | null; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const typeCell = cell(row, "type");
  const type = typeCell ? parseType(typeCell) : null;
  if (!typeCell) issues.push(rowIssue("TYPE_MISSING"));
  else if (!type) issues.push(rowIssue("TYPE_UNKNOWN", { value: typeCell }));
  const question = cleanText(row.cells.question ?? "");
  if (!question) issues.push(rowIssue("QUESTION_MISSING"));
  if (!type || !question) return { item: null, issues };

  const answer = cell(row, "answer");
  const columnCells = OPTION_COLUMNS.map((c) => ({ id: c as string, text: cleanText(row.cells[c] ?? "") }));
  const options = columnCells.filter((o) => o.text);
  let prompt = question;
  let content: ItemContent | null = null;
  let key: ItemKey | null = null;

  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE": {
      content = { kind: "CHOICE", options };
      if (!answer) issues.push(rowIssue("ANSWER_MISSING"));
      else {
        const a = choiceAnswer(answer, options);
        const missing = a.ids.filter((id) => !options.some((o) => o.id === id));
        for (const u of [...a.unknown, ...missing]) issues.push(rowIssue("ANSWER_UNKNOWN_OPTION", { value: u }));
        key = { kind: "CHOICE", correct: a.ids.filter((id) => options.some((o) => o.id === id)) };
      }
      break;
    }
    case "TRUE_FALSE_NG": {
      const statements = options.map((o, i) => ({ id: `s${i + 1}`, text: o.text }));
      content = { kind: "TFNG", statements };
      if (!answer) issues.push(rowIssue("ANSWER_MISSING"));
      else {
        const a = tfngAnswers(answer, statements.length);
        for (const u of a.unknown) issues.push(rowIssue("TFNG_ANSWER_UNKNOWN", { value: u }));
        if (a.unknown.length === 0 && a.values.length !== statements.length)
          issues.push(rowIssue("TFNG_ANSWER_COUNT", { expected: statements.length, got: a.values.length }));
        key = { kind: "TFNG", answers: Object.fromEntries(statements.map((s, i) => [s.id, a.values[i]]).filter(([, v]) => v)) };
      }
      break;
    }
    case "GAP_FILL": {
      prompt = gapPrompt(question);
      const ids = [...new Set(gapMarkers(prompt))];
      if (ids.length === 0) {
        issues.push(rowIssue("GAP_NONE"));
        break;
      }
      content = {
        kind: "GAP",
        gaps: ids.map((id, i) => {
          const choices = splitChoices(columnCells[i]?.text ?? "");
          return choices.length ? { id, choices } : { id };
        }),
      };
      if (!answer) issues.push(rowIssue("ANSWER_MISSING"));
      else {
        const parts = answer.split(/;|\n/).map((p) => p.trim());
        while (parts.length > ids.length && parts[parts.length - 1] === "") parts.pop();
        if (parts.length !== ids.length) issues.push(rowIssue("GAP_ANSWER_COUNT", { expected: ids.length, got: parts.length }));
        key = { kind: "GAP", answers: Object.fromEntries(ids.map((id, i) => [id, splitAlternatives(parts[i] ?? "")])) };
      }
      break;
    }
    case "MATCHING": {
      const rows: Array<{ id: string; text: string; target: string }> = [];
      const targets: Array<{ id: string; text: string }> = [];
      const targetId = (text: string) => {
        const found = targets.find((t) => fold(t.text) === fold(text));
        if (found) return found.id;
        const id = `r${targets.length + 1}`;
        targets.push({ id, text });
        return id;
      };
      columnCells.forEach((c, i) => {
        if (!c.text) return;
        const at = c.text.search(MATCH_SPLIT);
        if (at < 0) {
          issues.push(rowIssue("MATCH_CELL_FORMAT", { value: OPTION_COLUMNS[i] }));
          return;
        }
        const m = MATCH_SPLIT.exec(c.text)!;
        const left = c.text.slice(0, at).trim();
        const right = c.text.slice(at + m[0].length).trim();
        if (!right) {
          issues.push(rowIssue("MATCH_CELL_FORMAT", { value: OPTION_COLUMNS[i] }));
          return;
        }
        const target = targetId(right);
        if (left) rows.push({ id: `l${rows.length + 1}`, text: left, target });
      });
      content = { kind: "MATCHING", left: rows.map(({ id, text }) => ({ id, text })), right: targets };
      key = { kind: "MATCHING", pairs: Object.fromEntries(rows.map((r) => [r.id, r.target])) };
      break;
    }
    case "SHORT_TEXT": {
      content = { kind: "SHORT_TEXT", maxChars: SHORT_TEXT_IMPORT_MAX_CHARS };
      if (!answer) issues.push(rowIssue("ANSWER_MISSING"));
      key = { kind: "SHORT_TEXT", accepted: splitAlternatives(answer) };
      break;
    }
  }

  if (!content || !key) return { item: null, issues };
  const item: RowItem = {
    type,
    prompt,
    content,
    key,
    explanation: cleanText(row.cells.explanation ?? "") || null,
    skillTag: skillTagOf(cell(row, "skill")),
  };
  // A sheet problem usually explains the structural one (an unread answer leaves the key empty): say only the first.
  if (issues.length === 0) for (const problem of itemProblems(item)) issues.push({ kind: "item", problem });
  return { item: issues.length ? null : item, issues };
}

const skillTagOf = (raw: string): string | null => {
  const tag = raw
    .toLowerCase()
    .replace(/[^a-z0-9.\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return tag || null;
};

// ---------------------------------------------------------------------------
// The whole file
// ---------------------------------------------------------------------------

const TURN = /^([^:\n]{1,40}):\s*\S/;

/** The voices of a listening script: one or two "Label: text" speakers, else a monologue (empty). */
export function scriptSpeakers(body: string): { speakers: Array<{ label: string; voice: "A" | "B" }>; tooMany: boolean } {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const labels: string[] = [];
  for (const line of lines) {
    const m = TURN.exec(line);
    if (!m) return { speakers: [], tooMany: false };
    const label = m[1].trim();
    if (!labels.includes(label)) labels.push(label);
  }
  if (labels.length > 2) return { speakers: [], tooMany: true };
  return { speakers: labels.map((label, i) => ({ label, voice: i === 0 ? "A" : "B" })), tooMany: false };
}

/** A title for a text that has none: its first words. */
export function titleFromBody(body: string): string {
  const words = body.replace(/\s+/g, " ").trim().split(" ");
  const head = words.slice(0, 6).join(" ");
  return (words.length > 6 ? `${head} ...` : head).slice(0, 120);
}

export type PlannedText = {
  key: string;
  title: string;
  body: string;
  section: "READING" | "LISTENING";
  level: Cefr;
  speakers: Array<{ label: string; voice: "A" | "B" }> | null;
};

export type PlannedItem = RowItem & {
  line: number;
  section: ImportSection;
  level: Cefr;
  within: Within;
  /** The shared text, by `PlannedText.key`; null for a question on its own. */
  textKey: string | null;
};

export type RowResult = { line: number; settings: ImportSettings; issues: RowIssue[]; item: PlannedItem | null };

export type ImportPlan = { rows: RowResult[]; items: PlannedItem[]; texts: PlannedText[] };

/**
 * Every row checked against the file's defaults and the per-row choices, and
 * the shared texts the valid rows need. Rows are independent: a broken row is
 * reported and left out, the rest still import.
 */
export function planImport(rows: SheetRow[], defaults: ImportSettings, overrides: Record<number, RowOverride> = {}): ImportPlan {
  // Shared texts first: a text is written once and named by its title on the other rows.
  const bodies = new Map<string, { body: string; line: number }>();
  const groupOf = (row: SheetRow): string | null => {
    const title = cleanText(row.cells.text_title ?? "");
    const body = cleanText(row.cells.text ?? "");
    if (title) return `t:${fold(title) || title}`;
    if (body) return `b:${body}`;
    return null;
  };
  for (const row of rows) {
    const g = groupOf(row);
    const body = cleanText(row.cells.text ?? "");
    if (g && body && !bodies.has(g)) bodies.set(g, { body, line: row.line });
  }

  const texts = new Map<string, PlannedText>();
  const results: RowResult[] = rows.map((row) => {
    const own = rowCellSettings(row);
    const override = overrides[row.line] ?? {};
    // A cell the wizard overrides no longer matters.
    const cellIssues = own.issues.filter(
      (i) =>
        !(i.kind === "row" && ((i.code === "LEVEL_UNKNOWN" && override.level) || (i.code === "DIFFICULTY_UNKNOWN" && override.within) || ((i.code === "SECTION_UNKNOWN" || i.code === "SECTION_NOT_OBJECTIVE") && override.section))),
    );
    const settings = resolveSettings(row, defaults, override);
    const built = rowToItem(row);
    const issues = [...cellIssues, ...built.issues];

    const g = groupOf(row);
    let textKey: string | null = null;
    if (g) {
      const shared = bodies.get(g);
      const body = cleanText(row.cells.text ?? "");
      if (!shared) issues.push(rowIssue("TEXT_WITHOUT_BODY"));
      else if (body && body !== shared.body) issues.push(rowIssue("TEXT_CONFLICT"));
      else if (settings.section === "GRAMMAR") issues.push(rowIssue("TEXT_IN_GRAMMAR"));
      else {
        const existing = texts.get(g);
        if (existing && existing.section !== settings.section) issues.push(rowIssue("TEXT_SECTION_MIXED"));
        else if (!existing && issues.length === 0) {
          const title = cleanText(row.cells.text_title ?? "") || titleFromBody(shared.body);
          let speakers: PlannedText["speakers"] = null;
          if (settings.section === "LISTENING") {
            const s = scriptSpeakers(shared.body);
            if (s.tooMany) issues.push(rowIssue("LISTENING_SPEAKERS"));
            speakers = s.speakers;
          }
          if (issues.length === 0) texts.set(g, { key: g, title: title.slice(0, 200), body: shared.body, section: settings.section, level: settings.level, speakers });
        }
        textKey = g;
      }
    } else if (settings.section === "LISTENING") {
      issues.push(rowIssue("LISTENING_WITHOUT_TEXT"));
    }

    const item: PlannedItem | null = issues.length === 0 && built.item ? { ...built.item, line: row.line, ...settings, textKey } : null;
    return { line: row.line, settings, issues, item };
  });
  const items = results.flatMap((r) => (r.item ? [r.item] : []));
  const used = new Set(items.map((i) => i.textKey).filter(Boolean));
  return { rows: results, items, texts: [...texts.values()].filter((t) => used.has(t.key)) };
}

/** Where a row problem's sentence lives: `bankTools.r_<code>` for the sheet, `bankTools.p_<code>` for the question. */
export function issueMessage(issue: RowIssue): { key: string; values: Record<string, string | number> } {
  if (issue.kind === "row") {
    return { key: `r_${issue.code}`, values: { value: issue.value ?? "", expected: issue.expected ?? 0, got: issue.got ?? 0 } };
  }
  return { key: `p_${issue.problem.code}`, values: { n: issue.problem.n ?? 0, ids: (issue.problem.ids ?? []).join(", "), detail: issue.problem.detail ?? "" } };
}

// ---------------------------------------------------------------------------
// The template
// ---------------------------------------------------------------------------

const TEMPLATE_HEADERS: Record<"tr" | "en", Record<string, string>> = {
  tr: { type: "tip", section: "bölüm", level: "seviye", difficulty: "zorluk", text_title: "metin başlığı", text: "metin", question: "soru", answer: "cevap", explanation: "açıklama" },
  en: { type: "type", section: "section", level: "level", difficulty: "difficulty", text_title: "text_title", text: "text", question: "question", answer: "answer", explanation: "explanation" },
};

const TEMPLATE_COLUMNS = ["type", "section", "level", "difficulty", "text_title", "text", "question", "a", "b", "c", "d", "e", "f", "answer", "explanation"] as const;

const NEIGHBOUR_TEXT =
  "Seit März wohnt Frau Keller im zweiten Stock. Sie kommt aus Hamburg und arbeitet als Krankenschwester im Stadtkrankenhaus.\nIhr Mann ist Koch in einem kleinen Restaurant am Markt. Die beiden Kinder, Lena und Max, gehen in die Grundschule in der Lindenstraße. Am Wochenende fährt die Familie oft mit dem Fahrrad an den See.";

type TemplateRow = Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>>;

function templateRows(locale: "tr" | "en"): TemplateRow[] {
  const tr = locale === "tr";
  const sec = (s: ImportSection) => (tr ? { GRAMMAR: "Dilbilgisi", READING: "Okuma", LISTENING: "Dinleme" } : { GRAMMAR: "Grammar", READING: "Reading", LISTENING: "Listening" })[s];
  return [
    {
      type: "SINGLE_CHOICE",
      section: sec("GRAMMAR"),
      level: "A2",
      question: "Gestern ___ ich mit meiner Schwester ins Kino gegangen.",
      a: "bin",
      b: "habe",
      c: "war",
      d: "hatte",
      answer: "a",
      explanation: "Perfekt mit sein: gehen ist ein Verb der Bewegung.",
    },
    {
      type: "MULTI_CHOICE",
      section: sec("GRAMMAR"),
      level: "A2",
      question: "Welche Sätze sind richtig? Mehrere Antworten sind möglich.",
      a: "Ich fahre morgen nach Berlin.",
      b: "Ich fahre morgen in Berlin.",
      c: "Wir sind gestern nach Hause gegangen.",
      d: "Wir haben gestern nach Hause gegangen.",
      answer: "a, c",
    },
    {
      type: "TRUE_FALSE_NG",
      section: sec("READING"),
      level: "A2",
      difficulty: tr ? "Kolay" : "Easy",
      text_title: "Neue Nachbarin",
      text: NEIGHBOUR_TEXT,
      question: "Lesen Sie den Text. Richtig, falsch oder nicht im Text?",
      a: "Frau Keller wohnt seit März im Haus.",
      b: "Frau Keller arbeitet in einem Restaurant.",
      c: "Lena und Max haben einen Hund.",
      answer: "R, F, NG",
    },
    {
      type: "MATCHING",
      section: sec("READING"),
      level: "A2",
      text_title: "Neue Nachbarin",
      question: "Wer macht was? Ordnen Sie zu.",
      a: "Frau Keller = arbeitet im Krankenhaus.",
      b: "Herr Keller = kocht in einem Restaurant.",
      c: "Lena und Max = gehen in die Grundschule.",
      d: "= wohnt im ersten Stock.",
    },
    {
      type: "GAP_FILL",
      section: sec("GRAMMAR"),
      level: "A2",
      question: "Ich interessiere mich ___ Musik und denke oft ___ meinen letzten Urlaub.",
      answer: "für; an",
    },
    {
      type: "GAP_FILL",
      section: sec("GRAMMAR"),
      level: "A2",
      question: "Kannst du mir bitte ___ Buch geben?",
      a: "das | den | dem",
      answer: "das",
    },
    {
      type: "SHORT_TEXT",
      section: sec("GRAMMAR"),
      level: "A2",
      question: "Wie heißt das Gegenteil von „teuer“? Schreiben Sie ein Wort.",
      answer: "billig | günstig",
    },
  ];
}

/** The downloadable example file: one row per question type, in the panel's language. */
export function templateCsv(locale: "tr" | "en"): { text: string; delimiter: Delimiter; filename: string } {
  // Excel in Turkish (and German) reads ";" as the list separator; English Excel reads ",".
  const delimiter: Delimiter = locale === "tr" ? ";" : ",";
  const head = TEMPLATE_COLUMNS.map((c) => TEMPLATE_HEADERS[locale][c] ?? c);
  const rows = templateRows(locale).map((r) => TEMPLATE_COLUMNS.map((c) => r[c] ?? ""));
  return { text: toCsv([head, ...rows], delimiter), delimiter, filename: locale === "tr" ? "kademe-soru-sablonu.csv" : "kademe-question-template.csv" };
}
