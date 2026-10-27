import type { Cefr, ExamMode } from "@/lib/exam/types";

/**
 * Inviting many students at once, pure: the pasted or uploaded list, and the
 * copy and CSV the result screen hands out. The wizard runs it live as the
 * manager types, and the server runs it again on the same text, so the rows
 * the manager saw are the rows that are invited.
 */

/** One batch. A course cohort fits; a whole school year is several batches. */
export const MAX_STUDENT_ROWS = 100;
export const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
/** The longest list text the server reads: every allowed row with room to spare. */
export const MAX_LIST_TEXT = MAX_STUDENT_ROWS * 512;
/** A CSV larger than this is not a class list. */
export const MAX_CSV_BYTES = 256 * 1024;

const EMAIL_RE = /^[^@\s<>",;]+@[^@\s<>",;.]+(\.[^@\s<>",;.]+)+$/;
const ANGLE_EMAIL_RE = /<\s*([^<>\s,;]*@[^<>\s,;]*)\s*>/;
const LINE_BREAK_RE = /\r\n|[\r\n\u2028\u2029]/;
const LEVEL_RE = /^(a1|a2|b1|b2|c1|c2)$/i;
/** Column titles a spreadsheet export starts with; such a first line is skipped, not reported. */
const HEADER_RE = /^(ad|adı|ad soyad|ad-soyad|adsoyad|isim|isim soyisim|öğrenci|öğrenci adı|name|full name|fullname|student|e-?posta|e-?posta adresi|e-?mail|email address|mail|seviye|level|beyan|claimed level)$/i;

export type StudentRowProblem = "NAME" | "EMAIL" | "DUPLICATE";

export type StudentRow = {
  /** The line in the pasted text (1-based), so the manager knows which one to fix. */
  line: number;
  fullName: string;
  email: string;
  /** A CEFR level written on the line (verification exams); null when there is none. */
  claimed: Cefr | null;
  problem: StudentRowProblem | null;
};

export type ParsedStudents = {
  rows: StudentRow[];
  /** More rows than MAX_STUDENT_ROWS: only the first ones are read. */
  tooMany: boolean;
  /** The first line was column titles and was skipped. */
  header: boolean;
};

export const isEmail = (value: string): boolean => {
  const v = value.trim();
  return v.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(v);
};

/** Spaces collapsed, 2 to MAX_NAME_LENGTH characters (an emoji is one), no angle brackets and no "@". The cleaned name, or null. */
export function cleanStudentName(value: string): string | null {
  const name = value.replace(/\s+/g, " ").trim();
  const length = Array.from(name).length;
  return length >= 2 && length <= MAX_NAME_LENGTH && !/[<>@]/.test(name) ? name : null;
}

/** One line split on comma, semicolon or tab outside double quotes; a quoted cell loses its quotes ("" inside is one quote). */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const isHeader = (line: string): boolean => {
  if (line.includes("@")) return false;
  const cells = splitCells(line);
  return cells.length > 0 && cells.some((c) => HEADER_RE.test(c));
};

/**
 * A name typed all in lower case ("kadir ay") is written the usual way
 * ("Kadir Ay"), each word and each part after a hyphen starting with a
 * capital. A name with any capital letter is kept exactly as typed: the
 * teacher chose it (van der Berg, McDonald, KADİR AY). `locale` decides the
 * dotted i: "ilker" is "İlker" in Turkish and "Ilker" in English.
 */
export function tidyStudentName(name: string, locale: "tr" | "en"): string {
  if (name !== name.toLocaleLowerCase(locale)) return name;
  return name.replace(/(^|[\s-])(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase(locale));
}

/**
 * One student per line: a name and an e-mail separated by a comma, semicolon
 * or tab, in either order, or "Ad Soyad <mail>" as a mail program copies it.
 * A CEFR level anywhere on the line (A1 to C2) is that student's claimed
 * level. Spreadsheet column titles on the first line are skipped, other
 * columns after the e-mail (a phone, a class) never enter the name. Blank
 * lines are skipped. A row without a usable name, with a bad e-mail or
 * repeating an earlier e-mail (any letter case) is marked, never dropped,
 * so the manager sees which line to fix. A name typed all in lower case gets
 * its capitals (tidyStudentName) by the rules of `locale`, the manager's
 * language, so the preview and the invitation show the same name.
 */
export function parseStudentRows(text: string, locale: "tr" | "en" = "tr"): ParsedStudents {
  const rows: StudentRow[] = [];
  const seen = new Set<string>();
  let tooMany = false;
  let header = false;
  let first = true;
  const lines = text.replace(/﻿/g, "").split(LINE_BREAK_RE);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    if (first) {
      first = false;
      if (isHeader(lines[i])) {
        header = true;
        continue;
      }
    }
    if (rows.length === MAX_STUDENT_ROWS) {
      tooMany = true;
      break;
    }
    let rest = lines[i];
    let email = "";
    const angle = ANGLE_EMAIL_RE.exec(rest);
    if (angle) {
      email = angle[1];
      rest = rest.replace(angle[0], " ");
    }
    let cells = splitCells(rest);
    const levelAt = cells.findIndex((c) => LEVEL_RE.test(c));
    const claimed = levelAt >= 0 ? (cells[levelAt].toUpperCase() as Cefr) : null;
    if (levelAt >= 0) cells = cells.filter((_, j) => j !== levelAt);
    if (!email) {
      const at = cells.findIndex((c) => c.includes("@"));
      if (at >= 0) {
        email = cells[at];
        // The name is the cells before the e-mail; a sheet that starts with the e-mail has it after.
        cells = at > 0 ? cells.slice(0, at) : cells.slice(1);
      }
    }
    email = email.replace(/^mailto:/i, "").trim();
    const fullName = tidyStudentName(cells.join(" ").replace(/\s+/g, " ").trim(), locale);
    const key = email.toLowerCase();
    const emailOk = isEmail(email);
    const problem: StudentRowProblem | null = !emailOk ? "EMAIL" : cleanStudentName(fullName) === null ? "NAME" : seen.has(key) ? "DUPLICATE" : null;
    if (emailOk) seen.add(key);
    rows.push({ line: i + 1, fullName, email, claimed, problem });
  }
  return { rows, tooMany, header };
}

/** The rows that will be invited; null while any row still has a problem (the manager fixes or deletes the line first). */
export function readyStudents(parsed: ParsedStudents): StudentRow[] | null {
  if (parsed.rows.length === 0 || parsed.tooMany || parsed.rows.some((r) => r.problem)) return null;
  return parsed.rows;
}

/** Why the list step waits, or null when the list can go on. */
export function listWait(parsed: ParsedStudents): "EMPTY" | "PROBLEMS" | "TOO_MANY" | null {
  if (parsed.tooMany) return "TOO_MANY";
  if (parsed.rows.length === 0) return "EMPTY";
  if (parsed.rows.some((r) => r.problem)) return "PROBLEMS";
  return null;
}

/**
 * The verification claim of each row: its own level when the line had one,
 * otherwise the batch's. Placement exams have no claim.
 */
export function claimFor(row: Pick<StudentRow, "claimed">, mode: ExamMode, batch: Cefr | null): Cefr | null {
  if (mode !== "LEVEL_VERIFICATION") return null;
  return row.claimed ?? batch;
}

/**
 * Text bytes from an uploaded CSV. Excel on a Turkish Windows saves CSV in
 * Windows-1254, which is not UTF-8: a file that is not valid UTF-8 is read
 * as Windows-1254 so "Şule Çağlar" survives either way.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    try {
      return new TextDecoder("windows-1254").decode(data);
    } catch {
      return new TextDecoder("latin1").decode(data);
    }
  }
}

/** One invited student on the result screen. */
export type InvitedStudent = { fullName: string; email: string; url: string; expires: string };

/**
 * A spreadsheet must never run a cell as a formula: a name like
 * "=HYPERLINK(...)" is written as text (OWASP CSV injection).
 */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * The result as CSV. The panel's Turkish Excel splits on ";" (comma is the
 * decimal mark there), the English one on ","; the parser above reads both.
 * A byte order mark first, so Excel reads it as UTF-8.
 */
export function studentsCsv(students: readonly InvitedStudent[], headers: readonly [string, string, string, string, string], exam: string, delimiter: ";" | ","): string {
  const cell = (value: string) => {
    const v = safeCell(value.replace(/\r\n|[\r\n]/g, " "));
    return v.includes(delimiter) || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [headers.map(cell).join(delimiter), ...students.map((s) => [s.fullName, s.email, exam, s.url, s.expires].map(cell).join(delimiter))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** "Tümünü kopyala": tab separated with its titles, so it pastes into a spreadsheet as columns and reads as a list. */
export function studentsTsv(students: readonly InvitedStudent[], headers: readonly [string, string, string]): string {
  const cell = (value: string) => value.replace(/[\t\r\n]+/g, " ").trim();
  return [headers.map(cell).join("\t"), ...students.map((s) => [s.fullName, s.email, s.url].map(cell).join("\t"))].join("\n");
}

/**
 * The invite wizard: the list, the exam, a last look; the student's screen
 * language and the exam window (opening time, last entry) are side steps
 * opened from the last look's "Değiştir".
 */
export const INVITE_STEPS = ["list", "exam", "review", "language", "window"] as const;
export type InviteStep = (typeof INVITE_STEPS)[number];
export const INVITE_PATH = ["list", "exam", "review"] as const;

/** The first step that is not ready, so the address never runs ahead of a missing decision (W3). */
export function inviteFirstInvalid(input: { listReady: boolean; examReady: boolean }): InviteStep | null {
  if (!input.listReady) return "list";
  if (!input.examReady) return "exam";
  return null;
}

/** The exam step waits for a choice and, on a verification exam, for a claim on every row. */
export function examWait(input: { mode: ExamMode | null; rows: readonly Pick<StudentRow, "claimed">[]; batch: Cefr | null }): "EXAM" | "CLAIM" | null {
  const mode = input.mode;
  if (!mode) return "EXAM";
  if (mode === "LEVEL_VERIFICATION" && input.rows.some((r) => !claimFor(r, mode, input.batch))) return "CLAIM";
  return null;
}

/** Rows whose e-mail already has an open invitation: a new one is a second exam, so the last look names them. */
export function alreadyInvited(rows: readonly Pick<StudentRow, "email">[], openEmails: readonly string[]): string[] {
  const open = new Set(openEmails.map((e) => e.trim().toLowerCase()));
  return rows.map((r) => r.email.trim()).filter((e) => open.has(e.toLowerCase()));
}

/** The downloaded file's name: the exam and the day, in plain ASCII. */
export function csvFileName(exam: string, day: string): string {
  const slug = exam
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "sinav"}-davetler-${day}.csv`;
}
